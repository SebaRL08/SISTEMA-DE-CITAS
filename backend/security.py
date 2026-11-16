from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from backend.config import SECRET_KEY, TOKEN_MINUTES

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
    try:
        payload = jwt.decode(cred.credentials, SECRET_KEY, algorithms=["HS256"])
        return {"id_usuario": int(payload["sub"]), "rol": payload["rol"]}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada")


def require_admin(user: dict = Depends(current_user)) -> dict:
    if user["rol"] != "administrador":
        raise HTTPException(status_code=403, detail="Solo para administradores")
    return user
