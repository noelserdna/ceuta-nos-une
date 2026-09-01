/* El widget de la fila cero, para incrustar en otra web con un iframe.
 *
 * Autónomo a propósito: no comparte nada con app.js ni con directo.js, porque
 * esto se sirve dentro de una página ajena y no debe arrastrar el mapa ni el
 * muro. Solo lee /api/directo, que es del mismo origen que el iframe.
 */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var pase = $("#pase"), vacio = $("#vacio"), cifra = $("#cifra");
  var puestas = {};   // media ya pintada, para no recrear la imagen en cada sondeo
  var orden = [], i = 0, sondeoMs = 8000;

  function texto(d) {
    if (d.momento === "off") return "Aún no ha empezado";
    if (d.momento === "fin") return "Fuimos " + (d.total || 0).toLocaleString("es-ES") + " personas";
    var n = d.ahora || 0;
    return "Somos " + n.toLocaleString("es-ES") + (n === 1 ? " persona" : " personas");
  }

  function pintar(tarjetas) {
    tarjetas.forEach(function (t) {
      if (!t.media || puestas[t.media]) return;
      var img = new Image();
      img.src = t.media;
      img.alt = "";
      img.loading = "lazy";
      pase.appendChild(img);
      puestas[t.media] = img;
      orden.push(img);
    });
    vacio.hidden = orden.length > 0;
    if (!orden.length) vacio.textContent = "Todavía no hay fotos";
  }

  function pasar() {
    if (!orden.length) return;
    orden.forEach(function (img, n) { img.classList.toggle("visible", n === i); });
    i = (i + 1) % orden.length;
  }

  function sondear() {
    fetch("/api/directo", { headers: { accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        cifra.textContent = texto(d);
        if (d.momento === "off") {
          orden.forEach(function (img) { img.remove(); });
          orden = []; puestas = {};
          vacio.hidden = false;
          vacio.textContent = "La fila cero abre el 2 de septiembre a las 20:00";
          return;
        }
        pintar((d.tarjetas || []).slice(0, 24));
        if (d.sondeo) sondeoMs = Math.max(6000, d.sondeo * 1000);
      })
      .catch(function () { /* un fallo suelto no rompe el widget: se reintenta */ })
      .then(function () { setTimeout(sondear, sondeoMs); });
  }

  /* Modo desnudo: solo el pase. Se usa cuando el widget va DENTRO de la propia
     web, donde el contador, el botón y la firma ya los pone la página que lo
     rodea y repetirlos sobra. */
  if (location.search.indexOf("desnudo") !== -1) {
    document.body.classList.add("desnudo");
  }

  // El enlace sale del iframe a la pestaña de arriba, no dentro de la cajita.
  $("#boton").href = location.origin + "/directo";

  sondear();
  setInterval(pasar, 5000);
})();
