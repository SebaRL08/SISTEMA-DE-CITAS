from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from backend.routers import auth, citas, horarios, servicios, usuarios

app = FastAPI(title="Sistema de Citas", version="1.0.0")

for modulo in (auth, usuarios, servicios, horarios, citas):
    app.include_router(modulo.router)

# Sirve la interfaz web desde la misma app (debe ir al final)
FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
