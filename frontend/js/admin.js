// ================= RESUMEN GLOBAL =================
async function renderResumenAdmin(cont) {
  const [usuarios, servicios, horarios, citas] = await Promise.all([
    api("/usuarios"), api("/servicios"), api("/horarios"), api("/citas"),
  ]);
  cont.innerHTML = `
    <div class="encabezado"><h2>📊 Panel de control</h2></div>
    <div class="stats">
      ${stat("👥", usuarios.length, "Usuarios")}
      ${stat("🛠️", usuarios.filter(u => u.rol === "proveedor").length, "Proveedores")}
      ${stat("🙋", usuarios.filter(u => u.rol === "cliente").length, "Clientes")}
      ${stat("🗓️", citas.filter(c => c.estado === "confirmada").length, "Citas confirmadas")}
      ${stat("🕒", horarios.filter(h => h.estado === "disponible").length, "Cupos libres")}
      ${stat("🧩", servicios.filter(s => s.activo).length, "Servicios activos")}
    </div>
    <h3 class="subtitulo">Citas recientes</h3>
    <div id="recientes">${citas.slice(0, 5).map(c => tarjetaCita(c, "administrador")).join("")
      || vacio("📭", "Todavía no hay citas.")}</div>`;
  animarNumeros(cont);
  document.getElementById("recientes").onclick = (e) => accionCita(e, () => renderResumenAdmin(cont));
}

// ================= USUARIOS =================
async function renderUsuarios(cont) {
  let usuarios = await api("/usuarios");
  const yo = Sesion.usuario.id_usuario;
  cont.innerHTML = `
    <div class="encabezado">
      <h2>Usuarios</h2>
      <div class="acciones">
        <input id="buscar-u" class="buscador" placeholder="🔎 Buscar nombre o correo…">
        <select id="filtro-rol" class="select">
          <option value="">Todos los roles</option>
          <option value="administrador">Administradores</option>
          <option value="proveedor">Proveedores</option>
          <option value="cliente">Clientes</option>
        </select>
      </div>
    </div>
    <div class="card tabla-wrap" id="tabla-u"></div>`;

  const pintar = () => {
    const texto = document.getElementById("buscar-u").value.toLowerCase();
    const rol = document.getElementById("filtro-rol").value;
    const lista = usuarios.filter(u =>
      (!rol || u.rol === rol) && (u.nombre + u.correo).toLowerCase().includes(texto));
    document.getElementById("tabla-u").innerHTML = lista.length ? `
      <table><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Activo</th><th>Registro</th></tr></thead>
      <tbody>${lista.map(u => `<tr>
        <td><b>${esc(u.nombre)}</b></td>
        <td>${esc(u.correo)}</td>
        <td><select class="select" data-rol="${u.id_usuario}" ${u.id_usuario === yo ? "disabled" : ""}>
          ${["cliente", "proveedor", "administrador"].map(r =>
            `<option value="${r}" ${u.rol === r ? "selected" : ""}>${r}</option>`).join("")}
        </select></td>
        <td><label class="switch" style="margin:0">
          <input type="checkbox" data-activo="${u.id_usuario}" ${u.activo ? "checked" : ""}
            ${u.id_usuario === yo ? "disabled" : ""}><span></span></label></td>
        <td class="suave">${String(u.fecha_registro).replace("T", " ").slice(0, 16)}</td>
      </tr>`).join("")}</tbody></table>` : vacio("🔍", "Sin resultados.");
  };

  const guardar = async (id, rol, activo) => {
    try {
      await api(`/usuarios/${id}`, "PATCH", { rol, activo });
      toast("Usuario actualizado");
    } catch (err) { toast(err.message, "error"); }
    usuarios = await api("/usuarios");
    pintar();
  };

  document.getElementById("buscar-u").addEventListener("input", pintar);
  document.getElementById("filtro-rol").addEventListener("change", pintar);
  document.getElementById("tabla-u").addEventListener("change", (e) => {
    if (e.target.dataset.rol) {
      const u = usuarios.find(x => x.id_usuario == e.target.dataset.rol);
      guardar(u.id_usuario, e.target.value, !!u.activo);
    }
    if (e.target.dataset.activo) {
      const u = usuarios.find(x => x.id_usuario == e.target.dataset.activo);
      guardar(u.id_usuario, u.rol, e.target.checked);
    }
  });
  pintar();
}
