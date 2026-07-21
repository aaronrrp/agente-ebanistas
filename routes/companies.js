// ── Empresas (ferreterías, distribuidores, maquinaria, etc.) ────────────────
// Mismo patrón exacto que routes/professionals.js -- registro público en estado
// "pending", sesión propia, panel de auto-gestión. products[]/promotions[] viven
// embebidos en el registro de la empresa (bajo volumen por empresa, no necesitan
// archivo propio, igual que tenant.catalog/tenant.prices ya hacen con los ebanistas).
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { sendJson, readBody, getToken, hashPassword, verifyPassword, generatePassword, requireAdmin, atomicWrite, checkRateLimit, getClientIp, registerSessionChecker, registerSessionSweep } = require("../lib/shared.js");
const { logActivity } = require("../lib/activity-log.js");
const { sendEmail, reviewPendingHtml, approvedHtml } = require("../lib/email.js");

const COMPANIES_FILE = path.join(__dirname, "..", "companies.json");

const CATEGORIES = [
  "ferreteria", "distribuidor_materiales", "melamina", "herrajes", "mdf", "madera",
  "pinturas", "adhesivos", "maquinaria", "cnc", "herramientas", "transporte",
  "marmol", "vidrio", "electrico", "plomeria", "cocinas", "tapiceria", "otra"
];

function loadCompanies() {
  try { return JSON.parse(fs.readFileSync(COMPANIES_FILE, "utf-8")); }
  catch { saveCompanies([]); return []; }
}
function saveCompanies(list) {
  try { atomicWrite(COMPANIES_FILE, list); } catch (e) { console.error("[saveCompanies]", e.message); }
}
let companies = loadCompanies();

// Migración v50: las empresas creadas antes del sistema de slugs reciben uno al arrancar
(function backfillSlugs() {
  let changed = false;
  for (const c of companies) {
    if (!c.slug && c.id) { c.slug = makeSlug(c.name, c.id); changed = true; }
  }
  if (changed) saveCompanies(companies);
})();

function publicCompany(c) {
  const { passwordHash, passwordSalt, paymentNote, ...rest } = c; // paymentNote es solo para el admin, nunca sale al público ni a la empresa misma
  return rest;
}
// Coordenadas públicas (v55.34, mismo criterio que professionals.js): en modo
// "approx" el punto exacto no sale del servidor — se redondea a ~2 decimales y
// se oculta la dirección. Cada sucursal tiene su propia ubicación en el mapa.
function sanitizeLocationForPublic(loc) {
  if (!loc || typeof loc !== "object") return loc;
  const out = { ...loc };
  if (out.precision === "approx" && typeof out.lat === "number" && typeof out.lng === "number") {
    out.lat = Math.round(out.lat * 100) / 100;
    out.lng = Math.round(out.lng * 100) / 100;
    out.address = "";
  }
  return out;
}
function publicCompanyPublic(c) {
  const r = publicCompany(c);
  if (r.location) r.location = sanitizeLocationForPublic(r.location);
  if (Array.isArray(r.branches)) r.branches = r.branches.map(b => ({ ...b, location: sanitizeLocationForPublic(b.location) }));
  return r;
}
// Para las vistas de Admin: todo MENOS las contraseñas -- a diferencia de
// publicCompany(), el admin sí necesita ver/editar paymentNote.
function adminCompanyView(c) {
  const { passwordHash, passwordSalt, ...rest } = c;
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
registerSessionChecker(getCompanySession);
registerSessionSweep(companySessions, SESSION_TTL);

function makeCompanyCode(name) {
  const prefix = String(name || "empresa")
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "").slice(0, 10) || "empresa";
  const hash = crypto.createHash("sha256").update(String(name || "") + Date.now()).digest("hex").slice(0, 6);
  return `${prefix}-${hash}`;
}

function makeSlug(name, id) {
  const base = String(name || "empresa")
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "empresa";
  return `${base}-${String(id).slice(0, 6)}`;
}

function matchesFilters(c, q) {
  if (c.status !== "approved") return false;
  if (q.name && !String(c.name || "").toLowerCase().includes(String(q.name).toLowerCase())) return false;
  if (q.category && c.category !== q.category) return false;
  if (q.province && c.location?.province !== q.province) return false;
  if (q.city && c.location?.city !== q.city) return false;
  return true;
}

function findCompanyById(id) { return companies.find(x => x.id === id); }

async function handle(req, res, { method, p, parts }) {
  // GET /api/companies/slug/:slug — empresa por URL amigable
  if (method === "GET" && parts[0] === "api" && parts[1] === "companies" && parts[2] === "slug" && parts[3]) {
    const co = companies.find(x => x.slug === parts[3] && x.status === "approved");
    if (!co) { sendJson(res, 404, { error: "Empresa no encontrada." }); return true; }
    sendJson(res, 200, publicCompanyPublic(co));
    return true;
  }

  if (method === "GET" && p === "/api/companies") {
    const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
    sendJson(res, 200, companies.filter(c => matchesFilters(c, q)).map(publicCompanyPublic));
    return true;
  }

  if (method === "POST" && p === "/api/companies/register") {
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.name || !String(data.name).trim()) { sendJson(res, 400, { error: "Falta el nombre de la empresa." }); return true; }
    // v53.6: el correo es la identidad de acceso — requerido y único
    const emailNorm = String(data.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNorm)) { sendJson(res, 400, { error: "Ingresa un correo válido." }); return true; }
    if (companies.some(x => x.email && x.email.toLowerCase() === emailNorm)) { sendJson(res, 409, { error: "Ya existe una empresa con ese correo." }); return true; }
    const id = crypto.randomUUID();
    const company = {
      id,
      slug: makeSlug(String(data.name).trim(), id),
      name: String(data.name).trim(),
      category: CATEGORIES.includes(data.category) ? data.category : "otra",
      categoryOther: String(data.categoryOther || "").trim().slice(0, 60),
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
      createdAt: new Date().toISOString(),
      lastAccessAt: null,
      views: 0,
      contactClicks: 0
    };
    companies.push(company);
    saveCompanies(companies);
    logActivity({ actorType: "company", actorId: company.id, actorLabel: company.name, action: "company.registered", meta: { category: company.category } });
    if (company.email) {
      sendEmail({ to: company.email, subject: "Tu empresa en PiLLA está en revisión", html: reviewPendingHtml(company.name, "company") })
        .catch(e => console.log("[email] company register:", e.message));
    }
    sendJson(res, 201, { ok: true, message: "Solicitud recibida. Te contactaremos por correo o WhatsApp para activar tu cuenta." });
    return true;
  }

  if (method === "POST" && p === "/api/auth/company") {
    const body = await readBody(req);
    const { code, password } = body ? JSON.parse(body) : {};
    const q = String(code || "").trim().toLowerCase();
    const company = companies.find(x => x.accessCode === code || (x.email && x.email.toLowerCase() === q));
    if (!company) { sendJson(res, 401, { error: "Correo o contraseña incorrectos." }); return true; }
    if (!verifyPassword(password, company.passwordSalt, company.passwordHash)) { sendJson(res, 401, { error: "Contraseña incorrecta." }); return true; }
    company.lastAccessAt = new Date().toISOString();
    saveCompanies(companies);
    const token = createCompanySession(company.id);
    logActivity({ actorType: "company", actorId: company.id, actorLabel: company.name, action: "auth.login" });
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
    for (const field of [
      "name", "businessName", "ruc", "description", "phone", "whatsapp", "email",
      "schedule", "logoUrl", "coverUrl", "location", "socialLinks", "photos",
      "services", "coverage"
    ]) {
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
  if (p === "/api/companies/me/products" && method === "GET") {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    sendJson(res, 200, company.products || []);
    return true;
  }
  if (p === "/api/companies/me/products" && method === "POST") {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.name) { sendJson(res, 400, { error: "Falta el nombre del producto." }); return true; }
    const tagsRaw = Array.isArray(data.tags) ? data.tags : (data.tags ? String(data.tags).split(",").map(t => t.trim()).filter(Boolean) : []);
    const product = {
      id: crypto.randomUUID(),
      name: data.name, code: data.code || "", sku: data.sku || "",
      category: data.category || "", subcategory: data.subcategory || "",
      brand: data.brand || "", supplier: data.supplier || "",
      material: data.material || "", color: data.color || "",
      thickness: Number(data.thickness) || 0, dimensions: data.dimensions || "",
      weight: Number(data.weight) || 0, presentation: data.presentation || "",
      price: Number(data.price) || 0, salePrice: Number(data.salePrice) || 0,
      status: data.status === "inactive" ? "inactive" : "active",
      availability: ["in_stock", "on_order", "out_of_stock"].includes(data.availability) ? data.availability : "in_stock",
      description: data.description || "", photoUrl: data.photoUrl || "",
      tags: tagsRaw, featured: false, createdAt: new Date().toISOString()
    };
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
      const productFields = ["name", "code", "sku", "category", "subcategory", "brand", "supplier", "material", "color", "thickness", "dimensions", "weight", "presentation", "price", "salePrice", "status", "availability", "description", "photoUrl", "tags"];
      for (const field of productFields) if (data[field] !== undefined) product[field] = data[field];
      if (data.tags !== undefined && !Array.isArray(product.tags)) {
        product.tags = String(data.tags).split(",").map(t => t.trim()).filter(Boolean);
      }
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

  // ── Vendedores de la empresa (/api/companies/me/sellers) — v53 ───────────
  // Equipo de ventas propio de la empresa (contacto), embebido en el registro
  // igual que products[]. Se muestran en el perfil público de la empresa.
  if (p === "/api/companies/me/sellers" && method === "GET") {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    sendJson(res, 200, company.sellers || []);
    return true;
  }
  if (p === "/api/companies/me/sellers" && method === "POST") {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const data = JSON.parse((await readBody(req)) || "{}");
    if (!data.name?.trim()) { sendJson(res, 400, { error: "Falta el nombre del vendedor." }); return true; }
    if (!company.sellers) company.sellers = [];
    const seller = {
      id: crypto.randomUUID(),
      name: String(data.name).trim().slice(0, 80),
      position: String(data.position || "").trim().slice(0, 60),
      phone: String(data.phone || "").trim().slice(0, 30),
      whatsapp: String(data.whatsapp || "").trim().slice(0, 30),
      email: String(data.email || "").trim().slice(0, 120),
      photoUrl: data.photoUrl || "",
      createdAt: new Date().toISOString()
    };
    company.sellers.push(seller);
    saveCompanies(companies);
    sendJson(res, 201, seller);
    return true;
  }
  if (parts[0] === "api" && parts[1] === "companies" && parts[2] === "me" && parts[3] === "sellers" && parts[4]) {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const sid = parts[4];
    if (method === "PUT") {
      const data = JSON.parse((await readBody(req)) || "{}");
      const seller = (company.sellers || []).find(s => s.id === sid);
      if (!seller) { sendJson(res, 404, { error: "Vendedor no encontrado." }); return true; }
      for (const f of ["name", "position", "phone", "whatsapp", "email", "photoUrl"]) {
        if (data[f] !== undefined) seller[f] = String(data[f]).trim();
      }
      saveCompanies(companies);
      sendJson(res, 200, seller);
      return true;
    }
    if (method === "DELETE") {
      company.sellers = (company.sellers || []).filter(s => s.id !== sid);
      saveCompanies(companies);
      sendJson(res, 200, { ok: true });
      return true;
    }
  }

  // ── Categorías (/api/companies/me/categories) ───────────────────────────
  if (p === "/api/companies/me/categories" && method === "GET") {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    sendJson(res, 200, company.categories || []);
    return true;
  }
  if (p === "/api/companies/me/categories" && method === "POST") {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.name || !String(data.name).trim()) { sendJson(res, 400, { error: "Falta el nombre de la categoría." }); return true; }
    if (!company.categories) company.categories = [];
    const cat = { id: crypto.randomUUID(), name: String(data.name).trim(), description: data.description || "", parentId: data.parentId || null, createdAt: new Date().toISOString() };
    company.categories.push(cat);
    saveCompanies(companies);
    sendJson(res, 201, cat);
    return true;
  }
  if (parts[0] === "api" && parts[1] === "companies" && parts[2] === "me" && parts[3] === "categories" && parts[4]) {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const catId = parts[4];
    if (method === "PUT") {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      const cat = (company.categories || []).find(c => c.id === catId);
      if (!cat) { sendJson(res, 404, { error: "Categoría no encontrada." }); return true; }
      for (const f of ["name", "description", "parentId"]) if (data[f] !== undefined) cat[f] = data[f];
      saveCompanies(companies);
      sendJson(res, 200, cat);
      return true;
    }
    if (method === "DELETE") {
      if (!company.categories) company.categories = [];
      company.categories = company.categories.filter(c => c.id !== catId);
      // Orphan children by clearing their parentId
      company.categories.forEach(c => { if (c.parentId === catId) c.parentId = null; });
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

  // ── Sucursales (/api/companies/me/branches) ─────────────────────────────
  if (p === "/api/companies/me/branches" && method === "GET") {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    sendJson(res, 200, company.branches || []);
    return true;
  }
  if (p === "/api/companies/me/branches" && method === "POST") {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.name || !String(data.name).trim()) { sendJson(res, 400, { error: "Falta el nombre de la sucursal." }); return true; }
    const branch = {
      id: crypto.randomUUID(),
      name: String(data.name).trim(),
      address: data.address || "",
      province: data.province || "",
      city: data.city || "",
      phone: data.phone || "",
      schedule: data.schedule || "",
      manager: data.manager || "",
      location: (data.location && typeof data.location === "object") ? data.location : null,
      status: "active",
      createdAt: new Date().toISOString()
    };
    if (!company.branches) company.branches = [];
    company.branches.push(branch);
    saveCompanies(companies);
    sendJson(res, 201, branch);
    return true;
  }
  if (parts[0] === "api" && parts[1] === "companies" && parts[2] === "me" && parts[3] === "branches" && parts[4]) {
    const session = requireCompany(req, res); if (!session) return true;
    const company = findCompanyById(session.companyId);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const branchId = parts[4];
    if (method === "PUT") {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      const branch = (company.branches || []).find(b => b.id === branchId);
      if (!branch) { sendJson(res, 404, { error: "Sucursal no encontrada." }); return true; }
      for (const f of ["name", "address", "province", "city", "phone", "schedule", "manager", "status", "location"]) {
        if (data[f] !== undefined) branch[f] = data[f];
      }
      saveCompanies(companies);
      sendJson(res, 200, branch);
      return true;
    }
    if (method === "DELETE") {
      company.branches = (company.branches || []).filter(b => b.id !== branchId);
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
    sendJson(res, 200, publicCompanyPublic(company));
    return true;
  }

  // ── Moderación (admin) ──────────────────────────────────────────────────
  if (method === "GET" && p === "/api/admin/companies") {
    if (!requireAdmin(req, res)) return true;
    sendJson(res, 200, companies.map(adminCompanyView));
    return true;
  }
  if (method === "POST" && p === "/api/admin/companies") {
    if (!requireAdmin(req, res)) return true;
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.name || !String(data.name).trim()) { sendJson(res, 400, { error: "Falta el nombre de la empresa." }); return true; }
    const passwordPlain = (data.password && String(data.password).trim()) || generatePassword();
    const { salt, hash } = hashPassword(passwordPlain);
    const company = {
      id: crypto.randomUUID(),
      name: String(data.name).trim(),
      category: CATEGORIES.includes(data.category) ? data.category : "otra",
      logoUrl: "",
      description: "",
      phone: data.phone || "", whatsapp: data.whatsapp || "", email: data.email || "",
      location: { province: data.province || "", city: data.city || "", address: "" },
      schedule: "",
      socialLinks: { facebook: "", instagram: "", website: "" },
      products: [],
      promotions: [],
      photos: [],
      status: "approved",
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
    logActivity({ actorType: "admin", action: "company.created", meta: { id: company.id, name: company.name } });
    sendJson(res, 201, { ...adminCompanyView(company), passwordPlain });
    return true;
  }
  const COMPANY_ACTIONS = new Set(["approve", "reject", "suspend", "feature", "unfeature", "set-payment-note", "request-changes"]);
  if (parts[0] === "api" && parts[1] === "admin" && parts[2] === "companies" && parts[3] && COMPANY_ACTIONS.has(parts[4]) && !parts[5] && method === "POST") {
    if (!requireAdmin(req, res)) return true;
    const company = findCompanyById(parts[3]);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const action = parts[4];
    if (action === "approve") {
      company.status = "approved";
      if (company.email) sendEmail({ to: company.email, subject: "¡Tu empresa en PiLLA fue aprobada!", html: approvedHtml(company.name, "company", company.accessCode) }).catch(() => {});
      if (!company.accessCode) {
        const passwordPlain = generatePassword();
        const { salt, hash } = hashPassword(passwordPlain);
        company.accessCode = makeCompanyCode(company.name);
        company.passwordSalt = salt;
        company.passwordHash = hash;
        saveCompanies(companies);
        logActivity({ actorType: "admin", action: "company.approved", meta: { id: company.id, name: company.name } });
        sendJson(res, 200, { ...adminCompanyView(company), passwordPlain });
        return true;
      }
      logActivity({ actorType: "admin", action: "company.approved", meta: { id: company.id, name: company.name } });
    }
    else if (action === "reject") { company.status = "rejected"; logActivity({ actorType: "admin", action: "company.rejected", meta: { id: company.id, name: company.name } }); }
    else if (action === "suspend") { company.status = "suspended"; logActivity({ actorType: "admin", action: "company.suspended", meta: { id: company.id, name: company.name } }); }
    else if (action === "feature") {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      company.featured = true;
      company.featuredUntil = data.featuredUntil || null;
      logActivity({ actorType: "admin", action: "company.featured", meta: { id: company.id, name: company.name } });
    }
    else if (action === "unfeature") { company.featured = false; company.featuredUntil = null; }
    else if (action === "set-payment-note") {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      company.paymentNote = data.paymentNote || "";
    }
    else if (action === "request-changes") {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : {};
      company.status = "changes_requested";
      company.adminNote = String(data.note || "").trim().slice(0, 1000);
      logActivity({ actorType: "admin", action: "company.changes_requested", meta: { id: company.id, name: company.name } });
    }
    else { sendJson(res, 400, { error: "Acción no reconocida." }); return true; }
    saveCompanies(companies);
    sendJson(res, 200, adminCompanyView(company));
    return true;
  }

  // PUT /api/admin/companies/:id — editar cualquier campo
  if (method === "PUT" && parts[0] === "api" && parts[1] === "admin" && parts[2] === "companies" && parts[3] && !parts[4]) {
    if (!requireAdmin(req, res)) return true;
    const company = findCompanyById(parts[3]);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    const editableFields = ["name", "description", "phone", "whatsapp", "email", "schedule", "logoUrl", "coverPhotoUrl", "location", "socialLinks", "category", "categoryOther", "plan", "status", "adminNote", "paymentNote"];
    for (const field of editableFields) {
      if (data[field] !== undefined) company[field] = data[field];
    }
    if (data.category && !CATEGORIES.includes(data.category)) company.category = "otra";
    saveCompanies(companies);
    logActivity({ actorType: "admin", action: "company.edited", meta: { id: company.id, name: company.name } });
    sendJson(res, 200, adminCompanyView(company));
    return true;
  }

  // PUT /api/admin/companies/:id/password
  if (method === "PUT" && parts[0] === "api" && parts[1] === "admin" && parts[2] === "companies" && parts[3] && parts[4] === "password") {
    if (!requireAdmin(req, res)) return true;
    const company = findCompanyById(parts[3]);
    if (!company) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.password || String(data.password).length < 4) { sendJson(res, 400, { error: "La contraseña necesita al menos 4 caracteres." }); return true; }
    const { salt, hash } = hashPassword(String(data.password));
    company.passwordSalt = salt;
    company.passwordHash = hash;
    saveCompanies(companies);
    logActivity({ actorType: "admin", action: "company.password_changed", meta: { id: company.id, name: company.name } });
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

module.exports = {
  handle, CATEGORIES, getCompanySession, findCompanyById,
  getAllCompanies: () => companies,
  reload: () => { companies = loadCompanies(); }
};
