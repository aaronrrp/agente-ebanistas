/*
 * mobile-bridge.js — Puente Web ⇄ App móvil (Capacitor). PiLLA v55.0
 * ---------------------------------------------------------------------------
 * OBJETIVO: que la MISMA web (index.html + app.js + styles.css) funcione dentro
 * de la app móvil SIN duplicar lógica. Se carga ANTES de app.js.
 *
 * - En la WEB (Render): no hace absolutamente nada. API_BASE = "" → mismo origen.
 *   (Cero riesgo de romper la web existente: hay una salida temprana.)
 * - En la APP (Capacitor): las peticiones relativas "/api/..." se redirigen al
 *   backend en la nube, porque dentro de la app el origen es capacitor://localhost
 *   y "/api" no existe localmente. Así se reutiliza el backend TAL CUAL, una sola
 *   lógica para web y móvil.
 *
 * Configurable: define window.PILLA_API_BASE antes de este script para apuntar a
 * otro dominio (staging, dominio propio, etc.).
 */
(function () {
  "use strict";

  var cap = window.Capacitor;
  var isNative = !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());

  // Backend en la nube que usa la app. Cambia esto (o define window.PILLA_API_BASE)
  // si mueves el backend a un dominio propio.
  var DEFAULT_CLOUD_API = "https://agente-ebanistas.onrender.com";

  var API_BASE = window.PILLA_API_BASE || (isNative ? DEFAULT_CLOUD_API : "");
  window.PILLA_API_BASE = API_BASE;
  window.PILLA_IS_NATIVE = isNative;
  window.PILLA_PLATFORM = (cap && typeof cap.getPlatform === "function") ? cap.getPlatform() : "web";

  if (!API_BASE) return; // Web normal: nada que reescribir. Salida temprana = 0 impacto.

  // Redirige SOLO las rutas del API ("/api/..."). El resto (assets locales) queda igual.
  var nativeFetch = window.fetch.bind(window);
  function isApiPath(u) { return typeof u === "string" && u.indexOf("/api") === 0; }

  window.fetch = function (input, init) {
    try {
      if (isApiPath(input)) {
        input = API_BASE + input;
      } else if (input && typeof input === "object" && isApiPath(input.url)) {
        input = new Request(API_BASE + input.url, input);
      }
    } catch (e) { /* ante cualquier duda, no tocar la petición */ }
    return nativeFetch(input, init);
  };

  // Marca <html> para poder afinar estilos solo-app desde CSS (safe-area, tabs, etc.)
  try { document.documentElement.classList.add("pilla-native", "pilla-" + window.PILLA_PLATFORM); } catch (e) {}
})();
