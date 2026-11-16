import os
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "sistema_citas"),
}

SECRET_KEY = os.getenv("SECRET_KEY", "clave-solo-para-desarrollo")
TOKEN_MINUTES = int(os.getenv("TOKEN_MINUTES", "120"))
