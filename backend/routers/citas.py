from fastapi import APIRouter, Depends, HTTPException
from backend.database import db_cursor
from backend.schemas import CitaEstadoIn, CitaIn
from backend.security import current_user, require_admin

router = APIRouter(prefix="/api/citas", tags=["Citas"])

CONSULTA = """
    SELECT c.id_cita, c.estado, c.fecha_creacion,
           u.nombre AS cliente, s.nombre AS servicio,
           h.fecha, LEFT(CAST(h.hora_inicio AS CHAR), 5) AS hora_inicio,
           LEFT(CAST(h.hora_fin AS CHAR), 5) AS hora_fin
    FROM citas c
    JOIN usuarios u  ON u.id_usuario  = c.id_usuario
    JOIN servicios s ON s.id_servicio = c.id_servicio
    JOIN horarios h  ON h.id_horario  = c.id_horario
"""


@router.post("", status_code=201)
def reservar(datos: CitaIn, user=Depends(current_user)):
    if user["rol"] != "cliente":
        raise HTTPException(status_code=403, detail="Solo los clientes pueden reservar")
    with db_cursor(commit=True) as cur:
        # FOR UPDATE bloquea la fila: dos clientes no pueden reservar a la vez el mismo horario
        cur.execute("SELECT estado FROM horarios WHERE id_horario=%s FOR UPDATE", (datos.id_horario,))
        horario = cur.fetchone()
        if not horario:
            raise HTTPException(status_code=404, detail="Horario no encontrado")
        if horario["estado"] != "disponible":
            raise HTTPException(status_code=409, detail="Ese horario ya no está disponible")
        cur.execute("SELECT activo FROM servicios WHERE id_servicio=%s", (datos.id_servicio,))
        servicio = cur.fetchone()
        if not servicio or not servicio["activo"]:
            raise HTTPException(status_code=404, detail="Servicio no disponible")
        cur.execute(
            "INSERT INTO citas (id_usuario, id_servicio, id_horario, estado) VALUES (%s,%s,%s,'confirmada')",
            (user["id_usuario"], datos.id_servicio, datos.id_horario),
        )
        id_cita = cur.lastrowid
        cur.execute("UPDATE horarios SET estado='reservado' WHERE id_horario=%s", (datos.id_horario,))
    return {"id_cita": id_cita, "mensaje": "Cita confirmada"}


@router.get("/mis-citas")
def mis_citas(user=Depends(current_user)):
    with db_cursor() as cur:
        cur.execute(CONSULTA + " WHERE c.id_usuario = %s ORDER BY h.fecha DESC, h.hora_inicio",
                    (user["id_usuario"],))
        return cur.fetchall()


@router.get("")
def todas_las_citas(_=Depends(require_admin)):
    with db_cursor() as cur:
        cur.execute(CONSULTA + " ORDER BY h.fecha DESC, h.hora_inicio")
        return cur.fetchall()


@router.patch("/{id_cita}/estado")
def cambiar_estado(id_cita: int, datos: CitaEstadoIn, user=Depends(current_user)):
    es_admin = user["rol"] == "administrador"
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT id_usuario, id_horario, estado FROM citas WHERE id_cita=%s FOR UPDATE", (id_cita,))
        cita = cur.fetchone()
        if not cita:
            raise HTTPException(status_code=404, detail="Cita no encontrada")
        if not es_admin and cita["id_usuario"] != user["id_usuario"]:
            raise HTTPException(status_code=403, detail="Esa cita no es tuya")
        if not es_admin and datos.estado != "cancelada":
            raise HTTPException(status_code=403, detail="Solo puedes cancelar tus citas")
        if cita["estado"] != "confirmada":
            raise HTTPException(status_code=409, detail="Solo se pueden modificar citas confirmadas")
        cur.execute("UPDATE citas SET estado=%s WHERE id_cita=%s", (datos.estado, id_cita))
        if datos.estado == "cancelada":  # el horario vuelve a quedar libre
            cur.execute("UPDATE horarios SET estado='disponible' WHERE id_horario=%s", (cita["id_horario"],))
    return {"mensaje": f"Cita {datos.estado}"}
