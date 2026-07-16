// ── lib/notifications.js — Notificaciones internas + email + push (stub) ───────
// Un solo punto para avisar a un usuario (role+id): guarda la notificación en
// notifications.json (centro interno #13), opcionalmente manda email (lib/email.js)
// y deja una interfaz de push lista para la app móvil (#16). Cero deps.
//
//   const notif = require("../lib/notifications.js");
//   await notif.notify({ role:"professional", id, email }, {
//     title:"Nueva propuesta", body:"...", kind:"job", link:"/p/mi-perfil", sendPush:true
//   });
//   notif.listFor(userRef);            // → notificaciones del usuario, recientes primero
//   notif.unreadCount(userRef);        // → número de no leídas
//   notif.markRead(id); notif.markAllRead(userRef);
"use strict";

const { defineStore } = require("./store.js");
const events = require("./events.js");
const { sendEmail } = require("./email.js");

const store = defineStore("notifications.json", { seed: [] });

function esc(s) {
  return String(s || "").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

// Envío push — STUB. Interfaz estable para cuando exista la app (FCM/APNs).
// Hoy no hace nada real; solo deja el punto de extensión.
async function pushSend(userRef, payload) {
  // TODO(app-móvil): registrar tokens de dispositivo por usuario y enviar aquí.
  return { ok: false, skipped: true };
}

// Crea una notificación interna para un usuario, con email y push opcionales.
async function notify(userRef = {}, { title, body = "", kind = "info", link = "", email, sendPush = false } = {}) {
  const role = userRef.role || "";
  const userId = userRef.id || "";
  const note = store.create({
    role, userId,
    title: String(title || ""),
    body: String(body || ""),
    kind,                 // info | success | warning | job | review | system
    link: String(link || ""),
    read: false
  });

  events.emit("notification.created", { role, userId, kind });

  const to = email || userRef.email;
  if (to) {
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#2D235F">
      <h2 style="color:#2D235F">${esc(title)}</h2>
      <p>${esc(body)}</p>
      ${link ? `<p><a href="${esc(link)}" style="color:#2D235F">Ver más</a></p>` : ""}
      <p style="color:#6B7280;font-size:.85rem">— PiLLA</p></div>`;
    try { await sendEmail({ to, subject: String(title || "PiLLA"), html }); } catch (e) { console.error("[notif:email]", e.message); }
  }

  if (sendPush) { try { await pushSend(userRef, { title, body, link }); } catch {} }

  return note;
}

function listFor(userRef = {}, { unreadOnly = false, limit = 50 } = {}) {
  const role = userRef.role || "";
  const userId = userRef.id || "";
  let list = store.query(n => n.role === role && n.userId === userId);
  if (unreadOnly) list = list.filter(n => !n.read);
  return list
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, limit);
}

function unreadCount(userRef) {
  return listFor(userRef, { unreadOnly: true, limit: 100000 }).length;
}

function markRead(id) { return store.update(id, { read: true }); }

function markAllRead(userRef = {}) {
  const role = userRef.role || "";
  const userId = userRef.id || "";
  let n = 0;
  for (const note of store.query(x => x.role === role && x.userId === userId && !x.read)) {
    note.read = true; n++;
  }
  if (n) store.save();
  return n;
}

module.exports = { notify, listFor, unreadCount, markRead, markAllRead, pushSend, store };
