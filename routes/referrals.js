// ── routes/referrals.js — Programa de Referidos (#11) ─────────────────────────
// Cada usuario (consumidor/profesional/empresa) tiene un código para invitar; al
// registrarse alguien con su código, el referidor suma un crédito. Los créditos
// son un contador de beneficios (recompensa concreta se define aparte). Sobre la
// fundación: store + events + flags + getCallerIdentity. Cero deps.
"use strict";

const crypto = require("node:crypto");
const { sendJson, readBody } = require("../lib/shared.js");
const { defineStore } = require("../lib/store.js");
const events = require("../lib/events.js");
const flags = require("../lib/flags.js");

const store = defineStore("referrals.json", { seed: [] });

const ID_FIELD = {
  professional: "professionalId", company: "companyId",
  usuario_gratuito: "freeUserId", ebanista: "tenantId", vendedor: "sellerId"
};
function caller(getCallerIdentity, req) {
  const idn = getCallerIdentity ? getCallerIdentity(req) : null;
  if (!idn) return null;
  return { role: idn.role, id: idn[ID_FIELD[idn.role]] };
}
function genCode() { return "PILLA" + crypto.randomBytes(3).toString("hex").toUpperCase(); }

// Devuelve (creando si hace falta) el registro de referidos del usuario.
function recordFor(role, id) {
  let rec = store.query(r => r.ownerRole === role && r.ownerId === id)[0];
  if (!rec) rec = store.create({ code: genCode(), ownerRole: role, ownerId: id, credits: 0, invitedCount: 0, referredBy: "" });
  return rec;
}

async function handle(req, res, ctx) {
  const { method, parts, getCallerIdentity } = ctx;
  if (parts[0] !== "api" || parts[1] !== "referrals") return false;
  if (!flags.isEnabled("referrals")) { sendJson(res, 200, { disabled: true }); return true; }

  const c = caller(getCallerIdentity, req);
  if (!c || !c.id) { sendJson(res, 401, { error: "Inicia sesión para ver tus referidos." }); return true; }

  // GET /api/referrals/me → código propio + estadísticas.
  // Cada persona referida = 10% de descuento en la mensualidad del referidor (tope 100% = gratis).
  if (method === "GET" && parts[2] === "me") {
    const rec = recordFor(c.role, c.id);
    const invitedCount = rec.invitedCount || 0;
    sendJson(res, 200, {
      code: rec.code,
      invitedCount,
      discountPercent: Math.min(invitedCount * 10, 100),
      referredBy: rec.referredBy || ""
    });
    return true;
  }

  // POST /api/referrals/track {code} → el que llama fue referido por ese código
  if (method === "POST" && parts[2] === "track") {
    let body; try { body = JSON.parse((await readBody(req)) || "{}"); } catch { body = {}; }
    const useCode = String(body.code || "").trim().toUpperCase();
    const mine = recordFor(c.role, c.id);
    if (mine.referredBy) { sendJson(res, 200, { ok: true, already: true, message: "Ya registraste un código antes." }); return true; }
    if (!useCode || useCode === mine.code) { sendJson(res, 400, { error: "Código inválido." }); return true; }
    const owner = store.query(r => r.code === useCode)[0];
    if (!owner) { sendJson(res, 404, { error: "Ese código no existe." }); return true; }
    if (owner.ownerRole === c.role && owner.ownerId === c.id) { sendJson(res, 400, { error: "No puedes usar tu propio código." }); return true; }
    store.update(mine.id, { referredBy: useCode });
    store.update(owner.id, { credits: (owner.credits || 0) + 1, invitedCount: (owner.invitedCount || 0) + 1 });
    events.emit("referral.redeemed", { code: useCode, byRole: c.role });
    sendJson(res, 200, { ok: true, message: "¡Código aplicado! Tu referidor baja 10% de su mensualidad." });
    return true;
  }

  return false;
}

module.exports = { handle, reload: () => store.reload() };
