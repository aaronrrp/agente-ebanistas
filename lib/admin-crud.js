// ── lib/admin-crud.js — Generador de endpoints admin para una colección ───────
// Dado un store (lib/store.js) genera el CRUD admin estándar + lectura pública
// opcional + acciones personalizadas, en ~10 líneas por módulo. Cumple "todo
// administrable sin tocar código" (#14). Cero deps.
//
//   const { makeAdminCrud } = require("../lib/admin-crud.js");
//   const crud = makeAdminCrud(store, {
//     base: "courses",
//     validate: (d) => d.title ? null : "Falta el título.",
//     shape:    (d) => ({ title: d.title, level: d.level || "básico" }),
//     publicList: (items, q) => items.filter(c => c.published),  // GET /api/courses
//     actions:  { publish: (item) => { item.published = true; } } // POST /api/admin/courses/:id/publish
//   });
//   async function handle(req, res, ctx) {
//     if (await crud(req, res, ctx)) return true;
//     /* ...endpoints propios... */
//     return false;
//   }
//
// Rutas que sirve:
//   GET    /api/{base}            (si hay publicList)      lista pública
//   GET    /api/{base}/:id        (si hay publicList)      uno público (publicShape)
//   GET    /api/admin/{base}                               lista completa (admin)
//   GET    /api/admin/{base}/:id                           uno (admin)
//   POST   /api/admin/{base}                               crear (validate + shape)
//   PUT    /api/admin/{base}/:id                           editar (validate + shape)
//   DELETE /api/admin/{base}/:id                           borrar
//   POST   /api/admin/{base}/:id/:action                  acción personalizada
"use strict";

const { sendJson, readBody, requireAdmin } = require("./shared.js");
const events = require("./events.js");

function safeBody(raw) { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }

function makeAdminCrud(store, opts = {}) {
  const base = opts.base;
  const validate = opts.validate || (() => null);        // (data, isUpdate) => error|null
  const shape = opts.shape || (d => d);                   // (data, isUpdate) => objeto a guardar
  const publicList = opts.publicList || null;            // (items, query) => array | null
  const publicShape = opts.publicShape || (x => x);
  const actions = opts.actions || {};                    // { accion: (item, body, ctx) => result }
  const eventPrefix = opts.eventPrefix || base;

  return async function handle(req, res, ctx) {
    const { method, parts } = ctx;
    if (parts[0] !== "api") return false;

    // ── Lectura pública opcional ────────────────────────────────────────────
    if (publicList && parts[1] === base && method === "GET" && parts[2] !== "admin") {
      if (!parts[2]) {
        const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
        sendJson(res, 200, publicList(store.all(), q));
        return true;
      }
      const item = store.get(parts[2]);
      if (!item) { sendJson(res, 404, { error: "No encontrado." }); return true; }
      sendJson(res, 200, publicShape(item));
      return true;
    }

    // ── Admin ────────────────────────────────────────────────────────────────
    if (!(parts[1] === "admin" && parts[2] === base)) return false;
    if (!requireAdmin(req, res)) return true;

    const id = parts[3];
    const action = parts[4];

    if (method === "GET" && !id) { sendJson(res, 200, store.all()); return true; }

    if (method === "GET" && id && !action) {
      const item = store.get(id);
      if (!item) { sendJson(res, 404, { error: "No encontrado." }); return true; }
      sendJson(res, 200, item); return true;
    }

    if (method === "POST" && !id) {
      const data = safeBody(await readBody(req));
      const err = validate(data, false);
      if (err) { sendJson(res, 400, { error: err }); return true; }
      const item = store.create(shape(data, false));
      events.emit(`${eventPrefix}.created`, { id: item[store.idField] });
      sendJson(res, 201, item); return true;
    }

    if (method === "PUT" && id && !action) {
      if (!store.get(id)) { sendJson(res, 404, { error: "No encontrado." }); return true; }
      const data = safeBody(await readBody(req));
      const err = validate(data, true);
      if (err) { sendJson(res, 400, { error: err }); return true; }
      const item = store.update(id, shape(data, true));
      events.emit(`${eventPrefix}.updated`, { id });
      sendJson(res, 200, item); return true;
    }

    if (method === "DELETE" && id && !action) {
      if (!store.remove(id)) { sendJson(res, 404, { error: "No encontrado." }); return true; }
      events.emit(`${eventPrefix}.deleted`, { id });
      sendJson(res, 200, { ok: true }); return true;
    }

    if (method === "POST" && id && action && actions[action]) {
      const item = store.get(id);
      if (!item) { sendJson(res, 404, { error: "No encontrado." }); return true; }
      const body = safeBody(await readBody(req));
      const result = await actions[action](item, body, { store, req });
      store.save();
      events.emit(`${eventPrefix}.${action}`, { id });
      sendJson(res, 200, result === undefined ? item : result);
      return true;
    }

    return false;
  };
}

module.exports = { makeAdminCrud };
