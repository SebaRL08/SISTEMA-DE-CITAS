"""Crea un usuario administrador. Ejecutar desde la raíz: python -m scripts.crear_admin"""
import getpass
from backend.database import db_cursor
from backend.security import hash_password

nombre = input("Nombre: ").strip()
correo = input("Correo: ").strip().lower()
contrasena = getpass.getpass("Contraseña (mín. 6): ")

if len(contrasena) < 6:
    raise SystemExit("La contraseña es muy corta")

with db_cursor(commit=True) as cur:
    cur.execute(
        "INSERT INTO usuarios (nombre, correo, contrasena, rol) VALUES (%s,%s,%s,'administrador')",
        (nombre, correo, hash_password(contrasena)),
    )
print("Administrador creado.")
