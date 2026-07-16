// sync-web.mjs — Copia la web (FUENTE ÚNICA en la raíz del repo) a movil/www para
// que Capacitor la empaquete dentro de la app. NO duplica lógica: www es un
// artefacto de build regenerable; la verdad vive en index.html/app.js/styles.css.
//
// Uso:  node sync-web.mjs   (o  npm run sync-web)
import { cpSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");           // raíz del repo (backend + web)
const www = join(here, "www");           // destino que empaqueta Capacitor

// Requeridos para que la app funcione. El puente (mobile-bridge.js) DEBE ir.
const REQUIRED = ["index.html", "app.js", "styles.css", "mobile-bridge.js", "pilla-logo.png"];
// Opcionales (media del hero): se copian si existen.
const OPTIONAL = ["panama-hero.jpg", "panama-hero.mp4", "favicon.ico"];

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

let copied = [];
let missing = [];
for (const f of REQUIRED) {
  const src = join(root, f);
  if (existsSync(src)) { cpSync(src, join(www, f)); copied.push(f); }
  else missing.push(f);
}
for (const f of OPTIONAL) {
  const src = join(root, f);
  if (existsSync(src)) { cpSync(src, join(www, f)); copied.push(f); }
}

console.log("[sync-web] www regenerado.");
console.log("[sync-web] copiados:", copied.join(", "));
if (missing.length) {
  console.error("[sync-web] FALTAN (requeridos):", missing.join(", "));
  process.exit(1);
}
