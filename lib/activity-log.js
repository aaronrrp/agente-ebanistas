// ── Activity Log / Auditoría ─────────────────────────────────────────────────
// El resto de las entidades de esta app reescriben su archivo JSON completo en
// cada cambio -- aceptable para decenas/cientos de registros (tenants, sellers),
// pero NO para "cada imagen generada, cada login" que puede acumular miles de
// eventos por día. Por eso este módulo usa un formato distinto, a propósito:
//
// - Un archivo NDJSON (un JSON por línea) por día (logs/activity-2026-06-29.ndjson).
//   Cada evento se agrega con fs.appendFileSync -- O(1), nunca relee ni reescribe
//   el archivo completo (a diferencia de saveTenants()-style, que es O(n) por
//   escritura). Esta es la única razón real para no seguir el patrón loadX/saveX
//   del resto del proyecto -- no es una preferencia de estilo.
// - Un ring buffer en memoria (últimos 500) para que "actividad reciente" (el
//   caso común del dashboard) no toque disco para nada.
// - Lecturas con rango de fechas leen solo los archivos .ndjson de esos días,
//   nunca "todo desde el principio de los tiempos".
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const LOGS_DIR = path.join(__dirname, "..", "logs");
const RING_SIZE = 500;
const ring = [];

function ensureLogsDir() {
  try { fs.mkdirSync(LOGS_DIR, { recursive: true }); } catch {}
}

function dayFile(isoDate) {
  return path.join(LOGS_DIR, `activity-${isoDate}.ndjson`);
}

function logActivity({ actorType, actorId, actorLabel, action, meta }) {
  const entry = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    actorType: actorType || "system",
    actorId: actorId || null,
    actorLabel: actorLabel || "",
    action,
    meta: meta || {}
  };
  ring.push(entry);
  if (ring.length > RING_SIZE) ring.shift();
  try {
    ensureLogsDir();
    fs.appendFileSync(dayFile(entry.ts.slice(0, 10)), JSON.stringify(entry) + "\n");
  } catch (e) {
    console.log(`[activity-log] no se pudo escribir: ${e.message}`);
  }
  return entry;
}

function getRecentActivity(limit = 100, filter = {}) {
  let list = ring;
  if (filter.action) list = list.filter(e => e.action.startsWith(filter.action));
  if (filter.actorType) list = list.filter(e => e.actorType === filter.actorType);
  return list.slice(-limit).reverse();
}

// Lee un rango de días específico (no "desde siempre") -- bounded por diseño.
function getActivityLogRange(fromIso, toIso, filter = {}) {
  ensureLogsDir();
  const from = fromIso || new Date().toISOString().slice(0, 10);
  const to = toIso || from;
  const out = [];
  let d = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (d <= end) {
    const iso = d.toISOString().slice(0, 10);
    try {
      const lines = fs.readFileSync(dayFile(iso), "utf-8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (filter.action && !entry.action.startsWith(filter.action)) continue;
          if (filter.actorType && entry.actorType !== filter.actorType) continue;
          out.push(entry);
        } catch {}
      }
    } catch {} // ese día no tiene archivo -- normal, no todos los días hay actividad
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out.reverse();
}

module.exports = { logActivity, getRecentActivity, getActivityLogRange };
