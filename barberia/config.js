// Todo lo que cambia de un negocio a otro vive aquí.
// Para un cliente nuevo: copia la carpeta, edita este archivo y sube las fotos a img/.
window.NEGOCIO = {
  nombre: "Barbería Navaja",
  eslogan: "Cortes clásicos, fade y barba con navaja caliente.",
  giro: "barberia", // "barberia" | "estetica" — solo cambia textos genéricos
  whatsapp: "523312699758", // 52 + 10 dígitos, sin espacios ni signos
  telefono: "33 1269 9758",
  instagram: "barberianavaja",
  direccion: "Av. Chapultepec 123, Col. Americana, Guadalajara, Jal.",
  mapa: "https://maps.google.com/?q=Av.+Chapultepec+123+Guadalajara",

  colores: {
    acento: "#c9a227",
    fondo: "#111111",
  },

  // Horario por día: [abre, cierra] en 24 h, o null si está cerrado. 0 = domingo.
  horario: {
    0: null,
    1: ["10:00", "20:00"],
    2: ["10:00", "20:00"],
    3: ["10:00", "20:00"],
    4: ["10:00", "20:00"],
    5: ["10:00", "21:00"],
    6: ["09:00", "18:00"],
  },
  intervaloMinutos: 30, // cada cuánto se ofrecen horarios
  diasDeAnticipacion: 14, // hasta cuántos días adelante se puede agendar

  servicios: [
    { nombre: "Corte clásico", duracion: 30, precio: 180, descripcion: "Tijera y máquina, lavado incluido." },
    { nombre: "Fade / degradado", duracion: 45, precio: 220, descripcion: "Skin, low, mid o high fade." },
    { nombre: "Barba con navaja", duracion: 30, precio: 150, descripcion: "Toalla caliente, navaja y aceite." },
    { nombre: "Corte + barba", duracion: 60, precio: 320, descripcion: "El combo completo." },
    { nombre: "Corte infantil", duracion: 30, precio: 150, descripcion: "Menores de 12 años." },
    { nombre: "Diseño / líneas", duracion: 15, precio: 60, descripcion: "Complemento a cualquier corte." },
  ],

  equipo: [
    { nombre: "Luis", especialidad: "Fades y diseños", foto: "" },
    { nombre: "Carlos", especialidad: "Clásicos y barba", foto: "" },
    { nombre: "Andrea", especialidad: "Color y estilo", foto: "" },
  ],

  // Rutas en img/ o URLs. Si está vacío se muestran mosaicos de color.
  galeria: [],

  resenas: [
    { autor: "Jorge M.", texto: "El mejor fade que me han hecho en Guadalajara. Agendar por aquí es rapidísimo.", estrellas: 5 },
    { autor: "Daniel R.", texto: "Muy buen ambiente y puntuales con la cita.", estrellas: 5 },
    { autor: "Iván P.", texto: "La barba con toalla caliente vale cada peso.", estrellas: 5 },
  ],

  // Plan Pro: agenda con base de datos en Neon. Déjalo en null para el plan Básico (citas por WhatsApp).
  // Con Neon, servicios, precios, equipo y horario se leen de la base de datos y se editan
  // desde panel/; lo de arriba queda solo como respaldo si Neon no responde.
  // Las dos URLs son públicas (NEON_AUTH_BASE_URL y NEON_DATA_API_URL de .env.local).
  // neon: { authUrl: "https://…neonauth…/neondb/auth", dataApiUrl: "https://…apirest…/neondb/rest/v1", slug: "navaja" },
  neon: null,

  // Créditos en el pie de página (tu publicidad gratis en cada sitio que vendas).
  creditos: { texto: "Sitio por Víctor Velázquez", url: "https://wa.me/523312699758" },
};
