// ── routes/marketplace.js — Comparador de materiales + Marketplace de productos ──
// (#5) y (#6) son la MISMA data vista de dos formas: comparar un material entre
// empresas, o navegar el catálogo. Los productos viven EMBEBIDOS en cada empresa
// (company.products[]), administrados por companies.js. Este módulo los aplana y
// enriquece con los datos de la empresa (nombre, ubicación, contacto, rating), sin
// duplicar el almacén. Emite material.searched para las analíticas (#15). Cero deps.
"use strict";

const { sendJson } = require("../lib/shared.js");
const events = require("../lib/events.js");
const flags = require("../lib/flags.js");
const companies = require("./companies.js"); // getAllCompanies, findCompanyById

const HIDDEN_COMPANY = new Set(["pending", "suspended", "rejected", "inactive"]);

function enrich(pr, co) {
  return {
    id: pr.id, companyId: co.id,
    name: pr.name || "", brand: pr.brand || "", material: pr.material || "",
    category: pr.category || "", color: pr.color || "", thickness: pr.thickness || 0,
    presentation: pr.presentation || "", dimensions: pr.dimensions || "",
    price: pr.price || 0, salePrice: pr.salePrice || 0,
    availability: pr.availability || "in_stock", photoUrl: pr.photoUrl || "",
    featured: Boolean(pr.featured),
    company: {
      id: co.id, name: co.name, category: co.category || "",
      province: (co.location && co.location.province) || "",
      city: (co.location && co.location.city) || "",
      whatsapp: co.whatsapp || "", phone: co.phone || "", logoUrl: co.logoUrl || "",
      ratingAvg: (co.ratings && co.ratings.avg) || 0,
      ratingCount: (co.ratings && co.ratings.count) || 0
    }
  };
}

// Aplana los productos activos de empresas visibles.
function activeProducts() {
  const out = [];
  for (const co of companies.getAllCompanies()) {
    if (!co || !Array.isArray(co.products)) continue;
    if (co.status && HIDDEN_COMPANY.has(co.status)) continue;
    for (const pr of co.products) {
      if (!pr || pr.status === "inactive") continue;
      out.push(enrich(pr, co));
    }
  }
  return out;
}

async function handle(req, res, ctx) {
  const { parts, method } = ctx;
  if (parts[0] !== "api" || parts[1] !== "marketplace") return false;
  if (!flags.isEnabled("marketplace")) { sendJson(res, 200, []); return true; }

  const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);

  // GET /api/marketplace/materials → materiales distintos (chips de búsqueda rápida)
  if (method === "GET" && parts[2] === "materials") {
    const tally = new Map();
    for (const pr of activeProducts()) {
      const key = String(pr.material || pr.name || "").trim();
      if (!key) continue;
      const norm = key.toLowerCase();
      const cur = tally.get(norm) || { name: key, count: 0 };
      cur.count++; tally.set(norm, cur);
    }
    sendJson(res, 200, [...tally.values()].sort((a, b) => b.count - a.count).slice(0, 30));
    return true;
  }

  // GET /api/marketplace/company/:id → catálogo de una empresa
  if (method === "GET" && parts[2] === "company" && parts[3]) {
    sendJson(res, 200, activeProducts().filter(pr => pr.companyId === parts[3]));
    return true;
  }

  // GET /api/marketplace  o  /api/marketplace/search → comparador / navegación
  if (method === "GET" && (parts[2] === "search" || !parts[2])) {
    let list = activeProducts();
    if (q.q) {
      const s = q.q.toLowerCase();
      list = list.filter(x => `${x.name} ${x.brand} ${x.material} ${x.category} ${x.color} ${x.presentation}`.toLowerCase().includes(s));
    }
    if (q.province) list = list.filter(x => x.company && x.company.province === q.province);
    if (q.maxPrice) list = list.filter(x => Number(x.price) <= Number(q.maxPrice));
    if (q.sort === "rating") list.sort((a, b) => ((b.company && b.company.ratingAvg) || 0) - ((a.company && a.company.ratingAvg) || 0));
    else list.sort((a, b) => (Number(a.price) || 1e12) - (Number(b.price) || 1e12)); // precio asc = comparador
    if (q.q) events.emit("material.searched", { q: q.q, results: list.length });
    sendJson(res, 200, list.slice(0, 200));
    return true;
  }

  return false;
}

module.exports = { handle };
