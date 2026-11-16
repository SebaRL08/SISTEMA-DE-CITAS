const API = "/api";

const Sesion = {
  get token() { return localStorage.getItem("token"); },
  get usuario() {
    const u = localStorage.getItem("usuario");
    return u ? JSON.parse(u) : null;
  },
  guardar(token, usuario) {
    localStorage.setItem("token", token);
    localStorage.setItem("usuario", JSON.stringify(usuario));
  },
  limpiar() { localStorage.clear(); },
};

// Función única para hablar con el backend
async function api(ruta, metodo = "GET", cuerpo = null) {
  const opciones = { method: metodo, headers: { "Content-Type": "application/json" } };
  if (Sesion.token) opciones.headers.Authorization = "Bearer " + Sesion.token;
  if (cuerpo) opciones.body = JSON.stringify(cuerpo);

  const resp = await fetch(API + ruta, opciones);
  const datos = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    if (resp.status === 401 && Sesion.token) { Sesion.limpiar(); location.reload(); }
    let detalle = datos.detail;
    if (Array.isArray(detalle)) detalle = detalle.map(e => e.msg).join(", ");
    throw new Error(detalle || "Error en la solicitud");
  }
  return datos;
}

// ---------- Notificaciones flotantes ----------
function toast(texto, tipo = "ok") {
  const t = document.createElement("div");
  t.className = "toast " + tipo;
  t.textContent = texto;
  document.getElementById("toasts").appendChild(t);
  setTimeout(() => { t.classList.add("sale"); setTimeout(() => t.remove(), 300); }, 3500);
}

// ---------- Ventana emergente ----------
function abrirModal(html) {
  const cuerpo = document.getElementById("modal-cuerpo");
  cuerpo.onclick = null;
  cuerpo.innerHTML = html;
  document.getElementById("modal").classList.remove("oculto");
}
function cerrarModal() {
  document.getElementById("modal").classList.add("oculto");
  document.getElementById("modal-cuerpo").onclick = null;
}
document.getElementById("modal").addEventListener("click", (e) => {
  if (e.target.id === "modal" || e.target.id === "modal-x") cerrarModal();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarModal(); });

// ---------- Utilidades de texto y fechas ----------
// Escapa HTML para evitar inyección de código en los textos mostrados
function esc(texto) {
  const d = document.createElement("div");
  d.textContent = texto ?? "";
  return d.innerHTML.replace(/"/g, "&quot;");
}
function iniciales(nombre) {
  return nombre.split(" ").filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("");
}
function colorDe(texto) {
  let h = 0;
  for (const ch of texto) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 45%)`;
}
function fechaDe(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function formatoFecha(iso) {
  return fechaDe(iso).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
}
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- Piezas visuales reutilizables ----------
function vacio(icono, texto) { return `<div class="vacio"><span>${icono}</span>${texto}</div>`; }
function cargando() { return '<div class="cargando">Cargando…</div>'; }
function stat(icono, n, texto) {
  return `<div class="stat"><span class="stat-i">${icono}</span><b data-n="${n}">0</b><small>${texto}</small></div>`;
}
function animarNumeros(raiz = document) {
  raiz.querySelectorAll("[data-n]").forEach(el => {
    const fin = Number(el.dataset.n);
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min((t - t0) / 700, 1);
      el.textContent = Math.round(fin * p);
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  });
}

// Tarjeta de cita compartida por cliente, proveedor y administrador
function tarjetaCita(c, rol) {
  const quien = rol === "cliente"
    ? `con <b>${esc(c.proveedor)}</b>`
    : `Cliente: <b>${esc(c.cliente)}</b>${rol === "administrador" ? ` · Proveedor: ${esc(c.proveedor)}` : ""}`;
  let acciones = "";
  if (c.estado === "confirmada") {
    if (rol !== "cliente")
      acciones += `<button class="btn peq" data-cita="${c.id_cita}" data-estado="completada">✔ Completar</button>`;
    acciones += `<button class="btn peq peligro" data-cita="${c.id_cita}" data-estado="cancelada">Cancelar</button>`;
  }
  return `<article class="cita ${c.estado}">
    <div class="cita-info">
      <strong>${esc(c.servicio)}</strong>
      <span>${quien}</span>
      <span class="suave">📅 ${formatoFecha(c.fecha)} · 🕒 ${c.hora_inicio} - ${c.hora_fin}</span>
    </div>
    <div class="cita-acc"><span class="badge ${c.estado}">${c.estado}</span>${acciones}</div>
  </article>`;
}

// Maneja los botones Completar / Cancelar de cualquier lista de citas
async function accionCita(e, recargar) {
  const b = e.target.closest("[data-cita]");
  if (!b) return;
  if (b.dataset.estado === "cancelada" && !confirm("¿Cancelar esta cita? El horario quedará libre.")) return;
  try {
    await api(`/citas/${b.dataset.cita}/estado`, "PATCH", { estado: b.dataset.estado });
    toast(b.dataset.estado === "cancelada" ? "Cita cancelada" : "Cita completada");
    await recargar();
  } catch (err) { toast(err.message, "error"); }
}