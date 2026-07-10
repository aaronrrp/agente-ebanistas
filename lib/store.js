// ── lib/store.js — Colección JSON genérica reutilizable ───────────────────────
// Elimina la duplicación de load/save/find/CRUD que hoy reescribe cada módulo
// (locations.js, ads.js, professionals.js...). Se apoya en atomicWrite de
// lib/shared.js (escritura a prueba de crashes) y cachea en memoria. Cero deps.
//
// Uso (colección — array de items):
//   const { defineStore } = require("../lib/store.js");
//   const jobs = defineStore("jobs.json", { seed: [] });
//   jobs.all();                    // → array (referencia viva)
//   jobs.get(id);                  // → item | undefined
//   jobs.query(fn);                // → array filtrado
//   jobs.create({ ...campos });    // → item con id/createdAt/updatedAt
//   jobs.update(id, { patch });    // → item | null
//   jobs.remove(id);               // → boolean
//   jobs.reload();                 // relee del disco (tras restore de backup)
//
// Uso (documento — objeto único, p.ej. settings):
//   const cfg = defineStore("settings.json", { seed: { modules: {} } });
//   cfg.getDoc();                  // → objeto
//   cfg.setDoc({ patch });         // → objeto fusionado
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { atomicWrite } = require("./shared.js");

const ROOT = path.join(__dirname, "..");

function defineStore(filename, opts = {}) {
  const FILE = path.isAbsolute(filename) ? filename : path.join(ROOT, filename);
  const seed = opts.seed !== undefined ? opts.seed : [];
  const idField = opts.idField || "id";
  const genId = opts.genId || (() => crypto.randomUUID());

  let data = load();

  function load() {
    try {
      return JSON.parse(fs.readFileSync(FILE, "utf-8"));
    } catch {
      // Primera vez: sembrar el archivo con una copia del seed.
      const initial = JSON.parse(JSON.stringify(seed));
      try { atomicWrite(FILE, initial); } catch (e) { console.error(`[store:${filename}] seed`, e.message); }
      return initial;
    }
  }

  function save() {
    try { atomicWrite(FILE, data); }
    catch (e) { console.error(`[store:${filename}] save`, e.message); }
  }

  // ── API para colecciones (array de items) ──────────────────────────────────
  function all() { return data; }

  function get(id) {
    return Array.isArray(data) ? data.find(x => x && x[idField] === id) : undefined;
  }

  function query(fn) {
    return Array.isArray(data) ? data.filter(fn) : [];
  }

  function create(obj = {}) {
    const now = new Date().toISOString();
    const item = {
      ...obj,
      [idField]: obj[idField] || genId(),
      createdAt: obj.createdAt || now,
      updatedAt: now
    };
    if (!Array.isArray(data)) data = [];
    data.push(item);
    save();
    return item;
  }

  function update(id, patch = {}) {
    const item = get(id);
    if (!item) return null;
    Object.assign(item, patch, { [idField]: item[idField], updatedAt: new Date().toISOString() });
    save();
    return item;
  }

  function remove(id) {
    if (!Array.isArray(data)) return false;
    const before = data.length;
    data = data.filter(x => !x || x[idField] !== id);
    if (data.length === before) return false;
    save();
    return true;
  }

  // ── API para documento-objeto (no-array; p.ej. settings) ───────────────────
  function getDoc() { return data; }

  function setDoc(patch = {}) {
    data = Array.isArray(data) ? patch : { ...data, ...patch };
    save();
    return data;
  }

  function reload() { data = load(); }

  return {
    all, get, query, create, update, remove,   // colección
    getDoc, setDoc,                              // documento
    save, reload, FILE, idField
  };
}

module.exports = { defineStore };
