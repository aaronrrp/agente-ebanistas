// ── Dashboard + Activity Log del Admin ───────────────────────────────────────
// Un solo endpoint agregado (GET /api/admin/dashboard) en vez de que el cliente
// haga 10 llamadas sueltas -- todos los conteos en un solo round-trip. Lee
// tenants/sellers/handoffs del contexto de la request (ver server.js, mismo
// mecanismo que getCallerIdentity) y profesionales/empresas/retazos vía los
// getAllX() ya exportados por sus propios módulos.
const { sendJson, requireAdmin } = require("../lib/shared.js");
const { getRecentActivity, getActivityLogRange } = require("../lib/activity-log.js");
const { getAllProfessionals } = require("./professionals.js");
const { getAllCompanies } = require("./companies.js");
const { getAllRetazos } = require("./retazos.js");

function countByStatus(list) {
  const out = {};
  for (const item of list) out[item.status] = (out[item.status] || 0) + 1;
  return out;
}

async function handle(req, res, { method, p, tenants, sellers, handoffs }) {
  if (method === "GET" && p === "/api/admin/dashboard") {
    if (!requireAdmin(req, res)) return true;
    const professionals = getAllProfessionals();
    const companies = getAllCompanies();
    const retazos = getAllRetazos();
    const activeRetazos = retazos.filter(r => r.status === "active" && !r.isInspiration);
    sendJson(res, 200, {
      ebanistas: { total: tenants.length, byStatus: countByStatus(tenants) },
      vendedores: { total: sellers.length, byStatus: countByStatus(sellers) },
      professionals: { total: professionals.length, byStatus: countByStatus(professionals), pending: professionals.filter(p => p.status === "pending").length },
      companies: { total: companies.length, byStatus: countByStatus(companies), pending: companies.filter(c => c.status === "pending").length },
      retazos: { total: activeRetazos.length, free: activeRetazos.filter(r => r.isFree).length, inspiration: retazos.filter(r => r.isInspiration && r.status === "active").length },
      handoffs: { total: handoffs.length, pending: handoffs.filter(h => h.status === "pending").length },
      recentActivity: getRecentActivity(20)
    });
    return true;
  }

  if (method === "GET" && p === "/api/admin/activity-log") {
    if (!requireAdmin(req, res)) return true;
    const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
    const today = new Date().toISOString().slice(0, 10);
    const list = getActivityLogRange(q.from || today, q.to || today, { action: q.action, actorType: q.actorType });
    sendJson(res, 200, list);
    return true;
  }

  return false;
}

module.exports = { handle };
