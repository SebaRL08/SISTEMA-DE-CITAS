from datetime import date, time
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field


class RegistroIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    correo: EmailStr
    contrasena: str = Field(min_length=6, max_length=72)
    rol: Literal["cliente", "proveedor"] = "cliente"


class LoginIn(BaseModel):
    correo: EmailStr
    contrasena: str


class PerfilIn(BaseModel):
    descripcion: str = Field(default="", max_length=255)


class UsuarioAdminIn(BaseModel):
    rol: Literal["administrador", "proveedor", "cliente"]
    activo: bool


class ServicioIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    descripcion: str = ""
    duracion_minutos: int = Field(gt=0, le=480)
    activo: bool = True
    id_proveedor: Optional[int] = None  # solo lo usa el administrador


class HorarioIn(BaseModel):
    fecha: date
    hora_inicio: time
    hora_fin: time
    intervalo_minutos: Optional[int] = Field(default=None, gt=0, le=480)
    id_proveedor: Optional[int] = None  # solo lo usa el administrador


class HorarioEstadoIn(BaseModel):
    estado: Literal["disponible", "bloqueado"]


class CitaIn(BaseModel):
    id_servicio: int
    id_horario: int


class CitaEstadoIn(BaseModel):
    estado: Literal["cancelada", "completada"]
