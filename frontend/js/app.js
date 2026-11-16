// Pestañas de cada rol: cada una llama a una función de render definida en los otros archivos
const TABS = {
  cliente: [
    { id: "explorar", texto: "🔎 Explorar", render: renderExplorar },
    { id: "citas", texto: "🗓️ Mis citas", render: renderMisCitas },
  ],
  proveedor: [
    { id: "resumen", texto: "📊 Resumen", render: renderResumenProv },
    { id: "servicios", texto: "🛠️ Servicios", render: renderServicios },
    { id: "agenda", texto: "🕒 Agenda", render: renderAgenda },
    { id: "citas", texto: "🗓️ Citas", render: renderCitasProv },
    { id: "perfil", texto: "👤 Perfil", render: renderPerfil },
  ],
  administrador: [
    { id: "resumen", texto: "📊 Resumen", render: renderResumenAdmin },
    { id: "usuarios", texto: "👥 Usuarios", render: renderUsuarios },
    { id: "servicios", texto: "🛠️ Servicios", render: renderServicios },
    { id: "agenda", texto: "🕒 Agenda", render: renderAgenda },
    { id: "citas", texto: "🗓️ Citas", render: renderCitasProv },
  ],
};

function irA(id) {
  const rol = Sesion.usuario.rol;
  const tab = TABS[rol].find(t => t.id === id) || TABS[rol][0];
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("activa", b.dataset.tab === tab.id));
  const cont = document.getElementById("contenido");
  cont.innerHTML = cargando();
  Promise.resolve(tab.render(cont)).catch(e => { cont.innerHTML = vacio("⚠️", esc(e.message)); });
}

function entrar() {
  const u = Sesion.usuario;
  if (!Sesion.token || !u) return;
  document.getElementById("vista-auth").classList.add("oculto");
  document.getElementById("vista-app").classList.remove("oculto");
  document.getElementById("nombre-usuario").textContent = u.nombre;
  document.getElementById("rol-usuario").textContent = u.rol;
  document.getElementById("nav").innerHTML =
    TABS[u.rol].map(t => `<button data-tab="${t.id}">${t.texto}</button>`).join("");
  irA(TABS[u.rol][0].id);
}

document.getElementById("nav").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (b) irA(b.dataset.tab);
});

// Pestañas de login / registro
document.querySelectorAll("#vista-auth .tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll("#vista-auth .tab").forEach(b => b.classList.toggle("activa", b === btn));
  ["form-login", "form-registro"].forEach(id =>
    document.getElementById(id).classList.toggle("oculto", id !== btn.dataset.form));
}));

document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    const r = await api("/auth/login", "POST", { correo: f.correo.value, contrasena: f.contrasena.value });
    Sesion.guardar(r.token, r.usuario);
    f.reset();
    entrar();
  } catch (err) { toast(err.message, "error"); }
});

document.getElementById("form-registro").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    await api("/auth/registro", "POST", {
      nombre: f.nombre.value, correo: f.correo.value,
      contrasena: f.contrasena.value, rol: f.rol.value,
    });
    toast("Cuenta creada. Ya puedes iniciar sesión.");
    f.reset();
    document.querySelector('[data-form="form-login"]').click();
  } catch (err) { toast(err.message, "error"); }
});

document.getElementById("btn-salir").addEventListener("click", () => { Sesion.limpiar(); location.reload(); });

entrar();
