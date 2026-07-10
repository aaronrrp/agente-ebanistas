// ── lib/flags.js — Interruptores de módulos + ajustes globales ─────────────────
// Editables desde Admin (settings.json). Cumple "todo administrable sin tocar
// código" (#14) y permite lanzar features de forma gradual y segura. Cero deps.
//
//   const flags = require("../lib/flags.js");
//   flags.isEnabled("academy");         // → bool (default ON salvo apagado explícito)
//   flags.all();                        // → { modules:{...}, ... }
//   flags.setModule("academy", false);  // admin apaga un módulo
//   flags.get("brandName", "PiLLA");
//   flags.set("brandName", "PiLLA");
"use strict";

const { defineStore } = require("./store.js");

// Módulos del ecosistema — arrancan encendidos. El admin puede apagar cualquiera
// para ocultarlo mientras se termina de pulir, sin desplegar código.
const DEFAULTS = {
  modules: {
    jobs: true,          // Marketplace de solicitudes de trabajo (#1)
    marketplace: true,   // Comparador de materiales + productos (#5, #6)
    academy: true,       // Academia PiLLA (#8)
    inspiration: true,   // Centro de inspiración (#9)
    calculators: true,   // Calculadoras (#10)
    vacancies: true,     // Bolsa de empleo (#7)
    referrals: true,     // Referidos (#11)
    bookings: true,      // Calendario / reservas (#2)
    notifications: true  // Centro de notificaciones (#13)
  }
};

const store = defineStore("settings.json", { seed: DEFAULTS });

// Asegura que existan las claves nuevas aunque settings.json ya existiera de antes
// (p.ej. si en el futuro se agrega otro módulo a DEFAULTS).
(function ensureDefaults() {
  const cur = store.getDoc() || {};
  store.setDoc({
    ...DEFAULTS,
    ...cur,
    modules: { ...DEFAULTS.modules, ...(cur.modules || {}) }
  });
})();

function all() { return store.getDoc(); }

function isEnabled(moduleName) {
  const m = (store.getDoc() || {}).modules || {};
  return m[moduleName] !== false; // default ON; solo se apaga con false explícito
}

function setModule(moduleName, enabled) {
  const doc = store.getDoc() || {};
  const modules = { ...(doc.modules || {}), [moduleName]: Boolean(enabled) };
  return store.setDoc({ modules });
}

function get(key, fallback) {
  const v = (store.getDoc() || {})[key];
  return v === undefined ? fallback : v;
}

function set(key, value) { return store.setDoc({ [key]: value }); }

function reload() { store.reload(); }

module.exports = { all, isEnabled, setModule, get, set, reload, DEFAULTS };
