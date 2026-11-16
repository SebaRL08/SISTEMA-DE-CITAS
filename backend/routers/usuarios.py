from fastapi import APIRouter, Depends, HTTPException
from backend.database import db_cursor
from backend.schemas import PerfilIn, UsuarioAdminIn
from backend.security import current_user, require_admin, require_proveedor

router = APIRouter(prefix="/api/usuarios", tags=["Usuarios"])


@router.get("")
def listar_usuarios(_=Depends(require_admin)):
    with db_cursor() as cur:
        cur.execute(
            "SELECT id_usuario, nombre, correo, rol, activo, fecha_registro "
            "FROM usuarios ORDER BY id_usuario"
        )
        return cur.fetchall()


@router.get("/proveedores")
def listar_proveedores(_=Depends(current_user)):
    """Directorio de proveedores activos, con cuántos servicios y cupos libres tienen."""
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT u.id_usuario, u.nombre, u.descripcion,
                   (SELECT COUNT(*) FROM servicios s
                     WHERE s.id_proveedor = u.id_usuario AND s.activo = 1) AS servicios,
                   (SELECT COUNT(*) FROM horarios h
                     WHERE h.id_proveedor = u.id_usuario AND h.estado = 'disponible'
                       AND h.fecha >= CURDATE()) AS cupos
            FROM usuarios u
            WHERE u.rol = 'proveedor' AND u.activo = 1
            ORDER BY u.nombre
            """
        )
        return cur.fetchall()


@router.get("/perfil")
def ver_perfil(user=Depends(current_user)):
    with db_cursor() as cur:
        cur.execute(
            "SELECT nombre, correo, rol, descripcion FROM usuarios WHERE id_usuario = %s",
            (user["id_usuario"],),
        )
        return cur.fetchone()


@router.patch("/perfil")
def editar_perfil(datos: PerfilIn, user=Depends(require_proveedor)):
    with db_cursor(commit=True) as cur:
        cur.execute(
            "UPDATE usuarios SET descripcion = %s WHERE id_usuario = %s",
            (datos.descripcion.strip(), user["id_usuario"]),
        )
    return {"mensaje": "Perfil actualizado"}


@router.patch("/{id_usuario}")
def editar_usuario(id_usuario: int, datos: UsuarioAdminIn, admin=Depends(require_admin)):
    """El administrador cambia el rol o activa/desactiva cuentas."""
    if id_usuario == admin["id_usuario"]:
        raise HTTPException(status_code=409, detail="No puedes modificar tu propia cuenta")
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT id_usuario FROM usuarios WHERE id_usuario = %s", (id_usuario,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        cur.execute(
            "UPDATE usuarios SET rol = %s, activo = %s WHERE id_usuario = %s",
            (datos.rol, datos.activo, id_usuario),
        )
    return {"mensaje": "Usuario actualizado"}
