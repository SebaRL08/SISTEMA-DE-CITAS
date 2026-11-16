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

function mostrarMensaje(texto, tipo = "ok") {
  const caja = document.getElementById("mensaje");
  caja.textContent = texto;
  caja.className = "mensaje " + tipo;
  clearTimeout(mostrarMensaje.temporizador);
  mostrarMensaje.temporizador = setTimeout(() => caja.classList.add("oculto"), 4000);
}

// Escapa HTML para evitar inyección de código en los textos mostrados
function esc(texto) {
  const d = document.createElement("div");
  d.textContent = texto ?? "";
  return d.innerHTML;
}
