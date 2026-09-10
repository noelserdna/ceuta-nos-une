/**
 * Sacar las fotos de una publicación de Instagram o de Facebook.
 *
 * El método es una mezcla a propósito: el DOM dice CUÁLES son las imágenes de
 * esta publicación (y no las del bloque de sugerencias que hay debajo), y la red
 * da los BYTES. Pedir la imagen por segunda vez desde fuera no funciona: las URL
 * del CDN van firmadas y contestan 403 fuera de su contexto.
 *
 * Por eso se escucha `response` desde el primer momento: cuando el navegador
 * pinta la foto, ya la ha descargado, y esos bytes son los buenos. Lo que no se
 * haya podido capturar se pide desde dentro de la propia página, que sí lleva
 * las cookies y el referer que el CDN espera.
 */

/** Un avatar o un icono de la interfaz no llega a esto. Una foto sí. */
const BYTES_MINIMOS = 40_000;

/** Señales de que nos han cortado el paso. Ver `estaBloqueado`. */
const CORTES = [
  /\/accounts\/login/, /\/challenge/, /\/checkpoint/, /login\.php/, /\/two_step_verification/,
];
const TEXTOS_DE_CORTE = [
  "Try Again Later", "Vuelve a intentarlo más tarde", "Inténtalo de nuevo más tarde",
  "restringimos ciertas actividades", "We restrict certain activity",
];

/**
 * Escucha las imágenes que descarga el navegador, y devuelve con qué soltarla.
 *
 * Soltar el oyente no es cortesía: sin ello queda uno por publicación, cada uno
 * con su mapa de bytes vivo, y a las pocas decenas el sistema se queda sin
 * memoria y mata la cosecha a mitad. Pasó a las 52 publicaciones.
 */
export function escucharImagenes(page) {
  const capturadas = new Map();
  const oyente = async (res) => {
    try {
      const tipo = res.headers()["content-type"] ?? "";
      if (!tipo.startsWith("image/")) return;
      if (!/cdninstagram\.com|fbcdn\.net/.test(res.url())) return;
      const bytes = await res.body();
      if (bytes && bytes.length >= BYTES_MINIMOS) capturadas.set(res.url(), bytes);
    } catch {
      /* Una respuesta que ya no se puede leer no es motivo para parar la cosecha. */
    }
  };
  page.on("response", oyente);
  return {
    capturadas,
    soltar() {
      page.off("response", oyente);
      capturadas.clear();
    },
  };
}

export async function estaBloqueado(page) {
  if (CORTES.some((re) => re.test(page.url()))) return `redirigido a ${page.url().slice(0, 60)}`;
  const texto = await page.evaluate(() => document.body?.innerText?.slice(0, 3000) ?? "")
    .catch(() => "");
  const pillado = TEXTOS_DE_CORTE.find((t) => texto.includes(t));
  return pillado ? `la página dice «${pillado}»` : null;
}

/**
 * Lo que se ve en la publicación abierta, leído del DOM.
 *
 * El filtro por posición no es un adorno: debajo de la publicación, Instagram
 * cuelga «Más publicaciones de esta cuenta», y sin acotar por altura se cosecha
 * el programa de las fiestas del pueblo y los horarios del autobús junto con la
 * concentración. Probado: 13 imágenes donde había 7.
 */
async function leerPublicacion(page, { todaLaPagina = false, anchoMinimo = 380, soloArriba = false } = {}) {
  return page.evaluate(({ todaLaPagina, anchoMinimo, soloArriba }) => {
    /* El contenedor de la publicación, y nunca el `body`: en Facebook, al lado
       del post hay vídeos sugeridos que también se pintan grandes, y mirando la
       página entera se cosechan gatos y jugadores de la NBA. En un permalink el
       post es el primero del documento, así que se coge ése y punto. */
    /* Instagram ha dejado de envolver la publicación en un `<article>`: hay
       páginas suyas con cero contenedores. Así que si no aparece, se mira la
       página entera y el trabajo de separar lo hace el tamaño con el que se
       pinta cada imagen, que es lo que de verdad distingue la publicación
       (unos 600 px de ancho) de la rejilla de «más publicaciones» (unos 310). */
    const propio = todaLaPagina
      ? null
      : (document.querySelector("article") || document.querySelector('[role="article"]'));
    const caja = propio ?? document.body;
    /* Lo que separa la foto de la publicación de las miniaturas de «Más
       publicaciones de esta cuenta» es cómo de grande se pinta: la principal
       ocupa medio ancho de pantalla, las de la rejilla no llegan a un tercio.
       El tamaño del fichero no vale para distinguirlas —las miniaturas de
       Instagram también son de 640 px— y la altura tampoco, porque la rejilla
       empieza antes de que acabe la ventana. */
    let candidatas = [...caja.querySelectorAll("img")]
      .filter((i) => i.naturalWidth >= 400 && i.naturalHeight >= 400)
      .map((i) => {
        const r = i.getBoundingClientRect();
        return { src: i.currentSrc || i.src, alt: i.alt || null, ancho: r.width, top: r.top };
      })
      .filter((c) => c.ancho >= anchoMinimo);

    /* La publicación abierta está SIEMPRE pegada arriba. Si lo más alto que hay
       cuelga por debajo, es que no estamos viendo una publicación sino la
       rejilla del perfil: Instagram te saca ahí sin cambiar la URL, y entonces
       lo que se cosecha es el taller de teatro y La Vuelta ciclista del pueblo.
       Mejor volver sin nada que traer lo que no es. */
    const DEMASIADO_ABAJO = 350;
    if (soloArriba && candidatas.length) {
      candidatas.sort((a, b) => a.top - b.top);
      if (candidatas[0].top > DEMASIADO_ABAJO) candidatas = [];
    }

    if (soloArriba && candidatas.length) {
      /* La medida no puede ser fija. Una foto apaisada se pinta a 889 px y un
         cartel vertical a 449, mientras que las miniaturas de «más
         publicaciones de esta cuenta» se pintan siempre a 407: con un listón
         fijo, o se cuela la rejilla entera o se pierde el cartel por 42 px.
         La referencia buena es la propia publicación —la imagen de más arriba,
         que es la abierta— y se aceptan las que midan como ella. Así el criterio
         se ajusta solo a cada publicación en vez de a un número inventado. */
      candidatas.sort((a, b) => a.top - b.top);
      const referencia = candidatas[0].ancho;
      candidatas = candidatas.filter((c) => Math.abs(c.ancho - referencia) <= referencia * 0.06);
    }
    const imagenes = candidatas.map((c) => ({ src: c.src, alt: c.alt }));
    // Para poder mirar por qué eligió lo que eligió, sin adivinar.
    const medidas = candidatas.map((c) => ({ ancho: Math.round(c.ancho), top: Math.round(c.top) }));
    const fechaDelPost = caja.querySelector("time")?.getAttribute("datetime") ?? null;
    const video = caja.querySelector("video");
    return {
      imagenes,
      medidas,
      sinCaja: !propio && !todaLaPagina,
      hayVideo: !!video,
      fecha: caja.querySelector("time")?.getAttribute("datetime") ?? null,
      // El texto entero de la tarjeta. No es el pie limpio, pero contiene el pie,
      // y con eso basta para cotejarlo luego con lo que anotó quien la encontró.
      texto: (caja.innerText || "").replace(/\s+/g, " ").trim().slice(0, 1200),
    };
  }, { todaLaPagina, anchoMinimo, soloArriba });
}

/**
 * La foto que la propia publicación declara al compartirse (`og:image`).
 *
 * En Facebook es la única forma fiable de saber cuál es la foto del post: no
 * hay un contenedor que envuelva la publicación (hay veinte `role="article"`,
 * y los tres primeros vienen vacíos), y a la misma altura de la foto buena
 * conviven los vídeos sugeridos de la columna de al lado. Medido: mirando la
 * página entera se cosechaba un gato y un jugador de la NBA.
 *
 * Se pierden las fotos segunda y siguientes de un álbum. Es un intercambio
 * consciente: mejor una foto segura por publicación que cuatro dudosas.
 */
async function imagenDeclarada(page) {
  return page.evaluate(() => document.querySelector('meta[property="og:image"]')?.content ?? null)
    .catch(() => null);
}

/** Los bytes de una imagen: de lo capturado, o pedidos desde la propia página. */
async function bytesDe(page, capturadas, src) {
  if (capturadas.has(src)) return capturadas.get(src);
  const base64 = await page.evaluate(async (url) => {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return null;
      const buf = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      for (const b of buf) bin += String.fromCharCode(b);
      return btoa(bin);
    } catch {
      return null;
    }
  }, src).catch(() => null);
  return base64 ? Buffer.from(base64, "base64") : null;
}

/**
 * Cosecha una publicación. Devuelve la fila que se apunta en el registro:
 * nunca lanza por una publicación mala, sólo por un corte de la red social.
 */
export async function cosecharPublicacion(page, pub, opciones = {}) {
  const { capturadas, soltar } = escucharImagenes(page);
  try {
    /* Facebook pinta la misma publicación de forma distinta en cada visita, y
       con tres segundos a veces no ha llegado a poner la foto: la misma que
       vuelve vacía sale bien al segundo intento. Se le da el doble de margen. */
    const esperaCarga = opciones.esperaCarga ?? (pub.forma === "fb_post" ? 6000 : 3000);
    return await cosechar(page, pub, { ...opciones, esperaCarga }, capturadas);
  } finally {
    soltar();
  }
}

async function cosechar(page, pub, { esperaCarga } = {}, capturadas) {
  await page.goto(pub.url, { waitUntil: "domcontentloaded", timeout: 45000 });

  const corte = await estaBloqueado(page);
  if (corte) {
    const err = new Error(corte);
    err.bloqueo = true;
    throw err;
  }

  /* Se espera a que aparezca la foto de la publicación —grande y arriba—, no a
     un contenedor: Instagram ya no pone `<article>`, así que esperarlo eran
     veinte segundos tirados en cada visita, y en ese rato daba tiempo a que la
     página se fuera al perfil. */
  await page.waitForFunction(() => [...document.querySelectorAll("img")].some((i) => {
    const r = i.getBoundingClientRect();
    return i.naturalWidth >= 400 && r.width >= 380 && r.top < 350;
  }), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(esperaCarga);

  /* Cada red pide su medida, y las dos salieron de mirar la página con una
     regla en la mano:

     Instagram ya no envuelve la publicación en su contenedor, así que hay que
     mirarlo todo; pero la foto abierta se pinta a unos 890 px y arriba del todo,
     mientras que las miniaturas de «más publicaciones de esta cuenta» se pintan
     a 407 y por debajo de los 1.300. Con el listón en 500 y sólo la primera
     pantalla, se separan solas. Con el listón donde estaba (380), la agenda
     deportiva del pueblo y una clase de spinning entraban como si fueran del
     2 de septiembre.

     En Facebook, en cambio, la foto buena aparece más pequeña y más abajo, y
     quien hace la criba es el filtro de CDN de más adelante. */
  const esInstagram = pub.forma?.startsWith("ig");
  const datos = await leerPublicacion(page, {
    todaLaPagina: pub.forma === "fb_post",
    anchoMinimo: 380,
    soloArriba: esInstagram,
  });
  const vistas = new Map(datos.imagenes.map((i) => [i.src, i]));
  if (process.env.DEPURAR) {
    console.log(`   [depurar] ${datos.imagenes.length} candidatas:`,
      JSON.stringify(datos.medidas), `sinCaja=${datos.sinCaja}`);
  }

  if (pub.forma === "fb_post") {
    /* Facebook no envuelve el post en ningún contenedor útil —hay veinte
       `role="article"` y los primeros vienen vacíos— y con la sesión abierta
       tampoco publica `og:image`. Lo que sí distingue una foto de publicación
       de un vídeo sugerido es la carpeta del CDN: las fotos salen de
       `t39.30808` o `t51`, y los reels de la columna de al lado, de `t39.99`.
       Sin este filtro se cosechaban un gato y un jugador de la NBA. */
    for (const src of [...vistas.keys()]) {
      if (/\/t39\.99/.test(src) || !/\/t39\.30808|\/t51\./.test(src)) vistas.delete(src);
    }
  }

  /* Un reel es un vídeo: no se descarga (serían gigas y no se pueden servir
     bien desde el móvil), se guarda el fotograma que se está viendo, que cuenta
     lo mismo en 60 KB. La publicación queda marcada con vídeo y su enlace. */
  /* Sólo se saca fotograma cuando el vídeo ES la publicación (un reel), y sólo
     si está arriba: si no, lo que se captura es cualquier vídeo suelto de la
     página —los sugeridos de la rejilla— y sale un fotograma que no tiene nada
     que ver con el municipio. */
  const videoArriba = await page.evaluate(() => {
    const v = document.querySelector("video");
    return !!v && v.getBoundingClientRect().top < 350;
  }).catch(() => false);

  if (pub.forma === "ig_reel" && videoArriba) {
    const marco = page.locator("article video, video").first();
    const captura = await marco.screenshot({ timeout: 8000 }).catch(() => null);
    if (!captura) {
      return { estado: "sin_medios", nota: "vídeo sin fotograma legible", texto: datos.texto };
    }
    return {
      estado: "ok", hay_video: 1, fecha_pub: datos.fecha, texto: datos.texto,
      medios: [{ bytes: captura, ext: "png", clase: "portada", alt: null, origen_url: null, orden: 0 }],
    };
  }

  if (!vistas.size) {
    /* El rescate por los bytes capturados vale SÓLO para Instagram, y sólo
       cuando la publicación llegó a pintarse: allí el riesgo conocido es que te
       echen a mitad, y sin scroll no ha cargado nada ajeno. En Facebook este
       mismo atajo cosechaba los vídeos sugeridos de la columna de al lado, así
       que allí se prefiere quedarse sin foto. */
    const rescatadas = pub.forma?.startsWith("ig") && !datos.sinCaja
      ? [...capturadas.entries()]
        .filter(([, bytes]) => bytes.length >= BYTES_MINIMOS)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 3)
      : [];
    if (rescatadas.length) {
      return {
        estado: "ok", rescate: true, hay_video: datos.hayVideo ? 1 : 0,
        fecha_pub: datos.fecha, texto: datos.texto,
        medios: rescatadas.map(([src, bytes], i) => ({
          bytes, ext: "jpg", clase: "foto", alt: null,
          origen_url: src.split("?")[0], orden: i,
        })),
      };
    }
    return { estado: "sin_medios", nota: "ninguna imagen grande en la publicación", texto: datos.texto };
  }

  /* El carrusel NO se recorre, y no es por pereza.
     
     Instagram ya no envuelve la publicación en su propio contenedor, así que hay
     que mirar la página entera; y en esa página, las publicaciones vecinas de la
     misma cuenta se pintan igual de grandes que la abierta. Pulsando la flecha
     ocho veces, lo que entraba era la agenda deportiva del pueblo, el taller de
     memoria y una clase de spinning: medido sobre 315 publicaciones, seis de
     cada ocho fotos eran de otro día.
     
     Con lo que se ve al abrir, en cambio, no ha fallado ni una vez. Se pierde la
     tercera foto y siguientes de los carruseles largos; se gana que lo que se
     publica sea de verdad de ese municipio y de ese día, que es lo único que
     hace útil un archivo. */

  /* Segundo cerrojo, por si algún día vuelve a colarse algo: el alt que genera
     Instagram dice de qué día es la foto («Photo by … on September 02, 2026»).
     Si trae fecha y no es la de la publicación, no es de esta publicación. */
  const diaDelPost = (datos.fecha ?? "").slice(0, 10);
  const MESES = ["january", "february", "march", "april", "may", "june", "july",
    "august", "september", "october", "november", "december"];
  const otroDia = (alt) => {
    if (!alt || !diaDelPost) return false;
    const m = alt.toLowerCase().match(/on (\w+) (\d{1,2}), (\d{4})/);
    if (!m) return false;
    const mes = MESES.indexOf(m[1]);
    if (mes < 0) return false;
    const fecha = `${m[3]}-${String(mes + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    return fecha !== diaDelPost;
  };

  const medios = [];
  for (const [src, img] of vistas) {
    if (otroDia(img.alt)) continue;
    const bytes = await bytesDe(page, capturadas, src);
    if (!bytes || bytes.length < BYTES_MINIMOS) continue;
    medios.push({
      bytes, ext: "jpg", clase: "foto", alt: img.alt,
      origen_url: src.split("?")[0], orden: medios.length,
    });
  }

  if (!medios.length) {
    return { estado: "sin_medios", nota: "se vieron imágenes pero no se pudo traer ninguna", texto: datos.texto };
  }
  return {
    estado: "ok", hay_video: datos.hayVideo ? 1 : 0, fecha_pub: datos.fecha,
    texto: datos.texto, medios,
  };
}
