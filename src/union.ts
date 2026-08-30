/**
 * Cruce de nuestras convocatorias con las de porceuta.es.
 *
 * Lo dificil no es juntar las dos listas: es decidir cuando dos filas son la
 * misma concentracion. Por texto no vale, porque «Plaza Vieja» y «Plaza Vieja,
 * frente al Consistorio» son el mismo sitio. Y por distancia tampoco, porque
 * hay coordenadas mal puestas en las dos bases: Quintanar de la Orden aparece
 * en ambas con la misma plaza y sus puntos estan a 88 kilometros.
 *
 * Asi que se usan las dos cosas: mismo municipio y, o bien los puntos a menos
 * de 300 m, o bien el nombre del sitio equivalente una vez quitadas las
 * muletillas.
 *
 * Portado de scratchpad/union/unir.py, que es donde se afino contra los datos
 * reales. La unica diferencia deliberada: aqui no se carga el listado del INE
 * (8.115 municipios en un Excel), que alli servia para canonizar nombres. Se
 * queda con la tabla de provincias y sus alias, y el nombre que se muestra es
 * el que publica cada fuente.
 */

// --------------------------------------------------------------- utilidades --

/** Minusculas y sin acentos. */
export function pelar(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function norm(s: string | null | undefined): string {
  return pelar(s).replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Para comparar municipios. Quita articulos y NUNCA recorta tras «de»: ese
 * atajo, que servia para que «Palma de Mallorca» casara con «Palma», hacia que
 * Torrejon de Ardoz pareciera Torrejon de la Calzada, Jerez de los Caballeros
 * pareciera Jerez de la Frontera y Santa Cruz de la Palma pareciera Santa Cruz
 * de Tenerife. Cuatro municipios se habrian perdido en silencio.
 */
function normMuni(s: string | null | undefined): string {
  return pelar(s).replace(/\b(el|la|los|las|l)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Todas las formas de un nombre: «Elx/Elche», «Vila Joiosa, la». */
export function formasMuni(nombre: string | null | undefined): Set<string> {
  const out = new Set<string>();
  const meter = (v: string) => { if (v) out.add(v); };
  meter(normMuni(nombre));
  for (const parte of (nombre ?? "").split(/\s*\/\s*/)) {
    meter(normMuni(parte));
    const m = parte.trim().match(/^(.*),\s*(el|la|los|las|l')$/i);
    if (m) meter(normMuni(m[1]));
  }
  return out;
}

const MULETILLAS =
  /\b(puertas?|frente|ante|junto|delante|entrada|explanada|exterior|plaza|placa|plaça|praza|plazoleta|glorieta|paseo|calle|carrer|avenida|del|de|la|el|los|las|al|a|en|l|d|i)\b/g;

/**
 * «Puerta del Ayuntamiento» y «Plaza del Ayuntamiento» dan los dos
 * «ayuntamiento». Es lo que evita que Jaca o Jerez salgan duplicados.
 */
function nucleoSitio(s: string | null | undefined): string {
  const t = pelar(s)
    .replace(/\(.*?\)/g, " ")        // «Plaza Gibaxa (Ayuntamiento)»
    .replace(/[^a-z0-9]+/g, " ")
    .replace(MULETILLAS, " ");
  return [...new Set(t.split(" ").filter(Boolean))].sort().join(" ");
}

/** Haversine, en metros. */
function metros(a: number, b: number, c: number, d: number): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const p1 = rad(a), p2 = rad(c);
  const dp = rad(c - a), dl = rad(d - b);
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// ------------------------------------------------------------- provincias ---

const PROVINCIAS = [
  "A Coruña", "Álava", "Albacete", "Alicante", "Almería", "Asturias", "Ávila", "Badajoz",
  "Baleares", "Barcelona", "Burgos", "Cáceres", "Cádiz", "Cantabria", "Castellón", "Ceuta",
  "Ciudad Real", "Córdoba", "Cuenca", "Girona", "Granada", "Guadalajara", "Guipúzcoa", "Huelva",
  "Huesca", "Jaén", "La Rioja", "Las Palmas", "León", "Lleida", "Lugo", "Madrid", "Málaga",
  "Melilla", "Murcia", "Navarra", "Ourense", "Palencia", "Pontevedra", "Salamanca",
  "Santa Cruz de Tenerife", "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo",
  "Valencia", "Valladolid", "Vizcaya", "Zamora", "Zaragoza",
];

const POR_NOMBRE = new Map(PROVINCIAS.map((p) => [norm(p), p]));

/** Lo que escriben ellos y no cuadra con nuestra lista. */
const ALIAS_PROV: Record<string, string> = {
  "oalencia": "Palencia", "illes balears": "Baleares", "balears illes": "Baleares",
  "tenerife": "Santa Cruz de Tenerife", "santa cruz tenerife": "Santa Cruz de Tenerife",
  "araba alava": "Álava", "alava araba": "Álava", "alacant alicante": "Alicante",
  "castello castellon": "Castellón", "valencia valencia": "Valencia", "gipuzkoa": "Guipúzcoa",
  "bizkaia": "Vizcaya", "rioja la": "La Rioja", "palmas las": "Las Palmas",
  "coruna a": "A Coruña", "a coruna": "A Coruña", "gerona": "Girona", "lerida": "Lleida",
  "orense": "Ourense", "guipuzcoa": "Guipúzcoa", "region murcia": "Murcia",
  "comunidad madrid": "Madrid", "principado asturias": "Asturias",
};

export function provincia(p: string | null | undefined): string | null {
  const n = norm(p);
  return POR_NOMBRE.get(n) ?? ALIAS_PROV[n] ?? null;
}

// ------------------------------------------------------------------ filas ---

export interface Fila {
  municipio: string;
  provincia: string;
  sitio: string;
  direccion: string;
  fecha: string;
  hora: string;
  lat: number | null;
  lon: number | null;
  convoca: string;
  notas: string;
  estado: string;
  fuente: string;
  pin: string;
  /** Solo para cruzar: el nombre tal cual lo publica su fuente. */
  ciudadCruda: string;
  /** De donde vino: las nuestras absorben a las suyas, no al reves. */
  origen: "nos" | "nos-otras" | "pc";
}

/** Nuestra fila de la tabla `places`. */
export interface Lugar {
  city: string; province: string; venue: string; address: string;
  event_date: string; event_time: string; lat: number | null; lon: number | null;
  notes: string | null; organizer: string | null; status: string; review_note: string | null;
}

/** Su fila de /api/public/convocatorias. */
export interface Suya {
  ciudad: string; provincia: string; lugar: string | null;
  fecha: string | null; hora: string | null; notas: string | null; convoca: string | null;
  latitud: number | null; longitud: number | null; pin: string | null;
}

/** Su marca de confianza, en tres niveles. */
const CONFIANZA: Record<string, string> = {
  gold: "Confirmada", bronze: "Difundida", red: "Sin confirmar",
};

/** «20.00», «20h», «8:00 » → «20:00». Lo suyo viene sin normalizar. */
function horaLimpia(t: string | null | undefined): string {
  const s = (t ?? "").trim().replace(/\./g, ":").replace(/\s/g, "").replace(/[hH]$/, "");
  const m = s.match(/^(\d{1,2}):?(\d{2})?$/);
  if (!m) return "";
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2] ?? "00"}`;
}

function fila(p: Partial<Fila> & { ciudadCruda: string; origen: Fila["origen"] }): Fila {
  return {
    municipio: (p.municipio ?? "").trim(),
    provincia: provincia(p.provincia) ?? (p.provincia ?? "").trim(),
    sitio: (p.sitio ?? "").trim(),
    direccion: (p.direccion ?? "").trim(),
    fecha: p.fecha ?? "",
    hora: (p.hora ?? "").trim(),
    lat: p.lat ?? null,
    lon: p.lon ?? null,
    convoca: (p.convoca ?? "").trim(),
    notas: (p.notas ?? "").trim(),
    estado: p.estado ?? "",
    fuente: p.fuente ?? "",
    pin: p.pin ?? "",
    ciudadCruda: p.ciudadCruda.trim(),
    origen: p.origen,
  };
}

// ------------------------------------------------------------- deduplicar ---

/**
 * La regla. Hacen falta las dos condiciones:
 *  - solo por nombre, Alicante juntaria Luceros y Ayuntamiento, que estan a
 *    849 m y son actos distintos;
 *  - solo por distancia, Quintanar de la Orden se partiria en dos, porque las
 *    mismas coordenadas estan mal en su base y a 88 km de las nuestras.
 */
function misma(a: Fila, b: Fila): boolean {
  const fa = formasMuni(a.ciudadCruda), fb = formasMuni(b.ciudadCruda);
  if (![...fa].some((x) => fb.has(x))) return false;

  const na = nucleoSitio(a.sitio), nb = nucleoSitio(b.sitio);
  if (na && na === nb) return true;                 // mismo sitio, aunque el punto discrepe

  if (a.lat !== null && a.lon !== null && b.lat !== null && b.lon !== null) {
    if (metros(a.lat, a.lon, b.lat, b.lon) <= 300) return true;  // mismo punto, otro nombre
  }
  return false;
}

export interface Resultado {
  filas: Fila[];
  absorbidas: number;
  /** Cuando lo suyo no viene de su API sino de la ultima copia guardada. */
  copiaDe: string | null;
}

export function unir(nuestros: Lugar[], suyas: Suya[], copiaDe: string | null = null): Resultado {
  const todas: Fila[] = [];

  for (const x of nuestros) {
    const estado =
      x.status === "approved" ? "Publicada"
      : x.status === "pending" ? "Pendiente de revisar"
      : "Retirada · " + (x.review_note || "sin motivo anotado");

    todas.push(fila({
      municipio: x.city, provincia: x.province, sitio: x.venue, direccion: x.address,
      fecha: x.event_date, hora: x.event_time, lat: x.lat, lon: x.lon,
      convoca: x.organizer ?? "", notas: x.notes ?? "",
      estado, fuente: "Listado oficial",
      ciudadCruda: x.city, origen: x.status === "approved" ? "nos" : "nos-otras",
    }));
  }

  for (const x of suyas) {
    const marca = CONFIANZA[x.pin ?? ""] ?? "Sin clasificar";
    todas.push(fila({
      municipio: x.ciudad, provincia: x.provincia, sitio: x.lugar ?? "", direccion: "",
      fecha: x.fecha ?? "", hora: horaLimpia(x.hora), lat: x.latitud, lon: x.longitud,
      convoca: x.convoca ?? "", notas: x.notas ?? "",
      estado: "Solo en porceuta.es · " + marca, fuente: "porceuta.es", pin: marca,
      ciudadCruda: x.ciudad, origen: "pc",
    }));
  }

  // Las nuestras mandan: se recorren primero y absorben a las suyas.
  const orden = { nos: 0, "nos-otras": 1, pc: 2 } as const;
  todas.sort((a, b) => orden[a.origen] - orden[b.origen]);

  const porMuni = new Map<string, Fila[]>();
  const finales: Fila[] = [];
  let absorbidas = 0;

  for (const f of todas) {
    const claves = formasMuni(f.ciudadCruda);
    let hallado: Fila | undefined;
    for (const k of claves) {
      hallado = (porMuni.get(k) ?? []).find((c) => misma(f, c));
      if (hallado) break;
    }

    if (hallado) {
      absorbidas++;
      // No se pierde nada: se completa lo que a la nuestra le faltaba.
      if (!hallado.direccion && f.direccion) hallado.direccion = f.direccion;
      if (!hallado.hora && f.hora) hallado.hora = f.hora;
      if (!hallado.convoca && f.convoca) hallado.convoca = f.convoca;
      if (f.origen === "pc" && hallado.origen !== "pc") {
        hallado.fuente = "Ambas";
        if (f.pin) hallado.pin = f.pin;   // su marca de confianza no se pierde
      }
      if (f.notas && !hallado.notas.includes(f.notas)) {
        const extra = f.notas.replace(/\s+/g, " ").trim();
        if (extra.length > 3 && !/^(nueva|alta nueva|revisado)/i.test(extra)) {
          hallado.notas = (hallado.notas + " · " + extra).replace(/^ ·+ ?| ·+$/g, "").trim();
        }
      }
      continue;
    }

    finales.push(f);
    for (const k of claves) {
      const lista = porMuni.get(k);
      if (lista) lista.push(f); else porMuni.set(k, [f]);
    }
  }

  finales.sort((a, b) =>
    a.provincia.localeCompare(b.provincia, "es") ||
    a.municipio.localeCompare(b.municipio, "es") ||
    a.sitio.localeCompare(b.sitio, "es"));

  return { filas: finales, absorbidas, copiaDe };
}
