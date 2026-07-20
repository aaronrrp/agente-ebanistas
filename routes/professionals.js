// ── Directorio Profesional: listado público + auto-registro + panel propio ─────
// Mismo patrón que tenants/sellers en server.js (array plano en JSON, sesión en Map
// con TTL, hash/verify de contraseña vía lib/shared.js) — pero el registro es
// PÚBLICO (cualquiera puede crear su perfil, sin admin de por medio) y arranca en
// status "pending" hasta que el admin lo aprueba (Fase 5 del plan se encarga de
// aprobar/rechazar; por ahora un perfil pending simplemente no aparece en el listado
// público, ver filterPublic()).
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { sendJson, readBody, getToken, hashPassword, verifyPassword, generatePassword, todayIso, requireAdmin, atomicWrite, checkRateLimit, getClientIp, registerSessionChecker, registerSessionSweep, isAnyValidSession } = require("../lib/shared.js");
const { logActivity } = require("../lib/activity-log.js");
const { sendEmail, reviewPendingHtml, approvedHtml } = require("../lib/email.js");

const PROFESSIONALS_FILE = path.join(__dirname, "..", "professionals.json");

const CATEGORIES = [
  "ebanista", "carpintero", "plomero", "electricista", "gypsum", "remodelador",
  "pintor", "soldador", "marmolista", "instalador_cocinas", "instalador_muebles",
  "vidriero", "tecnico_ac", "disenador_interiores", "arquitecto", "acarreos", "otra"
];

function loadProfessionals() {
  try { return JSON.parse(fs.readFileSync(PROFESSIONALS_FILE, "utf-8")); }
  catch { saveProfessionals([]); return []; }
}
function saveProfessionals(list) {
  try { atomicWrite(PROFESSIONALS_FILE, list); } catch (e) { console.error("[saveProfessionals]", e.message); }
}
let professionals = loadProfessionals();

// Migración v50: los perfiles creados antes del sistema de slugs reciben uno al arrancar
(function backfillSlugs() {
  let changed = false;
  for (const p of professionals) {
    if (!p.slug && p.id) { p.slug = makeSlug(p.name, p.id); changed = true; }
  }
  if (changed) saveProfessionals(professionals);
})();

function publicProfessional(p) {
  const { passwordHash, passwordSalt, ...rest } = p;
  return rest;
}
// Coordenadas en salida PÚBLICA (v55.34): si el profesional eligió "zona
// aproximada", el punto exacto NUNCA sale del servidor — se redondea a ~2
// decimales (~1.1 km) y se oculta la dirección exacta. Si eligió "exacta",
// pasa tal cual. Se usa solo en los endpoints públicos, no en los del dueño
// (que sí necesita ver/editar su punto real).
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
function publicProfessionalPublic(p) {
  const r = publicProfessional(p);
  if (r.location) r.location = sanitizeLocationForPublic(r.location);
  return r;
}
// Para el listado público no se manda el email/teléfono crudo sin que el usuario
// haga clic en "Contactar" -- en esta fase sí se manda (no hay todavía un mecanismo
// de mensajería intermedio), pero se deja esta función separada para poder limitarlo
// más adelante sin tocar el resto del módulo.
function publicProfessionalForListing(p) { return publicProfessionalPublic(p); }

// ── Sesión de profesional (mismo patrón que sellerSessions en server.js) ──────
const professionalSessions = new Map(); // token -> { professionalId, ts }
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 horas

function createProfessionalSession(professionalId) {
  const token = crypto.randomBytes(32).toString("hex");
  professionalSessions.set(token, { professionalId, ts: Date.now() });
  return token;
}
function getProfessionalSession(token) {
  if (!token) return null;
  const s = professionalSessions.get(token);
  if (!s) return null;
  if (Date.now() - s.ts > SESSION_TTL) { professionalSessions.delete(token); return null; }
  return s;
}
function requireProfessional(req, res) {
  const session = getProfessionalSession(getToken(req));
  if (!session) { sendJson(res, 401, { error: "No autorizado. Inicia sesión como profesional." }); return null; }
  return session;
}
registerSessionChecker(getProfessionalSession);
registerSessionSweep(professionalSessions, SESSION_TTL);

function makeProfessionalCode(name) {
  const prefix = String(name || "profesional")
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "").slice(0, 10) || "profesional";
  const hash = crypto.createHash("sha256").update(String(name || "") + Date.now()).digest("hex").slice(0, 6);
  return `${prefix}-${hash}`;
}

function makeSlug(name, id) {
  const base = String(name || "profesional")
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "profesional";
  return `${base}-${String(id).slice(0, 6)}`;
}

function matchesFilters(p, q) {
  if (p.status !== "approved") return false;
  if (p.active === false) return false; // perfil puesto en inactivo por el profesional
  if (q.name && !String(p.name || "").toLowerCase().includes(String(q.name).toLowerCase())) return false;
  if (q.category && p.category !== q.category) return false;
  if (q.province && p.location?.province !== q.province) return false;
  if (q.city && p.location?.city !== q.city) return false;
  if (q.specialty && !String(p.specialty || "").toLowerCase().includes(String(q.specialty).toLowerCase())) return false;
  if (q.minRating && Number(p.ratings?.avg || 0) < Number(q.minRating)) return false;
  return true;
}

async function handle(req, res, { method, p, parts, getCallerIdentity, tenants }) {
  // GET /api/professionals/slug/:slug — perfil por URL amigable
  if (method === "GET" && parts[0] === "api" && parts[1] === "professionals" && parts[2] === "slug" && parts[3]) {
    const prof = professionals.find(x => x.slug === parts[3] && x.status === "approved");
    if (!prof) { sendJson(res, 404, { error: "Perfil no encontrado." }); return true; }
    sendJson(res, 200, publicProfessionalPublic(prof));
    return true;
  }

  // GET /api/professionals — listado filtrable
  // v54.26: el directorio es PÚBLICO — cualquiera puede EXPLORAR sin cuenta
  // (igual que empresas y retazos). La cuenta se pide al CONTACTAR (gate en el
  // cliente: botones WhatsApp/Llamar/Cotizar), no al mirar. Esto reduce fricción
  // y evita que "Buscar profesionales" y "Crear cuenta" hagan lo mismo.
  // Los perfiles individuales (slug/:id) ya eran públicos para compartir/QR.
  if (method === "GET" && p === "/api/professionals") {
    const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
    const list = professionals.filter(prof => matchesFilters(prof, q)).map(publicProfessionalForListing);
    const sort = q.sort || "recent";
    if (sort === "rating") list.sort((a, b) => (b.ratings?.avg || 0) - (a.ratings?.avg || 0));
    else if (sort === "reviews") list.sort((a, b) => (b.ratings?.count || 0) - (a.ratings?.count || 0));
    else list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    sendJson(res, 200, list);
    return true;
  }

  // POST /api/professionals/register — público, crea en estado "pending"
  if (method === "POST" && p === "/api/professionals/register") {
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.name || !String(data.name).trim()) { sendJson(res, 400, { error: "Falta el nombre." }); return true; }
    // v53.6: el correo es la identidad de acceso — requerido y único
    const emailNorm = String(data.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNorm)) { sendJson(res, 400, { error: "Ingresa un correo válido." }); return true; }
    if (professionals.some(x => x.email && x.email.toLowerCase() === emailNorm)) { sendJson(res, 409, { error: "Ya existe una cuenta con ese correo." }); return true; }
    const passwordPlain = (data.password && String(data.password).trim()) || generatePassword();
    const { salt, hash } = hashPassword(passwordPlain);
    const id = crypto.randomUUID();
    const professional = {
      id,
      slug: makeSlug(String(data.name).trim(), id),
      category: CATEGORIES.includes(data.category) ? data.category : "otra",
      name: String(data.name).trim(),
      company: data.company || "",
      description: data.description || "",
      specialty: data.specialty || "",
      experienceYears: Number(data.experienceYears) || 0,
      phone: data.phone || "",
      whatsapp: data.whatsapp || "",
      email: data.email || "",
      location: { province: data.location?.province || "", city: data.location?.city || "", address: data.location?.address || "" },
      schedule: data.schedule || "",
      photoUrl: data.photoUrl || "",
      portfolioUrls: Array.isArray(data.portfolioUrls) ? data.portfolioUrls.slice(0, 20) : [],
      socialLinks: { facebook: data.socialLinks?.facebook || "", instagram: data.socialLinks?.instagram || "", tiktok: data.socialLinks?.tiktok || "", website: data.socialLinks?.website || "" },
      coverPhotoUrl: data.coverPhotoUrl || "",
      services: Array.isArray(data.services) ? data.services.slice(0, 20) : [],
      certifications: Array.isArray(data.certifications) ? data.certifications.slice(0, 20) : [],
      availability: ["available", "busy", "projects_only"].includes(data.availability) ? data.availability : "available",
      videos: Array.isArray(data.videos) ? data.videos.slice(0, 5) : [],
      // v53: el profesional decide si su perfil se muestra en el directorio
      active: data.active === false ? false : true,
      // v53: idoneidad (licencia profesional de Panamá) — declara si la tiene,
      // su número y una foto/escaneo del documento
      idoneidad: {
        has: Boolean(data.idoneidad?.has),
        number: String(data.idoneidad?.number || "").trim().slice(0, 60),
        photoUrl: data.idoneidad?.photoUrl || ""
      },
      adminNote: "",
      ratings: { avg: 0, count: 0 },
      status: "pending",
      featured: false,
      featuredUntil: null,
      plan: "gratuito",
      accessCode: makeProfessionalCode(data.name),
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
      lastAccessAt: null,
      views: 0,
      contactClicks: 0
    };
    professionals.push(professional);
    saveProfessionals(professionals);
    logActivity({ actorType: "professional", actorId: professional.id, actorLabel: professional.name, action: "professional.registered", meta: { category: professional.category } });
    // Correo "en revisión" (no bloquea la respuesta; no-op si el correo no está configurado)
    if (professional.email) {
      sendEmail({ to: professional.email, subject: "Tu perfil en PiLLA está en revisión", html: reviewPendingHtml(professional.name, "professional") })
        .catch(e => console.log("[email] pro register:", e.message));
    }
    sendJson(res, 201, { ...publicProfessional(professional), passwordPlain });
    return true;
  }

  // POST /api/auth/professional — login con código + contraseña
  if (method === "POST" && p === "/api/auth/professional") {
    const ip = getClientIp(req);
    if (!checkRateLimit(`auth:professional:${ip}`, 15, 60000)) {
      sendJson(res, 429, { error: "Demasiados intentos. Espera 1 minuto." }); return true;
    }
    const body = await readBody(req);
    const { code, password } = body ? JSON.parse(body) : {};
    // v53.6: se puede entrar con el CORREO o (por compatibilidad) el código
    const q = String(code || "").trim().toLowerCase();
    const prof = professionals.find(x => x.accessCode === code || (x.email && x.email.toLowerCase() === q));
    if (!prof) { sendJson(res, 401, { error: "Correo o contraseña incorrectos." }); return true; }
    if (!verifyPassword(password, prof.passwordSalt, prof.passwordHash)) {
      logActivity({ actorType: "professional", actorId: prof.id, actorLabel: prof.name, action: "auth.login.failed", meta: { ip } });
      sendJson(res, 401, { error: "Contraseña incorrecta." }); return true;
    }
    prof.lastAccessAt = new Date().toISOString();
    saveProfessionals(professionals);
    const token = createProfessionalSession(prof.id);
    logActivity({ actorType: "professional", actorId: prof.id, actorLabel: prof.name, action: "auth.login", meta: { ip } });
    sendJson(res, 200, { token, professional: publicProfessional(prof) });
    return true;
  }
  if (method === "GET" && p === "/api/auth/professional/check") {
    sendJson(res, 200, { valid: Boolean(getProfessionalSession(getToken(req))) });
    return true;
  }
  if (method === "POST" && p === "/api/auth/professional/logout") {
    const token = getToken(req);
    if (token) professionalSessions.delete(token);
    sendJson(res, 200, { message: "Sesión cerrada." });
    return true;
  }

  // GET/PUT /api/professionals/me — panel propio (requiere sesión)
  if (p === "/api/professionals/me" && method === "GET") {
    const session = requireProfessional(req, res); if (!session) return true;
    const prof = professionals.find(x => x.id === session.professionalId);
    if (!prof) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    sendJson(res, 200, publicProfessional(prof));
    return true;
  }
  if (p === "/api/professionals/me" && method === "PUT") {
    const session = requireProfessional(req, res); if (!session) return true;
    const prof = professionals.find(x => x.id === session.professionalId);
    if (!prof) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    // Campos editables por el propio profesional -- status/featured/plan/accessCode
    // quedan fuera a propósito, esos solo los cambia el admin (Fase 5).
    for (const field of ["company", "description", "specialty", "experienceYears", "phone", "whatsapp", "email", "schedule", "photoUrl", "portfolioUrls", "location", "socialLinks", "coverPhotoUrl", "services", "certifications", "availability", "videos"]) {
      if (data[field] !== undefined) prof[field] = data[field];
    }
    if (CATEGORIES.includes(data.category)) prof.category = data.category;
    if (data.active !== undefined) prof.active = Boolean(data.active);
    if (data.idoneidad !== undefined) {
      prof.idoneidad = {
        has: Boolean(data.idoneidad?.has),
        number: String(data.idoneidad?.number || "").trim().slice(0, 60),
        photoUrl: data.idoneidad?.photoUrl || ""
      };
    }
    saveProfessionals(professionals);
    sendJson(res, 200, publicProfessional(prof));
    return true;
  }
  if (p === "/api/professionals/me/password" && method === "PUT") {
    const session = requireProfessional(req, res); if (!session) return true;
    const prof = professionals.find(x => x.id === session.professionalId);
    if (!prof) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const body = await readBody(req);
    const { password } = body ? JSON.parse(body) : {};
    if (!password || String(password).trim().length < 4) { sendJson(res, 400, { error: "Contraseña muy corta." }); return true; }
    const { salt, hash } = hashPassword(String(password).trim());
    prof.passwordSalt = salt; prof.passwordHash = hash;
    saveProfessionals(professionals);
    sendJson(res, 200, { message: "Contraseña actualizada." });
    return true;
  }

  // POST /api/professionals/:id/contact-click — público, fire-and-forget
  if (parts[0] === "api" && parts[1] === "professionals" && parts[2] && parts[3] === "contact-click" && method === "POST") {
    const prof = professionals.find(x => x.id === parts[2]);
    if (prof) { prof.contactClicks = (prof.contactClicks || 0) + 1; saveProfessionals(professionals); }
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/professionals/:id — perfil público, incrementa views (va AL FINAL para
  // no interceptar /api/professionals/me ni /api/professionals/:id/contact-click)
  if (parts[0] === "api" && parts[1] === "professionals" && parts[2] && !parts[3] && method === "GET") {
    const prof = professionals.find(x => x.id === parts[2]);
    if (!prof || prof.status !== "approved") { sendJson(res, 404, { error: "No encontrado." }); return true; }
    prof.views = (prof.views || 0) + 1;
    saveProfessionals(professionals);
    sendJson(res, 200, publicProfessionalPublic(prof));
    return true;
  }

  // ── Moderación (admin) ──────────────────────────────────────────────────
  // POST /api/admin/professionals — crea un profesional directamente como "approved"
  if (method === "POST" && p === "/api/admin/professionals") {
    if (!requireAdmin(req, res)) return true;
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.name || !String(data.name).trim()) { sendJson(res, 400, { error: "Falta el nombre." }); return true; }
    const passwordPlain = (data.password && String(data.password).trim()) || generatePassword();
    const { salt, hash } = hashPassword(passwordPlain);
    const professional = {
      id: crypto.randomUUID(),
      category: CATEGORIES.includes(data.category) ? data.category : "otra",
      name: String(data.name).trim(),
      company: data.company || "",
      description: data.description || "",
      specialty: data.specialty || "",
      experienceYears: 0,
      phone: data.phone || "",
      whatsapp: data.whatsapp || "",
      email: data.email || "",
      location: { province: data.province || "", city: data.city || "", address: "" },
      schedule: "",
      photoUrl: "",
      portfolioUrls: [],
      socialLinks: {},
      ratings: { avg: 0, count: 0 },
      status: "approved",
      featured: false,
      featuredUntil: null,
      plan: "gratuito",
      accessCode: makeProfessionalCode(data.name),
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
      lastAccessAt: null,
      views: 0,
      contactClicks: 0
    };
    professionals.push(professional);
    saveProfessionals(professionals);
    logActivity({ actorType: "admin", actorId: "admin", actorLabel: "Admin", action: "professional.created_by_admin", meta: { name: professional.name } });
    sendJson(res, 201, { ...publicProfessional(professional), passwordPlain });
    return true;
  }

  if (method === "GET" && p === "/api/admin/professionals") {
    if (!requireAdmin(req, res)) return true;
    sendJson(res, 200, professionals.map(publicProfessional)); // incluye pending/rejected/suspended, a diferencia del listado público
    return true;
  }
  if (parts[0] === "api" && parts[1] === "admin" && parts[2] === "professionals" && parts[3] && parts[4] && method === "POST") {
    if (!requireAdmin(req, res)) return true;
    const prof = professionals.find(x => x.id === parts[3]);
    if (!prof) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const action = parts[4];
    const body2 = ["feature", "request-changes"].includes(action) ? (await readBody(req)) : null;
    const d2 = body2 ? JSON.parse(body2) : {};
    if (action === "approve") {
      prof.status = "approved";
      logActivity({ actorType: "admin", action: "professional.approved", meta: { id: prof.id, name: prof.name } });
      if (prof.email) sendEmail({ to: prof.email, subject: "¡Tu perfil en PiLLA fue aprobado!", html: approvedHtml(prof.name, "professional", prof.accessCode) }).catch(() => {});
    }
    else if (action === "reject") { prof.status = "rejected"; logActivity({ actorType: "admin", action: "professional.rejected", meta: { id: prof.id, name: prof.name } }); }
    else if (action === "suspend") { prof.status = "suspended"; logActivity({ actorType: "admin", action: "professional.suspended", meta: { id: prof.id, name: prof.name } }); }
    else if (action === "request-changes") {
      prof.status = "changes_requested";
      prof.adminNote = String(d2.note || "").trim().slice(0, 1000);
      logActivity({ actorType: "admin", action: "professional.changes_requested", meta: { id: prof.id, name: prof.name } });
    }
    else if (action === "feature") {
      prof.featured = true;
      prof.featuredUntil = d2.featuredUntil || null;
      logActivity({ actorType: "admin", action: "professional.featured", meta: { id: prof.id, name: prof.name } });
    }
    else if (action === "unfeature") { prof.featured = false; prof.featuredUntil = null; }
    else { sendJson(res, 400, { error: "Acción no reconocida." }); return true; }
    saveProfessionals(professionals);
    sendJson(res, 200, publicProfessional(prof));
    return true;
  }

  // PUT /api/admin/professionals/:id — editar cualquier campo
  if (method === "PUT" && parts[0] === "api" && parts[1] === "admin" && parts[2] === "professionals" && parts[3] && !parts[4]) {
    if (!requireAdmin(req, res)) return true;
    const prof = professionals.find(x => x.id === parts[3]);
    if (!prof) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    const editableFields = ["name", "company", "description", "specialty", "experienceYears", "phone", "whatsapp", "email", "schedule", "photoUrl", "coverPhotoUrl", "services", "certifications", "availability", "videos", "location", "socialLinks", "category", "plan", "status", "adminNote"];
    for (const field of editableFields) {
      if (data[field] !== undefined) prof[field] = data[field];
    }
    if (data.category && !CATEGORIES.includes(data.category)) prof.category = "otra";
    saveProfessionals(professionals);
    logActivity({ actorType: "admin", action: "professional.edited", meta: { id: prof.id, name: prof.name } });
    sendJson(res, 200, publicProfessional(prof));
    return true;
  }

  // PUT /api/admin/professionals/:id/password — cambiar contraseña
  if (method === "PUT" && parts[0] === "api" && parts[1] === "admin" && parts[2] === "professionals" && parts[3] && parts[4] === "password") {
    if (!requireAdmin(req, res)) return true;
    const prof = professionals.find(x => x.id === parts[3]);
    if (!prof) { sendJson(res, 404, { error: "No encontrado." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.password || String(data.password).length < 4) { sendJson(res, 400, { error: "La contraseña necesita al menos 4 caracteres." }); return true; }
    const { salt, hash } = hashPassword(String(data.password));
    prof.passwordSalt = salt;
    prof.passwordHash = hash;
    saveProfessionals(professionals);
    logActivity({ actorType: "admin", action: "professional.password_changed", meta: { id: prof.id, name: prof.name } });
    sendJson(res, 200, { ok: true });
    return true;
  }

  // ── Perfil PÚBLICO del ebanista (v55.31) ─────────────────────────────────────
  // Reutiliza TODO el sistema de profesionales: cada ebanista puede tener un perfil
  // profesional ligado a su cuenta (ownerTenantId) que aparece en el directorio,
  // recibe reseñas de clientes y muestra portafolio/estadísticas — administrado desde
  // su propio panel. Así los ebanistas tienen las mismas opciones que los profesionales.
  if (parts[0] === "api" && parts[1] === "ebanista" && parts[2] === "profile" && !parts[3]) {
    const idn = getCallerIdentity ? getCallerIdentity(req) : null;
    if (!idn || idn.role !== "ebanista" || !idn.tenantId) {
      sendJson(res, 401, { error: "Inicia sesión como ebanista." }); return true;
    }
    const tenant = (tenants || []).find(t => t.id === idn.tenantId);
    let prof = professionals.find(x => x.ownerTenantId === idn.tenantId);

    if (method === "GET") {
      if (prof) { sendJson(res, 200, { exists: true, professional: publicProfessional(prof) }); return true; }
      sendJson(res, 200, { exists: false, prefill: {
        name: tenant?.companyName || "", company: tenant?.companyName || "",
        phone: tenant?.phone || "", whatsapp: tenant?.phone || "",
        email: tenant?.email || "", category: "ebanista"
      } }); return true;
    }

    if (method === "POST") {
      const data = JSON.parse((await readBody(req)) || "{}");
      const EDITABLE = ["company", "description", "specialty", "experienceYears", "phone", "whatsapp", "email", "schedule", "photoUrl", "portfolioUrls", "location", "socialLinks", "coverPhotoUrl", "services", "certifications", "availability", "videos"];
      if (!prof) {
        const name = String(data.name || tenant?.companyName || "").trim();
        if (!name) { sendJson(res, 400, { error: "Falta el nombre del perfil." }); return true; }
        const id = crypto.randomUUID();
        prof = {
          id, slug: makeSlug(name, id),
          category: CATEGORIES.includes(data.category) ? data.category : "ebanista",
          name, company: tenant?.companyName || "", description: "", specialty: "",
          experienceYears: 0, phone: tenant?.phone || "", whatsapp: tenant?.phone || "",
          email: tenant?.email || "",
          location: { province: "", city: "", address: "" }, schedule: "",
          photoUrl: "", portfolioUrls: [],
          socialLinks: { facebook: "", instagram: "", tiktok: "", website: "" },
          coverPhotoUrl: "", services: [], certifications: [], availability: "available", videos: [],
          active: true, idoneidad: { has: false, number: "", photoUrl: "" },
          ownerTenantId: idn.tenantId, status: "approved",
          ratings: { avg: 0, count: 0 }, createdAt: new Date().toISOString()
        };
        professionals.push(prof);
      }
      for (const f of EDITABLE) if (data[f] !== undefined) prof[f] = data[f];
      if (data.name !== undefined && String(data.name).trim()) prof.name = String(data.name).trim();
      if (CATEGORIES.includes(data.category)) prof.category = data.category;
      if (data.active !== undefined) prof.active = Boolean(data.active);
      saveProfessionals(professionals);
      logActivity({ actorType: "ebanista", actorId: idn.tenantId, action: "ebanista.profile.saved", meta: { profId: prof.id } });
      sendJson(res, 200, { ok: true, professional: publicProfessional(prof) });
      return true;
    }
  }

  return false;
}

module.exports = {
  handle, CATEGORIES, getProfessionalSession,
  findProfessionalById: id => professionals.find(x => x.id === id),
  getAllProfessionals: () => professionals,
  reload: () => { professionals = loadProfessionals(); }
};
