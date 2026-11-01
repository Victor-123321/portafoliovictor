import { createAuthClient } from "https://cdn.jsdelivr.net/npm/@neon/auth@0.8.2/dist/index.js/+esm";
import { PostgrestClient } from "https://cdn.jsdelivr.net/npm/@supabase/postgrest-js@1.19.4/+esm";

(async () => {
  const N = window.NEGOCIO;
  const { DIAS, $, $$, el, pesos, hora12, fechaISO, sumarDias, fechaLarga, enZona, aInstante, waUrl } = window.Comun;

  if (!N.neon) {
    document.body.replaceChildren(el("p", { class: "vacio" }, "El panel necesita el plan Pro: configura neon en config.js."));
    return;
  }

  // Neon Auth maneja la sesión; cada consulta a la Data API lleva el JWT del dueño,
  // y la base de datos (RLS) decide qué puede ver y cambiar.
  const auth = createAuthClient(N.neon.authUrl);

  // Neon Auth entrega el JWT en getSession() (encabezado set-auth-jwt → session.token)
  // y el SDK lo cachea hasta que expira. token() queda solo como respaldo.
  async function jwt() {
    const { data } = await auth.getSession();
    if (data?.session?.token) return data.session.token;
    const respaldo = await auth.token?.().catch(() => null);
    return respaldo?.data?.token || null;
  }

  const sb = new PostgrestClient(N.neon.dataApiUrl, {
    fetch: async (url, opciones = {}) => {
      const token = await jwt();
      // Sin token la Data API responde 400; mejor avisar que mandar la consulta sin credenciales.
      if (!token) return new Response(JSON.stringify({ code: "SIN_SESION", message: "No hay sesión" }), { status: 401 });
      const headers = new Headers(opciones.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return fetch(url, { ...opciones, headers });
    },
  });
  const ESTADOS = { pendiente: "Por confirmar", confirmada: "Confirmada", completada: "Completada", no_asistio: "No asistió", cancelada: "Cancelada" };
  const S = { negocio: null, servicios: [], profesionales: [], fecha: null, filtroProf: "" };

  // ---------- Utilidades ----------
  let toastTimer;
  function toast(msg) {
    const t = $("[data-toast]");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3000);
  }

  // Los errores de la base de datos vienen en inglés; se traducen los que el dueño puede provocar.
  function explicar(error) {
    if (error?.code === "23P01") return "Ese profesional ya tiene una cita que se empalma con ese horario.";
    if (error?.code === "23514") return "Revisa los datos: algún valor no es válido.";
    if (error?.code === "23503") return "No se puede borrar porque tiene citas registradas. Mejor desactívalo.";
    return "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.";
  }

  const tz = () => S.negocio.zona_horaria;
  const hoy = () => enZona(new Date(), tz()).fecha;
  const vista = (nombre) => $$("[data-vista]").forEach((v) => (v.hidden = v.dataset.vista !== nombre));

  // ---------- Sesión ----------
  // El mismo formulario sirve para entrar y, la primera vez, para crear la cuenta del dueño.
  let registrando = false;
  $("[data-modo]").addEventListener("click", () => {
    registrando = !registrando;
    $("[data-solo-registro]").hidden = !registrando;
    $("[data-solo-registro] input").required = registrando;
    $("[data-login] input[name=password]").autocomplete = registrando ? "new-password" : "current-password";
    $("[data-login] .btn--bloque").textContent = registrando ? "Crear cuenta" : "Entrar";
    $("[data-modo]").textContent = registrando ? "Ya tengo cuenta" : "¿Primera vez? Crea tu cuenta";
    $("[data-login-error]").hidden = true;
  });

  $("[data-login]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const boton = e.target.querySelector(".btn--bloque");
    boton.disabled = true;
    const datos = { email: f.get("email").trim(), password: f.get("password") };
    let error;
    try {
      ({ error } = registrando
        ? await auth.signUp.email({ ...datos, name: f.get("name").trim() })
        : await auth.signIn.email(datos));
    } catch (ex) {
      error = ex;
    }
    boton.disabled = false;
    const err = $("[data-login-error]");
    err.hidden = !error;
    if (!error) return iniciar();
    const codigo = error.code || "";
    err.textContent = codigo.includes("INVALID_EMAIL_OR_PASSWORD") ? "Correo o contraseña incorrectos."
      : codigo.includes("USER_ALREADY_EXISTS") ? "Ese correo ya tiene cuenta: usa «Ya tengo cuenta»."
      : codigo.includes("PASSWORD_TOO_SHORT") ? "La contraseña debe tener al menos 8 caracteres."
      : codigo.includes("EMAIL_NOT_VERIFIED") ? "Confirma tu correo con el código que te llegó y vuelve a entrar."
      : error.message || "No se pudo conectar. Inténtalo de nuevo.";
  });

  $("[data-salir]").addEventListener("click", async () => {
    await auth.signOut();
    location.reload();
  });

  async function iniciar() {
    const { data: miembro, error } = await sb.from("miembros").select("negocio_id").limit(1).maybeSingle();
    if (error?.code === "SIN_SESION") {
      vista("login");
      return;
    }
    if (error) {
      // Un error de red no debe sacar al dueño: se queda con su sesión y puede reintentar.
      console.error("No se pudo cargar el negocio", error);
      vista("login");
      const err = $("[data-login-error]");
      err.hidden = false;
      err.replaceChildren("No se pudo conectar con la agenda. ",
        el("button", { type: "button", class: "btn btn--texto", onclick: () => { err.hidden = true; iniciar(); } }, "Reintentar"));
      return;
    }
    if (!miembro) {
      const { data: sesion } = await auth.getSession();
      await auth.signOut();
      vista("login");
      const err = $("[data-login-error]");
      err.hidden = false;
      err.textContent = `Tu cuenta (${sesion?.user?.email || "sin correo"}) todavía no tiene un negocio asignado. Pídele a tu proveedor que te dé acceso.`;
      return;
    }
    const { data: negocio } = await sb.from("negocios").select("*").eq("id", miembro.negocio_id).single();
    S.negocio = negocio;
    $$("[data-nombre]").forEach((n) => (n.textContent = negocio.nombre));
    document.title = `Panel · ${negocio.nombre}`;
    await cargarCatalogo();
    S.fecha = hoy();
    vista("app");
    pintarFiltroProf();
    await cargarAgenda();
    setInterval(() => { if (!document.hidden && !$("[data-panel=agenda]").hidden) cargarAgenda(); }, 60_000);
  }

  async function cargarCatalogo() {
    const [s, p] = await Promise.all([
      sb.from("servicios").select("*").eq("negocio_id", S.negocio.id).order("orden").order("nombre"),
      sb.from("profesionales").select("*").eq("negocio_id", S.negocio.id).order("orden").order("nombre"),
    ]);
    S.servicios = s.data || [];
    S.profesionales = p.data || [];
  }

  // ---------- Pestañas ----------
  $("[data-tabs]").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]")?.dataset.tab;
    if (!tab) return;
    $$("[data-tab]").forEach((b) => (b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
    $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== tab));
    if (tab === "agenda") cargarAgenda();
    if (tab === "catalogo") pintarCatalogo();
    if (tab === "horario") cargarHorario();
  });

  // ---------- Agenda ----------
  function pintarFiltroProf() {
    $("[data-filtro-prof]").replaceChildren(
      el("option", { value: "" }, "Todo el equipo"),
      ...S.profesionales.filter((p) => p.activo).map((p) => el("option", { value: p.id }, p.nombre)),
    );
    $("[data-filtro-prof]").value = S.filtroProf;
  }

  async function cargarAgenda() {
    $("[data-fecha]").value = S.fecha;
    let q = sb.from("citas")
      .select("*, servicios(nombre), profesionales(nombre)")
      .eq("negocio_id", S.negocio.id)
      .gte("inicio", aInstante(S.fecha, "00:00", tz()))
      .lt("inicio", aInstante(sumarDias(S.fecha, 1), "00:00", tz()))
      .order("inicio");
    if (S.filtroProf) q = q.eq("profesional_id", S.filtroProf);
    const { data, error } = await q;
    if (error) return toast("No se pudo cargar la agenda.");
    pintarAgenda(data);
  }

  function pintarAgenda(citas) {
    const vivas = citas.filter((c) => !["cancelada", "no_asistio"].includes(c.estado));
    const total = vivas.reduce((t, c) => t + Number(c.precio), 0);
    const etiquetaDia = S.fecha === hoy() ? "Hoy" : S.fecha === sumarDias(hoy(), 1) ? "Mañana" : fechaLarga(S.fecha);
    $("[data-resumen]").replaceChildren(
      el("b", {}, etiquetaDia), ` · ${vivas.length} ${vivas.length === 1 ? "cita" : "citas"} · `, el("b", {}, pesos(total)), " estimado",
    );
    if (!citas.length) {
      $("[data-citas]").replaceChildren(el("div", { class: "vacio" }, "No hay citas este día."));
      return;
    }
    $("[data-citas]").replaceChildren(...citas.map(tarjetaCita));
  }

  function tarjetaCita(c) {
    const ini = enZona(c.inicio, tz()).hora;
    const fin = enZona(c.fin, tz()).hora;
    const viva = ["pendiente", "confirmada"].includes(c.estado);
    const acciones = [];
    if (c.estado === "pendiente") acciones.push(boton("Confirmar", () => cambiarEstado(c, "confirmada")));
    if (viva) {
      if (c.cliente_tel) acciones.push(el("a", { class: "btn btn--suave", href: recordatorio(c), target: "_blank", rel: "noopener" }, "WhatsApp"));
      acciones.push(boton("Llegó ✓", () => cambiarEstado(c, "completada")));
      acciones.push(boton("No vino", () => cambiarEstado(c, "no_asistio")));
      acciones.push(boton("Cancelar", () => confirm(`¿Cancelar la cita de ${c.cliente_nombre}?`) && cambiarEstado(c, "cancelada")));
    } else {
      acciones.push(boton("Deshacer", () => cambiarEstado(c, "confirmada")));
    }
    return el("article", { class: `cita cita--${c.estado}` },
      el("div", { class: "cita__hora" }, hora12(ini), el("small", {}, hora12(fin))),
      el("div", {},
        el("div", { class: "cita__cliente" }, c.cliente_nombre, el("span", { class: `chip chip--${c.estado}` }, ESTADOS[c.estado])),
        el("div", { class: "cita__detalle" },
          `${c.servicios?.nombre} · ${c.profesionales?.nombre} · ${pesos(c.precio)}`,
          c.cliente_tel ? ` · ${c.cliente_tel}` : "", c.origen === "panel" ? " · mostrador" : ""),
        c.notas ? el("div", { class: "cita__notas" }, `“${c.notas}”`) : null,
      ),
      el("div", { class: "cita__acciones" }, acciones),
    );
  }

  const boton = (texto, onclick) => el("button", { class: "btn btn--suave", onclick }, texto);

  function recordatorio(c) {
    const { fecha, hora } = enZona(c.inicio, tz());
    const cuando = fecha === hoy() ? "hoy" : fecha === sumarDias(hoy(), 1) ? "mañana" : `el ${fechaLarga(fecha).toLowerCase()}`;
    const link = new URL(`../cita.html?t=${c.token}`, location.href).href;
    const texto = [
      `Hola ${c.cliente_nombre.split(" ")[0]}, te recordamos tu cita en ${S.negocio.nombre} ${cuando} a las ${hora12(hora)}`,
      `(${c.servicios?.nombre} con ${c.profesionales?.nombre}).`,
      ``,
      `Si no puedes venir, cancela aquí para liberar el espacio: ${link}`,
      `¡Te esperamos!`,
    ].join("\n");
    return waUrl("52" + c.cliente_tel, texto);
  }

  async function cambiarEstado(c, estado) {
    const { error } = await sb.from("citas").update({ estado }).eq("id", c.id);
    if (error) toast(explicar(error));
    else toast(`${c.cliente_nombre}: ${ESTADOS[estado].toLowerCase()}`);
    cargarAgenda();
  }

  $$("[data-dia]").forEach((b) => b.addEventListener("click", () => { S.fecha = sumarDias(S.fecha, Number(b.dataset.dia)); cargarAgenda(); }));
  $("[data-hoy]").addEventListener("click", () => { S.fecha = hoy(); cargarAgenda(); });
  $("[data-fecha]").addEventListener("change", (e) => { if (e.target.value) { S.fecha = e.target.value; cargarAgenda(); } });
  $("[data-filtro-prof]").addEventListener("change", (e) => { S.filtroProf = e.target.value; cargarAgenda(); });

  // ---------- Cita de mostrador / teléfono ----------
  const modal = $("[data-modal-cita]");
  const formCita = $("[data-form-cita]");

  $("[data-nueva]").addEventListener("click", () => {
    formCita.reset();
    formCita.servicio.replaceChildren(...S.servicios.filter((s) => s.activo).map((s) => el("option", { value: s.id }, `${s.nombre} · ${s.duracion_min} min · ${pesos(s.precio)}`)));
    formCita.profesional.replaceChildren(...S.profesionales.filter((p) => p.activo).map((p) => el("option", { value: p.id }, p.nombre)));
    if (S.filtroProf) formCita.profesional.value = S.filtroProf;
    formCita.fecha.value = S.fecha;
    const ahora = enZona(new Date(), tz()).hora;
    formCita.hora.value = S.fecha === hoy() ? ahora : "10:00";
    $("[data-cita-error]").hidden = true;
    modal.showModal();
  });
  $("[data-cerrar]").addEventListener("click", () => modal.close());

  formCita.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = formCita;
    const servicio = S.servicios.find((s) => s.id === f.servicio.value);
    const tel = f.telefono.value.replace(/\D/g, "");
    const err = $("[data-cita-error]");
    if (tel && tel.length !== 10) {
      err.hidden = false;
      err.textContent = "El WhatsApp debe tener 10 dígitos (o déjalo vacío).";
      return;
    }
    const inicio = aInstante(f.fecha.value, f.hora.value, tz());
    const { error } = await sb.from("citas").insert({
      negocio_id: S.negocio.id,
      servicio_id: servicio.id,
      profesional_id: f.profesional.value,
      inicio,
      fin: new Date(new Date(inicio).getTime() + servicio.duracion_min * 60_000).toISOString(),
      cliente_nombre: f.nombre.value.trim(),
      cliente_tel: tel,
      notas: f.notas.value.trim() || null,
      precio: servicio.precio,
      estado: "confirmada",
      origen: "panel",
    });
    if (error) {
      err.hidden = false;
      err.textContent = explicar(error);
      return;
    }
    modal.close();
    toast("Cita guardada");
    S.fecha = f.fecha.value;
    cargarAgenda();
  });

  // ---------- Servicios y equipo ----------
  // Cada fila guarda sola; el botón se habilita en cuanto algo cambia.
  function filaEditable(clase, campos, guardar, borrar) {
    const btn = el("button", { class: "btn", disabled: true }, "Guardar");
    const fila = el("div", { class: `fila-edit ${clase}` }, campos, btn, borrar ? el("button", { class: "btn btn--texto", onclick: borrar }, "Borrar") : null);
    fila.addEventListener("input", () => (btn.disabled = false));
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const error = await guardar();
      if (error) { btn.disabled = false; toast(explicar(error)); } else toast("Guardado");
    });
    return fila;
  }

  function pintarCatalogo() {
    $("[data-servicios]").replaceChildren(...S.servicios.map((s) => {
      const nombre = el("input", { value: s.nombre, "aria-label": "Nombre", maxlength: 60 });
      const duracion = el("input", { type: "number", value: s.duracion_min, min: 5, max: 480, step: 5, "aria-label": "Minutos", title: "Duración en minutos" });
      const precio = el("input", { type: "number", value: Number(s.precio), min: 0, step: 10, "aria-label": "Precio", title: "Precio" });
      const activo = el("input", { type: "checkbox" });
      activo.checked = s.activo;
      return filaEditable("fila-edit--servicio",
        [nombre, el("label", {}, duracion, "min"), el("label", {}, "$", precio), el("label", {}, activo, "Activo")],
        async () => {
          const cambios = { nombre: nombre.value.trim(), duracion_min: Number(duracion.value), precio: Number(precio.value), activo: activo.checked };
          const { error } = await sb.from("servicios").update(cambios).eq("id", s.id);
          if (!error) Object.assign(s, cambios);
          return error;
        });
    }));

    $("[data-equipo]").replaceChildren(...S.profesionales.map((p) => {
      const nombre = el("input", { value: p.nombre, "aria-label": "Nombre", maxlength: 40 });
      const esp = el("input", { value: p.especialidad || "", placeholder: "Especialidad", "aria-label": "Especialidad", maxlength: 60 });
      const activo = el("input", { type: "checkbox" });
      activo.checked = p.activo;
      return filaEditable("fila-edit--prof",
        [nombre, esp, el("label", {}, activo, "Activo")],
        async () => {
          const cambios = { nombre: nombre.value.trim(), especialidad: esp.value.trim(), activo: activo.checked };
          const { error } = await sb.from("profesionales").update(cambios).eq("id", p.id);
          if (!error) { Object.assign(p, cambios); pintarFiltroProf(); }
          return error;
        });
    }));
  }

  $("[data-agregar-servicio]").addEventListener("click", async () => {
    const { error } = await sb.from("servicios").insert({ negocio_id: S.negocio.id, nombre: "Nuevo servicio", duracion_min: 30, precio: 0, activo: false, orden: S.servicios.length + 1 });
    if (error) return toast(explicar(error));
    await cargarCatalogo();
    pintarCatalogo();
    toast("Servicio agregado (inactivo): ponle nombre y precio, y actívalo.");
  });

  $("[data-agregar-prof]").addEventListener("click", async () => {
    const { error } = await sb.from("profesionales").insert({ negocio_id: S.negocio.id, nombre: "Nueva persona", activo: false, orden: S.profesionales.length + 1 });
    if (error) return toast(explicar(error));
    await cargarCatalogo();
    pintarCatalogo();
    toast("Persona agregada (inactiva): ponle nombre y actívala.");
  });

  // ---------- Horario y bloqueos ----------
  async function cargarHorario() {
    const [{ data: horarios }, { data: bloqueos }] = await Promise.all([
      sb.from("horarios").select("*").eq("negocio_id", S.negocio.id),
      sb.from("bloqueos").select("*, profesionales(nombre)").eq("negocio_id", S.negocio.id)
        .gte("fin", new Date().toISOString()).order("inicio"),
    ]);
    pintarHorario(horarios || []);
    pintarBloqueos(bloqueos || []);
  }

  function pintarHorario(horarios) {
    $("[data-horario]").replaceChildren(...[1, 2, 3, 4, 5, 6, 0].map((d) => {
      const h = horarios.find((x) => x.dia === d);
      const abierto = el("input", { type: "checkbox", "data-abierto": d });
      abierto.checked = Boolean(h);
      const abre = el("input", { type: "time", step: 900, value: h?.abre.slice(0, 5) || "10:00", "data-abre": d, "aria-label": `${DIAS[d]} abre` });
      const cierra = el("input", { type: "time", step: 900, value: h?.cierra.slice(0, 5) || "20:00", "data-cierra": d, "aria-label": `${DIAS[d]} cierra` });
      const sync = () => { abre.disabled = cierra.disabled = !abierto.checked; };
      abierto.addEventListener("change", sync);
      sync();
      return el("div", { class: "fila-edit fila-edit--dia" }, el("strong", {}, DIAS[d]), el("label", {}, abierto, "Abre"), abre, cierra);
    }));
  }

  $("[data-guardar-horario]").addEventListener("click", async () => {
    const abiertos = [];
    const cerrados = [];
    for (const d of [0, 1, 2, 3, 4, 5, 6]) {
      if (!$(`[data-abierto="${d}"]`).checked) { cerrados.push(d); continue; }
      const abre = $(`[data-abre="${d}"]`).value;
      const cierra = $(`[data-cierra="${d}"]`).value;
      if (!abre || !cierra || cierra <= abre) return toast(`${DIAS[d]}: la hora de cierre debe ser después de la de apertura.`);
      abiertos.push({ negocio_id: S.negocio.id, dia: d, abre, cierra });
    }
    const r1 = await sb.from("horarios").upsert(abiertos, { onConflict: "negocio_id,dia" });
    const r2 = cerrados.length ? await sb.from("horarios").delete().eq("negocio_id", S.negocio.id).in("dia", cerrados) : {};
    const error = r1.error || r2.error;
    toast(error ? explicar(error) : "Horario guardado");
  });

  function pintarBloqueos(bloqueos) {
    const form = $("[data-bloqueo-form]");
    form.profesional.replaceChildren(
      el("option", { value: "" }, "Todo el negocio"),
      ...S.profesionales.filter((p) => p.activo).map((p) => el("option", { value: p.id }, p.nombre)),
    );
    if (!form.fecha.value) form.fecha.value = hoy();
    if (!bloqueos.length) {
      $("[data-bloqueos]").replaceChildren(el("p", { class: "tenue" }, "No hay bloqueos próximos."));
      return;
    }
    $("[data-bloqueos]").replaceChildren(...bloqueos.map((b) => {
      const i = enZona(b.inicio, tz());
      const f = enZona(b.fin, tz());
      const rango = i.fecha === f.fecha
        ? `${fechaLarga(i.fecha)}, ${hora12(i.hora)} – ${hora12(f.hora)}`
        : `${fechaLarga(i.fecha)} ${hora12(i.hora)} – ${fechaLarga(f.fecha)} ${hora12(f.hora)}`;
      return el("div", { class: "fila-edit fila-edit--bloqueo" },
        el("div", {}, el("strong", {}, b.profesionales?.nombre || "Todo el negocio"), el("div", { class: "tenue", style: "margin:0" }, rango, b.motivo ? ` · ${b.motivo}` : "")),
        el("button", {
          class: "btn btn--suave",
          onclick: async () => {
            const { error } = await sb.from("bloqueos").delete().eq("id", b.id);
            toast(error ? explicar(error) : "Bloqueo eliminado");
            cargarHorario();
          },
        }, "Quitar"),
      );
    }));
  }

  $("[data-bloqueo-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.hasta.value <= f.desde.value) return toast("La hora final debe ser después de la inicial.");
    const { error } = await sb.from("bloqueos").insert({
      negocio_id: S.negocio.id,
      profesional_id: f.profesional.value || null,
      inicio: aInstante(f.fecha.value, f.desde.value, tz()),
      fin: aInstante(f.fecha.value, f.hasta.value, tz()),
      motivo: f.motivo.value.trim() || null,
    });
    if (error) return toast(explicar(error));
    f.motivo.value = "";
    toast("Horario bloqueado");
    cargarHorario();
  });

  // ---------- Arranque ----------
  const { data: sesion } = await auth.getSession();
  if (sesion?.user) iniciar();
  else vista("login");
})();
