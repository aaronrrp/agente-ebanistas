// ── routes/inspiration.js — Centro de Inspiración (#9) ────────────────────────
// Biblioteca de diseños (cocinas, closets, baños, oficinas…) con fotos, autor y
// materiales, administrable desde Admin. Otro uso directo de `makeAdminCrud`.
// Cero deps.
"use strict";

const { makeAdminCrud } = require("../lib/admin-crud.js");
const { defineStore } = require("../lib/store.js");
const flags = require("../lib/flags.js");

const store = defineStore("inspiration.json", { seed: [] });
const CATS = ["cocina", "closet", "baño", "oficina", "dormitorio", "sala", "comercial", "otro"];

const crud = makeAdminCrud(store, {
  base: "inspiration",
  eventPrefix: "inspiration",
  validate: d => (d.title && d.photoUrl) ? null : "Falta el título o la foto principal.",
  shape: d => ({
    title: String(d.title).trim(),
    description: d.description || "",
    category: CATS.includes(d.category) ? d.category : "otro",
    photoUrl: d.photoUrl || "",
    photos: Array.isArray(d.photos) ? d.photos.slice(0, 10) : [],
    author: d.author || "",
    materials: d.materials || "",
    published: d.published !== false
  }),
  publicList: (items, q) => {
    if (!flags.isEnabled("inspiration")) return [];
    let list = items.filter(i => i.published);
    if (q.category) list = list.filter(i => i.category === q.category);
    return list;
  }
});

module.exports = { handle: crud, reload: () => store.reload(), CATS };
