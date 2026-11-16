from fastapi import APIRouter, Depends
from backend.database import db_cursor
from backend.security import require_admin

router = APIRouter(prefix="/api/usuarios", tags=["Usuarios"])


@router.get("")
def listar_usuarios(_=Depends(require_admin)):
    with db_cursor() as cur:
        cur.execute(
            "SELECT id_usuario, nombre, correo, rol, fecha_registro FROM usuarios ORDER BY id_usuario"
        )
        return cur.fetchall()
