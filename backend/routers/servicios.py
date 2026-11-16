from fastapi import APIRouter, Depends, HTTPException
from backend.database import db_cursor
from backend.schemas import ServicioIn
from backend.security import current_user, require_admin

router = APIRouter(prefix="/api/servicios", tags=["Servicios"])


@router.get("")
def listar_servicios(user=Depends(current_user)):
    """El administrador ve todos; el cliente solo los activos."""
    sql = "SELECT id_servicio, nombre, descripcion, duracion_minutos, activo FROM servicios"
    if user["rol"] != "administrador":
        sql += " WHERE activo = 1"
    with db_cursor() as cur:
        cur.execute(sql + " ORDER BY nombre")
        return cur.fetchall()


@router.post("", status_code=201)
def crear_servicio(datos: ServicioIn, _=Depends(require_admin)):
    with db_cursor(commit=True) as cur:
        cur.execute(
            "INSERT INTO servicios (nombre, descripcion, duracion_minutos, activo) VALUES (%s,%s,%s,%s)",
            (datos.nombre.strip(), datos.descripcion, datos.duracion_minutos, datos.activo),
        )
        return {"id_servicio": cur.lastrowid, "mensaje": "Servicio creado"}


@router.put("/{id_servicio}")
def modificar_servicio(id_servicio: int, datos: ServicioIn, _=Depends(require_admin)):
    with db_cursor(commit=True) as cur:
        cur.execute(
            "UPDATE servicios SET nombre=%s, descripcion=%s, duracion_minutos=%s, activo=%s "
            "WHERE id_servicio=%s",
            (datos.nombre.strip(), datos.descripcion, datos.duracion_minutos, datos.activo, id_servicio),
        )
        cur.execute("SELECT id_servicio FROM servicios WHERE id_servicio=%s", (id_servicio,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Servicio no encontrado")
    return {"mensaje": "Servicio actualizado"}


@router.delete("/{id_servicio}")
def desactivar_servicio(id_servicio: int, _=Depends(require_admin)):
    """No borra: solo desactiva, para conservar el historial de citas."""
    with db_cursor(commit=True) as cur:
        cur.execute("UPDATE servicios SET activo = 0 WHERE id_servicio = %s", (id_servicio,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Servicio no encontrado")
    return {"mensaje": "Servicio desactivado"}
