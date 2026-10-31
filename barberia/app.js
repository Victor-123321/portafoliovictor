(() => {
  const N = window.NEGOCIO;
  const { DIAS, DIAS_CORTOS, MESES, $, $$, el, pesos, aMin, aHora, hora12, fechaISO, deISO, sumarDias, fechaLarga, waUrl, api, mensajeError, googleCalendar } = window.Comun;
  const GIROS = {
    barberia: { kicker: "Barbería", profesional: "barbero" },
    estetica: {
      kicker: "Estética & Belleza",
      profesional: "estilista",
      // Se usan cuando una demo pide ?giro=estetica sobre una config de barbería.
      servicios: [
        { nombre: "Manicure gelish", duracion: 60, precio: 280, descripcion: "Limado, cutícula y esmalte gelish." },
        { nombre: "Uñas acrílicas", duracion: 90, precio: 450, descripcion: "Aplicación completa, diseño sencillo." },
        { nombre: "Pedicure spa", duracion: 60, precio: 350, descripcion: "Exfoliación, mascarilla y esmalte." },
        { nombre: "Lifting de pestañas", duracion: 60, precio: 400, descripcion: "Incluye tinte." },
        { nombre: "Corte y peinado", duracion: 60, precio: 300, descripcion: "Lavado, corte y secado." },
        { nombre: "Tinte completo", duracion: 120, precio: 900, descripcion: "Precio desde; depende del largo." },
      ],
      equipo: [
        { nombre: "Fernanda", especialidad: "Uñas y nail art", foto: "" },
        { nombre: "Mariana", especialidad: "Color y corte", foto: "" },
        { nombre: "Sofía", especialidad: "Pestañas y cejas", foto: "" },
      ],
      resenas: [
        { autor: "Paola G.", texto: "Mis uñas duraron perfectas tres semanas. Agendar en línea es comodísimo.", estrellas: 5 },
        { autor: "Karla V.", texto: "Súper puntuales y el lugar muy limpio.", estrellas: 5 },
        { autor: "Ana L.", texto: "El lifting quedó increíble, ya reservé el siguiente.", estrellas: 5 },
      ],
    },
  };

  // Plan Pro: con datos de Supabase en config.js las citas se guardan en la base de datos.
  // Sin ellos (plan Básico) o si Supabase no responde, la cita se manda por WhatsApp.
  let VIVO = Boolean(N.supabase?.url && N.supabase?.anonKey && N.supabase?.slug);

  // Demos personalizadas sin tocar código:
  // index.html?nombre=Barber%C3%ADa%20Don%20Pepe&color=b91c1c&wa=523311112222
  const params = new URLSearchParams(location.search);
  const hex = (v) => (/^#?[0-9a-f]{6}$/i.test(v) ? "#" + v.replace("#", "") : null);
  if (params.get("nombre")) N.nombre = params.get("nombre");
  if (params.get("eslogan")) N.eslogan = params.get("eslogan");
  if (params.get("dir")) N.direccion = params.get("dir");
  if (params.get("ig")) N.instagram = params.get("ig").replace("@", "");
  if (/^\d{12,13}$/.test(params.get("wa") || "")) N.whatsapp = params.get("wa");
  if (GIROS[params.get("giro")] && params.get("giro") !== N.giro) {
    N.giro = params.get("giro");
    const preset = GIROS[N.giro];
    for (const k of ["servicios", "equipo", "resenas"]) if (preset[k]) N[k] = preset[k];
    VIVO = false; // una demo de otro giro no puede reservar en la agenda real
  }
  if (hex(params.get("color") || "")) N.colores.acento = hex(params.get("color"));
  if (hex(params.get("fondo") || "")) N.colores.fondo = hex(params.get("fondo"));

  const giro = GIROS[N.giro] || GIROS.barberia;

  // Servicios, equipo y horario vienen de la base de datos para que los cambios del panel
  // se vean en el sitio sin volver a publicarlo.
  async function cargarDeSupabase() {
    const sel = "*,servicios(*),profesionales(*),horarios(*)";
    const [neg] = await api(N.supabase, `negocios?slug=eq.${encodeURIComponent(N.supabase.slug)}&select=${sel}`);
    if (!neg) throw new Error("NEGOCIO_NO_EXISTE");
    const porOrden = (a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre);
    N.nombre = neg.nombre;
    N.whatsapp = neg.whatsapp;
    N.diasDeAnticipacion = neg.dias_anticipacion;
    N.servicios = neg.servicios.filter((s) => s.activo).sort(porOrden)
      .map((s) => ({ id: s.id, nombre: s.nombre, descripcion: s.descripcion, duracion: s.duracion_min, precio: Number(s.precio) }));
    N.equipo = neg.profesionales.filter((p) => p.activo).sort(porOrden)
      .map((p) => ({ id: p.id, nombre: p.nombre, especialidad: p.especialidad || "", foto: p.foto || "" }));
    N.horario = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => {
      const h = neg.horarios.find((x) => x.dia === d);
      return [d, h ? [h.abre.slice(0, 5), h.cierra.slice(0, 5)] : null];
    }));
  }

  // ---------- Página ----------
  function pintarPagina() {
    document.title = `${N.nombre} · Agenda tu cita`;
    document.documentElement.style.setProperty("--acento", N.colores.acento);
    document.documentElement.style.setProperty("--fondo", N.colores.fondo);

    $$("[data-nombre]").forEach((n) => (n.textContent = N.nombre));
    $("[data-kicker]").textContent = giro.kicker;
    $("[data-eslogan]").textContent = N.eslogan;
    $("[data-wa-link]").href = waUrl(N.whatsapp, `Hola ${N.nombre}, quiero información.`);
    $("[data-direccion]").textContent = N.direccion;
    $("[data-mapa]").href = N.mapa || `https://maps.google.com/?q=${encodeURIComponent(N.direccion)}`;
    $("[data-tel]").textContent = N.telefono;
    $("[data-tel]").href = "tel:" + N.telefono.replace(/\D/g, "");
    if (N.instagram) {
      $("[data-ig]").textContent = "@" + N.instagram;
      $("[data-ig]").href = "https://instagram.com/" + N.instagram;
    } else {
      $("[data-ig-wrap]")?.remove();
    }
    $("[data-anio]").textContent = new Date().getFullYear();
    $("[data-creditos]").textContent = N.creditos?.texto || "";
    $("[data-creditos]").href = N.creditos?.url || "#";

    pintarEstado();

    $("[data-servicios]").replaceChildren(
      ...N.servicios.map((s, i) =>
        el("article", { class: "servicio" },
          el("div", { class: "servicio__fila" }, el("h3", {}, s.nombre), el("span", { class: "servicio__precio" }, pesos(s.precio))),
          el("p", {}, s.descripcion || ""),
          el("span", { class: "servicio__dur" }, `${s.duracion} min`),
          el("button", { class: "btn btn--sm", onclick: () => abrirReserva(i) }, "Agendar"),
        ),
      ),
    );

    $("[data-equipo]").replaceChildren(
      ...N.equipo.map((p) => {
        const foto = el("div", { class: "persona__foto" }, p.foto ? null : p.nombre[0]);
        if (p.foto) foto.style.backgroundImage = `url("${p.foto}")`;
        return el("div", { class: "persona" }, foto, el("h3", {}, p.nombre), el("p", {}, p.especialidad));
      }),
    );

    const fotos = N.galeria.length ? N.galeria : Array(6).fill("");
    $("[data-galeria]").replaceChildren(
      ...fotos.map((src, i) => {
        const d = el("div");
        if (src) d.style.backgroundImage = `url("${src}")`;
        else d.style.background = `linear-gradient(${120 + i * 40}deg, color-mix(in srgb, var(--acento) ${18 + (i % 3) * 12}%, var(--fondo)), var(--superficie))`;
        return d;
      }),
    );

    $("[data-resenas]").replaceChildren(
      ...N.resenas.map((r) =>
        el("blockquote", { class: "resena" },
          el("div", { class: "resena__estrellas" }, "★".repeat(r.estrellas)),
          el("p", {}, `“${r.texto}”`),
          el("cite", {}, "— " + r.autor),
        ),
      ),
    );

    const hoy = new Date().getDay();
    $("[data-horario]").replaceChildren(
      ...[1, 2, 3, 4, 5, 6, 0].map((d) => {
        const h = N.horario[d];
        return el("li", { class: d === hoy ? "hoy" : "" },
          el("span", {}, DIAS[d]),
          el("span", {}, h ? `${hora12(h[0])} – ${hora12(h[1])}` : "Cerrado"),
        );
      }),
    );
  }

  function pintarEstado() {
    const ahora = new Date();
    const min = ahora.getHours() * 60 + ahora.getMinutes();
    const h = N.horario[ahora.getDay()];
    const caja = $("[data-estado]");
    if (h && min >= aMin(h[0]) && min < aMin(h[1])) {
      caja.replaceChildren(el("span", { class: "punto", style: "background:#22c55e" }), el("b", {}, "Abierto ahora"), ` · cierra a las ${hora12(h[1])}`);
      return;
    }
    for (let i = 0; i < 7; i++) {
      const d = new Date(ahora);
      d.setDate(d.getDate() + i);
      const hd = N.horario[d.getDay()];
      if (!hd || (i === 0 && min >= aMin(hd[0]))) continue;
      const cuando = i === 0 ? "hoy" : i === 1 ? "mañana" : DIAS[d.getDay()].toLowerCase();
      caja.replaceChildren(el("span", { class: "punto", style: "background:#ef4444" }), el("b", {}, "Cerrado"), ` · abre ${cuando} a las ${hora12(hd[0])}`);
      return;
    }
  }

  // ---------- Disponibilidad ----------
  // Ambos modos producen lo mismo: { "YYYY-MM-DD": ["10:00", "10:30", ...] }.

  function disponibilidadLocal(duracion) {
    const out = {};
    const ahora = new Date();
    const minimo = ahora.getHours() * 60 + ahora.getMinutes() + 30;
    for (let i = 0; i < N.diasDeAnticipacion; i++) {
      const fecha = sumarDias(fechaISO(ahora), i);
      const h = N.horario[deISO(fecha).getDay()];
      if (!h) continue;
      const horas = [];
      for (let m = aMin(h[0]); m + duracion <= aMin(h[1]); m += N.intervaloMinutos) {
        if (i > 0 || m >= minimo) horas.push(aHora(m));
      }
      if (horas.length) out[fecha] = horas;
    }
    return out;
  }

  async function disponibilidadRemota(servicio, profesional) {
    const filas = await api(N.supabase, "rpc/horarios_libres", {
      p_slug: N.supabase.slug, p_servicio: servicio.id, p_profesional: profesional?.id ?? null,
    });
    const out = {};
    for (const { fecha, hora } of filas) (out[fecha] ||= []).push(hora);
    return out;
  }

  const cacheDispo = new Map();
  function disponibilidad(servicio, profesional) {
    const clave = `${servicio.id ?? servicio.nombre}|${profesional?.id ?? ""}`;
    if (!cacheDispo.has(clave)) {
      const p = VIVO ? disponibilidadRemota(servicio, profesional) : Promise.resolve(disponibilidadLocal(servicio.duracion));
      p.catch(() => cacheDispo.delete(clave));
      cacheDispo.set(clave, p);
    }
    return cacheDispo.get(clave);
  }

  // ---------- Reserva ----------
  const dialogo = $("[data-reserva]");
  const SIN_PREFERENCIA = { id: null, nombre: "Sin preferencia", especialidad: "El primero disponible" };
  let paso = 0;
  let r = {};

  function cargarHorarios() {
    r.dispo = null;
    r.errorDispo = null;
    const servicio = N.servicios[r.servicio];
    disponibilidad(servicio, r.profesional.id ? r.profesional : null)
      .then((d) => { r.dispo = d; })
      .catch((e) => { r.errorDispo = mensajeError(e); })
      .finally(() => { if (paso === 2) pintarReserva(); });
  }

  const PASOS = [
    {
      listo: () => r.servicio != null,
      pintar: () => [
        el("h3", {}, "¿Qué te vas a hacer?"),
        el("div", { class: "opciones" },
          N.servicios.map((s, i) =>
            el("button", { class: "opcion", "aria-pressed": String(r.servicio === i), onclick: () => { r.servicio = i; avanzar(); } },
              el("span", {}, s.nombre, el("small", {}, `${s.duracion} min`)),
              el("b", {}, pesos(s.precio)),
            ),
          ),
        ),
      ],
    },
    {
      listo: () => r.profesional != null,
      pintar: () => [
        el("h3", {}, `¿Con qué ${giro.profesional}?`),
        el("div", { class: "opciones" },
          [SIN_PREFERENCIA, ...N.equipo].map((p) =>
            el("button", { class: "opcion", "aria-pressed": String(r.profesional?.nombre === p.nombre), onclick: () => { r.profesional = p; avanzar(); } },
              el("span", {}, p.nombre, el("small", {}, p.especialidad)),
            ),
          ),
        ),
      ],
    },
    {
      entrar: () => {
        // Solo se recargan los horarios si cambió el servicio o el profesional.
        const clave = `${r.servicio}|${r.profesional.nombre}`;
        if (clave === r.claveDispo) return;
        r.claveDispo = clave;
        r.fecha = null;
        r.hora = null;
        cargarHorarios();
      },
      listo: () => r.fecha && r.hora,
      pintar: () => {
        const titulo = el("h3", {}, "¿Cuándo?");
        const aviso = r.aviso ? el("p", { class: "aviso" }, r.aviso) : null;
        if (r.errorDispo) {
          return [titulo, el("p", { class: "aviso" }, r.errorDispo),
            el("button", { class: "btn btn--ghost btn--sm", onclick: () => { cargarHorarios(); pintarReserva(); } }, "Reintentar")];
        }
        if (!r.dispo) return [titulo, el("p", { class: "vacio" }, "Buscando horarios disponibles…")];

        const hoy = fechaISO(new Date());
        const fechas = Array.from({ length: N.diasDeAnticipacion }, (_, i) => sumarDias(hoy, i));
        if (!r.fecha) r.fecha = (r.dispo[r.fechaPreferida] && r.fechaPreferida) || fechas.find((f) => r.dispo[f]) || null;
        const horas = (r.fecha && r.dispo[r.fecha]) || [];
        return [
          titulo,
          aviso,
          el("div", { class: "dias" },
            fechas.map((f) => {
              const d = deISO(f);
              return el("button", {
                class: "dia", disabled: !r.dispo[f], "aria-pressed": String(r.fecha === f),
                onclick: () => { r.fecha = f; r.hora = null; pintarReserva(); },
              }, el("small", {}, DIAS_CORTOS[d.getDay()]), el("b", {}, d.getDate()), el("small", {}, MESES[d.getMonth()]));
            }),
          ),
          horas.length
            ? el("div", { class: "horas" },
                horas.map((h) => el("button", { class: "hora", "aria-pressed": String(r.hora === h), onclick: () => { r.hora = h; pintarReserva(); } }, hora12(h))))
            : el("p", { class: "vacio" }, "No hay horarios disponibles en los próximos días."),
        ];
      },
    },
    {
      listo: () => !r.enviando && (r.nombre || "").trim().length > 1 && (r.telefono || "").replace(/\D/g, "").length === 10,
      pintar: () => {
        const campo = (etiqueta, clave, attrs, tag = "input") =>
          el("label", { class: "campo" }, el("span", {}, etiqueta),
            el(tag, { ...attrs, value: r[clave] || "", oninput: (e) => { r[clave] = e.target.value; actualizarBotones(); } }));
        return [
          el("h3", {}, "Tus datos"),
          r.aviso ? el("p", { class: "aviso" }, r.aviso) : null,
          campo("Nombre", "nombre", { autocomplete: "name", placeholder: "¿Cómo te llamas?", maxlength: 80 }),
          campo("WhatsApp (10 dígitos)", "telefono", { type: "tel", inputmode: "numeric", autocomplete: "tel-national", placeholder: "33 1234 5678" }),
          campo("Comentarios (opcional)", "notas", { rows: 2, placeholder: "Ej. traigo foto del corte", maxlength: 300 }, "textarea"),
          el("p", { class: "nota" }, VIVO
            ? "Tu cita queda apartada al confirmar. Te daremos un link para verla o cancelarla."
            : "Al confirmar se abre WhatsApp con tu cita lista para enviar."),
        ];
      },
    },
  ];

  function resumen() {
    const partes = [];
    if (r.servicio != null) {
      const s = N.servicios[r.servicio];
      partes.push(el("b", {}, s.nombre), ` · ${pesos(s.precio)}`);
    }
    if (r.profesional && paso > 1) partes.push(" · con ", el("b", {}, r.profesional.nombre));
    if (r.fecha && r.hora && paso > 2) partes.push(" · ", el("b", {}, `${fechaLarga(r.fecha)}, ${hora12(r.hora)}`));
    return partes;
  }

  function actualizarBotones() {
    const ultimo = paso === PASOS.length - 1;
    $("[data-atras]").style.visibility = paso === 0 ? "hidden" : "visible";
    $("[data-siguiente]").disabled = !PASOS[paso].listo();
    $("[data-siguiente]").textContent = !ultimo ? "Siguiente"
      : r.enviando ? "Apartando…"
      : VIVO ? "Confirmar cita" : "Confirmar por WhatsApp";
  }

  function pintarReserva() {
    $("[data-pasos]").hidden = false;
    $("[data-acciones]").hidden = false;
    $$("[data-pasos] li").forEach((li, i) => {
      li.classList.toggle("activo", i === paso);
      li.classList.toggle("hecho", i < paso);
    });
    $("[data-cuerpo]").replaceChildren(...PASOS[paso].pintar().filter(Boolean));
    $("[data-resumen]").replaceChildren(...resumen());
    actualizarBotones();
  }

  function irA(n) {
    paso = n;
    PASOS[paso].entrar?.();
    pintarReserva();
    $("[data-cuerpo]").scrollTop = 0;
  }

  function avanzar() {
    if (!PASOS[paso].listo()) return;
    r.aviso = null;
    if (paso < PASOS.length - 1) irA(paso + 1);
    else if (VIVO) reservarEnLinea();
    else confirmarPorWhatsApp();
  }

  function confirmarPorWhatsApp() {
    const s = N.servicios[r.servicio];
    const lineas = [
      `Hola ${N.nombre}, quiero agendar una cita:`,
      ``,
      `• Servicio: ${s.nombre} (${pesos(s.precio)})`,
      `• Con: ${r.profesional.nombre}`,
      `• Día: ${fechaLarga(r.fecha)}`,
      `• Hora: ${hora12(r.hora)}`,
      `• Nombre: ${r.nombre.trim()}`,
      `• Tel: ${r.telefono.replace(/\D/g, "")}`,
    ];
    if (r.notas?.trim()) lineas.push(`• Notas: ${r.notas.trim()}`);
    window.open(waUrl(N.whatsapp, lineas.join("\n")), "_blank", "noopener");
    dialogo.close();
  }

  async function reservarEnLinea() {
    r.enviando = true;
    actualizarBotones();
    try {
      const cita = await api(N.supabase, "rpc/reservar", {
        p_slug: N.supabase.slug,
        p_servicio: N.servicios[r.servicio].id,
        p_profesional: r.profesional.id,
        p_fecha: r.fecha,
        p_hora: r.hora,
        p_nombre: r.nombre,
        p_telefono: r.telefono,
        p_notas: r.notas || null,
      });
      cacheDispo.clear();
      pintarConfirmacion(cita);
    } catch (e) {
      r.enviando = false;
      if (e.message === "HORARIO_OCUPADO") {
        cacheDispo.clear();
        r.claveDispo = null;
        r.fechaPreferida = r.fecha;
        irA(2);
      }
      r.aviso = mensajeError(e);
      pintarReserva();
    }
  }

  function pintarConfirmacion(cita) {
    const s = N.servicios[r.servicio];
    const linkCita = new URL(`cita.html?t=${cita.token}`, location.href).href;
    const cuando = `${fechaLarga(r.fecha)}, ${hora12(r.hora)}`;
    const pendiente = cita.estado === "pendiente";
    $("[data-pasos]").hidden = true;
    $("[data-acciones]").hidden = true;
    $("[data-resumen]").replaceChildren();
    $("[data-cuerpo]").replaceChildren(
      el("div", { class: "confirmada" },
        el("div", { class: "confirmada__check" }, "✓"),
        el("h3", {}, pendiente ? "¡Solicitud enviada!" : "¡Cita confirmada!"),
        el("p", {}, pendiente ? `${N.nombre} te confirmará por WhatsApp.` : `Te esperamos, ${r.nombre.trim().split(" ")[0]}.`),
        el("dl", { class: "confirmada__datos" },
          el("dt", {}, "Servicio"), el("dd", {}, `${s.nombre} · ${pesos(cita.precio)}`),
          el("dt", {}, "Con"), el("dd", {}, cita.profesional),
          el("dt", {}, "Cuándo"), el("dd", {}, cuando),
        ),
        el("a", {
          class: "btn", target: "_blank", rel: "noopener",
          href: googleCalendar({ titulo: `${s.nombre} en ${N.nombre}`, inicio: cita.inicio, fin: cita.fin, detalles: `Con ${cita.profesional}. Ver o cancelar: ${linkCita}`, lugar: N.direccion }),
        }, "Agregar a mi calendario"),
        el("a", { class: "btn btn--ghost", href: linkCita }, "Ver o cancelar mi cita"),
        el("p", { class: "nota" }, "Guarda este link; con él puedes cancelar si no puedes venir."),
      ),
    );
  }

  function abrirReserva(servicio) {
    r = {};
    paso = 0;
    if (servicio != null) { r.servicio = servicio; paso = 1; }
    pintarReserva();
    dialogo.showModal();
  }

  $("[data-siguiente]").addEventListener("click", avanzar);
  $("[data-atras]").addEventListener("click", () => { if (paso > 0) { r.aviso = null; irA(paso - 1); } });
  dialogo.addEventListener("click", (e) => { if (e.target === dialogo) dialogo.close(); });
  $$("[data-agendar]").forEach((b) => b.addEventListener("click", () => abrirReserva()));

  (async () => {
    if (VIVO) {
      try {
        await cargarDeSupabase();
      } catch (e) {
        console.warn("Supabase no respondió; se usa config.js y reservas por WhatsApp.", e);
        VIVO = false;
      }
    }
    pintarPagina();
  })();
})();
