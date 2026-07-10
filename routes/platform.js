// ── routes/platform.js — Superficie HTTP de la capa-plataforma ────────────────
// Expone feature-flags (#14), el centro de notificaciones (#13) y un resumen de
// eventos para analíticas (#15). Es la demostración de punta a punta de la Ola 0
// y la base sobre la que se apoyan todos los módulos siguientes.
//
// Contrato de módulo idéntico al resto: handle(req,res,ctx) → true si respondió.
"use strict";

const { sendJson, readBody, requireAdmin } = require("../lib/shared.js");
const flags = require("../lib/flags.js");
const notif = require("../lib/notifications.js");
const events = require("../lib/events.js");

function safeBody(raw) { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }

// Normaliza la identidad multi-rol de server.js a { role, id, email? } para
// direccionar notificaciones sin acoplar este módulo a cada Map de sesión.
const ID_FIELD = {
  professional: "professionalId",
  company: "companyId",
  usuario_gratuito: "freeUserId",
  ebanista: "tenantId",
  vendedor: "sellerId"
};
function callerRef(getCallerIdentity, req) {
  const idn = getCallerIdentity ? getCallerIdentity(req) : null;
  if (!idn) return null;
  const field = ID_FIELD[idn.role];
  return { role: idn.role, id: idn[field] };
}

async function handle(req, res, ctx) {
  const { method, p, parts, getCallerIdentity } = ctx;

  // ── Feature flags ──────────────────────────────────────────────────────────

  // Público: qué módulos están encendidos (el cliente oculta lo apagado).
  if (method === "GET" && p === "/api/flags") {
    sendJson(res, 200, { modules: (flags.all() || {}).modules || {} });
    return true;
  }

  // Admin: ver toda la configuración.
  if (method === "GET" && p === "/api/admin/flags") {
    if (!requireAdmin(req, res)) return true;
    sendJson(res, 200, flags.all());
    return true;
  }

  // Admin: prender/apagar un módulo. Body: { module, enabled }
  if (method === "POST" && p === "/api/admin/flags/module") {
    if (!requireAdmin(req, res)) return true;
    const { module, enabled } = safeBody(await readBody(req));
    if (!module) { sendJson(res, 400, { error: "Falta 'module'." }); return true; }
    const updated = flags.setModule(module, enabled);
    events.emit("admin.flags.updated", { module, enabled: Boolean(enabled) });
    sendJson(res, 200, updated);
    return true;
  }

  // Admin: fijar un ajuste global arbitrario. Body: { key, value }
  if (method === "POST" && p === "/api/admin/flags/set") {
    if (!requireAdmin(req, res)) return true;
    const { key, value } = safeBody(await readBody(req));
    if (!key) { sendJson(res, 400, { error: "Falta 'key'." }); return true; }
    sendJson(res, 200, flags.set(key, value));
    return true;
  }

  // ── Centro de notificaciones (cualquier usuario con sesión) ─────────────────

  if (parts[0] === "api" && parts[1] === "notifications") {
    const ref = callerRef(getCallerIdentity, req);
    if (!ref || !ref.id) { sendJson(res, 401, { error: "Inicia sesión para ver tus notificaciones." }); return true; }

    // GET /api/notifications?unread=1
    if (method === "GET" && !parts[2]) {
      const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
      sendJson(res, 200, notif.listFor(ref, { unreadOnly: q.unread === "1" }));
      return true;
    }
    // GET /api/notifications/unread-count
    if (method === "GET" && parts[2] === "unread-count") {
      sendJson(res, 200, { count: notif.unreadCount(ref) });
      return true;
    }
    // POST /api/notifications/read-all
    if (method === "POST" && parts[2] === "read-all") {
      sendJson(res, 200, { marked: notif.markAllRead(ref) });
      return true;
    }
    // POST /api/notifications/:id/read
    if (method === "POST" && parts[2] && parts[3] === "read") {
      const n = notif.store.get(parts[2]);
      if (!n || n.role !== ref.role || n.userId !== ref.id) { sendJson(res, 404, { error: "No encontrada." }); return true; }
      notif.markRead(parts[2]);
      sendJson(res, 200, { ok: true });
      return true;
    }
  }

  // ── Eventos / analíticas base (admin) ───────────────────────────────────────

  if (method === "GET" && p === "/api/admin/events/recent") {
    if (!requireAdmin(req, res)) return true;
    const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
    const n = Math.min(Math.max(parseInt(q.n, 10) || 200, 1), 2000);
    sendJson(res, 200, events.recent(n));
    return true;
  }

  return false;
}

module.exports = {
  handle,
  reload: () => { flags.reload(); notif.store.reload(); }
};
