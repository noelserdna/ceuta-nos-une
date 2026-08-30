/* Autónomo a propósito: esta página se abre en una plaza, puede que con mala
   cobertura, así que no arrastra ni el mapa ni el resto de la web. */
(function () {
  "use strict";
  var campo = document.getElementById("municipio");
  var huecos = document.querySelectorAll("[data-hueco]");
  var original = [];
  for (var i = 0; i < huecos.length; i++) original.push(huecos[i].textContent);

  function pinta() {
    var v = campo.value.trim();
    for (var i = 0; i < huecos.length; i++) {
      huecos[i].textContent = v || original[i];
      huecos[i].classList.toggle("hueco--puesto", !!v);
    }
    try { v ? localStorage.setItem("municipio", v) : localStorage.removeItem("municipio"); }
    catch (e) { /* navegación privada: da igual, el texto se lee lo mismo */ }
  }

  try {
    var guardado = localStorage.getItem("municipio");
    if (guardado) { campo.value = guardado; pinta(); }
  } catch (e) {}

  campo.addEventListener("input", pinta);

  var boton = document.getElementById("btn-compartir-manifiesto");
  var nota = document.getElementById("manif-nota");
  var dice = nota.textContent;
  boton.addEventListener("click", function () {
    var url = location.origin + "/manifiesto";
    var texto = "Manifiesto por Ceuta, para leer en las concentraciones del 2 de septiembre.";
    if (navigator.share) {
      navigator.share({ title: "Manifiesto por Ceuta", text: texto, url: url }).catch(function () {});
      return;
    }
    navigator.clipboard.writeText(texto + " " + url).then(function () {
      nota.textContent = "Enlace copiado. Pégalo donde quieras.";
      nota.classList.add("difunde__nota--ok");
      setTimeout(function () {
        nota.textContent = dice;
        nota.classList.remove("difunde__nota--ok");
      }, 4000);
    }).catch(function () {});
  });
})();
