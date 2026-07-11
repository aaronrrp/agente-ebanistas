// ── routes/bookings.js — Reservas / Calendario (#2) ──────────────────────────
// Un cliente pide una cita a un profesional (fecha/hora/nota); el profesional la
// confirma o rechaza. Versión enfocada en solicitud→confirmación (sin grilla de
// calendario). Sobre la fundación (store/events/notifications/flags). Cero deps.
"use strict";

const { sendJson, readBody, requireAdmin } = require("../lib/shared.js");
const { defineStore } = require("../lib/store.js");
const events = require("../lib/events.js");
const notif = require("../lib/notifications.js");
const flags = require("../lib/flags.js");
const professionals = require("./professionals.js");

const bookings = defineStore("bookings.json", { seed: [] });

const ID_FIELD = { professional: "professionalId", company: "companyId", usuario_gratuito: "freeUserId", ebanista: "tenantId", vendedor: "sellerId" };
function caller(getCallerIdentity, req) {
  const idn = getCallerIdentity ? getCallerIdentity(req) : null;
  if (!idn) return null;
  return { role: idn.role, id: idn[ID_FIELD[idn.role]] };
}
function safeBody(raw) { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
function byDate(a, b) { return String(b.date + (b.time || "")).localeCompare(String(a.date + (a.time || ""))); }
const STATUS_ES = { requested: "Solicitada", confirmed: "Confirmada", declined: "Rechazada", cancelled: "Cancelada" };

async function handle(req, res, ctx) {
  const { method, p, parts, getCallerIdentity } = ctx;

  // ── Admin ────────────────────────────────────────────────────────────────────
  if (method === "GET" && p === "/api/admin/bookings") {
    if (!requireAdmin(req, res)) return true;
    sendJson(res, 200, bookings.all().slice().sort(byDate));
    return true;
  }

  if (parts[0] !== "api" || parts[1] !== "bookings") return false;
  if (!flags.isEnabled("bookings")) { sendJson(res, 200, []); return true; }
  const c = caller(getCallerIdentity, req);

  // GET /api/bookings/mine — reservas del cliente
  if (method === "GET" && parts[2] === "mine") {
    if (!c) { sendJson(res, 401, { error: "Inicia sesión." }); return true; }
    sendJson(res, 200, bookings.query(b => b.clientRef && b.clientRef.role === c.role && b.clientRef.id === c.id).sort(byDate));
    return true;
  }

  // GET /api/bookings/received — reservas recibidas por el profesional
  if (method === "GET" && parts[2] === "received") {
    if (!c || c.role !== "professional") { sendJson(res, 401, { error: "Inicia sesión como profesional." }); return true; }
    sendJson(res, 200, bookings.query(b => b.professionalId === c.id).sort(byDate));
    return true;
  }

  // POST /api/bookings — el cliente solicita una cita
  if (method === "POST" && !parts[2]) {
    if (!c) { sendJson(res, 401, { error: "Inicia sesión para reservar." }); return true; }
    const d = safeBody(await readBody(req));
    if (!d.professionalId || !d.date) { sendJson(res, 400, { error: "Elige el profesional y la fecha." }); return true; }
    const pro = professionals.findProfessionalById(d.professionalId);
    if (!pro) { sendJson(res, 404, { error: "Profesional no encontrado." }); return true; }
    const b = bookings.create({
      professionalId: d.professionalId, professionalName: pro.name,
      clientRef: { role: c.role, id: c.id },
      contact: { name: (d.contact && d.contact.name) || "", phone: (d.contact && d.contact.phone) || "" },
      date: String(d.date), time: String(d.time || ""), note: String(d.note || "").trim(),
      status: "requested"
    });
    events.emit("booking.requested", { bookingId: b.id, professionalId: d.professionalId });
    notif.notify({ role: "professional", id: d.professionalId, email: pro.email }, {
      title: "Nueva solicitud de cita 📅",
      body: `${b.contact.name || "Un cliente"} pidió una cita para el ${b.date}${b.time ? " a las " + b.time : ""}.`,
      kind: "job"
    }).catch(() => {});
    sendJson(res, 201, b);
    return true;
  }

  // POST /api/bookings/:id/{confirm|decline|cancel}
  if (method === "POST" && parts[2] && parts[3]) {
    const b = bookings.get(parts[2]);
    if (!b) { sendJson(res, 404, { error: "Reserva no encontrada." }); return true; }
    const act = parts[3];
    if (act === "confirm" || act === "decline") {
      if (!c || c.role !== "professional" || b.professionalId !== c.id) { sendJson(res, 403, { error: "No autorizado." }); return true; }
      const status = act === "confirm" ? "confirmed" : "declined";
      bookings.update(b.id, { status });
      events.emit("booking." + status, { bookingId: b.id });
      notif.notify({ role: b.clientRef.role, id: b.clientRef.id }, {
        title: act === "confirm" ? "¡Tu cita fue confirmada! ✅" : "Tu cita no pudo confirmarse",
        body: `${b.professionalName} ${act === "confirm" ? "confirmó" : "no pudo tomar"} tu cita del ${b.date}${b.time ? " a las " + b.time : ""}.`,
        kind: "job"
      }).catch(() => {});
      sendJson(res, 200, { ok: true, status });
      return true;
    }
    if (act === "cancel") {
      if (!c || !(b.clientRef.role === c.role && b.clientRef.id === c.id)) { sendJson(res, 403, { error: "No autorizado." }); return true; }
      bookings.update(b.id, { status: "cancelled" });
      sendJson(res, 200, { ok: true });
      return true;
    }
  }

  return false;
}

module.exports = { handle, STATUS_ES, reload: () => bookings.reload() };
