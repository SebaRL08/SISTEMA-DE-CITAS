// ---------- Explorar proveedores ----------
async function renderExplorar(cont) {
  const provs = await api("/usuarios/proveedores");
  cont.innerHTML = `
    <div class="encabezado">
      <h2>Encuentra un profesional</h2>
      <input id="buscar" class="buscador" placeholder="🔎 Buscar por nombre…">
    </div>
    <div id="grid-provs" class="grid"></div>`;

  const pintar = (texto = "") => {
    const lista = provs.filter(p => p.nombre.toLowerCase().includes(texto.toLowerCase()));
    document.getElementById("grid-provs").innerHTML = lista.map(p => `
      <article class="card prov" data-prov="${p.id_usuario}">
        <div class="avatar" style="background:${colorDe(p.nombre)}">${esc(iniciales(p.nombre))}</div>
        <h3>${esc(p.nombre)}</h3>
        <p class="suave">${esc(p.descripcion || "Sin descripción")}</p>
        <div class="meta">
          <span class="pill">🛠️ ${p.servicios} servicios</span>
          <span class="pill ${p.cupos ? "verde" : "gris"}">🕒 ${p.cupos} cupos</span>
        </div>
        <button class="btn peq">Ver agenda</button>
      </article>`).join("") || vacio("😕", "No encontramos profesionales.");
  };
  pintar();
  document.getElementById("buscar").addEventListener("input", e => pintar(e.target.value));
  document.getElementById("grid-provs").addEventListener("click", (e) => {
    const card = e.target.closest("[data-prov]");
    if (card) abrirReserva(provs.find(p => p.id_usuario == card.dataset.prov));
  });
}

// ---------- Ventana de reserva en 3 pasos ----------
async function abrirReserva(prov) {
  abrirModal(cargando());
  let servicios, horarios;
  try {
    [servicios, horarios] = await Promise.all([
      api(`/servicios?id_proveedor=${prov.id_usuario}`),
      api(`/horarios?id_proveedor=${prov.id_usuario}`),
    ]);
  } catch (e) { cerrarModal(); toast(e.message, "error"); return; }

  const estado = { servicio: null, fecha: null, horario: null };
  const cuerpo = document.getElementById("modal-cuerpo");

  function pintar() {
    // Se muestran los próximos 7 días con disponibilidad (cambia el número si quieres más o menos)
    const fechas = [...new Set(horarios.map(h => h.fecha))].slice(0, 7);
    if (!fechas.includes(estado.fecha)) { estado.fecha = null; estado.horario = null; }
    const horas = horarios.filter(h => h.fecha === estado.fecha);
    const srv = servicios.find(s => s.id_servicio === estado.servicio);
    const hor = horarios.find(h => h.id_horario === estado.horario);

    cuerpo.innerHTML = `
      <div class="modal-cab">
        <div class="avatar" style="background:${colorDe(prov.nombre)}">${esc(iniciales(prov.nombre))}</div>
        <div><h2>${esc(prov.nombre)}</h2><p class="suave">${esc(prov.descripcion || "")}</p></div>
      </div>

      <h4>1. Elige un servicio</h4>
      <div class="opciones">${servicios.map(s => `
        <div class="opcion ${s.id_servicio === estado.servicio ? "sel" : ""}" data-servicio="${s.id_servicio}">
          <strong>${esc(s.nombre)}</strong>
          <small>${esc(s.descripcion)}</small>
          <small>⏱ ${s.duracion_minutos} min</small>
        </div>`).join("") || "<p class='suave'>Este profesional aún no tiene servicios activos.</p>"}</div>

      <h4>2. Elige un día</h4>
      <div class="dias">${fechas.map(f => {
        const d = fechaDe(f);
        return `<button class="dia ${f === estado.fecha ? "sel" : ""}" data-fecha="${f}">
          <small>${d.toLocaleDateString("es-CO", { weekday: "short" })}</small>
          <b>${d.getDate()}</b>
          <small>${d.toLocaleDateString("es-CO", { month: "short" })}</small></button>`;
      }).join("") || "<p class='suave'>No hay días disponibles por ahora.</p>"}</div>

      <h4>3. Elige una hora</h4>
      <div class="horas">${estado.fecha
        ? horas.map(h => `<button class="hora ${h.id_horario === estado.horario ? "sel" : ""}"
            data-horario="${h.id_horario}">${h.hora_inicio}</button>`).join("")
        : "<p class='suave'>Primero elige un día.</p>"}</div>

      <div class="resumen-reserva">${srv && hor
        ? `✅ <b>${esc(srv.nombre)}</b> · ${formatoFecha(hor.fecha)} · ${hor.hora_inicio} - ${hor.hora_fin}`
        : "Completa los 3 pasos para reservar"}</div>
      <button class="btn grande" id="btn-confirmar" ${srv && hor ? "" : "disabled"}>Confirmar reserva</button>`;
  }

  cuerpo.onclick = async (e) => {
    const t = e.target.closest("[data-servicio],[data-fecha],[data-horario],#btn-confirmar");
    if (!t) return;
    if (t.dataset.servicio) estado.servicio = Number(t.dataset.servicio);
    else if (t.dataset.fecha) { estado.fecha = t.dataset.fecha; estado.horario = null; }
    else if (t.dataset.horario) estado.horario = Number(t.dataset.horario);
    else if (t.id === "btn-confirmar") {
      try {
        await api("/citas", "POST", { id_servicio: estado.servicio, id_horario: estado.horario });
        cerrarModal();
        toast("✅ Cita confirmada correctamente");
        irA("citas");
        return;
      } catch (err) {
        toast(err.message, "error"); // p. ej. horario ocupado: se recarga para elegir otro
        horarios = await api(`/horarios?id_proveedor=${prov.id_usuario}`).catch(() => horarios);
        estado.horario = null;
      }
    }
    pintar();
  };
  pintar();
}

// ---------- Mis citas ----------
async function renderMisCitas(cont) {
  let citas = await api("/citas");
  let filtro = "proximas";
  cont.innerHTML = `
    <div class="encabezado">
      <h2>Mis citas</h2>
      <div class="tabs" style="margin:0">
        <button class="tab activa" data-f="proximas">Próximas</button>
        <button class="tab" data-f="historial">Historial</button>
      </div>
    </div>
    <div id="lista-citas"></div>`;

  const pintar = () => {
    const hoy = hoyISO();
    const proxima = c => c.estado === "confirmada" && c.fecha >= hoy;
    const lista = citas.filter(c => filtro === "proximas" ? proxima(c) : !proxima(c));
    document.getElementById("lista-citas").innerHTML =
      lista.map(c => tarjetaCita(c, "cliente")).join("") || vacio("🗓️", "No hay citas aquí.");
  };
  const recargar = async () => { citas = await api("/citas"); pintar(); };

  cont.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
    filtro = b.dataset.f;
    cont.querySelectorAll(".tab").forEach(x => x.classList.toggle("activa", x === b));
    pintar();
  }));
  document.getElementById("lista-citas").onclick = (e) => accionCita(e, recargar);
  pintar();
}