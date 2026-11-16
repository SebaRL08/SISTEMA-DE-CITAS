// Estos paneles los usan el proveedor (ve lo suyo) y el administrador (elige a qué proveedor ver/crear)
let provSel = "";     // proveedor elegido por el administrador ("" = todos)
let provLista = [];

const esAdmin = () => Sesion.usuario.rol === "administrador";
const qp = () => (provSel ? `?id_proveedor=${provSel}` : "");

async function cargarProveedores() {
  if (esAdmin()) provLista = await api("/usuarios/proveedores");
}

function htmlSelectorProv() {
  if (!esAdmin()) return "";
  return `<select id="sel-prov" class="select"><option value="">Todos los proveedores</option>${
    provLista.map(p => `<option value="${p.id_usuario}" ${String(p.id_usuario) === String(provSel) ? "selected" : ""}>
      ${esc(p.nombre)}</option>`).join("")}</select>`;
}

function enlazarSelectorProv(alCambiar) {
  const sel = document.getElementById("sel-prov");
  if (sel) sel.addEventListener("change", () => { provSel = sel.value; alCambiar(); });
}

// El administrador debe elegir proveedor antes de crear algo
function proveedorValido() {
  if (esAdmin() && !provSel) { toast("Selecciona un proveedor en la lista de arriba", "error"); return false; }
  return true;
}

// ================= RESUMEN =================
async function renderResumenProv(cont) {
  const [citas, servicios, horarios] = await Promise.all([api("/citas"), api("/servicios"), api("/horarios")]);
  const hoy = hoyISO();
  const proximas = citas.filter(c => c.estado === "confirmada" && c.fecha >= hoy)
    .sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio));
  cont.innerHTML = `
    <div class="encabezado"><h2>👋 Hola, ${esc(Sesion.usuario.nombre.split(" ")[0])}</h2></div>
    <div class="stats">
      ${stat("🗓️", proximas.length, "Citas próximas")}
      ${stat("✅", citas.filter(c => c.estado === "completada").length, "Completadas")}
      ${stat("🛠️", servicios.filter(s => s.activo).length, "Servicios activos")}
      ${stat("🕒", horarios.filter(h => h.estado === "disponible").length, "Cupos libres")}
    </div>
    <h3 class="subtitulo">Próximas citas</h3>
    <div id="prox">${proximas.slice(0, 5).map(c => tarjetaCita(c, "proveedor")).join("")
      || vacio("📭", "No tienes citas próximas.")}</div>`;
  animarNumeros(cont);
  document.getElementById("prox").onclick = (e) => accionCita(e, () => renderResumenProv(cont));
}

// ================= SERVICIOS =================
async function renderServicios(cont) {
  await cargarProveedores();
  let servicios = [];
  cont.innerHTML = `
    <div class="encabezado">
      <h2>Servicios</h2>
      <div class="acciones">${htmlSelectorProv()}<button class="btn" id="btn-nuevo">＋ Nuevo servicio</button></div>
    </div>
    <div id="grid-serv" class="grid"></div>`;

  const pintar = async () => {
    servicios = await api("/servicios" + qp());
    document.getElementById("grid-serv").innerHTML = servicios.map(s => `
      <article class="card servicio ${s.activo ? "" : "inactivo"}">
        <div class="fila-sb">
          <h3>${esc(s.nombre)}</h3>
          <label class="switch" title="Activar / desactivar">
            <input type="checkbox" data-toggle="${s.id_servicio}" ${s.activo ? "checked" : ""}><span></span>
          </label>
        </div>
        ${esAdmin() ? `<span class="pill">👤 ${esc(s.proveedor)}</span>` : ""}
        <p class="suave">${esc(s.descripcion) || "Sin descripción"}</p>
        <div class="meta"><span class="pill">⏱ ${s.duracion_minutos} min</span></div>
        <button class="btn peq ghost" data-editar="${s.id_servicio}">✏️ Editar</button>
      </article>`).join("") || vacio("🛠️", "Aún no hay servicios. ¡Crea el primero!");
  };

  function formServicio(s) {
    abrirModal(`
      <h2>${s ? "Editar" : "Nuevo"} servicio</h2>
      <form id="f-serv">
        <label>Nombre <input name="nombre" required minlength="2" maxlength="100" value="${esc(s?.nombre || "")}"></label>
        <label>Descripción <textarea name="descripcion" rows="3">${esc(s?.descripcion || "")}</textarea></label>
        <label>Duración (minutos) <input type="number" name="duracion" min="5" max="480" step="5" required
          value="${s?.duracion_minutos || 30}"></label>
        <button class="btn grande">Guardar</button>
      </form>`);
    document.getElementById("f-serv").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const cuerpo = {
        nombre: f.nombre.value, descripcion: f.descripcion.value,
        duracion_minutos: parseInt(f.duracion.value), activo: s ? !!s.activo : true,
      };
      if (!s && esAdmin()) cuerpo.id_proveedor = Number(provSel);
      try {
        if (s) await api(`/servicios/${s.id_servicio}`, "PUT", cuerpo);
        else await api("/servicios", "POST", cuerpo);
        cerrarModal();
        toast("Servicio guardado");
        await pintar();
      } catch (err) { toast(err.message, "error"); }
    };
  }

  document.getElementById("btn-nuevo").onclick = () => { if (proveedorValido()) formServicio(null); };
  enlazarSelectorProv(pintar);

  const grid = document.getElementById("grid-serv");
  grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-editar]");
    if (b) formServicio(servicios.find(x => x.id_servicio == b.dataset.editar));
  });
  grid.addEventListener("change", async (e) => {
    const t = e.target.closest("[data-toggle]");
    if (!t) return;
    const s = servicios.find(x => x.id_servicio == t.dataset.toggle);
    try {
      await api(`/servicios/${s.id_servicio}`, "PUT", {
        nombre: s.nombre, descripcion: s.descripcion || "",
        duracion_minutos: s.duracion_minutos, activo: t.checked,
      });
      toast(t.checked ? "Servicio activado" : "Servicio desactivado");
      await pintar();
    } catch (err) { toast(err.message, "error"); t.checked = !t.checked; }
  });
  await pintar();
}

// ================= AGENDA =================
async function renderAgenda(cont) {
  await cargarProveedores();
  let horarios = [];
  cont.innerHTML = `
    <div class="encabezado"><h2>Agenda</h2><div class="acciones">${htmlSelectorProv()}</div></div>
    <div class="card" style="margin-bottom:18px">
      <h3>Generar horarios</h3>
      <p class="suave">Ejemplo: de 09:00 a 12:00 cada 30 min crea 6 horarios de una vez.</p>
      <form id="f-agenda" class="acciones" style="align-items:end">
        <label>Fecha <input type="date" name="fecha" required min="${hoyISO()}" value="${hoyISO()}"></label>
        <label>Desde <input type="time" name="inicio" required value="09:00"></label>
        <label>Hasta <input type="time" name="fin" required value="12:00"></label>
        <label>Cada
          <select name="intervalo">
            <option value="15">15 min</option><option value="30" selected>30 min</option>
            <option value="45">45 min</option><option value="60">60 min</option>
            <option value="">Un solo bloque</option>
          </select></label>
        <button class="btn" style="margin-bottom:14px">Generar</button>
      </form>
    </div>
    <div class="leyenda">
      <span class="badge disponible">disponible</span><span class="badge reservado">reservado</span>
      <span class="badge bloqueado">bloqueado</span>
      <span class="suave">· Haz clic en un horario para bloquearlo o eliminarlo</span>
    </div>
    <div id="agenda-dias"></div>`;

  const pintar = async () => {
    horarios = await api("/horarios" + qp());
    const porDia = {};
    horarios.forEach(h => (porDia[h.fecha] ||= []).push(h));
    document.getElementById("agenda-dias").innerHTML = Object.keys(porDia).map(f => `
      <div class="card dia-card">
        <h4>📅 ${formatoFecha(f)}</h4>
        <div class="horas">${porDia[f].map(h => `
          <button class="hora ${h.estado}" data-h="${h.id_horario}">
            ${h.hora_inicio} - ${h.hora_fin}${esAdmin() ? `<small>${esc(h.proveedor)}</small>` : ""}
          </button>`).join("")}</div>
      </div>`).join("") || vacio("🕒", "Aún no hay horarios. Genera los primeros arriba.");
  };

  document.getElementById("f-agenda").onsubmit = async (e) => {
    e.preventDefault();
    if (!proveedorValido()) return;
    const f = e.target;
    const cuerpo = {
      fecha: f.fecha.value, hora_inicio: f.inicio.value, hora_fin: f.fin.value,
      intervalo_minutos: f.intervalo.value ? Number(f.intervalo.value) : null,
    };
    if (esAdmin()) cuerpo.id_proveedor = Number(provSel);
    try {
      const r = await api("/horarios", "POST", cuerpo);
      toast(`${r.creados} horario(s) creado(s)` + (r.omitidos ? ` · ${r.omitidos} omitido(s) por cruce` : ""));
      await pintar();
    } catch (err) { toast(err.message, "error"); }
  };

  document.getElementById("agenda-dias").onclick = (e) => {
    const b = e.target.closest("[data-h]");
    if (!b) return;
    const h = horarios.find(x => x.id_horario == b.dataset.h);
    abrirModal(`
      <h2>${formatoFecha(h.fecha)} · ${h.hora_inicio} - ${h.hora_fin}</h2>
      <p>Estado: <span class="badge ${h.estado}">${h.estado}</span></p>
      ${h.estado === "reservado"
        ? "<p class='suave'>Está reservado. Gestiona la cita desde la pestaña Citas.</p>"
        : `<div class="acciones">
             <button class="btn" data-acc="estado">${h.estado === "bloqueado" ? "Desbloquear" : "Bloquear"}</button>
             <button class="btn peligro" data-acc="borrar">Eliminar</button>
           </div>`}`);
    document.getElementById("modal-cuerpo").onclick = async (ev) => {
      const a = ev.target.closest("[data-acc]");
      if (!a) return;
      try {
        if (a.dataset.acc === "estado")
          await api(`/horarios/${h.id_horario}/estado`, "PATCH",
            { estado: h.estado === "bloqueado" ? "disponible" : "bloqueado" });
        else {
          if (!confirm("¿Eliminar este horario?")) return;
          await api(`/horarios/${h.id_horario}`, "DELETE");
        }
        cerrarModal();
        toast("Listo");
        await pintar();
      } catch (err) { toast(err.message, "error"); }
    };
  };

  enlazarSelectorProv(pintar);
  await pintar();
}

// ================= CITAS =================
async function renderCitasProv(cont) {
  await cargarProveedores();
  const rol = Sesion.usuario.rol;
  let citas = [];
  let filtro = "confirmada";
  cont.innerHTML = `
    <div class="encabezado"><h2>Citas</h2><div class="acciones">${htmlSelectorProv()}</div></div>
    <div class="tabs">
      <button class="tab activa" data-f="confirmada">Confirmadas</button>
      <button class="tab" data-f="completada">Completadas</button>
      <button class="tab" data-f="cancelada">Canceladas</button>
      <button class="tab" data-f="todas">Todas</button>
    </div>
    <div id="lista-citas"></div>`;

  const pintar = () => {
    const lista = citas.filter(c => filtro === "todas" || c.estado === filtro);
    document.getElementById("lista-citas").innerHTML =
      lista.map(c => tarjetaCita(c, rol)).join("") || vacio("🗓️", "No hay citas en esta categoría.");
  };
  const recargar = async () => { citas = await api("/citas" + qp()); pintar(); };

  cont.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
    filtro = b.dataset.f;
    cont.querySelectorAll(".tab").forEach(x => x.classList.toggle("activa", x === b));
    pintar();
  }));
  document.getElementById("lista-citas").onclick = (e) => accionCita(e, recargar);
  enlazarSelectorProv(recargar);
  await recargar();
}

// ================= PERFIL =================
async function renderPerfil(cont) {
  const p = await api("/usuarios/perfil");
  cont.innerHTML = `
    <div class="encabezado"><h2>Mi perfil</h2></div>
    <div class="card" style="max-width:520px">
      <div class="modal-cab">
        <div class="avatar" style="background:${colorDe(p.nombre)}">${esc(iniciales(p.nombre))}</div>
        <div><h3 style="margin:0">${esc(p.nombre)}</h3><p class="suave">${esc(p.correo)}</p></div>
      </div>
      <form id="f-perfil">
        <label>Descripción que verán los clientes
          <textarea name="descripcion" rows="4" maxlength="255"
            placeholder="Cuéntales qué haces, tu experiencia…">${esc(p.descripcion)}</textarea></label>
        <button class="btn">Guardar perfil</button>
      </form>
    </div>`;
  document.getElementById("f-perfil").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("/usuarios/perfil", "PATCH", { descripcion: e.target.descripcion.value });
      toast("Perfil actualizado");
    } catch (err) { toast(err.message, "error"); }
  };
}