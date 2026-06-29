// ── Helpers compartidos entre server.js y los módulos de routes/ ───────────
// Extraído tal cual de server.js (mismo comportamiento, sin lógica nueva) para que
// los módulos de rutas nuevos (profesionales, empresas, retazos, etc.) puedan usar
// estas mismas funciones sin requerir server.js completo (evita un require circular).
const crypto = require("node:crypto");

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 10_000_000) reject(new Error("Too large")); });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function getToken(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

function generatePassword() {
  return crypto.randomBytes(6).toString("base64url");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  const candidate = crypto.pbkdf2Sync(String(password || ""), salt, 100000, 64, "sha512").toString("hex");
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function makeStableId(seed) {
  const h = crypto.createHash("sha256").update(seed).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

function todayIso() { return new Date().toISOString().slice(0, 10); }

// Convierte un data URL ("data:image/png;base64,...") en un Blob nativo de Node 18+ --
// usado tanto para mandar imágenes a la API de OpenAI (server.js) como para subir
// fotos a un host externo (routes/upload.js). Cero dependencias nuevas.
function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const [, mime, b64] = match;
  const buffer = Buffer.from(b64, "base64");
  return new Blob([buffer], { type: mime });
}

// ── Sesión de admin (única para toda la app — vive aquí porque routes/ nuevos
// también necesitan poder exigir admin sin importar server.js completo) ──────
const adminSessions = new Map();
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 horas

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  adminSessions.set(token, Date.now());
  return token;
}

function isValidSession(token) {
  if (!token) return false;
  const ts = adminSessions.get(token);
  if (!ts) return false;
  if (Date.now() - ts > SESSION_TTL) { adminSessions.delete(token); return false; }
  return true;
}

function requireAdmin(req, res) {
  if (!isValidSession(getToken(req))) {
    sendJson(res, 401, { error: "No autorizado. Inicia sesión como admin." });
    return false;
  }
  return true;
}

module.exports = {
  sendJson, readBody, getToken,
  generatePassword, hashPassword, verifyPassword, makeStableId, todayIso, dataUrlToBlob,
  adminSessions, SESSION_TTL, createSession, isValidSession, requireAdmin
};
