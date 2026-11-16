from datetime import date, time
from typing import Literal
from pydantic import BaseModel, EmailStr, Field


class RegistroIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    correo: EmailStr
    contrasena: str = Field(min_length=6, max_length=72)


class LoginIn(BaseModel):
    correo: EmailStr
    contrasena: str


class ServicioIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    descripcion: str = ""
    duracion_minutos: int = Field(gt=0, le=480)
    activo: bool = True


class HorarioIn(BaseModel):
    fecha: date
    hora_inicio: time
    hora_fin: time


class HorarioEstadoIn(BaseModel):
    estado: Literal["disponible", "bloqueado"]


class CitaIn(BaseModel):
    id_servicio: int
    id_horario: int


class CitaEstadoIn(BaseModel):
    estado: Literal["cancelada", "completada"]
