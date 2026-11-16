from fastapi import APIRouter, HTTPException
from backend.database import db_cursor
from backend.schemas import LoginIn, RegistroIn
from backend.security import create_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])


@router.post("/registro", status_code=201)
def registro(datos: RegistroIn):
    """Cualquiera puede registrarse como cliente o proveedor. El rol admin NO se puede elegir."""
    correo = datos.correo.lower()
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT id_usuario FROM usuarios WHERE correo = %s", (correo,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="El correo ya está registrado")
        cur.execute(
            "INSERT INTO usuarios (nombre, correo, contrasena, rol) VALUES (%s, %s, %s, %s)",
            (datos.nombre.strip(), correo, hash_password(datos.contrasena), datos.rol),
        )
        return {"id_usuario": cur.lastrowid, "mensaje": "Usuario registrado correctamente"}


@router.post("/login")
def login(datos: LoginIn):
    with db_cursor() as cur:
        cur.execute(
            "SELECT id_usuario, nombre, contrasena, rol, activo FROM usuarios WHERE correo = %s",
            (datos.correo.lower(),),
        )
        usuario = cur.fetchone()
    if not usuario or not verify_password(datos.contrasena, usuario["contrasena"]):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    if not usuario["activo"]:
        raise HTTPException(status_code=403, detail="Tu cuenta está desactivada")
    return {
        "token": create_token(usuario["id_usuario"], usuario["rol"]),
        "usuario": {
            "id_usuario": usuario["id_usuario"],
            "nombre": usuario["nombre"],
            "rol": usuario["rol"],
        },
    }