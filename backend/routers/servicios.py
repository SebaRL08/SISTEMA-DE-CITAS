from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from backend.database import db_cursor
from backend.schemas import ServicioIn
from backend.security import current_user, require_staff
from backend.utils import proveedor_destino

router = APIRouter(prefix="/api/servicios", tags=["Servicios"])

BASE = """
    SELECT s.id_servicio, s.id_proveedor, u.nombre AS proveedor,
           s.nombre, s.descripcion, s.duracion_minutos, s.activo
    FROM servicios s JOIN usuarios u ON u.id_usuario = s.id_proveedor
"""


def _servicio_editable(cur, id_servicio, user):
    cur.execute("SELECT id_proveedor FROM servicios WHERE id_servicio = %s", (id_servicio,))
    s = cur.fetchone()
    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    if user["rol"] != "administrador" and s["id_proveedor"] != user["id_usuario"]:
        raise HTTPException(status_code=403, detail="Ese servicio no es tuyo")


@router.get("")
def listar_servicios(id_proveedor: Optional[int] = None, user=Depends(current_user)):
    """Proveedor: los suyos. Cliente: solo activos. Administrador: todos (filtrables)."""
    cond, params = [], []
    if user["rol"] == "proveedor":
        cond.append("s.id_proveedor = %s")
        params.append(user["id_usuario"])
    else:
        if user["rol"] == "cliente":
            cond.append("s.activo = 1 AND u.activo = 1 AND u.rol = 'proveedor'")
        if id_proveedor:
            cond.append("s.id_proveedor = %s")
            params.append(id_proveedor)
    where = "WHERE " + " AND ".join(cond) if cond else ""
    with db_cursor() as cur:
        cur.execute(f"{BASE} {where} ORDER BY u.nombre, s.nombre", tuple(params))
        return cur.fetchall()


@router.post("", status_code=201)
def crear_servicio(datos: ServicioIn, user=Depends(require_staff)):
    id_prov = proveedor_destino(user, datos.id_proveedor)
    with db_cursor(commit=True) as cur:
        cur.execute(
            "INSERT INTO servicios (id_proveedor, nombre, descripcion, duracion_minutos, activo) "
            "VALUES (%s,%s,%s,%s,%s)",
            (id_prov, datos.nombre.strip(), datos.descripcion, datos.duracion_minutos, datos.activo),
        )
        return {"id_servicio": cur.lastrowid, "mensaje": "Servicio creado"}


@router.put("/{id_servicio}")
def modificar_servicio(id_servicio: int, datos: ServicioIn, user=Depends(require_staff)):
    with db_cursor(commit=True) as cur:
        _servicio_editable(cur, id_servicio, user)
        cur.execute(
            "UPDATE servicios SET nombre=%s, descripcion=%s, duracion_minutos=%s, activo=%s "
            "WHERE id_servicio=%s",
            (datos.nombre.strip(), datos.descripcion, datos.duracion_minutos, datos.activo, id_servicio),
        )
    return {"mensaje": "Servicio actualizado"}


@router.delete("/{id_servicio}")
def desactivar_servicio(id_servicio: int, user=Depends(require_staff)):
    """No borra: solo desactiva, para conservar el historial de citas."""
    with db_cursor(commit=True) as cur:
        _servicio_editable(cur, id_servicio, user)
        cur.execute("UPDATE servicios SET activo = 0 WHERE id_servicio = %s", (id_servicio,))
    return {"mensaje": "Servicio desactivado"}