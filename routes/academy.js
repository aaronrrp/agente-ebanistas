// ── routes/academy.js — Academia PiLLA (#8) ──────────────────────────────────
// Cursos/tutoriales (video + PDF + descripción) administrables desde Admin. Es un
// uso directo de la fundación: `makeAdminCrud` genera todo el CRUD admin + la
// lectura pública en unas pocas líneas. Cero deps.
"use strict";

const { makeAdminCrud } = require("../lib/admin-crud.js");
const { defineStore } = require("../lib/store.js");
const flags = require("../lib/flags.js");

const store = defineStore("courses.json", { seed: [] });
const LEVELS = ["básico", "intermedio", "avanzado"];

const crud = makeAdminCrud(store, {
  base: "courses",
  eventPrefix: "course",
  validate: d => (d.title && String(d.title).trim()) ? null : "Falta el título del curso.",
  shape: d => ({
    title: String(d.title).trim(),
    description: d.description || "",
    category: d.category || "General",
    level: LEVELS.includes(d.level) ? d.level : "básico",
    videoUrl: d.videoUrl || "",
    pdfUrl: d.pdfUrl || "",
    thumbnailUrl: d.thumbnailUrl || "",
    durationMin: Number(d.durationMin) || 0,
    published: d.published !== false
  }),
  // Lectura pública: solo cursos publicados, y solo si el módulo está encendido.
  publicList: (items, q) => {
    if (!flags.isEnabled("academy")) return [];
    let list = items.filter(c => c.published);
    if (q.category) list = list.filter(c => c.category === q.category);
    if (q.level) list = list.filter(c => c.level === q.level);
    return list;
  },
  actions: {
    publish: item => { item.published = !item.published; return { published: item.published }; }
  }
});

module.exports = { handle: crud, reload: () => store.reload() };
