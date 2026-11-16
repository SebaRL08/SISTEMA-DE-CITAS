DROP DATABASE IF EXISTS sistema_citas;
CREATE DATABASE sistema_citas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sistema_citas;

CREATE TABLE usuarios (
    id_usuario     INT AUTO_INCREMENT PRIMARY KEY,
    nombre         VARCHAR(100) NOT NULL,
    correo         VARCHAR(120) NOT NULL UNIQUE,
    contrasena     VARCHAR(255) NOT NULL,
    rol            ENUM('administrador','proveedor','cliente') NOT NULL DEFAULT 'cliente',
    descripcion    VARCHAR(255) NOT NULL DEFAULT '',
    activo         BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE servicios (
    id_servicio      INT AUTO_INCREMENT PRIMARY KEY,
    id_proveedor     INT NOT NULL,
    nombre           VARCHAR(100) NOT NULL,
    descripcion      TEXT,
    duracion_minutos INT NOT NULL,
    activo           BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_servicio_proveedor FOREIGN KEY (id_proveedor) REFERENCES usuarios(id_usuario)
);

CREATE TABLE horarios (
    id_horario   INT AUTO_INCREMENT PRIMARY KEY,
    id_proveedor INT NOT NULL,
    fecha        DATE NOT NULL,
    hora_inicio  TIME NOT NULL,
    hora_fin     TIME NOT NULL,
    estado       ENUM('disponible','reservado','bloqueado') NOT NULL DEFAULT 'disponible',
    CONSTRAINT fk_horario_proveedor FOREIGN KEY (id_proveedor) REFERENCES usuarios(id_usuario),
    UNIQUE KEY uq_horario (id_proveedor, fecha, hora_inicio)
);

CREATE TABLE citas (
    id_cita        INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario     INT NOT NULL,
    id_servicio    INT NOT NULL,
    id_horario     INT NOT NULL,
    estado         ENUM('confirmada','cancelada','completada') NOT NULL DEFAULT 'confirmada',
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- NULL si la cita está cancelada, 1 si está activa. Con el UNIQUE garantiza
    -- UNA sola cita activa por horario.
    cita_activa    TINYINT GENERATED ALWAYS AS (IF(estado = 'cancelada', NULL, 1)) STORED,
    CONSTRAINT fk_cita_usuario  FOREIGN KEY (id_usuario)  REFERENCES usuarios(id_usuario),
    CONSTRAINT fk_cita_servicio FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio),
    CONSTRAINT fk_cita_horario  FOREIGN KEY (id_horario)  REFERENCES horarios(id_horario),
    UNIQUE KEY uq_horario_activo (id_horario, cita_activa)
);