// ── Publicidad / Marketplace ─────────────────────────────────────────────────
// "Empresa destacada" y "producto destacado" YA existen desde las Fases 1/2/5
// (el flag featured/featuredUntil en professionals.json/companies.json, con su
// aprobación manual de admin) -- no se duplica ese mecanismo aquí. Este módulo
// cubre los formatos que SÍ son una entidad propia, sin perfil detrás: banner
// principal, banner lateral, promoción, cupón. "active" es el toggle manual de
// "ya pagó" que se acordó con el usuario -- no hay pasarela de pago real.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { sendJson, readBody, requireAdmin } = require("../lib/shared.js");
const { logActivity } = require("../lib/activity-log.js");

const ADS_FILE = path.join(__dirname, "..", "ads.json");
const TYPES = ["banner_principal", "banner_lateral", "promocion", "cupon"];

function loadAds() {
  try { return JSON.parse(fs.readFileSync(ADS_FILE, "utf-8")); }
  catch { saveAds([]); return []; }
}
function saveAds(list) {
  try { fs.writeFileSync(ADS_FILE, JSON.stringify(list, null, 2)); } catch {}
}
let ads = loadAds();

function isCurrentlyActive(ad) {
  if (!ad.active) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (ad.startsAt && today < ad.startsAt) return false;
  if (ad.endsAt && today > ad.endsAt) return false;
  return true;
}

async function handle(req, res, { method, p, parts }) {
  // GET /api/ads?type=&placement= -- público, solo lo activo y dentro de fecha
  if (method === "GET" && p === "/api/ads") {
    const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
    let list = ads.filter(isCurrentlyActive);
    if (q.type) list = list.filter(a => a.type === q.type);
    sendJson(res, 200, list);
    return true;
  }

  if (parts[0] === "api" && parts[1] === "ads" && parts[2] && parts[3] === "impression" && method === "POST") {
    const ad = ads.find(a => a.id === parts[2]);
    if (ad) { ad.stats.impressions = (ad.stats.impressions || 0) + 1; saveAds(ads); }
    sendJson(res, 200, { ok: true });
    return true;
  }
  if (parts[0] === "api" && parts[1] === "ads" && parts[2] && parts[3] === "click" && method === "POST") {
    const ad = ads.find(a => a.id === parts[2]);
    if (ad) { ad.stats.clicks = (ad.stats.clicks || 0) + 1; saveAds(ads); }
    sendJson(res, 200, { ok: true });
    return true;
  }

  // ── Admin: CRUD completo ─────────────────────────────────────────────────
  if (method === "GET" && p === "/api/admin/ads") {
    if (!requireAdmin(req, res)) return true;
    sendJson(res, 200, ads);
    return true;
  }
  if (method === "POST" && p === "/api/admin/ads") {
    if (!requireAdmin(req, res)) return true;
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.title) { sendJson(res, 400, { error: "Falta el título." }); return true; }
    const ad = {
      id: crypto.randomUUID(),
      type: TYPES.includes(data.type) ? data.type : "promocion",
      ownerType: data.ownerType || "", // company|professional, opcional -- de quién es el anuncio
      ownerId: data.ownerId || "",
      title: data.title,
      imageUrl: data.imageUrl || "",
      linkUrl: data.linkUrl || "",
      couponCode: data.couponCode || "",
      startsAt: data.startsAt || null,
      endsAt: data.endsAt || null,
      active: false, // arranca apagado -- el admin lo prende cuando confirma el pago manual
      paymentNote: data.paymentNote || "",
      stats: { impressions: 0, clicks: 0 },
      createdAt: new Date().toISOString()
    };
    ads.push(ad);
    saveAds(ads);
    logActivity({ actorType: "admin", action: "ad.created", meta: { id: ad.id, type: ad.type, title: ad.title } });
    sendJson(res, 201, ad);
    return true;
  }
  if (parts[0] === "api" && parts[1] === "admin" && parts[2] === "ads" && parts[3] && !parts[4] && method === "PUT") {
    if (!requireAdmin(req, res)) return true;
    const ad = ads.find(a => a.id === parts[3]);
    if (!ad) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    for (const field of ["title", "imageUrl", "linkUrl", "couponCode", "startsAt", "endsAt", "paymentNote"]) {
      if (data[field] !== undefined) ad[field] = data[field];
    }
    if (TYPES.includes(data.type)) ad.type = data.type;
    saveAds(ads);
    sendJson(res, 200, ad);
    return true;
  }
  if (parts[0] === "api" && parts[1] === "admin" && parts[2] === "ads" && parts[3] && parts[4] === "toggle-active" && method === "POST") {
    if (!requireAdmin(req, res)) return true;
    const ad = ads.find(a => a.id === parts[3]);
    if (!ad) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    ad.active = !ad.active;
    saveAds(ads);
    logActivity({ actorType: "admin", action: ad.active ? "ad.activated" : "ad.deactivated", meta: { id: ad.id, title: ad.title } });
    sendJson(res, 200, ad);
    return true;
  }
  if (parts[0] === "api" && parts[1] === "admin" && parts[2] === "ads" && parts[3] && !parts[4] && method === "DELETE") {
    if (!requireAdmin(req, res)) return true;
    ads = ads.filter(a => a.id !== parts[3]);
    saveAds(ads);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

module.exports = { handle, TYPES };
