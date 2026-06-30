// ── Helpers compartidos entre server.js y los módulos de routes/ ───────────
const crypto = require("node:crypto");
const fs = require("node:fs");

// ── HTTP Security Headers ─────────────────────────────────────────────────────
// Se aplican a todas las respuestas JSON y estáticas.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Download-Options": "noopen",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Cache-Control": "no-store"
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    ...SECURITY_HEADERS
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

// Safe JSON.parse — devuelve fallback en lugar de lanzar en input malformado
function safeJson(text, fallback = null) {
  if (!text) return fallback;
  try { return JSON.parse(text); } catch { return fallback; }
}

// Atomic write: escribe a .tmp primero, luego renombra.
// Evita que un crash durante la escritura deje el JSON truncado/corrupto.
function atomicWrite(filePath, data) {
  const tmp = filePath + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, filePath);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch {}
    throw e;
  }
}

// ── Rate Limiting ──────────────────────────────────────────────────────────────
// Contador en memoria por clave (IP + endpoint). Ventana deslizante simple.
// Sin dependencias externas — suficiente para proteger los endpoints de auth
// de ataques de fuerza bruta en una instancia única (Render free plan).
const _rl = new Map();
// Limpiar entradas caducadas cada 5 minutos para evitar memory leak
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _rl) if (now > v.resetAt) _rl.delete(k);
}, 5 * 60 * 1000).unref(); // .unref() para que no bloquee el shutdown del proceso

function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  let e = _rl.get(key);
  if (!e || now > e.resetAt) e = { count: 0, resetAt: now + windowMs };
  e.count++;
  _rl.set(key, e);
  return e.count <= maxRequests;
}

// Client IP — respeta X-Forwarded-For del load balancer de Render
function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (fwd ? fwd.split(",")[0].trim() : req.socket?.remoteAddress) || "unknown";
}

// Comparación de strings en tiempo constante para prevenir timing attacks.
// Usa HMAC con clave efímera para comparar strings de longitud variable sin
// filtrar información sobre cuál byte difirió ni cuándo.
function safeCompare(a, b) {
  const key = crypto.randomBytes(32);
  const ha = crypto.createHmac("sha256", key).update(String(a || "")).digest();
  const hb = crypto.createHmac("sha256", key).update(String(b || "")).digest();
  return crypto.timingSafeEqual(ha, hb);
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

function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const [, mime, b64] = match;
  const buffer = Buffer.from(b64, "base64");
  return new Blob([buffer], { type: mime });
}

// ── Admin session (única para toda la app) ────────────────────────────────────
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
  safeJson, atomicWrite, checkRateLimit, getClientIp, safeCompare, SECURITY_HEADERS,
  generatePassword, hashPassword, verifyPassword, makeStableId, todayIso, dataUrlToBlob,
  adminSessions, SESSION_TTL, createSession, isValidSession, requireAdmin
};
