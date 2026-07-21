// ── Muro de comunidad (v55.36) ───────────────────────────────────────────────
// Preguntas y recomendaciones entre usuarios ("busco un ebanista en La Chorrera
// que haga cocinas a medida"). Cualquiera puede LEER; para publicar o responder
// se requiere sesión (cualquier rol). El nombre a mostrar lo envía el cliente
// (display); el rol/id reales del autor se guardan del lado del servidor para
// moderación (borrado por el autor o por el admin).
//
// Sin dependencias: node:http + almacenamiento en community.json (atomicWrite),
// mismo patrón que ads.json. serveStatic bloquea los .json → nunca se sirve.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { sendJson, readBody, atomicWrite, checkRateLimit, getClientIp, requireAdmin } = require("../lib/shared.js");

const FILE = path.join(__dirname, "..", "community.json");
const MAX_BODY = 1200;
const MAX_NAME = 60;
const MAX_POSTS = 500;

function load() { try { return JSON.parse(fs.readFileSync(FILE, "utf-8")); } catch { return []; } }
function save(list) { try { atomicWrite(FILE, list); } catch (e) { console.error("[community] save:", e.message); } }
let posts = load();

function clean(s, max) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max); }
function authorLabel(role) {
  return ({ ebanista: "Ebanista", professional: "Profesional", company: "Empresa", vendedor: "Vendedor", usuario_gratuito: "Usuario" })[role] || "Usuario";
}
function authorId(idn) {
  return idn.tenantId || idn.professionalId || idn.companyId || idn.sellerId || idn.freeUserId || "";
}
// Salida pública: nunca se expone el authId crudo (ni en el post ni en respuestas).
function publicPost(p) {
  const { authId, replies, ...rest } = p;
  rest.replies = (replies || []).map(r => { const { authId: _a, ...rr } = r; return rr; });
  return rest;
}

async function handle(req, res, { method, p, parts, getCallerIdentity }) {
  // GET /api/community — público (cualquiera puede leer, sin cuenta)
  if (method === "GET" && p === "/api/community") {
    const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
    let list = posts.slice();
    if (q.category) list = list.filter(x => x.category === q.category);
    if (q.province) list = list.filter(x => String(x.province || "").toLowerCase() === String(q.province).toLowerCase());
    if (q.q) { const t = String(q.q).toLowerCase(); list = list.filter(x => String(x.body || "").toLowerCase().includes(t)); }
    list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 120).map(publicPost);
    sendJson(res, 200, list);
    return true;
  }

  // POST /api/community — crear publicación (requiere sesión)
  if (method === "POST" && p === "/api/community") {
    const idn = getCallerIdentity ? getCallerIdentity(req) : null;
    if (!idn) { sendJson(res, 401, { error: "Inicia sesión para publicar en la comunidad." }); return true; }
    if (!checkRateLimit(`community:${getClientIp(req)}`, 8, 60000)) { sendJson(res, 429, { error: "Espera un momento antes de publicar de nuevo." }); return true; }
    const data = JSON.parse((await readBody(req)) || "{}");
    const body = clean(data.body, MAX_BODY);
    if (body.length < 4) { sendJson(res, 400, { error: "Escribe tu mensaje (mínimo 4 caracteres)." }); return true; }
    const post = {
      id: crypto.randomUUID(),
      body,
      category: clean(data.category, 40),
      province: clean(data.province, 40),
      city: clean(data.city, 60),
      authRole: idn.role,
      authId: authorId(idn),
      authorName: clean(data.authorName, MAX_NAME) || authorLabel(idn.role),
      replies: [],
      createdAt: new Date().toISOString()
    };
    posts.unshift(post);
    if (posts.length > MAX_POSTS) posts = posts.slice(0, MAX_POSTS);
    save(posts);
    sendJson(res, 201, publicPost(post));
    return true;
  }

  // POST /api/community/:id/replies — responder (requiere sesión)
  if (method === "POST" && parts[0] === "api" && parts[1] === "community" && parts[2] && parts[3] === "replies") {
    const idn = getCallerIdentity ? getCallerIdentity(req) : null;
    if (!idn) { sendJson(res, 401, { error: "Inicia sesión para responder." }); return true; }
    if (!checkRateLimit(`community:${getClientIp(req)}`, 12, 60000)) { sendJson(res, 429, { error: "Espera un momento antes de responder de nuevo." }); return true; }
    const post = posts.find(x => x.id === parts[2]);
    if (!post) { sendJson(res, 404, { error: "Publicación no encontrada." }); return true; }
    const data = JSON.parse((await readBody(req)) || "{}");
    const body = clean(data.body, MAX_BODY);
    if (body.length < 2) { sendJson(res, 400, { error: "Escribe tu respuesta." }); return true; }
    const reply = {
      id: crypto.randomUUID(),
      body,
      authRole: idn.role,
      authId: authorId(idn),
      authorName: clean(data.authorName, MAX_NAME) || authorLabel(idn.role),
      createdAt: new Date().toISOString()
    };
    if (!post.replies) post.replies = [];
    post.replies.push(reply);
    save(posts);
    sendJson(res, 201, publicPost(post));
    return true;
  }

  // DELETE /api/community/:id — borra el autor o el admin
  if (method === "DELETE" && parts[0] === "api" && parts[1] === "community" && parts[2] && !parts[3]) {
    const post = posts.find(x => x.id === parts[2]);
    if (!post) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const idn = getCallerIdentity ? getCallerIdentity(req) : null;
    const isOwner = idn && idn.role === post.authRole && authorId(idn) === post.authId && post.authId;
    if (!isOwner && !requireAdmin(req, res)) return true; // requireAdmin responde 401 si no es admin
    posts = posts.filter(x => x.id !== parts[2]);
    save(posts);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

module.exports = { handle, reload: () => { posts = load(); } };
