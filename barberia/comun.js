// Utilidades compartidas por el sitio (app.js), la página de la cita (cita.html) y el panel.
window.Comun = (() => {
  const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // Crea nodos con textContent: nada de lo que escriba un cliente se interpreta como HTML.
  const el = (tag, attrs = {}, ...hijos) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (k === "value") n.value = v;
      else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
    }
    for (const h of hijos.flat()) if (h != null && h !== false) n.append(h);
    return n;
  };

  const pesos = (n) => "$" + Number(n).toLocaleString("es-MX");
  const aMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const hora12 = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
  };

  // Fechas "YYYY-MM-DD" como día de calendario, sin que la zona horaria del navegador las mueva.
  const fechaISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const deISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const sumarDias = (iso, n) => { const d = deISO(iso); d.setDate(d.getDate() + n); return fechaISO(d); };
  const fechaLarga = (iso) => { const d = deISO(iso); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };

  // Partes de un instante vistas en la zona horaria del negocio.
  function enZona(instante, tz) {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      }).formatToParts(new Date(instante)).map((x) => [x.type, x.value]),
    );
    return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
  }

  // "2026-11-02" + "10:00" en la zona del negocio → instante ISO (UTC).
  function aInstante(fecha, hora, tz) {
    const supuesto = new Date(`${fecha}T${hora}:00Z`);
    const visto = enZona(supuesto, tz);
    const desfase = new Date(`${visto.fecha}T${visto.hora}:00Z`) - supuesto;
    return new Date(supuesto.getTime() - desfase).toISOString();
  }

  const waUrl = (numero, texto) => `https://wa.me/${numero}${texto ? "?text=" + encodeURIComponent(texto) : ""}`;

  // Cliente mínimo de la API REST de Supabase (sin librerías) para el sitio público.
  async function api(sb, ruta, cuerpo) {
    const headers = { apikey: sb.anonKey, "Content-Type": "application/json" };
    if (!sb.anonKey.startsWith("sb_")) headers.Authorization = `Bearer ${sb.anonKey}`;
    const res = await fetch(`${sb.url}/rest/v1/${ruta}`, {
      method: cuerpo ? "POST" : "GET",
      headers,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const datos = await res.json().catch(() => null);
    if (!res.ok) throw new Error(datos?.message || `HTTP_${res.status}`);
    return datos;
  }

  const MENSAJES_ERROR = {
    HORARIO_OCUPADO: "Ese horario se acaba de ocupar. Elige otro, por favor.",
    DEMASIADAS_CITAS: "Ya tienes 2 citas próximas con este número. Si necesitas otra, escríbenos por WhatsApp.",
    TELEFONO_INVALIDO: "Revisa tu número: deben ser 10 dígitos.",
    NOMBRE_INVALIDO: "Escribe tu nombre.",
    NOTAS_MUY_LARGAS: "El comentario es muy largo (máximo 300 caracteres).",
  };
  const mensajeError = (e) => MENSAJES_ERROR[e.message] || "No pudimos conectar. Revisa tu internet e inténtalo de nuevo.";

  // Link para que el cliente agregue la cita a Google Calendar.
  function googleCalendar({ titulo, inicio, fin, detalles, lugar }) {
    const f = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const q = new URLSearchParams({ action: "TEMPLATE", text: titulo, dates: `${f(inicio)}/${f(fin)}`, details: detalles || "", location: lugar || "" });
    return `https://calendar.google.com/calendar/render?${q}`;
  }

  return {
    DIAS, DIAS_CORTOS, MESES, $, $$, el, pesos, aMin, aHora, hora12,
    fechaISO, deISO, sumarDias, fechaLarga, enZona, aInstante, waUrl, api, mensajeError, googleCalendar,
  };
})();
