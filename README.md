# 📅 Sistema de Gestión de Citas

Aplicación web donde **proveedores** publican sus servicios y horarios, y **clientes** reservan citas
en los espacios libres. Un **administrador** supervisa y controla todo.
Proyecto del curso **Teoría de Bases de Datos**, Universidad Manuela Beltrán.

- **Autor:** Sebastian Restrepo Labrador
- **Docente:** Juan Jose Osorio Tabares

## Tecnologías

| Capa | Tecnología |
|---|---|
| Servidor | Python + FastAPI |
| Base de datos | MySQL (diseñada con MySQL Workbench) |
| Interfaz | HTML, CSS y JavaScript (sin frameworks) |
| Seguridad | bcrypt (hash de contraseñas) + JWT (sesiones) |

## Roles

| Rol | Cómo se obtiene | Qué puede hacer |
|---|---|---|
| **Cliente** | Registro ("Quiero agendar citas") | Explorar proveedores, reservar en 3 pasos, ver y cancelar sus citas. |
| **Proveedor** | Registro ("Ofrezco servicios") | Crear/editar/activar sus servicios, generar su agenda por bloques, bloquear o eliminar horarios, completar o cancelar las citas de sus servicios, editar su perfil. |
| **Administrador** | Script `crear_admin.py` | Control total: cambia roles, activa/desactiva cuentas y gestiona servicios, horarios y citas de cualquier proveedor. |

## Instalación

```bash
git clone https://github.com/SebaRL08/SISTEMA-DE-CITAS.git
cd SISTEMA-DE-CITAS
python -m venv venv
venv\Scripts\activate          # Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
```

1. Ejecuta `database/schema.sql` en MySQL Workbench (**borra y recrea** la base `sistema_citas`).
2. Copia `.env.example` a `.env` y completa tu usuario/contraseña de MySQL.
3. Crea el administrador: `python -m scripts.crear_admin`
4. Inicia: `uvicorn backend.main:app --reload`
5. Abre `http://127.0.0.1:8000` (documentación de la API en `/docs`).

## Qué hace cada parte del código

### Base de datos
| Archivo | Función |
|---|---|
| `database/schema.sql` | Crea `usuarios`, `servicios`, `horarios` y `citas` con sus claves. Cada servicio y cada horario pertenecen a un proveedor (`id_proveedor`). El índice único `uq_horario_activo` (sobre la columna generada `cita_activa`) garantiza una sola cita activa por horario. |

### Backend (`backend/`)
| Archivo | Función |
|---|---|
| `config.py` | Lee las variables de `.env`. |
| `database.py` | `db_cursor()`: abre la conexión, hace *commit* si todo sale bien y *rollback* si hay error. |
| `security.py` | bcrypt, tokens JWT y dependencias de acceso (`current_user`, `require_admin`, `require_proveedor`, `require_staff`). En cada petición consulta la BD, así un cambio de rol o una cuenta desactivada surten efecto de inmediato. |
| `schemas.py` | Modelos Pydantic que validan los datos de entrada. |
| `utils.py` | `proveedor_destino()`: decide a nombre de qué proveedor se crea un servicio u horario (el propio, o el elegido por el admin). |
| `main.py` | Crea la app FastAPI, registra los routers y sirve `frontend/`. |
| `routers/auth.py` | Registro (cliente o proveedor, nunca admin) y login (rechaza cuentas desactivadas). |
| `routers/usuarios.py` | Directorio de proveedores con sus cupos, perfil propio y gestión de usuarios por el admin (rol y estado). |
| `routers/servicios.py` | CRUD de servicios por proveedor. "Eliminar" solo desactiva para conservar el historial. |
| `routers/horarios.py` | Genera horarios por bloques (ej. 09:00–12:00 cada 30 min), omite cruces, bloquea y elimina. |
| `routers/citas.py` | Reserva (bloquea la fila con `FOR UPDATE`, valida que servicio y horario sean del mismo proveedor), lista según el rol y cancela liberando el horario. |

### Scripts
| Archivo | Función |
|---|---|
| `scripts/crear_admin.py` | Crea por consola el usuario administrador. |

### Frontend (`frontend/`)
| Archivo | Función |
|---|---|
| `index.html` | Pantalla de acceso, contenedor de la app y ventana emergente. |
| `css/styles.css` | Estilos: tarjetas, notificaciones, interruptores, selector de días, animaciones. |
| `js/api.js` | Llamadas al backend con el token, sesión, notificaciones, ventana emergente y piezas reutilizables. |
| `js/app.js` | Login/registro y navegación por pestañas según el rol. |
| `js/cliente.js` | Explorar proveedores, ventana de reserva en 3 pasos y "Mis citas". |
| `js/proveedor.js` | Resumen, servicios, agenda, citas y perfil. El admin reutiliza estos paneles eligiendo un proveedor. |
| `js/admin.js` | Panel de control global y gestión de usuarios. |

## Modelo de datos

- `usuarios` (proveedor) 1 — N `servicios`
- `usuarios` (proveedor) 1 — N `horarios`
- `usuarios` (cliente) 1 — N `citas`
- `servicios` 1 — N `citas`
- `horarios` 1 — N `citas` (solo una activa por horario)

| Tabla | PK | FK |
|---|---|---|
| usuarios | id_usuario | — |
| servicios | id_servicio | id_proveedor |
| horarios | id_horario | id_proveedor |
| citas | id_cita | id_usuario, id_servicio, id_horario |

## Flujo de una reserva

1. El proveedor crea servicios y genera su agenda.
2. El cliente elige un proveedor, un servicio, un día y una hora libre.
3. El backend bloquea el horario, verifica que siga `disponible`, registra la cita y lo pasa a `reservado`.
4. Si ya estaba ocupado devuelve error 409 y el cliente elige otro.
5. Al cancelar, la cita pasa a `cancelada` y el horario vuelve a `disponible`.

## Pruebas

| N.º | Prueba | Resultado esperado |
|---|---|---|
| 1 | Registrar un usuario nuevo | Queda guardado |
| 2 | Registrar un correo existente | Rechaza el registro (409) |
| 3 | Iniciar sesión con datos correctos | Ingresa |
| 4 | Iniciar sesión con datos incorrectos | Mensaje de error |
| 5 | Proveedor crea un servicio | Queda guardado |
| 6 | Proveedor genera horarios | Aparecen disponibles |
| 7 | Cliente reserva un horario libre | Cita registrada |
| 8 | Dos clientes reservan el mismo horario | El segundo es rechazado |
| 9 | Cancelar una cita | La cita se cancela y el horario queda libre |
| 10 | Cliente consulta sus citas | Solo ve las suyas |
| 11 | Proveedor consulta sus citas | Solo ve las de sus servicios |
| 12 | Cliente intenta entrar a rutas de proveedor/admin | Rechaza (403) |
| 13 | Admin cambia el rol de un usuario | El cambio se aplica de inmediato |
| 14 | Admin desactiva una cuenta | Esa cuenta ya no puede ingresar |
| 15 | Proveedor intenta editar un servicio ajeno | Rechaza (403) |

## Flujo de trabajo con Git

- `DevelopBranch`: desarrollo diario.
- `main`: versión estable, solo recibe cambios de `DevelopBranch` ya probados.
