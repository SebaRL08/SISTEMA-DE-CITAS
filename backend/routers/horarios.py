from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from backend.database import db_cursor
from backend.schemas import HorarioEstadoIn, HorarioIn
from backend.security import current_user, require_staff
from backend.utils import proveedor_destino

router = APIRouter(prefix="/api/horarios", tags=["Horarios"])

COLUMNAS = (
    "h.id_horario, h.id_proveedor, u.nombre AS proveedor, h.fecha, "
    "LEFT(CAST(h.hora_inicio AS CHAR), 5) AS hora_inicio, "
    "LEFT(CAST(h.hora_fin AS CHAR), 5) AS hora_fin, h.estado"
)
ORIGEN = "FROM horarios h JOIN usuarios u ON u.id_usuario = h.id_proveedor"


def _horario_editable(cur, id_horario, user):
    cur.execute(
        "SELECT id_proveedor, estado FROM horarios WHERE id_horario = %s FOR UPDATE", (id_horario,)
    )
    h = cur.fetchone()
    if not h:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    if user["rol"] != "administrador" and h["id_proveedor"] != user["id_usuario"]:
        raise HTTPException(status_code=403, detail="Ese horario no es tuyo")
    return h


@router.get("")
def listar_horarios(id_proveedor: Optional[int] = None, fecha: Optional[date] = None,
                    solo_disponibles: bool = False, incluir_pasados: bool = False,
                    user=Depends(current_user)):
    """Cliente: solo libres y futuros del proveedor pedido. Proveedor: los suyos.
    Administrador: todos (filtrables por proveedor)."""
    cond, params = [], []
    if user["rol"] == "proveedor":
        cond.append("h.id_proveedor = %s")
        params.append(user["id_usuario"])
    elif id_proveedor:
        cond.append("h.id_proveedor = %s")
        params.append(id_proveedor)
    if user["rol"] == "cliente":
        cond.append("u.activo = 1 AND u.rol = 'proveedor'")
        solo_disponibles = True
        incluir_pasados = False
    if solo_disponibles:
        cond.append("h.estado = 'disponible'")
    if not incluir_pasados:
        cond.append("h.fecha >= CURDATE()")
    if fecha:
        cond.append("h.fecha = %s")
        params.append(fecha)
    where = "WHERE " + " AND ".join(cond) if cond else ""
    with db_cursor() as cur:
        cur.execute(
            f"SELECT {COLUMNAS} {ORIGEN} {where} ORDER BY h.fecha, h.hora_inicio", tuple(params)
        )
        return cur.fetchall()


@router.post("", status_code=201)
def crear_horarios(datos: HorarioIn, user=Depends(require_staff)):
    """Crea un bloque único o varios (si se indica intervalo_minutos).
    Ej.: 09:00 a 12:00 cada 30 min genera 6 horarios. Omite los que se crucen."""
    id_prov = proveedor_destino(user, datos.id_proveedor)
    if datos.hora_fin <= datos.hora_inicio:
        raise HTTPException(status_code=422, detail="La hora de fin debe ser posterior a la de inicio")
    if datos.fecha < date.today():
        raise HTTPException(status_code=422, detail="No se pueden crear horarios en fechas pasadas")

    inicio = datetime.combine(datos.fecha, datos.hora_inicio)
    fin = datetime.combine(datos.fecha, datos.hora_fin)
    paso = timedelta(minutes=datos.intervalo_minutos) if datos.intervalo_minutos else fin - inicio

    bloques, actual = [], inicio
    while actual + paso <= fin:
        bloques.append((actual.time(), (actual + paso).time()))
        actual += paso
    if not bloques:
        raise HTTPException(status_code=422, detail="El intervalo es mayor que el rango indicado")
    if len(bloques) > 48:
        raise HTTPException(status_code=422, detail="Máximo 48 horarios por vez")

    creados = 0
    with db_cursor(commit=True) as cur:
        for ini, fi in bloques:
            cur.execute(
                "SELECT id_horario FROM horarios "
                "WHERE id_proveedor=%s AND fecha=%s AND hora_inicio < %s AND hora_fin > %s",
                (id_prov, datos.fecha, fi, ini),
            )
            if cur.fetchone():
                continue
            cur.execute(
                "INSERT INTO horarios (id_proveedor, fecha, hora_inicio, hora_fin) VALUES (%s,%s,%s,%s)",
                (id_prov, datos.fecha, ini, fi),
            )
            creados += 1
    return {"creados": creados, "omitidos": len(bloques) - creados}


@router.patch("/{id_horario}/estado")
def cambiar_estado(id_horario: int, datos: HorarioEstadoIn, user=Depends(require_staff)):
    """Bloquear o desbloquear (los reservados no se tocan: primero se cancela la cita)."""
    with db_cursor(commit=True) as cur:
        horario = _horario_editable(cur, id_horario, user)
        if horario["estado"] == "reservado":
            raise HTTPException(status_code=409, detail="El horario está reservado; cancela la cita primero")
        cur.execute("UPDATE horarios SET estado=%s WHERE id_horario=%s", (datos.estado, id_horario))
    return {"mensaje": f"Horario {datos.estado}"}


@router.delete("/{id_horario}")
def eliminar_horario(id_horario: int, user=Depends(require_staff)):
    with db_cursor(commit=True) as cur:
        horario = _horario_editable(cur, id_horario, user)
        if horario["estado"] == "reservado":
            raise HTTPException(status_code=409, detail="El horario está reservado; cancela la cita primero")
        cur.execute("SELECT 1 FROM citas WHERE id_horario = %s LIMIT 1", (id_horario,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Tiene citas en el historial; mejor bloquéalo")
        cur.execute("DELETE FROM horarios WHERE id_horario = %s", (id_horario,))
    return {"mensaje": "Horario eliminado"}
