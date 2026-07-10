// ── lib/events.js — Bus de eventos + registro append-only (ndjson) ────────────
// Columna vertebral para analíticas (#15), referidos (#11), reputación (#4) y
// notificaciones (#13) sin acoplar módulos entre sí. Mismo patrón ndjson que el
// price_history.ndjson que ya usa el proyecto. Cero deps.
//
//   const events = require("../lib/events.js");
//   events.emit("job.published", { jobId, actorId });  // registra + avisa suscriptores
//   events.on("job.published", evt => { ... });          // suscribirse (in-memory)
//   events.on("*", evt => { ... });                       // todos los eventos
//   events.recent(200);                                   // últimos N eventos del log
//   events.countBy("job.published", sinceIso);            // conteo para analíticas
//   events.topBy(e => e.material, { type:"material.searched", limit:10 });
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const LOG_FILE = path.join(__dirname, "..", "events.ndjson");
const MAX_SCAN = 50000; // tope de líneas a leer, para no cargar un log gigante en RAM

const _subs = new Map(); // type -> [fn]   ("*" = cualquier evento)

function on(type, fn) {
  if (!_subs.has(type)) _subs.set(type, []);
  _subs.get(type).push(fn);
  return () => { // devuelve un unsubscribe
    const arr = _subs.get(type);
    if (arr) _subs.set(type, arr.filter(f => f !== fn));
  };
}

function emit(type, payload = {}) {
  const evt = { type, ts: new Date().toISOString(), ...payload };
  // 1) persistir (append — nunca reescribe todo el archivo)
  try { fs.appendFileSync(LOG_FILE, JSON.stringify(evt) + "\n", "utf-8"); }
  catch (e) { console.error("[events.emit]", e.message); }
  // 2) avisar a suscriptores en memoria, aislando errores de cada uno
  for (const t of [type, "*"]) {
    for (const fn of (_subs.get(t) || [])) {
      try { fn(evt); } catch (e) { console.error("[events.sub]", type, e.message); }
    }
  }
  return evt;
}

function _readLines() {
  try {
    const txt = fs.readFileSync(LOG_FILE, "utf-8");
    const lines = txt.split("\n").filter(Boolean);
    return lines.length > MAX_SCAN ? lines.slice(-MAX_SCAN) : lines;
  } catch { return []; }
}

function _parseAll() {
  const out = [];
  for (const l of _readLines()) {
    try { out.push(JSON.parse(l)); } catch { /* línea corrupta: ignorar */ }
  }
  return out;
}

function recent(n = 200) {
  const all = _parseAll();
  return n > 0 ? all.slice(-n) : all;
}

function countBy(selector, sinceIso) {
  const match = typeof selector === "function" ? selector : (e => e.type === selector);
  let count = 0;
  for (const e of _parseAll()) {
    if (sinceIso && e.ts < sinceIso) continue;
    if (match(e)) count++;
  }
  return count;
}

// Ranking: agrupa eventos por una clave y devuelve los más frecuentes.
// Ej.: topBy(e => e.professionalId, { type:"job.hired", limit:5 }) → más contratados.
function topBy(keyFn, { type, sinceIso, limit = 10 } = {}) {
  const tally = new Map();
  for (const e of _parseAll()) {
    if (type && e.type !== type) continue;
    if (sinceIso && e.ts < sinceIso) continue;
    const k = keyFn(e);
    if (k == null || k === "") continue;
    tally.set(k, (tally.get(k) || 0) + 1);
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

module.exports = { on, emit, recent, countBy, topBy, LOG_FILE };
