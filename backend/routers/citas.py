from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from backend.database import db_cursor
from backend.schemas import CitaEstadoIn, CitaIn
from backend.security import current_user

router = APIRouter(prefix="/api/citas", tags=["Citas"])

CONSULTA = """
    SELECT c.id_cita, c.estado, c.fecha_creacion,
           u.nombre AS cliente, p.nombre AS proveedor,
           s.nombre AS servicio, s.duracion_minutos,
           h.fecha, LEFT(CAST(h.hora_inicio AS CHAR), 5) AS hora_inicio,
           LEFT(CAST(h.hora_fin AS CHAR), 5) AS hora_fin
    FROM citas c
    JOIN usuarios u  ON u.id_usuario  = c.id_usuario
    JOIN servicios s ON s.id_servicio = c.id_servicio
    JOIN usuarios p  ON p.id_usuario  = s.id_proveedor
    JOIN horarios h  ON h.id_horario  = c.id_horario
"""


@router.post("", status_code=201)
def reservar(datos: CitaIn, user=Depends(current_user)):
    if user["rol"] != "cliente":
        raise HTTPException(status_code=403, detail="Solo los clientes pueden reservar")
    with db_cursor(commit=True) as cur:
        # FOR UPDATE bloquea la fila: dos clientes no pueden reservar a la vez el mismo horario
        cur.execute(
            "SELECT id_proveedor, estado, (fecha >= CURDATE()) AS vigente "
            "FROM horarios WHERE id_horario=%s FOR UPDATE",
            (datos.id_horario,),
        )
        horario = cur.fetchone()
        if not horario:
            raise HTTPException(status_code=404, detail="Horario no encontrado")
        if horario["estado"] != "disponible" or not horario["vigente"]:
            raise HTTPException(status_code=409, detail="Ese horario ya no está disponible")
        cur.execute(
            "SELECT s.activo, s.id_proveedor FROM servicios s "
            "JOIN usuarios u ON u.id_usuario = s.id_proveedor "
            "WHERE s.id_servicio=%s AND u.activo = 1",
            (datos.id_servicio,),
        )
        servicio = cur.fetchone()
        if not servicio or not servicio["activo"]:
            raise HTTPException(status_code=404, detail="Servicio no disponible")
        if servicio["id_proveedor"] != horario["id_proveedor"]:
            raise HTTPException(status_code=422, detail="El servicio y el horario son de proveedores distintos")
        cur.execute(
            "INSERT INTO citas (id_usuario, id_servicio, id_horario, estado) VALUES (%s,%s,%s,'confirmada')",
            (user["id_usuario"], datos.id_servicio, datos.id_horario),
        )
        id_cita = cur.lastrowid
        cur.execute("UPDATE horarios SET estado='reservado' WHERE id_horario=%s", (datos.id_horario,))
    return {"id_cita": id_cita, "mensaje": "Cita confirmada"}


@router.get("")
def listar_citas(id_proveedor: Optional[int] = None, user=Depends(current_user)):
    """Cliente: las suyas. Proveedor: las de sus servicios. Administrador: todas."""
    cond, params = [], []
    if user["rol"] == "cliente":
        cond.append("c.id_usuario = %s")
        params.append(user["id_usuario"])
    elif user["rol"] == "proveedor":
        cond.append("s.id_proveedor = %s")
        params.append(user["id_usuario"])
    elif id_proveedor:
        cond.append("s.id_proveedor = %s")
        params.append(id_proveedor)
    where = "WHERE " + " AND ".join(cond) if cond else ""
    with db_cursor() as cur:
        cur.execute(f"{CONSULTA} {where} ORDER BY h.fecha DESC, h.hora_inicio", tuple(params))
        return cur.fetchall()


@router.patch("/{id_cita}/estado")
def cambiar_estado(id_cita: int, datos: CitaEstadoIn, user=Depends(current_user)):
    rol = user["rol"]
    with db_cursor(commit=True) as cur:
        cur.execute(
            "SELECT c.id_usuario, c.id_horario, c.estado, s.id_proveedor "
            "FROM citas c JOIN servicios s ON s.id_servicio = c.id_servicio "
            "WHERE c.id_cita=%s FOR UPDATE",
            (id_cita,),
        )
        cita = cur.fetchone()
        if not cita:
            raise HTTPException(status_code=404, detail="Cita no encontrada")
        if rol == "cliente":
            if cita["id_usuario"] != user["id_usuario"]:
                raise HTTPException(status_code=403, detail="Esa cita no es tuya")
            if datos.estado != "cancelada":
                raise HTTPException(status_code=403, detail="Solo puedes cancelar tus citas")
        elif rol == "proveedor" and cita["id_proveedor"] != user["id_usuario"]:
            raise HTTPException(status_code=403, detail="Esa cita no es de tus servicios")
        if cita["estado"] != "confirmada":
            raise HTTPException(status_code=409, detail="Solo se pueden modificar citas confirmadas")
        cur.execute("UPDATE citas SET estado=%s WHERE id_cita=%s", (datos.estado, id_cita))
        if datos.estado == "cancelada":  # el horario vuelve a quedar libre
            cur.execute("UPDATE horarios SET estado='disponible' WHERE id_horario=%s", (cita["id_horario"],))
    return {"mensaje": f"Cita {datos.estado}"}