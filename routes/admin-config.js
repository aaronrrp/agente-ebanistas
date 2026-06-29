// ── Planes y Roles/Permisos (configuración pura, sin código) ────────────────
// Mismo patrón que /api/admin/prices ya usa en server.js: un objeto único (no un
// array), editable por PUT completo desde Admin -- "Configuración" del pedido
// original es justo esto, ningún límite/precio/permiso queda fijo en el código.
const fs = require("node:fs");
const path = require("node:path");
const { sendJson, readBody, requireAdmin } = require("../lib/shared.js");

const PLANS_FILE = path.join(__dirname, "..", "plans.json");
const ROLES_FILE = path.join(__dirname, "..", "roles.json");

function defaultPlans() {
  return {
    gratuito: { label: "Usuario Gratuito", maxPortfolioPhotos: 3, maxRetazoListings: 2, canFeature: false, monthlyPrice: 0 },
    profesional: { label: "Profesional", maxPortfolioPhotos: 20, maxRetazoListings: 20, canFeature: true, monthlyPrice: 0 },
    empresa: { label: "Empresa", maxPortfolioPhotos: 50, maxRetazoListings: 100, canFeature: true, monthlyPrice: 0 },
    administrador: { label: "Administrador", maxPortfolioPhotos: null, maxRetazoListings: null, canFeature: true, monthlyPrice: 0 }
  };
}
function defaultRoles() {
  return {
    administrador: { label: "Administrador", permissions: ["*"] },
    supervisor: { label: "Supervisor", permissions: ["users.view", "users.edit", "professionals.moderate", "companies.moderate", "retazos.moderate", "ads.manage"] },
    empresa: { label: "Empresa", permissions: ["company.self.edit", "ads.self.request"] },
    profesional: { label: "Profesional", permissions: ["professional.self.edit", "retazos.self.create"] },
    usuario_gratuito: { label: "Usuario Gratuito", permissions: ["retazos.self.create.limited", "directory.view"] }
  };
}

function loadPlans() {
  try { return { ...defaultPlans(), ...JSON.parse(fs.readFileSync(PLANS_FILE, "utf-8")) }; }
  catch { return defaultPlans(); }
}
function savePlans(p) {
  try { fs.writeFileSync(PLANS_FILE, JSON.stringify(p, null, 2)); } catch {}
}
let plans = loadPlans();

function loadRoles() {
  try { return { ...defaultRoles(), ...JSON.parse(fs.readFileSync(ROLES_FILE, "utf-8")) }; }
  catch { return defaultRoles(); }
}
function saveRoles(r) {
  try { fs.writeFileSync(ROLES_FILE, JSON.stringify(r, null, 2)); } catch {}
}
let roles = loadRoles();

// Único motor de RBAC que necesita esta app: una lista de strings por rol, "*"
// significa todo. Sin DSL, sin librería -- lo mismo que ya hace este proyecto en
// cualquier otro lado (ver CATEGORIES en professionals.js/companies.js).
function hasPermission(roleName, perm) {
  const role = roles[roleName];
  if (!role) return false;
  return role.permissions.includes("*") || role.permissions.includes(perm);
}

async function handle(req, res, { method, p }) {
  if (method === "GET" && p === "/api/plans") {
    sendJson(res, 200, plans);
    return true;
  }
  if (method === "PUT" && p === "/api/admin/plans") {
    if (!requireAdmin(req, res)) return true;
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    plans = { ...plans, ...data };
    savePlans(plans);
    sendJson(res, 200, plans);
    return true;
  }

  if (method === "GET" && p === "/api/roles") {
    if (!requireAdmin(req, res)) return true;
    sendJson(res, 200, roles);
    return true;
  }
  if (method === "PUT" && p === "/api/admin/roles") {
    if (!requireAdmin(req, res)) return true;
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    roles = { ...roles, ...data };
    saveRoles(roles);
    sendJson(res, 200, roles);
    return true;
  }

  return false;
}

module.exports = { handle, hasPermission, loadPlans, loadRoles };
