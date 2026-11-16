let servicioSel = null;
let horarioSel = null;
let horariosDisponibles = [];

async function iniciarCliente() {
  servicioSel = null;
  horarioSel = null;
  try {
    const servicios = await api("/servicios");
    document.getElementById("lista-servicios").innerHTML = servicios.map(s => `
      <div class="servicio" data-id="${s.id_servicio}">
        <strong>${esc(s.nombre)}</strong><br>
        <small>${esc(s.descripcion)}</small><br>
        <small>⏱ ${s.duracion_minutos} min</small>
      </div>`).join("") || "<p>No hay servicios disponibles.</p>";
    await cargarHorarios();
    await cargarMisCitas();
  } catch (e) { mostrarMensaje(e.message, "error"); }
}

async function cargarHorarios() {
  horariosDisponibles = await api("/horarios?solo_disponibles=true");
  horarioSel = null;
  actualizarBotonReserva();
  // Se muestran las fechas de los próximos 4 días con disponibilidad
  const fechas = [...new Set(horariosDisponibles.map(h => h.fecha))].slice(0, 4);
  document.getElementById("lista-fechas").innerHTML = fechas
    .map(f => `<button class="chip" data-fecha="${f}">${f}</button>`).join("")
    || "<p>No hay horarios disponibles por ahora.</p>";
  document.getElementById("lista-horas").innerHTML = "";
}

function mostrarHoras(fecha) {
  document.getElementById("lista-horas").innerHTML = horariosDisponibles
    .filter(h => h.fecha === fecha)
    .map(h => `<button class="chip" data-horario="${h.id_horario}">${h.hora_inicio} - ${h.hora_fin}</button>`)
    .join("");
}

function actualizarBotonReserva() {
  document.getElementById("btn-reservar").disabled = !(servicioSel && horarioSel);
}

async function cargarMisCitas() {
  const citas = await api("/citas/mis-citas");
  document.getElementById("mis-citas").innerHTML = citas.length ? `
    <table><thead><tr><th>Servicio</th><th>Fecha</th><th>Hora</th><th>Estado</th><th></th></tr></thead>
    <tbody>${citas.map(c => `
      <tr><td>${esc(c.servicio)}</td><td>${c.fecha}</td><td>${c.hora_inicio} - ${c.hora_fin}</td>
      <td><span class="badge ${c.estado}">${c.estado}</span></td>
      <td>${c.estado === "confirmada"
        ? `<button class="pequeno peligro" data-cancelar="${c.id_cita}">Cancelar</button>` : ""}</td></tr>`).join("")}
    </tbody></table>` : "<p>Aún no tienes citas.</p>";
}

// ----- Eventos de la vista cliente (delegación) -----
document.getElementById("vista-cliente").addEventListener("click", async (e) => {
  const servicio = e.target.closest(".servicio");
  if (servicio) {
    servicioSel = Number(servicio.dataset.id);
    document.querySelectorAll(".servicio").forEach(s => s.classList.toggle("sel", s === servicio));
    actualizarBotonReserva();
  }
  if (e.target.dataset.fecha) {
    document.querySelectorAll("[data-fecha]").forEach(b => b.classList.toggle("sel", b === e.target));
    horarioSel = null;
    actualizarBotonReserva();
    mostrarHoras(e.target.dataset.fecha);
  }
  if (e.target.dataset.horario) {
    horarioSel = Number(e.target.dataset.horario);
    document.querySelectorAll("[data-horario]").forEach(b => b.classList.toggle("sel", b === e.target));
    actualizarBotonReserva();
  }
  if (e.target.dataset.cancelar) {
    if (!confirm("¿Cancelar esta cita?")) return;
    try {
      await api(`/citas/${e.target.dataset.cancelar}/estado`, "PATCH", { estado: "cancelada" });
      mostrarMensaje("Cita cancelada. El horario quedó libre.");
      await cargarHorarios();
      await cargarMisCitas();
    } catch (err) { mostrarMensaje(err.message, "error"); }
  }
});

document.getElementById("btn-reservar").addEventListener("click", async () => {
  try {
    await api("/citas", "POST", { id_servicio: servicioSel, id_horario: horarioSel });
    mostrarMensaje("✅ Cita confirmada correctamente");
  } catch (err) {
    mostrarMensaje(err.message, "error"); // p. ej. horario ocupado: elegir otro
  }
  await cargarHorarios();
  await cargarMisCitas();
});
