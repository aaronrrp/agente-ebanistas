"use strict";
const path = require("node:path");
const crypto = require("node:crypto");
const { sendJson, readBody, requireAdmin, atomicWrite } = require("../lib/shared.js");

const LOC_FILE = path.join(__dirname, "../locations.json");

let locData = loadLocations();

function loadLocations() {
  try {
    return JSON.parse(require("node:fs").readFileSync(LOC_FILE, "utf-8"));
  } catch {
    return { countries: [] };
  }
}

function saveLocations() {
  atomicWrite(LOC_FILE, locData);
}

function findCountry(id) { return locData.countries.find(c => c.id === id); }

function findProvince(id) {
  for (const c of locData.countries) {
    const p = c.provinces?.find(p => p.id === id);
    if (p) return { country: c, province: p };
  }
  return null;
}

function findCity(id) {
  for (const c of locData.countries) {
    for (const p of (c.provinces || [])) {
      const city = p.cities?.find(ci => ci.id === id);
      if (city) return { country: c, province: p, city };
    }
  }
  return null;
}

function genId(prefix) {
  return `${prefix}-${crypto.randomBytes(3).toString("hex")}`;
}

async function handle(req, res, { method, p, parts }) {

  // ── Públicos ────────────────────────────────────────────────────────────────

  // GET /api/locations — árbol completo
  if (method === "GET" && p === "/api/locations") {
    sendJson(res, 200, locData);
    return true;
  }

  // GET /api/locations/provinces/:countryId
  if (method === "GET" && parts[0] === "api" && parts[1] === "locations" && parts[2] === "provinces" && parts[3]) {
    const country = findCountry(parts[3]);
    if (!country) { sendJson(res, 404, { error: "País no encontrado." }); return true; }
    sendJson(res, 200, country.provinces || []);
    return true;
  }

  // GET /api/locations/cities/:provinceId
  if (method === "GET" && parts[0] === "api" && parts[1] === "locations" && parts[2] === "cities" && parts[3]) {
    const found = findProvince(parts[3]);
    if (!found) { sendJson(res, 404, { error: "Provincia no encontrada." }); return true; }
    sendJson(res, 200, found.province.cities || []);
    return true;
  }

  // ── Admin ────────────────────────────────────────────────────────────────────

  if (!p.startsWith("/api/admin/locations")) return false;

  if (!requireAdmin(req, res)) return true;

  // POST /api/admin/locations/countries
  if (method === "POST" && p === "/api/admin/locations/countries") {
    const data = await readBody(req);
    if (!data.name?.trim()) { sendJson(res, 400, { error: "Nombre requerido." }); return true; }
    const country = { id: genId("C"), name: data.name.trim(), provinces: [] };
    locData.countries.push(country);
    saveLocations();
    sendJson(res, 201, country);
    return true;
  }

  // POST /api/admin/locations/provinces — body: {countryId, name}
  if (method === "POST" && p === "/api/admin/locations/provinces") {
    const data = await readBody(req);
    if (!data.name?.trim() || !data.countryId) { sendJson(res, 400, { error: "name y countryId requeridos." }); return true; }
    const country = findCountry(data.countryId);
    if (!country) { sendJson(res, 404, { error: "País no encontrado." }); return true; }
    const province = { id: genId(data.countryId), name: data.name.trim(), cities: [] };
    country.provinces.push(province);
    saveLocations();
    sendJson(res, 201, province);
    return true;
  }

  // POST /api/admin/locations/cities — body: {provinceId, name}
  if (method === "POST" && p === "/api/admin/locations/cities") {
    const data = await readBody(req);
    if (!data.name?.trim() || !data.provinceId) { sendJson(res, 400, { error: "name y provinceId requeridos." }); return true; }
    const found = findProvince(data.provinceId);
    if (!found) { sendJson(res, 404, { error: "Provincia no encontrada." }); return true; }
    const city = { id: genId(data.provinceId), name: data.name.trim() };
    found.province.cities.push(city);
    saveLocations();
    sendJson(res, 201, city);
    return true;
  }

  // PUT /api/admin/locations/provinces/:id
  if (method === "PUT" && parts[3] === "locations" && parts[4] === "provinces" && parts[5]) {
    const data = await readBody(req);
    if (!data.name?.trim()) { sendJson(res, 400, { error: "Nombre requerido." }); return true; }
    const found = findProvince(parts[5]);
    if (!found) { sendJson(res, 404, { error: "Provincia no encontrada." }); return true; }
    found.province.name = data.name.trim();
    saveLocations();
    sendJson(res, 200, found.province);
    return true;
  }

  // PUT /api/admin/locations/cities/:id
  if (method === "PUT" && parts[3] === "locations" && parts[4] === "cities" && parts[5]) {
    const data = await readBody(req);
    if (!data.name?.trim()) { sendJson(res, 400, { error: "Nombre requerido." }); return true; }
    const found = findCity(parts[5]);
    if (!found) { sendJson(res, 404, { error: "Ciudad no encontrada." }); return true; }
    found.city.name = data.name.trim();
    saveLocations();
    sendJson(res, 200, found.city);
    return true;
  }

  // DELETE /api/admin/locations/provinces/:id — solo si tiene 0 ciudades
  if (method === "DELETE" && parts[3] === "locations" && parts[4] === "provinces" && parts[5]) {
    const found = findProvince(parts[5]);
    if (!found) { sendJson(res, 404, { error: "Provincia no encontrada." }); return true; }
    if (found.province.cities?.length) { sendJson(res, 409, { error: "La provincia tiene ciudades. Elimínalas primero." }); return true; }
    found.country.provinces = found.country.provinces.filter(p => p.id !== parts[5]);
    saveLocations();
    sendJson(res, 200, { ok: true });
    return true;
  }

  // DELETE /api/admin/locations/cities/:id
  if (method === "DELETE" && parts[3] === "locations" && parts[4] === "cities" && parts[5]) {
    const found = findCity(parts[5]);
    if (!found) { sendJson(res, 404, { error: "Ciudad no encontrada." }); return true; }
    found.province.cities = found.province.cities.filter(c => c.id !== parts[5]);
    saveLocations();
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

module.exports = { handle, reload: () => { locData = loadLocations(); } };
