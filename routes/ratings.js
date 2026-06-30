// ── Valoraciones de profesionales ──────────────────────────────────────────
// POST /api/professionals/:id/ratings   — crea o actualiza valoración propia
// GET  /api/professionals/:id/ratings   — listado público (sin ocultas)
// PUT  /api/ratings/:ratingId           — editar propia valoración
// GET  /api/admin/ratings               — admin, todas + filtros
// POST /api/admin/ratings/:id/hide|show — moderación admin
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { sendJson, readBody, getToken, requireAdmin, adminSessions, SESSION_TTL, isValidSession } = require("../lib/shared.js");
const { logActivity } = require("../lib/activity-log.js");
const { getProfessionalSession } = require("./professionals.js");
const { getCompanySession } = require("./companies.js");
const { getFreeUserSession } = require("./retazos.js");

const RATINGS_FILE = path.join(__dirname, "..", "professional_ratings.json");
const PROFESSIONALS_FILE = path.join(__dirname, "..", "professionals.json");

function loadRatings() {
  try { return JSON.parse(fs.readFileSync(RATINGS_FILE, "utf-8")); }
  catch { saveRatings([]); return []; }
}
function saveRatings(list) {
  try { fs.writeFileSync(RATINGS_FILE, JSON.stringify(list, null, 2)); } catch {}
}
function loadProfessionals() {
  try { return JSON.parse(fs.readFileSync(PROFESSIONALS_FILE, "utf-8")); } catch { return []; }
}
function saveProfessionals(list) {
  try { fs.writeFileSync(PROFESSIONALS_FILE, JSON.stringify(list, null, 2)); } catch {}
}

function recalcProfessionalRatings(professionalId) {
  const visible = loadRatings().filter(r => r.professionalId === professionalId && !r.hidden);
  const avg = visible.length ? visible.reduce((s, r) => s + r.stars, 0) / visible.length : 0;
  const pros = loadProfessionals();
  const idx = pros.findIndex(p => p.id === professionalId);
  if (idx >= 0) {
    pros[idx].ratings = { avg: Math.round(avg * 10) / 10, count: visible.length };
    saveProfessionals(pros);
  }
}

function getRatingCaller(req) {
  const token = getToken(req);
  if (!token) return null;
  const pro = getProfessionalSession(token);
  if (pro) return { role: "professional", id: pro.professionalId };
  const co = getCompanySession(token);
  if (co) return { role: "company", id: co.companyId };
  const fu = getFreeUserSession(token);
  if (fu) return { role: "usuario_gratuito", id: fu.freeUserId };
  const adm = adminSessions.get(token);
  if (adm && isValidSession(adm)) return { role: "admin", id: "admin" };
  return null;
}
function callerKey(caller) { return `${caller.role}:${caller.id}`; }

function publicRating(r) {
  const { raterRole, raterId, reportedBy, ...rest } = r;
  return rest;
}

async function handle(req, res, { method, p, parts }) {
  // GET /api/professionals/:id/ratings
  if (method === "GET" && parts[0] === "api" && parts[1] === "professionals" && parts[2] && parts[3] === "ratings" && !parts[4]) {
    const list = loadRatings().filter(r => r.professionalId === parts[2] && !r.hidden);
    sendJson(res, 200, list.map(publicRating));
    return true;
  }

  // POST /api/professionals/:id/ratings
  if (method === "POST" && parts[0] === "api" && parts[1] === "professionals" && parts[2] && parts[3] === "ratings" && !parts[4]) {
    const caller = getRatingCaller(req);
    if (!caller) { sendJson(res, 401, { error: "Debes iniciar sesión para dejar una valoración." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    const stars = Number(data.stars);
    if (!stars || stars < 1 || stars > 5) { sendJson(res, 400, { error: "Valoración inválida (1–5 estrellas)." }); return true; }
    const professionalId = parts[2];
    const ratings = loadRatings();
    const key = callerKey(caller);
    const existing = ratings.find(r => r.professionalId === professionalId && callerKey({ role: r.raterRole, id: r.raterId }) === key);
    if (existing) {
      existing.stars = stars;
      existing.comment = String(data.comment || "").trim().slice(0, 1000);
      if (Array.isArray(data.photoUrls)) existing.photoUrls = data.photoUrls.slice(0, 5);
      existing.updatedAt = new Date().toISOString();
      saveRatings(ratings);
      recalcProfessionalRatings(professionalId);
      logActivity({ actorType: caller.role, actorId: caller.id, actorLabel: caller.role, action: "rating.updated", meta: { professionalId, stars } });
      sendJson(res, 200, publicRating(existing));
    } else {
      const rating = {
        id: crypto.randomUUID(),
        professionalId,
        raterRole: caller.role,
        raterId: caller.id,
        raterName: String(data.raterName || "").trim().slice(0, 80) || caller.role,
        stars,
        comment: String(data.comment || "").trim().slice(0, 1000),
        photoUrls: Array.isArray(data.photoUrls) ? data.photoUrls.slice(0, 5) : [],
        hidden: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      ratings.push(rating);
      saveRatings(ratings);
      recalcProfessionalRatings(professionalId);
      logActivity({ actorType: caller.role, actorId: caller.id, actorLabel: caller.role, action: "rating.created", meta: { professionalId, stars } });
      sendJson(res, 201, publicRating(rating));
    }
    return true;
  }

  // PUT /api/ratings/:ratingId
  if (method === "PUT" && parts[0] === "api" && parts[1] === "ratings" && parts[2] && !parts[3]) {
    const caller = getRatingCaller(req);
    if (!caller) { sendJson(res, 401, { error: "No autenticado." }); return true; }
    const ratings = loadRatings();
    const idx = ratings.findIndex(r => r.id === parts[2]);
    if (idx < 0) { sendJson(res, 404, { error: "Valoración no encontrada." }); return true; }
    const r = ratings[idx];
    if (r.raterRole !== caller.role || r.raterId !== caller.id) { sendJson(res, 403, { error: "No puedes editar esta valoración." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    const stars = Number(data.stars);
    if (stars && (stars < 1 || stars > 5)) { sendJson(res, 400, { error: "Estrellas inválidas." }); return true; }
    if (stars) r.stars = stars;
    if (data.comment !== undefined) r.comment = String(data.comment).trim().slice(0, 1000);
    if (Array.isArray(data.photoUrls)) r.photoUrls = data.photoUrls.slice(0, 5);
    r.updatedAt = new Date().toISOString();
    saveRatings(ratings);
    recalcProfessionalRatings(r.professionalId);
    sendJson(res, 200, publicRating(r));
    return true;
  }

  // GET /api/admin/ratings
  if (method === "GET" && p === "/api/admin/ratings") {
    if (!requireAdmin(req, res)) return true;
    const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
    const all = loadRatings().filter(r => {
      if (q.professionalId && r.professionalId !== q.professionalId) return false;
      if (q.hidden !== undefined && String(r.hidden) !== q.hidden) return false;
      return true;
    });
    sendJson(res, 200, all);
    return true;
  }

  // POST /api/admin/ratings/:id/hide
  if (method === "POST" && parts[0] === "api" && parts[1] === "admin" && parts[2] === "ratings" && parts[3] && parts[4] === "hide") {
    if (!requireAdmin(req, res)) return true;
    const ratings = loadRatings();
    const r = ratings.find(x => x.id === parts[3]);
    if (!r) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    r.hidden = true;
    saveRatings(ratings);
    recalcProfessionalRatings(r.professionalId);
    logActivity({ actorType: "admin", actorId: "admin", actorLabel: "Admin", action: "rating.hidden", meta: { ratingId: r.id } });
    sendJson(res, 200, { ok: true });
    return true;
  }

  // POST /api/admin/ratings/:id/show
  if (method === "POST" && parts[0] === "api" && parts[1] === "admin" && parts[2] === "ratings" && parts[3] && parts[4] === "show") {
    if (!requireAdmin(req, res)) return true;
    const ratings = loadRatings();
    const r = ratings.find(x => x.id === parts[3]);
    if (!r) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    r.hidden = false;
    saveRatings(ratings);
    recalcProfessionalRatings(r.professionalId);
    logActivity({ actorType: "admin", actorId: "admin", actorLabel: "Admin", action: "rating.shown", meta: { ratingId: r.id } });
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

module.exports = { handle };
