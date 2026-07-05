// ── Centro Sostenible de Retazos ─────────────────────────────────────────────
// Publicar un retazo requiere ALGUNA identidad logueada (ebanista, profesional,
// empresa, o la cuenta nueva y liviana "usuario gratuito" para quien no es
// ninguna de las anteriores) -- pero NAVEGAR/filtrar el listado es público, igual
// que el resto del directorio. Para no depender de un require circular con
// server.js (que es quien junta los 4 tipos de sesión en getCallerIdentity),
// este módulo RECIBE esa función ya armada en el contexto de cada request
// (ctx.getCallerIdentity) en vez de intentar reconstruirla por su cuenta.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { sendJson, readBody, getToken, hashPassword, verifyPassword, generatePassword, requireAdmin, atomicWrite, checkRateLimit, getClientIp, registerSessionChecker } = require("../lib/shared.js");
const { logActivity } = require("../lib/activity-log.js");

const RETAZOS_FILE = path.join(__dirname, "..", "retazos.json");
const FREE_USERS_FILE = path.join(__dirname, "..", "usuarios_gratuitos.json");

const MATERIALS = ["melamina", "mdf", "madera", "triplay", "otro"];

function loadRetazos() {
  try { return JSON.parse(fs.readFileSync(RETAZOS_FILE, "utf-8")); }
  catch { saveRetazos([]); return []; }
}
function saveRetazos(list) {
  try { atomicWrite(RETAZOS_FILE, list); } catch (e) { console.error("[saveRetazos]", e.message); }
}
let retazos = loadRetazos();

function loadFreeUsers() {
  try { return JSON.parse(fs.readFileSync(FREE_USERS_FILE, "utf-8")); }
  catch { saveFreeUsers([]); return []; }
}
function saveFreeUsers(list) {
  try { atomicWrite(FREE_USERS_FILE, list); } catch (e) { console.error("[saveFreeUsers]", e.message); }
}
let freeUsers = loadFreeUsers();

function publicFreeUser(u) {
  const { passwordHash, passwordSalt, ...rest } = u;
  return rest;
}

const freeUserSessions = new Map(); // token -> { freeUserId, ts }
const SESSION_TTL = 24 * 60 * 60 * 1000;

function createFreeUserSession(freeUserId) {
  const token = crypto.randomBytes(32).toString("hex");
  freeUserSessions.set(token, { freeUserId, ts: Date.now() });
  return token;
}
function getFreeUserSession(token) {
  if (!token) return null;
  const s = freeUserSessions.get(token);
  if (!s) return null;
  if (Date.now() - s.ts > SESSION_TTL) { freeUserSessions.delete(token); return null; }
  return s;
}
registerSessionChecker(getFreeUserSession);

function makeFreeUserCode(name) {
  const prefix = String(name || "usuario")
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "").slice(0, 10) || "usuario";
  const hash = crypto.createHash("sha256").update(String(name || "") + Date.now()).digest("hex").slice(0, 6);
  return `${prefix}-${hash}`;
}

// Mapea la identidad ya resuelta por server.js (ctx.getCallerIdentity) a un
// {ownerType, ownerId, ownerLabel} uniforme para guardar en el retazo. No
// requiere los módulos de profesionales/empresas -- ownerLabel es opcional
// (se completa después si se necesita mostrar el nombre, ver nota en GET).
function identityToOwner(identity) {
  if (!identity) return null;
  if (identity.role === "ebanista") return { ownerType: "ebanista", ownerId: identity.tenantId };
  if (identity.role === "professional") return { ownerType: "professional", ownerId: identity.professionalId };
  if (identity.role === "company") return { ownerType: "company", ownerId: identity.companyId };
  if (identity.role === "usuario_gratuito") return { ownerType: "usuario_gratuito", ownerId: identity.freeUserId };
  return null;
}

function matchesFilters(r, q) {
  if (r.status !== "active") return false;
  if (q.isInspiration !== undefined) {
    const want = q.isInspiration === "true";
    if (Boolean(r.isInspiration) !== want) return false;
  } else if (r.isInspiration) {
    return false; // por defecto el listado normal no mezcla las publicaciones de inspiración
  }
  if (q.material && r.material !== q.material) return false;
  if (q.thickness && Number(r.thickness) !== Number(q.thickness)) return false;
  if (q.color && !String(r.color || "").toLowerCase().includes(String(q.color).toLowerCase())) return false;
  if (q.city && r.location?.city !== q.city) return false;
  if (q.isFree === "true" && !r.isFree) return false;
  return true;
}

async function handle(req, res, { method, p, parts, getCallerIdentity }) {
  // ── Usuario Gratuito: registro + sesión (mismo patrón que profesionales/empresas) ──
  if (method === "POST" && p === "/api/free-users/register") {
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.name || !String(data.name).trim()) { sendJson(res, 400, { error: "Falta el nombre." }); return true; }
    const passwordPlain = (data.password && String(data.password).trim()) || generatePassword();
    const { salt, hash } = hashPassword(passwordPlain);
    const user = {
      id: crypto.randomUUID(),
      name: String(data.name).trim(),
      phone: data.phone || "",
      email: data.email || "",
      plan: "gratuito",
      accessCode: makeFreeUserCode(data.name),
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
      lastAccessAt: null,
      status: "active"
    };
    freeUsers.push(user);
    saveFreeUsers(freeUsers);
    sendJson(res, 201, { ...publicFreeUser(user), passwordPlain });
    return true;
  }
  if (method === "POST" && p === "/api/auth/free-user") {
    const body = await readBody(req);
    const { code, password } = body ? JSON.parse(body) : {};
    const user = freeUsers.find(x => x.accessCode === code);
    if (!user) { sendJson(res, 401, { error: "Código no válido." }); return true; }
    if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) { sendJson(res, 401, { error: "Contraseña incorrecta." }); return true; }
    user.lastAccessAt = new Date().toISOString();
    saveFreeUsers(freeUsers);
    const token = createFreeUserSession(user.id);
    sendJson(res, 200, { token, user: publicFreeUser(user) });
    return true;
  }
  if (method === "GET" && p === "/api/auth/free-user/check") {
    sendJson(res, 200, { valid: Boolean(getFreeUserSession(getToken(req))) });
    return true;
  }
  if (method === "POST" && p === "/api/auth/free-user/logout") {
    const token = getToken(req);
    if (token) freeUserSessions.delete(token);
    sendJson(res, 200, { message: "Sesión cerrada." });
    return true;
  }

  // ── Retazos ──────────────────────────────────────────────────────────────
  if (method === "GET" && p === "/api/retazos") {
    const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
    const list = retazos.filter(r => matchesFilters(r, q));
    sendJson(res, 200, list);
    return true;
  }

  if (method === "POST" && p === "/api/retazos") {
    const identity = getCallerIdentity(req);
    const owner = identityToOwner(identity);
    if (!owner) { sendJson(res, 401, { error: "Inicia sesión (ebanista, profesional, empresa o usuario gratuito) para publicar." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.material) { sendJson(res, 400, { error: "Falta el material." }); return true; }
    const retazo = {
      id: crypto.randomUUID(),
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      material: MATERIALS.includes(data.material) ? data.material : "otro",
      color: data.color || "",
      thickness: Number(data.thickness) || 0,
      dimensions: { width: Number(data.dimensions?.width) || 0, height: Number(data.dimensions?.height) || 0 },
      quantity: Number(data.quantity) || 1,
      price: Number(data.price) || 0,
      isFree: Boolean(data.isFree),
      location: { province: data.location?.province || "", city: data.location?.city || "" },
      condition: data.condition || "bueno",
      photos: Array.isArray(data.photos) ? data.photos.slice(0, 10) : [],
      contact: { phone: data.contact?.phone || "", whatsapp: data.contact?.whatsapp || "" },
      status: "active",
      isInspiration: Boolean(data.isInspiration),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      views: 0
    };
    retazos.push(retazo);
    saveRetazos(retazos);
    logActivity({ actorType: owner.ownerType, actorId: owner.ownerId, action: "retazo.posted", meta: { id: retazo.id, material: retazo.material, isInspiration: retazo.isInspiration } });
    sendJson(res, 201, retazo);
    return true;
  }

  if (parts[0] === "api" && parts[1] === "retazos" && parts[2] && !parts[3]) {
    const retazo = retazos.find(x => x.id === parts[2]);

    if (method === "GET") {
      if (!retazo || retazo.status !== "active") { sendJson(res, 404, { error: "No encontrado." }); return true; }
      retazo.views = (retazo.views || 0) + 1;
      saveRetazos(retazos);
      sendJson(res, 200, retazo);
      return true;
    }

    if (method === "PUT" || method === "DELETE") {
      if (!retazo) { sendJson(res, 404, { error: "No encontrado." }); return true; }
      const identity = getCallerIdentity(req);
      const owner = identityToOwner(identity);
      // Solo el dueño puede editar/borrar -- sin excepción de admin todavía (eso es
      // moderación, Fase 5, que tendrá su propia ruta /api/admin/retazos/:id).
      if (!owner || owner.ownerType !== retazo.ownerType || owner.ownerId !== retazo.ownerId) {
        sendJson(res, 403, { error: "No puedes editar esta publicación." });
        return true;
      }
      if (method === "DELETE") {
        retazo.status = "removed";
        saveRetazos(retazos);
        sendJson(res, 200, { ok: true });
        return true;
      }
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      for (const field of ["color", "thickness", "dimensions", "quantity", "price", "isFree", "location", "condition", "photos", "status"]) {
        if (data[field] !== undefined) retazo[field] = data[field];
      }
      if (MATERIALS.includes(data.material)) retazo.material = data.material;
      retazo.updatedAt = new Date().toISOString();
      saveRetazos(retazos);
      sendJson(res, 200, retazo);
      return true;
    }
  }

  // ── Moderación (admin) -- a diferencia de professionals/companies, retazos no
  // tiene "aprobar" (se publican directos, ver comentario en identityToOwner) --
  // solo "eliminar por reporte" tiene sentido aquí.
  if (method === "GET" && p === "/api/admin/retazos") {
    if (!requireAdmin(req, res)) return true;
    sendJson(res, 200, retazos);
    return true;
  }
  if (parts[0] === "api" && parts[1] === "admin" && parts[2] === "retazos" && parts[3] && method === "DELETE") {
    if (!requireAdmin(req, res)) return true;
    const retazo = retazos.find(x => x.id === parts[3]);
    if (!retazo) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    retazo.status = "removed";
    saveRetazos(retazos);
    logActivity({ actorType: "admin", action: "retazo.removed_by_admin", meta: { id: retazo.id } });
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

module.exports = {
  handle, MATERIALS, getFreeUserSession,
  getAllRetazos: () => retazos,
  reload: () => { retazos = loadRetazos(); freeUsers = loadFreeUsers(); }
};
