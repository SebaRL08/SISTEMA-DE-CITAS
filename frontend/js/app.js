const vistas = ["vista-auth", "vista-cliente", "vista-admin"];

function mostrarVista(id) {
  vistas.forEach(v => document.getElementById(v).classList.toggle("oculto", v !== id));
}

function entrar() {
  const usuario = Sesion.usuario;
  if (!Sesion.token || !usuario) { mostrarVista("vista-auth"); return; }
  document.getElementById("barra-usuario").classList.remove("oculto");
  document.getElementById("nombre-usuario").textContent = `${usuario.nombre} (${usuario.rol})`;
  if (usuario.rol === "administrador") { mostrarVista("vista-admin"); iniciarAdmin(); }
  else { mostrarVista("vista-cliente"); iniciarCliente(); }
}

// Cambio entre pestañas de login/registro
document.querySelectorAll("#vista-auth .tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll("#vista-auth .tab").forEach(b => b.classList.toggle("activa", b === btn));
  ["form-login", "form-registro"].forEach(id =>
    document.getElementById(id).classList.toggle("oculto", id !== btn.dataset.form));
}));

// Pestañas del panel administrador
document.querySelectorAll("#vista-admin .tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll("#vista-admin .tab").forEach(b => b.classList.toggle("activa", b === btn));
  document.querySelectorAll("#vista-admin .panel").forEach(p =>
    p.classList.toggle("oculto", p.id !== btn.dataset.panel));
}));

document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    const r = await api("/auth/login", "POST", { correo: f.correo.value, contrasena: f.contrasena.value });
    Sesion.guardar(r.token, r.usuario);
    f.reset();
    entrar();
  } catch (err) { mostrarMensaje(err.message, "error"); }
});

document.getElementById("form-registro").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    await api("/auth/registro", "POST",
      { nombre: f.nombre.value, correo: f.correo.value, contrasena: f.contrasena.value });
    mostrarMensaje("Cuenta creada. Ya puedes iniciar sesión.");
    f.reset();
    document.querySelector('[data-form="form-login"]').click();
  } catch (err) { mostrarMensaje(err.message, "error"); }
});

document.getElementById("btn-salir").addEventListener("click", () => { Sesion.limpiar(); location.reload(); });

entrar();
