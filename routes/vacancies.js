// ── routes/vacancies.js — Bolsa de Empleo (#7) ───────────────────────────────
// La empresa publica vacantes; los profesionales se postulan; el admin modera.
// Espejo de jobs.js pero en sentido empresa→profesional. Sobre la fundación
// (store/events/notifications/flags) + datos de companies/professionals. Cero deps.
"use strict";

const { sendJson, readBody, requireAdmin } = require("../lib/shared.js");
const { defineStore } = require("../lib/store.js");
const events = require("../lib/events.js");
const notif = require("../lib/notifications.js");
const flags = require("../lib/flags.js");
const companies = require("./companies.js");       // findCompanyById
const professionals = require("./professionals.js"); // findProfessionalById

const vacancies = defineStore("vacancies.json", { seed: [] });
const applications = defineStore("applications.json", { seed: [] });

const ID_FIELD = { professional: "professionalId", company: "companyId", usuario_gratuito: "freeUserId", ebanista: "tenantId", vendedor: "sellerId" };
function caller(getCallerIdentity, req) {
  const idn = getCallerIdentity ? getCallerIdentity(req) : null;
  if (!idn) return null;
  return { role: idn.role, id: idn[ID_FIELD[idn.role]] };
}
function safeBody(raw) { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
const TYPES = ["tiempo completo", "medio tiempo", "por proyecto", "temporal"];

async function handle(req, res, ctx) {
  const { method, p, parts, getCallerIdentity } = ctx;
  if (parts[0] !== "api") return false;

  // ── Mis postulaciones (profesional) ─────────────────────────────────────────
  if (method === "GET" && p === "/api/applications/mine") {
    const c = caller(getCallerIdentity, req);
    if (!c || c.role !== "professional") { sendJson(res, 401, { error: "Inicia sesión como profesional." }); return true; }
    const mine = applications.query(a => a.professionalId === c.id).map(a => {
      const v = vacancies.get(a.vacancyId);
      return { ...a, vacancyTitle: v ? v.title : "(cerrada)", companyName: v ? v.companyName : "" };
    }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    sendJson(res, 200, mine);
    return true;
  }

  // ── Vacantes de mi empresa ──────────────────────────────────────────────────
  if (method === "GET" && p === "/api/vacancies/mine") {
    const c = caller(getCallerIdentity, req);
    if (!c || c.role !== "company") { sendJson(res, 401, { error: "Inicia sesión como empresa." }); return true; }
    const mine = vacancies.query(v => v.companyId === c.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(v => ({ ...v, applicantsCount: applications.query(a => a.vacancyId === v.id).length }));
    sendJson(res, 200, mine);
    return true;
  }

  // ── Listado público de vacantes abiertas ────────────────────────────────────
  if (method === "GET" && p === "/api/vacancies") {
    if (!flags.isEnabled("vacancies")) { sendJson(res, 200, []); return true; }
    const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
    let list = vacancies.query(v => v.status === "open" && !v.hidden);
    if (q.category) list = list.filter(v => v.category === q.category);
    if (q.q) { const s = q.q.toLowerCase(); list = list.filter(v => `${v.title} ${v.description} ${v.companyName}`.toLowerCase().includes(s)); }
    list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    sendJson(res, 200, list);
    return true;
  }

  // ── Crear vacante (empresa) ─────────────────────────────────────────────────
  if (method === "POST" && p === "/api/vacancies") {
    if (!flags.isEnabled("vacancies")) { sendJson(res, 403, { error: "La bolsa de empleo no está disponible." }); return true; }
    const c = caller(getCallerIdentity, req);
    if (!c || c.role !== "company") { sendJson(res, 401, { error: "Inicia sesión como empresa para publicar vacantes." }); return true; }
    const d = safeBody(await readBody(req));
    if (!d.title || !d.title.trim()) { sendJson(res, 400, { error: "Falta el título del puesto." }); return true; }
    const co = companies.findCompanyById(c.id);
    const v = vacancies.create({
      companyId: c.id,
      companyName: co ? co.name : "Empresa",
      title: d.title.trim(),
      description: String(d.description || "").trim(),
      category: d.category || "General",
      type: TYPES.includes(d.type) ? d.type : "tiempo completo",
      location: d.location || (co && co.location ? `${co.location.city || ""}${co.location.province ? ", " + co.location.province : ""}` : ""),
      salary: d.salary || "",
      status: "open", hidden: false
    });
    events.emit("vacancy.published", { vacancyId: v.id, companyId: c.id });
    sendJson(res, 201, v);
    return true;
  }

  // ── Postulaciones de una vacante (empresa dueña o admin) ────────────────────
  if (parts[1] === "vacancies" && parts[2] && parts[3] === "applications" && method === "GET") {
    const v = vacancies.get(parts[2]);
    if (!v) { sendJson(res, 404, { error: "Vacante no encontrada." }); return true; }
    const c = caller(getCallerIdentity, req);
    const isOwner = c && c.role === "company" && v.companyId === c.id;
    if (!isOwner && !requireAdminSilently(req)) { sendJson(res, 403, { error: "Solo la empresa dueña ve las postulaciones." }); return true; }
    const list = applications.query(a => a.vacancyId === v.id).map(a => {
      const pro = professionals.findProfessionalById(a.professionalId);
      return { ...a, professionalPhoto: pro ? pro.photoUrl : "", professionalCategory: pro ? pro.category : "" };
    });
    sendJson(res, 200, list);
    return true;
  }

  // ── Postularse a una vacante (profesional) ──────────────────────────────────
  if (parts[1] === "vacancies" && parts[2] && parts[3] === "apply" && method === "POST") {
    const v = vacancies.get(parts[2]);
    if (!v || v.status !== "open") { sendJson(res, 409, { error: "Esta vacante ya no acepta postulaciones." }); return true; }
    const c = caller(getCallerIdentity, req);
    if (!c || c.role !== "professional") { sendJson(res, 401, { error: "Inicia sesión como profesional para postularte." }); return true; }
    if (applications.query(a => a.vacancyId === v.id && a.professionalId === c.id).length) { sendJson(res, 409, { error: "Ya te postulaste a esta vacante." }); return true; }
    const d = safeBody(await readBody(req));
    const pro = professionals.findProfessionalById(c.id);
    const app = applications.create({
      vacancyId: v.id, professionalId: c.id,
      professionalName: pro ? pro.name : "Profesional",
      phone: (pro && (pro.whatsapp || pro.phone)) || d.phone || "",
      message: String(d.message || "").trim(),
      status: "sent"
    });
    events.emit("vacancy.applied", { vacancyId: v.id, professionalId: c.id });
    notif.notify({ role: "company", id: v.companyId }, {
      title: "Nueva postulación a tu vacante",
      body: `${app.professionalName} se postuló a "${v.title}".`, kind: "job", link: "/empleos"
    }).catch(() => {});
    sendJson(res, 201, app);
    return true;
  }

  // ── Cerrar vacante (empresa dueña) ──────────────────────────────────────────
  if (parts[1] === "vacancies" && parts[2] && parts[3] === "close" && method === "POST") {
    const v = vacancies.get(parts[2]);
    if (!v) { sendJson(res, 404, { error: "No encontrada." }); return true; }
    const c = caller(getCallerIdentity, req);
    if (!c || c.role !== "company" || v.companyId !== c.id) { sendJson(res, 403, { error: "Solo la empresa dueña puede cerrarla." }); return true; }
    vacancies.update(v.id, { status: "closed" });
    sendJson(res, 200, { ok: true });
    return true;
  }

  // ── Admin ────────────────────────────────────────────────────────────────────
  if (method === "GET" && p === "/api/admin/vacancies") {
    if (!requireAdmin(req, res)) return true;
    sendJson(res, 200, vacancies.all().map(v => ({ ...v, applicantsCount: applications.query(a => a.vacancyId === v.id).length })));
    return true;
  }
  if (parts[1] === "admin" && parts[2] === "vacancies" && parts[3]) {
    if (!requireAdmin(req, res)) return true;
    if (method === "POST" && parts[4] === "hide") {
      const v = vacancies.get(parts[3]);
      if (!v) { sendJson(res, 404, { error: "No encontrada." }); return true; }
      vacancies.update(v.id, { hidden: !v.hidden });
      sendJson(res, 200, { ok: true, hidden: !v.hidden });
      return true;
    }
    if (method === "DELETE" && !parts[4]) {
      vacancies.remove(parts[3]);
      for (const a of applications.query(a => a.vacancyId === parts[3])) applications.remove(a.id);
      sendJson(res, 200, { ok: true });
      return true;
    }
  }

  return false;
}

const { isValidSession, getToken } = require("../lib/shared.js");
function requireAdminSilently(req) { return isValidSession(getToken(req)); }

module.exports = { handle, TYPES, reload: () => { vacancies.reload(); applications.reload(); } };
