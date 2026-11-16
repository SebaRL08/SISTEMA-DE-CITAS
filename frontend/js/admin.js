let serviciosAdmin = [];

async function iniciarAdmin() {
  await Promise.all([cargarServiciosAdmin(), cargarHorariosAdmin(), cargarCitasAdmin(), cargarUsuariosAdmin()])
    .catch(e => mostrarMensaje(e.message, "error"));
}

function tabla(columnas, filas) {
  if (!filas.length) return "<p>Sin registros.</p>";
  return `<table><thead><tr>${columnas.map(c => `<th>${c}</th>`).join("")}</tr></thead>
          <tbody>${filas.map(f => `<tr>${f.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

// ---------- Servicios ----------
async function cargarServiciosAdmin() {
  serviciosAdmin = await api("/servicios");
  document.getElementById("tabla-servicios").innerHTML = tabla(
    ["Nombre", "Descripción", "Min", "Estado", "Acciones"],
    serviciosAdmin.map(s => [
      esc(s.nombre), esc(s.descripcion), s.duracion_minutos,
      `<span class="badge ${s.activo ? "disponible" : "bloqueado"}">${s.activo ? "activo" : "inactivo"}</span>`,
      `<button class="pequeno" data-editar="${s.id_servicio}">Editar</button>
       <button class="pequeno ${s.activo ? "peligro" : ""}" data-toggle-serv="${s.id_servicio}">
         ${s.activo ? "Desactivar" : "Activar"}</button>`,
    ]));
}

function limpiarFormServicio() {
  const f = document.getElementById("form-servicio");
  f.reset();
  f.id_servicio.value = "";
  f.activo.value = "1";
  document.getElementById("btn-cancelar-edicion").classList.add("oculto");
}

document.getElementById("form-servicio").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const cuerpo = {
    nombre: f.nombre.value, descripcion: f.descripcion.value,
    duracion_minutos: parseInt(f.duracion.value), activo: f.activo.value === "1",
  };
  try {
    if (f.id_servicio.value) await api(`/servicios/${f.id_servicio.value}`, "PUT", cuerpo);
    else await api("/servicios", "POST", cuerpo);
    mostrarMensaje("Servicio guardado");
    limpiarFormServicio();
    await cargarServiciosAdmin();
  } catch (err) { mostrarMensaje(err.message, "error"); }
});

document.getElementById("btn-cancelar-edicion").addEventListener("click", limpiarFormServicio);

document.getElementById("tabla-servicios").addEventListener("click", async (e) => {
  try {
    if (e.target.dataset.editar) {
      const s = serviciosAdmin.find(x => x.id_servicio == e.target.dataset.editar);
      const f = document.getElementById("form-servicio");
      f.id_servicio.value = s.id_servicio; f.nombre.value = s.nombre;
      f.descripcion.value = s.descripcion || ""; f.duracion.value = s.duracion_minutos;
      f.activo.value = s.activo ? "1" : "0";
      document.getElementById("btn-cancelar-edicion").classList.remove("oculto");
    }
    if (e.target.dataset.toggleServ) {
      const s = serviciosAdmin.find(x => x.id_servicio == e.target.dataset.toggleServ);
      if (s.activo) await api(`/servicios/${s.id_servicio}`, "DELETE");
      else await api(`/servicios/${s.id_servicio}`, "PUT",
        { nombre: s.nombre, descripcion: s.descripcion || "", duracion_minutos: s.duracion_minutos, activo: true });
      await cargarServiciosAdmin();
    }
  } catch (err) { mostrarMensaje(err.message, "error"); }
});

// ---------- Horarios ----------
async function cargarHorariosAdmin() {
  const horarios = await api("/horarios");
  document.getElementById("tabla-horarios").innerHTML = tabla(
    ["Fecha", "Inicio", "Fin", "Estado", "Acción"],
    horarios.map(h => [
      h.fecha, h.hora_inicio, h.hora_fin,
      `<span class="badge ${h.estado}">${h.estado}</span>`,
      h.estado === "reservado" ? "—" :
        `<button class="pequeno" data-horario-estado="${h.id_horario}"
          data-nuevo="${h.estado === "bloqueado" ? "disponible" : "bloqueado"}">
          ${h.estado === "bloqueado" ? "Desbloquear" : "Bloquear"}</button>`,
    ]));
}

document.getElementById("form-horario").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    await api("/horarios", "POST",
      { fecha: f.fecha.value, hora_inicio: f.hora_inicio.value, hora_fin: f.hora_fin.value });
    mostrarMensaje("Horario creado");
    f.reset();
    await cargarHorariosAdmin();
  } catch (err) { mostrarMensaje(err.message, "error"); }
});

document.getElementById("tabla-horarios").addEventListener("click", async (e) => {
  if (!e.target.dataset.horarioEstado) return;
  try {
    await api(`/horarios/${e.target.dataset.horarioEstado}/estado`, "PATCH", { estado: e.target.dataset.nuevo });
    await cargarHorariosAdmin();
  } catch (err) { mostrarMensaje(err.message, "error"); }
});

// ---------- Citas ----------
async function cargarCitasAdmin() {
  const citas = await api("/citas");
  document.getElementById("tabla-citas").innerHTML = tabla(
    ["#", "Cliente", "Servicio", "Fecha", "Hora", "Estado", "Acciones"],
    citas.map(c => [
      c.id_cita, esc(c.cliente), esc(c.servicio), c.fecha, `${c.hora_inicio} - ${c.hora_fin}`,
      `<span class="badge ${c.estado}">${c.estado}</span>`,
      c.estado === "confirmada"
        ? `<button class="pequeno" data-cita="${c.id_cita}" data-estado="completada">Completar</button>
           <button class="pequeno peligro" data-cita="${c.id_cita}" data-estado="cancelada">Cancelar</button>` : "",
    ]));
}

document.getElementById("tabla-citas").addEventListener("click", async (e) => {
  if (!e.target.dataset.cita) return;
  try {
    await api(`/citas/${e.target.dataset.cita}/estado`, "PATCH", { estado: e.target.dataset.estado });
    await Promise.all([cargarCitasAdmin(), cargarHorariosAdmin()]);
  } catch (err) { mostrarMensaje(err.message, "error"); }
});

// ---------- Usuarios ----------
async function cargarUsuariosAdmin() {
  const usuarios = await api("/usuarios");
  document.getElementById("tabla-usuarios").innerHTML = tabla(
    ["ID", "Nombre", "Correo", "Rol", "Registro"],
    usuarios.map(u => [u.id_usuario, esc(u.nombre), esc(u.correo), u.rol, String(u.fecha_registro).replace("T", " ")]));
}
