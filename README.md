# Sistema de Gestión de Citas

Aplicación web para administrar citas de un negocio o establecimiento que ofrece servicios.
Proyecto del curso **Teoría de Bases de Datos**, Universidad Manuela Beltrán.

- **Autor:** Sebastian Restrepo Labrador
- **Docente:** Juan Jose Osorio Tabares

## Tecnologías

| Capa | Tecnología |
|---|---|
| Servidor | Python + FastAPI |
| Base de datos | MySQL (diseñada con MySQL Workbench) |
| Interfaz | HTML, CSS y JavaScript |
| Seguridad | bcrypt (hash de contraseñas) + JWT (sesiones) |

## Roles

- **Administrador:** gestiona servicios y horarios, consulta usuarios y citas, completa o cancela citas.
- **Cliente:** se registra, consulta servicios y horarios libres, reserva, consulta y cancela sus citas.

## Instalación

```bash
git clone https://github.com/SebaRL08/SISTEMA-DE-CITAS.git
cd SISTEMA-DE-CITAS
python -m venv venv
venv\Scripts\activate          # Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
```

1. Ejecuta `database/schema.sql` en MySQL Workbench.
2. Copia `.env.example` a `.env` y completa tu usuario/contraseña de MySQL.
3. Crea el administrador: `python -m scripts.crear_admin`
4. Inicia: `uvicorn backend.main:app --reload`
5. Abre `http://127.0.0.1:8000` (documentación de la API en `/docs`).

## Estructura y qué hace cada parte del código

### Base de datos
| Archivo | Función |
|---|---|
| `database/schema.sql` | Crea la BD `sistema_citas` con las tablas `usuarios`, `servicios`, `horarios` y `citas`, sus claves primarias/foráneas y datos de ejemplo. El índice único `uq_horario_activo` (sobre la columna generada `cita_activa`) garantiza a nivel de BD una sola cita activa por horario. |

### Backend (`backend/`)
| Archivo | Función |
|---|---|
| `config.py` | Lee las variables de `.env` (datos de MySQL, clave secreta, duración del token). |
| `database.py` | `db_cursor()`: abre la conexión a MySQL, hace *commit* si todo sale bien y *rollback* si hay error. |
| `security.py` | Hash y verificación de contraseñas (bcrypt), creación/lectura de tokens JWT, y dependencias `current_user` y `require_admin` que controlan el acceso según el rol (RNF02). |
| `schemas.py` | Modelos Pydantic que validan los datos recibidos: formato de correo, largo de contraseña, duraciones, estados permitidos (RNF05). |
| `main.py` | Crea la app FastAPI, registra los routers y sirve la carpeta `frontend/`. |
| `routers/auth.py` | `POST /api/auth/registro` (rechaza correos duplicados) y `POST /api/auth/login` (devuelve el token). RF01, RF02. |
| `routers/usuarios.py` | `GET /api/usuarios`: lista de usuarios (solo admin). RF03. |
| `routers/servicios.py` | CRUD de servicios; "eliminar" solo desactiva para conservar el historial. El cliente solo ve los activos. RF04. |
| `routers/horarios.py` | Crea horarios (valida fechas y cruces), lista disponibilidad y permite bloquear/desbloquear. RF05, RF06. |
| `routers/citas.py` | Reserva (bloquea la fila del horario con `FOR UPDATE` y lo marca como reservado), consulta de citas propias/todas y cancelación que libera el horario. RF07–RF10. |

### Scripts
| Archivo | Función |
|---|---|
| `scripts/crear_admin.py` | Crea por consola el primer usuario administrador. |

### Frontend (`frontend/`)
| Archivo | Función |
|---|---|
| `index.html` | Estructura de las tres vistas: acceso, cliente y administrador. |
| `css/styles.css` | Estilos de la interfaz (RNF01). |
| `js/api.js` | Función `api()` que llama al backend con el token, manejo de la sesión, mensajes y escape de HTML. |
| `js/cliente.js` | Flujo del cliente: elegir servicio → fecha (próximos 4 días con cupo) → horario → confirmar; lista y cancelación de sus citas. |
| `js/admin.js` | Paneles del administrador: servicios, horarios, citas y usuarios. |
| `js/app.js` | Controlador: login/registro, cambio de vistas según el rol y cierre de sesión. |

## Modelo de datos

- `usuarios` 1 — N `citas`
- `servicios` 1 — N `citas`
- `horarios` 1 — N `citas` (solo una activa por horario)

| Tabla | PK | FK |
|---|---|---|
| usuarios | id_usuario | — |
| servicios | id_servicio | — |
| horarios | id_horario | — |
| citas | id_cita | id_usuario, id_servicio, id_horario |

## Flujo de una reserva

1. El cliente inicia sesión (o se registra).
2. Elige un servicio y un horario libre.
3. El backend bloquea el horario, verifica que siga `disponible`, registra la cita y lo pasa a `reservado`.
4. Si estaba ocupado devuelve error 409 y el cliente elige otro.
5. Al cancelar, la cita pasa a `cancelada` y el horario vuelve a `disponible`.

## Pruebas

Se pueden ejecutar desde la interfaz web o desde `/docs`.

| N.º | Prueba | Resultado esperado | Cómo hacerla |
|---|---|---|---|
| 1 | Registrar usuario nuevo | Queda guardado | Pestaña "Registrarse" |
| 2 | Registrar correo existente | Rechaza (409) | Repetir el registro |
| 3 | Login correcto | Ingresa | Pestaña "Iniciar sesión" |
| 4 | Login incorrecto | Mensaje de error | Contraseña errónea |
| 5 | Registrar servicio | Queda guardado | Admin → Servicios |
| 6 | Crear horario | Aparece disponible | Admin → Horarios |
| 7 | Reservar horario libre | Cita registrada | Cliente → reservar |
| 8 | Reservar horario ocupado | Rechaza (409) | Dos clientes, mismo horario |
| 9 | Cancelar cita | Cita cancelada y horario libre | Cliente → Mis citas → Cancelar |
| 10 | Consultar citas del cliente | Solo ve las suyas | Cliente → Mis citas |

## Flujo de trabajo con Git

- `DevelopBranch`: desarrollo diario.
- `main`: versión estable, solo recibe cambios de `DevelopBranch` ya probados.