from fastapi import HTTPException
from backend.database import db_cursor


def proveedor_destino(user: dict, id_proveedor):
    """Define a nombre de qué proveedor se crea un servicio u horario.
    - Proveedor: siempre él mismo.
    - Administrador: debe indicar un proveedor existente."""
    if user["rol"] == "proveedor":
        return user["id_usuario"]
    if not id_proveedor:
        raise HTTPException(status_code=422, detail="Selecciona un proveedor")
    with db_cursor() as cur:
        cur.execute(
            "SELECT id_usuario FROM usuarios WHERE id_usuario = %s AND rol = 'proveedor'",
            (id_proveedor,),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return id_proveedor