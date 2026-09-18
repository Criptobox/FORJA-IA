/* prism-fx — la parte viva del kit. Sin dependencias, sin red, ~3 KB.
   Tres reglas:
   1. Si el visitante pidió menos animación, este script NO hace nada.
   2. Nada se esconde hasta que este script confirma que puede revelarlo.
   3. Red de seguridad: si el observer no llega a disparar (un iframe que no
      hace scroll, una pestaña en segundo plano), a los 1,2 s se revela todo.
      Un efecto que se pierde es una molestia; contenido invisible es un fallo. */
(function () {
  "use strict";
  var doc = document;

  // La transición de página va SIEMPRE disponible, motion o no: envuelve
  // `startViewTransition` y, sin soporte, simplemente ejecuta el cambio. No
  // depende del resto del motor — por eso se define antes de decidir si el
  // resto arranca.
  window.prismFx = window.prismFx || {};
  window.prismFx.transition = function (cambio) {
    if (doc.startViewTransition) doc.startViewTransition(cambio);
    else cambio();
  };

  var lento = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (lento || !("IntersectionObserver" in window)) return;

  function listo() {
    doc.documentElement.classList.add("fx-on");

    // titulares partidos en palabras: se hace ANTES de esconder nada
    var partir = doc.querySelectorAll('[data-fx="split"]');
    for (var s = 0; s < partir.length; s++) {
      var el = partir[s];
      if (el.dataset.fxDone) continue;
      var palabras = (el.textContent || "").split(/\s+/).filter(Boolean);
      if (!palabras.length || palabras.length > 60) continue;
      el.textContent = "";
      for (var w = 0; w < palabras.length; w++) {
        var span = doc.createElement("span");
        span.className = "fx-word";
        span.style.setProperty("--fx-i", String(w));
        span.textContent = palabras[w] + (w < palabras.length - 1 ? " " : "");
        el.appendChild(span);
      }
      el.dataset.fxDone = "1";
    }

    // índice de cada hijo para el escalonado
    var grupos = doc.querySelectorAll('[data-fx="stagger"]');
    for (var g = 0; g < grupos.length; g++) {
      var hijos = grupos[g].children;
      for (var h = 0; h < hijos.length; h++) hijos[h].style.setProperty("--fx-i", String(h));
    }

    // decrypt: caracteres al azar hasta asentarse en el texto real. No se
    // esconde con CSS —el contenido YA es visible—, así que sin JS el texto
    // simplemente se ve quieto: es la propia animación la que falta, no nada.
    var GLIFOS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    function scramblear(el) {
      if (el.dataset.fxDone) return;
      el.dataset.fxDone = "1";
      var final = el.textContent || "";
      var largo = final.length;
      if (!largo || largo > 140) return;
      var t0 = 0;
      (function paso(t) {
        if (!t0) t0 = t;
        var k = Math.min(1, (t - t0) / 900);
        var revelados = Math.floor(k * largo);
        var out = "";
        for (var i = 0; i < largo; i++) {
          var ch = final[i];
          out += ch === " " || i < revelados ? ch : GLIFOS[(Math.random() * GLIFOS.length) | 0];
        }
        el.textContent = out;
        if (k < 1) requestAnimationFrame(paso);
        else el.textContent = final;
      })(0);
    }

    var entrantes = doc.querySelectorAll(
      '[data-fx="reveal"],[data-fx="stagger"],[data-fx="split"],[data-fx="pop"],[data-fx="scramble"]'
    );
    var obs = new IntersectionObserver(
      function (filas) {
        for (var i = 0; i < filas.length; i++) {
          if (filas[i].isIntersecting) {
            var t = filas[i].target;
            if (t.dataset.fx === "scramble") scramblear(t);
            else t.classList.add("fx-in");
            obs.unobserve(t);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    for (var e = 0; e < entrantes.length; e++) obs.observe(entrantes[e]);

    // red de seguridad
    setTimeout(function () {
      for (var i = 0; i < entrantes.length; i++) {
        if (entrantes[i].dataset.fx === "scramble") scramblear(entrantes[i]);
        else entrantes[i].classList.add("fx-in");
      }
    }, 1200);

    // contadores
    var cuentas = doc.querySelectorAll('[data-fx="count"]');
    var obsC = new IntersectionObserver(function (filas) {
      for (var i = 0; i < filas.length; i++) {
        if (!filas[i].isIntersecting) continue;
        var nodo = filas[i].target;
        obsC.unobserve(nodo);
        var fin = parseFloat(nodo.dataset.fxTo || nodo.textContent || "0") || 0;
        var dec = (nodo.dataset.fxTo || "").indexOf(".") >= 0 ? 1 : 0;
        var t0 = 0;
        (function paso(t) {
          if (!t0) t0 = t;
          var k = Math.min(1, (t - t0) / 1400);
          var v = fin * (1 - Math.pow(1 - k, 3));
          nodo.textContent = v.toFixed(dec);
          if (k < 1) requestAnimationFrame(paso);
          else nodo.textContent = fin.toFixed(dec);
        })(0);
      }
    });
    for (var c = 0; c < cuentas.length; c++) {
      cuentas[c].dataset.fxTo = cuentas[c].dataset.fxTo || cuentas[c].textContent || "0";
      obsC.observe(cuentas[c]);
    }

    // puntero: inclinación, imán y foco
    doc.addEventListener(
      "pointermove",
      function (ev) {
        var t = ev.target;
        var nodo = t && t.closest ? t.closest('[data-fx="tilt"],[data-fx="magnetic"],[data-fx="spotlight"]') : null;
        if (!nodo) return;
        var r = nodo.getBoundingClientRect();
        var px = (ev.clientX - r.left) / r.width;
        var py = (ev.clientY - r.top) / r.height;
        var tipo = nodo.dataset.fx;
        if (tipo === "spotlight") {
          nodo.style.setProperty("--fx-x", (px * 100).toFixed(1) + "%");
          nodo.style.setProperty("--fx-y", (py * 100).toFixed(1) + "%");
        } else if (tipo === "tilt") {
          var max = parseFloat(nodo.dataset.fxMax || "8");
          nodo.classList.add("fx-tilting");
          nodo.style.transform =
            "perspective(900px) rotateX(" + ((0.5 - py) * max).toFixed(2) + "deg) rotateY(" + ((px - 0.5) * max).toFixed(2) + "deg)";
        } else {
          var f = parseFloat(nodo.dataset.fxFuerza || "0.25");
          nodo.style.transform = "translate(" + ((px - 0.5) * r.width * f).toFixed(1) + "px," + ((py - 0.5) * r.height * f).toFixed(1) + "px)";
        }
      },
      { passive: true }
    );
    doc.addEventListener(
      "pointerleave",
      function (ev) {
        var t = ev.target;
        var nodo = t && t.closest ? t.closest('[data-fx="tilt"],[data-fx="magnetic"]') : null;
        if (!nodo) return;
        nodo.classList.remove("fx-tilting");
        nodo.style.transform = "";
      },
      true
    );

    // cursor propio: solo se crea si algo lo pide. Reemplaza el del sistema
    // —la regla CSS que lo oculta también está detrás de `.fx-on`—, así que
    // sin este script el cursor normal sigue ahí.
    var anfitrionesCursor = doc.querySelectorAll('[data-fx="cursor"]');
    if (anfitrionesCursor.length) {
      var cursor = doc.createElement("div");
      cursor.className = "fx-cursor";
      var etiqueta = doc.createElement("span");
      etiqueta.className = "fx-cursor-label";
      cursor.appendChild(etiqueta);
      doc.body.appendChild(cursor);
      var cx = 0,
        cy = 0,
        tx = -100,
        ty = -100;
      (function bucleCursor() {
        cx += (tx - cx) * 0.2;
        cy += (ty - cy) * 0.2;
        cursor.style.transform = "translate(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px)";
        requestAnimationFrame(bucleCursor);
      })();
      doc.addEventListener(
        "pointermove",
        function (ev) {
          tx = ev.clientX;
          ty = ev.clientY;
          var t = ev.target;
          var etq = t && t.closest ? t.closest("[data-fx-cursor]") : null;
          cursor.classList.toggle("fx-cursor-active", !!etq);
          etiqueta.textContent = etq ? etq.dataset.fxCursor || "" : "";
        },
        { passive: true }
      );
    }

    // Un solo bucle de scroll para las tres cosas que dependen de él: el
    // parallax de siempre, y el avance (0 a 1) que `pin`/`horizontal` dejan
    // en `--fx-p` para que el propio autor —o los `[data-fx-step]`— lo usen.
    var capas = doc.querySelectorAll('[data-fx="parallax"]');
    var anclas = doc.querySelectorAll('[data-fx="pin"]');
    var horizontales = doc.querySelectorAll('[data-fx="horizontal"]');
    if (capas.length || anclas.length || horizontales.length) {
      var pendiente = false;
      var actualizar = function () {
        pendiente = false;
        var alto = window.innerHeight || 800;

        for (var i = 0; i < capas.length; i++) {
          var r = capas[i].getBoundingClientRect();
          if (r.bottom < 0 || r.top > alto) continue;
          var v = parseFloat(capas[i].dataset.fxVel || "0.15");
          capas[i].style.transform = "translateY(" + ((r.top - alto / 2) * -v).toFixed(1) + "px)";
        }

        for (var a = 0; a < anclas.length; a++) {
          var seccion = anclas[a];
          var rs = seccion.getBoundingClientRect();
          var total = rs.height - alto;
          var p = total > 0 ? Math.min(1, Math.max(0, -rs.top / total)) : 0;
          seccion.style.setProperty("--fx-p", p.toFixed(3));
          var pasos = seccion.querySelectorAll("[data-fx-step]");
          if (pasos.length) {
            var activo = Math.min(pasos.length - 1, Math.floor(p * pasos.length));
            for (var ps = 0; ps < pasos.length; ps++) {
              pasos[ps].classList.toggle("fx-active", ps === activo);
            }
          }
        }

        for (var h = 0; h < horizontales.length; h++) {
          var envoltura = horizontales[h];
          var rh = envoltura.getBoundingClientRect();
          var totalH = rh.height - alto;
          var ph = totalH > 0 ? Math.min(1, Math.max(0, -rh.top / totalH)) : 0;
          envoltura.style.setProperty("--fx-p", ph.toFixed(3));
          var carril = envoltura.querySelector('[data-fx="horizontal-track"]');
          if (carril) {
            var maxDesplace = carril.scrollWidth - envoltura.clientWidth;
            carril.style.transform = "translateX(" + (-ph * Math.max(0, maxDesplace)).toFixed(1) + "px)";
          }
        }
      };
      window.addEventListener(
        "scroll",
        function () {
          if (pendiente) return;
          pendiente = true;
          requestAnimationFrame(actualizar);
        },
        { passive: true }
      );
      // primer pintado: si la sección ya está a la vista al cargar (o un
      // paso inicial que no debería estar activo aún), no se espera al
      // primer scroll para saberlo.
      actualizar();
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", listo);
  else listo();
})();
