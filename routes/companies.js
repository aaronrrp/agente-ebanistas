// ── Empresas (ferreterías, distribuidores, maquinaria, etc.) ────────────────
// Mismo patrón exacto que routes/professionals.js -- registro público en estado
// "pending", sesión propia, panel de auto-gestión. products[]/promotions[] viven
// embebidos en el registro de la empresa (bajo volumen por empresa, no necesitan
// archivo propio, igual que tenant.catalog/tenant.prices ya hacen con los ebanistas).
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { sendJson, readBody, getToken, hashPassword, verifyPassword, generatePassword } = require("../lib/shared.js");

const COMPANIES_FILE = path.join(__dirname, "..", "companies.json");

const CATEGORIES = [
  "ferreteria", "melamina", "herrajes", "mdf", "madera", "pinturas", "adhesivos",
  "maquinaria", "cnc", "herramientas", "transporte", "marmol", "vidrio", "otra"
];

function loadCompanies() {
  try { return JSON.parse(fs.readFileSync(COMPANIES_FILE, "utf-8")); }
  catch { saveCompanies([]); return []; }
}
function saveCompanies(list) {
  try { fs.writeFileSync(COMPANIES_FILE, JSON.stringify(list, null, 2)); } catch {}
}
let companies = loadCompanies();

function publicCompany(c) {
  const { passwordHash, passwordSalt, paymentNote, ...rest } = c; // paymentNote es solo para el admin (Fase 5), nunca sale al público ni a la empresa misma
  return rest;
}

const companySessions = new Map(); // token -> { companyId, ts }
const SESSION_TTL = 24 * 60 * 60 * 1000;

function createCompanySession(companyId) {
  const token = crypto.randomBytes(32).toString("hex");
  companySessions.set(token, { companyId, ts: Date.now() });
  return token;
}
function getCompanySession(token) {
  if (!token) return null;
  const s = companySessions.get(token);
  if (!s) return null;
  if (Date.now() - s.ts > SESSION_TTL) { companySessions.delete(token); return null; }
  return s;
}
function requireCompany(req, res) {
  const session = getCompanySession(getToken(req));
  if (!session) { sendJson(res, 401, { error: "No autorizado. Inicia sesión como empresa." }); return null; }
  return session;
}

function makeCompanyCode(name) {
  const prefix = String(name || "empresa")
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "").slice(0, 10) || "empresa";
  const hash = crypto.createHash("sha256").update(String(name || "") + Date.now()).digest("hex").slice(0, 6);
  return `${prefix}-${hash}`;
}

function matchesFilters(c, q) {
  if (c.status !== "approved") return false;
  if (q.category && c.category !== q.category) return false;
  if (q.province && c.location?.province !== q.province) return false;
  if (q.city && c.location?.city !== q.city) return false;
  return true;
}

function findCompanyById(id) { return companies.find(x => x.id === id); }

async function handle(req, res, { method, p, parts }) {
  if (method === "GET" && p === "/api/companies") {
    const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
    sendJson(res, 200, companies.filter(c => matchesFilters(c, q)).map(publicCompany));
    return true;
  }

  if (method === "POST" && p === "/api/companies/register") {
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.name || !String(data.name).trim()) { sendJson(res, 400, { error: "Falta el nombre de la empresa." }); return true; }
    const passwordPlain = (data.password && String(data.password).trim()) || generatePassword();
    const { salt, hash } = hashPassword(passwordPlain);
    const company = {
      id: crypto.randomUUID(),
      name: String(data.name).trim(),
      category: CATEGORIES.includes(data.category) ? data.category : "otra",
      logoUrl: data.logoUrl || "",
      description: data.description || "",
      phone: data.phone || "", whatsapp: data.whatsapp || "", email: data.email || "",
      location: { province: data.location?.province || "", city: data.location?.city || "", address: data.location?.address || "" },
      schedule: data.schedule || "",
      socialLinks: { facebook: data.socialLinks?.facebook || "", instagram: data.socialLinks?.instagram || "", website: data.socialLinks?.website || "" },
      products: [],
      promotions: [],
      photos: [],
      status: "pending",
      featured: false,
      featuredUntil: null,
      plan: "empresa",
      paymentNote: "",
      accessCode: makeCompanyCode(data.name),
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
      lastAccessAt: null,
      views: 0,
      contactClicks: 0
    };
    companies.push(company);
    saveCompanies(companies);
    sendJson(res, 201, { ...publicCompany(company), passwordPlain });
    return true;
  }

  if (method === "POST" && p === "/api/auth/company") {
    const body = await readBody(req);
    const { code, password } = body ? JSON.parse(body) : {};
    const company = companies.find(x => x.accessCode === code);
    if (!company) { sendJson(res, 401, { error: "Código no válido." }); return true; }
    if (!verifyPassword(password, company.passwordSalt, company.passwordHash)) { sendJson(res, 401, { error: "Contraseña incorrecta." }); return true; }
    company.lastAccessAt = new Date().toISOString();
    saveCompanies(companies);
    const token = createCompanySession(company.id);
    sendJson(res, 200, { token, company: publicCompany(company) });
    return true;
  }
  if (method === "GET" && p === "/api/auth/company/check") {
    sendJson(res, 200, { valid: Boolean(getCompanySession(getToken(req))) });
    return true;
  }
  if (method === "POST" && p === "/api/auth/company/logout") {
    const token = getToken(req);
    if (token) companySessions.delete(token);
    sendJson(res, 200, { message: "Sesión cerrada." });
    return true;
  }

  if (p === "/api/companies/me" && method === "GET") {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    sendJson(res, 200, publicCompany(company));
    return true;
  }
  if (p === "/api/companies/me" && method === "PUT") {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    for (const field of ["description", "phone", "whatsapp", "email", "schedule", "logoUrl", "location", "socialLinks", "photos"]) {
      if (data[field] !== undefined) company[field] = data[field];
    }
    if (CATEGORIES.includes(data.category)) company.category = data.category;
    saveCompanies(companies);
    sendJson(res, 200, publicCompany(company));
    return true;
  }
  if (p === "/api/companies/me/password" && method === "PUT") {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const body = await readBody(req);
    const { password } = body ? JSON.parse(body) : {};
    if (!password || String(password).trim().length < 4) { sendJson(res, 400, { error: "Contraseña muy corta." }); return true; }
    const { salt, hash } = hashPassword(String(password).trim());
    company.passwordSalt = salt; company.passwordHash = hash;
    saveCompanies(companies);
    sendJson(res, 200, { message: "Contraseña actualizada." });
    return true;
  }

  // Productos y promociones embebidos -- /api/companies/me/products, /api/companies/me/promotions
  if (p === "/api/companies/me/products" && method === "POST") {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.name) { sendJson(res, 400, { error: "Falta el nombre del producto." }); return true; }
    const product = { id: crypto.randomUUID(), name: data.name, description: data.description || "", priceRef: data.priceRef || "", photoUrl: data.photoUrl || "", featured: false };
    company.products.push(product);
    saveCompanies(companies);
    sendJson(res, 201, product);
    return true;
  }
  if (parts[0] === "api" && parts[1] === "companies" && parts[2] === "me" && parts[3] === "products" && parts[4]) {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const productId = parts[4];
    if (method === "PUT") {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      const product = company.products.find(x => x.id === productId);
      if (!product) { sendJson(res, 404, { error: "Producto no encontrado." }); return true; }
      for (const field of ["name", "description", "priceRef", "photoUrl"]) if (data[field] !== undefined) product[field] = data[field];
      saveCompanies(companies);
      sendJson(res, 200, product);
      return true;
    }
    if (method === "DELETE") {
      company.products = company.products.filter(x => x.id !== productId);
      saveCompanies(companies);
      sendJson(res, 200, { ok: true });
      return true;
    }
  }
  if (p === "/api/companies/me/promotions" && method === "POST") {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.title) { sendJson(res, 400, { error: "Falta el título de la promoción." }); return true; }
    const promo = { id: crypto.randomUUID(), title: data.title, description: data.description || "", discountText: data.discountText || "", photoUrl: data.photoUrl || "", startsAt: data.startsAt || null, endsAt: data.endsAt || null, active: true };
    company.promotions.push(promo);
    saveCompanies(companies);
    sendJson(res, 201, promo);
    return true;
  }
  if (parts[0] === "api" && parts[1] === "companies" && parts[2] === "me" && parts[3] === "promotions" && parts[4]) {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const promoId = parts[4];
    if (method === "PUT") {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      const promo = company.promotions.find(x => x.id === promoId);
      if (!promo) { sendJson(res, 404, { error: "Promoción no encontrada." }); return true; }
      for (const field of ["title", "description", "discountText", "photoUrl", "startsAt", "endsAt", "active"]) if (data[field] !== undefined) promo[field] = data[field];
      saveCompanies(companies);
      sendJson(res, 200, promo);
      return true;
    }
    if (method === "DELETE") {
      company.promotions = company.promotions.filter(x => x.id !== promoId);
      saveCompanies(companies);
      sendJson(res, 200, { ok: true });
      return true;
    }
  }

  if (parts[0] === "api" && parts[1] === "companies" && parts[2] && parts[3] === "contact-click" && method === "POST") {
    const company = findCompanyById(parts[2]);
    if (company) { company.contactClicks = (company.contactClicks || 0) + 1; saveCompanies(companies); }
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (parts[0] === "api" && parts[1] === "companies" && parts[2] && !parts[3] && method === "GET") {
    const company = findCompanyById(parts[2]);
    if (!company || company.status !== "approved") { sendJson(res, 404, { error: "No encontrado." }); return true; }
    company.views = (company.views || 0) + 1;
    saveCompanies(companies);
    sendJson(res, 200, publicCompany(company));
    return true;
  }

  return false;
}

module.exports = { handle, CATEGORIES };
