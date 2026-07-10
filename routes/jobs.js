// ── routes/jobs.js — Marketplace de Solicitudes de Trabajo (#1) ────────────────
// El corazón del ecosistema: un cliente publica un proyecto ("necesito fabricar
// una cocina"), los profesionales envían propuestas (precio + tiempo + mensaje +
// fotos de trabajos similares) y el cliente compara y elige. Al completarse, el
// trabajo alimenta la reputación del profesional (#4).
//
// Construido 100% sobre la Ola 0: store, events, notifications, flags. Lee datos
// de profesionales vía professionals.findProfessionalById (sin ciclo). El contacto
// del cliente es PRIVADO: solo se revela al profesional seleccionado.
"use strict";

const { sendJson, readBody, requireAdmin } = require("../lib/shared.js");
const { defineStore } = require("../lib/store.js");
const events = require("../lib/events.js");
const notif = require("../lib/notifications.js");
const flags = require("../lib/flags.js");
const reputationEngine = require("../lib/reputation.js");
const professionals = require("./professionals.js"); // findProfessionalById, CATEGORIES

const jobs = defineStore("jobs.json", { seed: [] });
const proposals = defineStore("proposals.json", { seed: [] });

const ID_FIELD = {
  professional: "professionalId", company: "companyId",
  usuario_gratuito: "freeUserId", ebanista: "tenantId", vendedor: "sellerId"
};
function caller(getCallerIdentity, req) {
  const idn = getCallerIdentity ? getCallerIdentity(req) : null;
  if (!idn) return null;
  return { role: idn.role, id: idn[ID_FIELD[idn.role]] };
}
function safeBody(raw) { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }

function isOwner(job, c) { return c && job.clientRef && job.clientRef.role === c.role && job.clientRef.id === c.id; }
function isAssignedPro(job, c) { return c && c.role === "professional" && job.assignedProfessionalId === c.id; }

// Vista pública: oculta el contacto del cliente.
function publicJob(j) {
  const { contact, clientRef, ...rest } = j;
  return { ...rest, clientName: contact ? contact.name : "" };
}

// ── Reputación derivada de un profesional ────────────────────────────────────
function reputationFor(professionalId) {
  const pro = professionals.findProfessionalById(professionalId);
  if (!pro) return null;
  const completed = jobs.query(j => j.assignedProfessionalId === professionalId && j.status === "completed").length;
  const tenureDays = pro.createdAt ? (Date.now() - new Date(pro.createdAt).getTime()) / 86400000 : 0;
  return reputationEngine.reputation({
    ratingAvg: pro.ratings ? pro.ratings.avg : 0,
    ratingCount: pro.ratings ? pro.ratings.count : 0,
    completedJobs: completed,
    tenureDays,
    verified: Boolean(pro.idoneidad && (pro.idoneidad.number || pro.idoneidad.photoUrl))
  });
}

function proposalView(pr, { withPro = true } = {}) {
  const out = { ...pr };
  if (withPro) out.reputation = reputationFor(pr.professionalId);
  return out;
}

async function handle(req, res, ctx) {
  const { method, p, parts, getCallerIdentity } = ctx;
  if (parts[0] !== "api") return false;

  // ── Metadatos para el formulario (categorías, estados) ──────────────────────
  if (method === "GET" && p === "/api/jobs/meta") {
    sendJson(res, 200, { categories: professionals.CATEGORIES || [], statuses: ["open", "assigned", "completed", "cancelled"] });
    return true;
  }

  // ── Reputación de un profesional (o batch ?ids=a,b,c) ───────────────────────
  if (method === "GET" && parts[1] === "reputation") {
    if (parts[2]) { const r = reputationFor(parts[2]); return r ? (sendJson(res, 200, r), true) : (sendJson(res, 404, { error: "Profesional no encontrado." }), true); }
    const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
    const ids = String(q.ids || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 100);
    const map = {};
    for (const id of ids) { const r = reputationFor(id); if (r) map[id] = r; }
    sendJson(res, 200, map);
    return true;
  }

  // ── Mis propuestas (profesional) ────────────────────────────────────────────
  if (method === "GET" && p === "/api/proposals/mine") {
    const c = caller(getCallerIdentity, req);
    if (!c || c.role !== "professional") { sendJson(res, 401, { error: "Inicia sesión como profesional." }); return true; }
    const mine = proposals.query(pr => pr.professionalId === c.id)
      .map(pr => { const job = jobs.get(pr.jobId); return { ...pr, jobTitle: job ? job.title : "(eliminado)", jobStatus: job ? job.status : "gone" }; })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    sendJson(res, 200, mine);
    return true;
  }

  // ── Retirar una propuesta (profesional) ─────────────────────────────────────
  if (method === "POST" && parts[1] === "proposals" && parts[2] && parts[3] === "withdraw") {
    const c = caller(getCallerIdentity, req);
    if (!c || c.role !== "professional") { sendJson(res, 401, { error: "No autorizado." }); return true; }
    const pr = proposals.get(parts[2]);
    if (!pr || pr.professionalId !== c.id) { sendJson(res, 404, { error: "Propuesta no encontrada." }); return true; }
    proposals.update(pr.id, { status: "withdrawn" });
    const job = jobs.get(pr.jobId);
    if (job) jobs.update(job.id, { proposalsCount: Math.max(0, (job.proposalsCount || 1) - 1) });
    sendJson(res, 200, { ok: true });
    return true;
  }

  // ── Mis solicitudes (cliente) ───────────────────────────────────────────────
  if (method === "GET" && p === "/api/jobs/mine") {
    const c = caller(getCallerIdentity, req);
    if (!c) { sendJson(res, 401, { error: "Inicia sesión." }); return true; }
    const mine = jobs.query(j => isOwner(j, c)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    sendJson(res, 200, mine.map(j => ({ ...j, proposalsCount: proposals.query(pr => pr.jobId === j.id && pr.status !== "withdrawn").length })));
    return true;
  }

  // ── Listado público de solicitudes abiertas ─────────────────────────────────
  if (method === "GET" && p === "/api/jobs") {
    if (!flags.isEnabled("jobs")) { sendJson(res, 200, []); return true; }
    const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
    let list = jobs.query(j => j.status === "open" && !j.hidden);
    if (q.category) list = list.filter(j => j.category === q.category);
    if (q.provinceId) list = list.filter(j => j.location && j.location.provinceId === q.provinceId);
    if (q.cityId) list = list.filter(j => j.location && j.location.cityId === q.cityId);
    if (q.q) { const s = q.q.toLowerCase(); list = list.filter(j => (j.title + " " + j.description).toLowerCase().includes(s)); }
    list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    sendJson(res, 200, list.map(publicJob));
    return true;
  }

  // ── Crear una solicitud de trabajo ──────────────────────────────────────────
  if (method === "POST" && p === "/api/jobs") {
    if (!flags.isEnabled("jobs")) { sendJson(res, 403, { error: "El marketplace de trabajos no está disponible." }); return true; }
    const c = caller(getCallerIdentity, req);
    if (!c) { sendJson(res, 401, { error: "Inicia sesión para publicar una solicitud." }); return true; }
    const d = safeBody(await readBody(req));
    if (!d.title || !d.title.trim()) { sendJson(res, 400, { error: "Describe qué necesitas (título)." }); return true; }
    if (!d.contact || !d.contact.name || !d.contact.phone) { sendJson(res, 400, { error: "Incluye tu nombre y un teléfono de contacto." }); return true; }
    const job = jobs.create({
      title: d.title.trim(),
      description: String(d.description || "").trim(),
      category: (professionals.CATEGORIES || []).includes(d.category) ? d.category : "otra",
      specialty: String(d.specialty || ""),
      photos: Array.isArray(d.photos) ? d.photos.slice(0, 8) : [],
      location: d.location || {},
      budget: d.budget != null && d.budget !== "" ? Number(d.budget) || 0 : "",
      desiredDate: d.desiredDate || "",
      status: "open",
      hidden: false,
      assignedProfessionalId: null,
      proposalsCount: 0,
      clientRef: { role: c.role, id: c.id },
      contact: { name: String(d.contact.name), phone: String(d.contact.phone), email: String(d.contact.email || "") }
    });
    events.emit("job.published", { jobId: job.id, category: job.category, provinceId: job.location && job.location.provinceId });
    sendJson(res, 201, job);
    return true;
  }

  // ── Propuestas de una solicitud (solo dueño o admin) ────────────────────────
  if (parts[1] === "jobs" && parts[2] && parts[3] === "proposals") {
    const job = jobs.get(parts[2]);
    if (!job) { sendJson(res, 404, { error: "Solicitud no encontrada." }); return true; }

    // GET → lista de propuestas (dueño o admin)
    if (method === "GET") {
      const c = caller(getCallerIdentity, req);
      const admin = !c && requireAdminSilently(req); // admin token no pasa por getCallerIdentity
      if (!isOwner(job, c) && !admin) { sendJson(res, 403, { error: "Solo el dueño de la solicitud ve las propuestas." }); return true; }
      const list = proposals.query(pr => pr.jobId === job.id && pr.status !== "withdrawn")
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map(pr => proposalView(pr));
      sendJson(res, 200, list);
      return true;
    }

    // POST → profesional envía/actualiza su propuesta
    if (method === "POST") {
      const c = caller(getCallerIdentity, req);
      if (!c || c.role !== "professional") { sendJson(res, 401, { error: "Inicia sesión como profesional para proponer." }); return true; }
      if (job.status !== "open") { sendJson(res, 409, { error: "Esta solicitud ya no acepta propuestas." }); return true; }
      const d = safeBody(await readBody(req));
      if (!d.message || !d.message.trim()) { sendJson(res, 400, { error: "Escribe un mensaje para el cliente." }); return true; }
      const pro = professionals.findProfessionalById(c.id);
      const fields = {
        jobId: job.id,
        professionalId: c.id,
        professionalName: pro ? pro.name : "Profesional",
        professionalPhoto: pro ? pro.photoUrl : "",
        price: d.price != null && d.price !== "" ? Number(d.price) || 0 : "",
        estimatedTime: String(d.estimatedTime || ""),
        message: d.message.trim(),
        photos: Array.isArray(d.photos) ? d.photos.slice(0, 6) : [],
        status: "sent"
      };
      // Upsert: una propuesta activa por profesional por trabajo.
      const existing = proposals.query(pr => pr.jobId === job.id && pr.professionalId === c.id && pr.status === "sent")[0];
      let prop;
      if (existing) { prop = proposals.update(existing.id, fields); }
      else {
        prop = proposals.create(fields);
        jobs.update(job.id, { proposalsCount: (job.proposalsCount || 0) + 1 });
        events.emit("proposal.sent", { jobId: job.id, professionalId: c.id });
      }
      // Avisar al dueño de la solicitud.
      notif.notify({ role: job.clientRef.role, id: job.clientRef.id, email: job.contact && job.contact.email }, {
        title: "Nueva propuesta en tu solicitud",
        body: `${fields.professionalName} respondió a "${job.title}".`,
        kind: "job", link: `/jobs/${job.id}`
      }).catch(() => {});
      sendJson(res, existing ? 200 : 201, prop);
      return true;
    }
  }

  // ── Acciones del dueño sobre su solicitud: select / complete / cancel ───────
  if (parts[1] === "jobs" && parts[2] && parts[3] && method === "POST" &&
      ["select", "complete", "cancel"].includes(parts[3])) {
    const job = jobs.get(parts[2]);
    if (!job) { sendJson(res, 404, { error: "Solicitud no encontrada." }); return true; }
    const c = caller(getCallerIdentity, req);
    if (!isOwner(job, c)) { sendJson(res, 403, { error: "Solo el dueño puede hacer esto." }); return true; }

    if (parts[3] === "select") {
      const d = safeBody(await readBody(req));
      const prop = proposals.get(d.proposalId);
      if (!prop || prop.jobId !== job.id) { sendJson(res, 404, { error: "Propuesta no encontrada." }); return true; }
      jobs.update(job.id, { status: "assigned", assignedProfessionalId: prop.professionalId });
      proposals.update(prop.id, { status: "accepted" });
      for (const other of proposals.query(pr => pr.jobId === job.id && pr.id !== prop.id && pr.status === "sent")) {
        proposals.update(other.id, { status: "rejected" });
        notif.notify({ role: "professional", id: other.professionalId }, {
          title: "No fuiste seleccionado esta vez",
          body: `El cliente eligió otra propuesta para "${job.title}". ¡Sigue proponiendo!`, kind: "job"
        }).catch(() => {});
      }
      const proEmail = (professionals.findProfessionalById(prop.professionalId) || {}).email;
      notif.notify({ role: "professional", id: prop.professionalId, email: proEmail }, {
        title: "¡Te seleccionaron para un trabajo! 🎉",
        body: `El cliente ${job.contact.name} te eligió para "${job.title}". Contacto: ${job.contact.phone}.`,
        kind: "job", link: `/jobs/${job.id}`, sendPush: true
      }).catch(() => {});
      events.emit("job.assigned", { jobId: job.id, professionalId: prop.professionalId });
      sendJson(res, 200, { ok: true, assignedProfessionalId: prop.professionalId, contact: job.contact });
      return true;
    }

    if (parts[3] === "complete") {
      if (!job.assignedProfessionalId) { sendJson(res, 409, { error: "Primero selecciona un profesional." }); return true; }
      jobs.update(job.id, { status: "completed", completedAt: new Date().toISOString() });
      events.emit("job.completed", { jobId: job.id, professionalId: job.assignedProfessionalId });
      const proEmail = (professionals.findProfessionalById(job.assignedProfessionalId) || {}).email;
      notif.notify({ role: "professional", id: job.assignedProfessionalId, email: proEmail }, {
        title: "Trabajo marcado como completado ✅",
        body: `"${job.title}" se completó. Tu reputación sube. ¡Buen trabajo!`, kind: "review"
      }).catch(() => {});
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (parts[3] === "cancel") {
      jobs.update(job.id, { status: "cancelled" });
      events.emit("job.cancelled", { jobId: job.id });
      sendJson(res, 200, { ok: true });
      return true;
    }
  }

  // ── Detalle de una solicitud ────────────────────────────────────────────────
  if (method === "GET" && parts[1] === "jobs" && parts[2] && !parts[3]) {
    const job = jobs.get(parts[2]);
    if (!job || job.hidden) { sendJson(res, 404, { error: "Solicitud no encontrada." }); return true; }
    const c = caller(getCallerIdentity, req);
    if (isOwner(job, c) || isAssignedPro(job, c)) { sendJson(res, 200, job); return true; } // incluye contacto
    sendJson(res, 200, publicJob(job));
    return true;
  }

  // ── Admin ────────────────────────────────────────────────────────────────────
  if (method === "GET" && p === "/api/admin/jobs") {
    if (!requireAdmin(req, res)) return true;
    sendJson(res, 200, jobs.all().map(j => ({ ...j, proposalsCount: proposals.query(pr => pr.jobId === j.id).length })));
    return true;
  }
  if (parts[1] === "admin" && parts[2] === "jobs" && parts[3]) {
    if (!requireAdmin(req, res)) return true;
    if (method === "POST" && parts[4] === "hide") {
      const job = jobs.get(parts[3]);
      if (!job) { sendJson(res, 404, { error: "No encontrada." }); return true; }
      jobs.update(job.id, { hidden: !job.hidden });
      sendJson(res, 200, { ok: true, hidden: !job.hidden });
      return true;
    }
    if (method === "DELETE" && !parts[4]) {
      jobs.remove(parts[3]);
      for (const pr of proposals.query(pr => pr.jobId === parts[3])) proposals.remove(pr.id);
      sendJson(res, 200, { ok: true });
      return true;
    }
  }

  return false;
}

// Chequeo de admin sin escribir respuesta (para ramas donde el fallback no es 401).
const { isValidSession, getToken } = require("../lib/shared.js");
function requireAdminSilently(req) { return isValidSession(getToken(req)); }

module.exports = {
  handle,
  reputationFor,
  reload: () => { jobs.reload(); proposals.reload(); }
};
