/**
 * Analítica de visitas (Vercel Web Analytics).
 *
 * No se usa el paquete de npm ni el componente <Analytics/> porque esta web no
 * es React: es HTML servido tal cual. Lo que hace ese componente es exactamente
 * esto, cargar el script del propio dominio.
 *
 * Solo se carga en ceutanosune.es. El .com lo sirve el Worker de Cloudflare,
 * donde /_vercel/ no existe y el script daría un 404 en cada visita.
 *
 * Va todo por el mismo origen (/_vercel/insights/...), así que la política de
 * seguridad del sitio -script-src 'self'- lo permite sin abrirle la mano a
 * ningún dominio de terceros.
 */
(function () {
  "use strict";
  var host = location.hostname;
  if (host !== "ceutanosune.es" && host !== "www.ceutanosune.es") return;

  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };

  var s = document.createElement("script");
  s.defer = true;
  s.src = "/_vercel/insights/script.js";
  document.head.appendChild(s);
})();
