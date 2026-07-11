// ── routes/analytics.js — Analíticas ampliadas (#15) + Meta móvil (#16) ───────
// Las métricas se derivan del bus de eventos (events.ndjson) con events.countBy /
// events.topBy — sin tablas nuevas. /api/meta es el bootstrap público para la app
// móvil (Rork/React Native): versión, módulos activos, categorías, esquema de auth.
// Cero deps.
"use strict";

const { sendJson, requireAdmin } = require("../lib/shared.js");
const events = require("../lib/events.js");
const flags = require("../lib/flags.js");
const professionals = require("./professionals.js");

const VERSION = "v54";

async function handle(req, res, ctx) {
  const { method, p } = ctx;

  // ── GET /api/meta — bootstrap para la app móvil (#16) ───────────────────────
  if (method === "GET" && p === "/api/meta") {
    sendJson(res, 200, {
      app: "PiLLA",
      version: VERSION,
      modules: (flags.all() || {}).modules || {},
      categories: professionals.CATEGORIES || [],
      auth: { scheme: "Bearer", roles: ["usuario_gratuito", "professional", "company", "admin"] }
    });
    return true;
  }

  // ── GET /api/admin/analytics/insights — métricas completas (#15) ────────────
  if (method === "GET" && p === "/api/admin/analytics/insights") {
    if (!requireAdmin(req, res)) return true;
    const nameFor = id => { const pr = professionals.findProfessionalById(id); return pr ? pr.name : String(id).slice(0, 8); };
    sendJson(res, 200, {
      counts: {
        jobsPublished: events.countBy("job.published"),
        proposalsSent: events.countBy("proposal.sent"),
        jobsCompleted: events.countBy("job.completed"),
        vacanciesPublished: events.countBy("vacancy.published"),
        applications: events.countBy("vacancy.applied"),
        bookingsRequested: events.countBy("booking.requested"),
        materialSearches: events.countBy("material.searched"),
        referralsRedeemed: events.countBy("referral.redeemed"),
        coursesCreated: events.countBy("course.created")
      },
      // Rankings a partir de los eventos
      topProfessionals: events.topBy(e => e.professionalId, { type: "job.completed", limit: 10 }).map(x => ({ name: nameFor(x.key), count: x.count })),
      topMaterials: events.topBy(e => String(e.q || "").toLowerCase().trim(), { type: "material.searched", limit: 10 }),
      topCategories: events.topBy(e => e.category, { type: "job.published", limit: 10 }),
      recent: events.recent(25)
    });
    return true;
  }

  return false;
}

module.exports = { handle };
