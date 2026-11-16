from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from backend.config import SECRET_KEY, TOKEN_MINUTES
from backend.database import db_cursor

bearer = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(id_usuario: int, rol: str) -> str:
    payload = {
        "sub": str(id_usuario),
        "rol": rol,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=TOKEN_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def current_user(cred: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    """Valida el token y consulta la BD: así un cambio de rol o una cuenta
    desactivada por el administrador surten efecto de inmediato."""
    try:
        payload = jwt.decode(cred.credentials, SECRET_KEY, algorithms=["HS256"])
        id_usuario = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada")
    with db_cursor() as cur:
        cur.execute(
            "SELECT id_usuario, nombre, rol, activo FROM usuarios WHERE id_usuario = %s",
            (id_usuario,),
        )
        u = cur.fetchone()
    if not u or not u["activo"]:
        raise HTTPException(status_code=401, detail="Cuenta inactiva o inexistente")
    return {"id_usuario": u["id_usuario"], "nombre": u["nombre"], "rol": u["rol"]}


def require_admin(user: dict = Depends(current_user)) -> dict:
    if user["rol"] != "administrador":
        raise HTTPException(status_code=403, detail="Solo para administradores")
    return user


def require_proveedor(user: dict = Depends(current_user)) -> dict:
    if user["rol"] != "proveedor":
        raise HTTPException(status_code=403, detail="Solo para proveedores")
    return user


def require_staff(user: dict = Depends(current_user)) -> dict:
    """Proveedor o administrador."""
    if user["rol"] not in ("proveedor", "administrador"):
        raise HTTPException(status_code=403, detail="No tienes permisos para esta acción")
    return user