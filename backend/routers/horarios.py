from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from backend.database import db_cursor
from backend.schemas import HorarioEstadoIn, HorarioIn
from backend.security import current_user, require_admin

router = APIRouter(prefix="/api/horarios", tags=["Horarios"])

COLUMNAS = (
    "id_horario, fecha, LEFT(CAST(hora_inicio AS CHAR), 5) AS hora_inicio, "
    "LEFT(CAST(hora_fin AS CHAR), 5) AS hora_fin, estado"
)


@router.get("")
def listar_horarios(fecha: Optional[date] = None, solo_disponibles: bool = False,
                    user=Depends(current_user)):
    """Cliente: solo ve horarios disponibles y futuros. Administrador: ve todos."""
    if user["rol"] != "administrador":
        solo_disponibles = True
    condiciones, params = [], []
    if solo_disponibles:
        condiciones.append("estado = 'disponible' AND fecha >= CURDATE()")
    if fecha:
        condiciones.append("fecha = %s")
        params.append(fecha)
    where = "WHERE " + " AND ".join(condiciones) if condiciones else ""
    with db_cursor() as cur:
        cur.execute(f"SELECT {COLUMNAS} FROM horarios {where} ORDER BY fecha, hora_inicio", tuple(params))
        return cur.fetchall()


@router.post("", status_code=201)
def crear_horario(datos: HorarioIn, _=Depends(require_admin)):
    if datos.hora_fin <= datos.hora_inicio:
        raise HTTPException(status_code=422, detail="La hora de fin debe ser posterior a la de inicio")
    if datos.fecha < date.today():
        raise HTTPException(status_code=422, detail="No se pueden crear horarios en fechas pasadas")
    with db_cursor(commit=True) as cur:
        cur.execute(
            "SELECT id_horario FROM horarios WHERE fecha=%s AND hora_inicio < %s AND hora_fin > %s",
            (datos.fecha, datos.hora_fin, datos.hora_inicio),
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Ese horario se cruza con otro ya registrado")
        cur.execute(
            "INSERT INTO horarios (fecha, hora_inicio, hora_fin) VALUES (%s,%s,%s)",
            (datos.fecha, datos.hora_inicio, datos.hora_fin),
        )
        return {"id_horario": cur.lastrowid, "mensaje": "Horario creado"}


@router.patch("/{id_horario}/estado")
def cambiar_estado(id_horario: int, datos: HorarioEstadoIn, _=Depends(require_admin)):
    """El administrador puede bloquear o desbloquear (no tocar los reservados)."""
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT estado FROM horarios WHERE id_horario=%s FOR UPDATE", (id_horario,))
        horario = cur.fetchone()
        if not horario:
            raise HTTPException(status_code=404, detail="Horario no encontrado")
        if horario["estado"] == "reservado":
            raise HTTPException(status_code=409, detail="El horario está reservado; cancela la cita primero")
        cur.execute("UPDATE horarios SET estado=%s WHERE id_horario=%s", (datos.estado, id_horario))
    return {"mensaje": f"Horario {datos.estado}"}
