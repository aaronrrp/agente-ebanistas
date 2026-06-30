// ── Catálogo global de categorías + productos por empresa + historial de precios ──
// GET    /api/catalog/categories                              — público
// POST   /api/admin/catalog/categories                       — admin
// PUT    /api/admin/catalog/categories/:id                   — admin
// DELETE /api/admin/catalog/categories/:id                   — admin
// GET    /api/companies/:id/products                         — público (solo disponibles)
// GET    /api/admin/companies/:id/products                   — admin (todos)
// POST   /api/admin/companies/:id/products                   — admin
// PUT    /api/admin/companies/:id/products/:pid              — admin (registra historial)
// DELETE /api/admin/companies/:id/products/:pid              — admin
// GET    /api/admin/price-history                            — admin
// POST   /api/admin/companies/:id/products/import            — admin (bulk JSON)
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { sendJson, readBody, requireAdmin } = require("../lib/shared.js");
const { logActivity } = require("../lib/activity-log.js");

const CATEGORIES_FILE = path.join(__dirname, "..", "catalog_categories.json");
const PRODUCTS_FILE   = path.join(__dirname, "..", "company_products.json");
const HISTORY_FILE    = path.join(__dirname, "..", "price_history.ndjson");

// ── categorías ──────────────────────────────────────────────────────────────
function loadCategories() {
  try { return JSON.parse(fs.readFileSync(CATEGORIES_FILE, "utf-8")); }
  catch { saveCategories([]); return []; }
}
function saveCategories(list) {
  try { fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(list, null, 2)); } catch {}
}

// ── productos ────────────────────────────────────────────────────────────────
function loadProducts() {
  try { return JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8")); }
  catch { saveProducts([]); return []; }
}
function saveProducts(list) {
  try { fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(list, null, 2)); } catch {}
}

// ── historial de precios (NDJSON append-only) ────────────────────────────────
function appendPriceHistory(entry) {
  try { fs.appendFileSync(HISTORY_FILE, JSON.stringify(entry) + "\n"); } catch {}
}
function loadPriceHistory(limit = 200) {
  try {
    const lines = fs.readFileSync(HISTORY_FILE, "utf-8").trim().split("\n").filter(Boolean);
    return lines.slice(-limit).map(l => JSON.parse(l)).reverse();
  } catch { return []; }
}

function slugify(name) {
  return String(name).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "cat";
}

async function handle(req, res, { method, p, parts }) {
  // ── Categorías públicas ──────────────────────────────────────────────────
  if (method === "GET" && p === "/api/catalog/categories") {
    sendJson(res, 200, loadCategories());
    return true;
  }

  // POST /api/admin/catalog/categories
  if (method === "POST" && p === "/api/admin/catalog/categories") {
    if (!requireAdmin(req, res)) return true;
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.name || !String(data.name).trim()) { sendJson(res, 400, { error: "Falta el nombre." }); return true; }
    const cats = loadCategories();
    const cat = {
      id: crypto.randomUUID(),
      parentId: data.parentId || null,
      name: String(data.name).trim(),
      slug: slugify(data.name),
      sortOrder: Number(data.sortOrder) || 0,
      createdAt: new Date().toISOString()
    };
    cats.push(cat);
    saveCategories(cats);
    logActivity({ actorType: "admin", actorId: "admin", actorLabel: "Admin", action: "catalog.category.created", meta: { name: cat.name } });
    sendJson(res, 201, cat);
    return true;
  }

  // PUT /api/admin/catalog/categories/:id
  if (method === "PUT" && parts[0] === "api" && parts[1] === "admin" && parts[2] === "catalog" && parts[3] === "categories" && parts[4] && !parts[5]) {
    if (!requireAdmin(req, res)) return true;
    const cats = loadCategories();
    const idx = cats.findIndex(c => c.id === parts[4]);
    if (idx < 0) { sendJson(res, 404, { error: "Categoría no encontrada." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (data.name) { cats[idx].name = String(data.name).trim(); cats[idx].slug = slugify(data.name); }
    if (data.parentId !== undefined) cats[idx].parentId = data.parentId || null;
    if (data.sortOrder !== undefined) cats[idx].sortOrder = Number(data.sortOrder) || 0;
    saveCategories(cats);
    sendJson(res, 200, cats[idx]);
    return true;
  }

  // DELETE /api/admin/catalog/categories/:id
  if (method === "DELETE" && parts[0] === "api" && parts[1] === "admin" && parts[2] === "catalog" && parts[3] === "categories" && parts[4] && !parts[5]) {
    if (!requireAdmin(req, res)) return true;
    const cats = loadCategories();
    const hasChildren = cats.some(c => c.parentId === parts[4]);
    if (hasChildren) { sendJson(res, 409, { error: "Elimina primero las subcategorías." }); return true; }
    const products = loadProducts();
    const hasProducts = products.some(pr => pr.categoryId === parts[4]);
    if (hasProducts) { sendJson(res, 409, { error: "Hay productos en esta categoría. Muévelos primero." }); return true; }
    const newCats = cats.filter(c => c.id !== parts[4]);
    saveCategories(newCats);
    logActivity({ actorType: "admin", actorId: "admin", actorLabel: "Admin", action: "catalog.category.deleted", meta: { id: parts[4] } });
    sendJson(res, 200, { ok: true });
    return true;
  }

  // ── Productos públicos por empresa ────────────────────────────────────────
  // GET /api/companies/:id/products
  if (method === "GET" && parts[0] === "api" && parts[1] === "companies" && parts[2] && parts[3] === "products" && !parts[4]) {
    const all = loadProducts().filter(pr => pr.companyId === parts[2] && pr.available && !pr.discontinued);
    sendJson(res, 200, all);
    return true;
  }

  // ── Admin: productos ──────────────────────────────────────────────────────
  // GET /api/admin/companies/:id/products
  if (method === "GET" && parts[0] === "api" && parts[1] === "admin" && parts[2] === "companies" && parts[3] && parts[4] === "products" && !parts[5]) {
    if (!requireAdmin(req, res)) return true;
    const all = loadProducts().filter(pr => pr.companyId === parts[3]);
    sendJson(res, 200, all);
    return true;
  }

  // POST /api/admin/companies/:id/products
  if (method === "POST" && parts[0] === "api" && parts[1] === "admin" && parts[2] === "companies" && parts[3] && parts[4] === "products" && !parts[5]) {
    if (!requireAdmin(req, res)) return true;
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    if (!data.name || !String(data.name).trim()) { sendJson(res, 400, { error: "Falta el nombre del producto." }); return true; }
    const now = new Date().toISOString();
    const product = {
      id: crypto.randomUUID(),
      companyId: parts[3],
      categoryId: data.categoryId || null,
      name: String(data.name).trim(),
      description: String(data.description || "").trim(),
      thickness: String(data.thickness || "").trim(),
      color: String(data.color || "").trim(),
      presentation: String(data.presentation || "").trim(),
      unit: String(data.unit || "unidad").trim(),
      price: Number(data.price) || 0,
      currency: "USD",
      available: data.available !== false,
      featured: Boolean(data.featured),
      discontinued: false,
      createdAt: now,
      updatedAt: now
    };
    const products = loadProducts();
    products.push(product);
    saveProducts(products);
    if (product.price > 0) {
      appendPriceHistory({ productId: product.id, companyId: parts[3], productName: product.name, oldPrice: null, newPrice: product.price, changedAt: now });
    }
    logActivity({ actorType: "admin", actorId: "admin", actorLabel: "Admin", action: "catalog.product.created", meta: { name: product.name, companyId: parts[3] } });
    sendJson(res, 201, product);
    return true;
  }

  // PUT /api/admin/companies/:cid/products/:pid
  if (method === "PUT" && parts[0] === "api" && parts[1] === "admin" && parts[2] === "companies" && parts[3] && parts[4] === "products" && parts[5] && !parts[6]) {
    if (!requireAdmin(req, res)) return true;
    const products = loadProducts();
    const idx = products.findIndex(pr => pr.id === parts[5] && pr.companyId === parts[3]);
    if (idx < 0) { sendJson(res, 404, { error: "Producto no encontrado." }); return true; }
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    const pr = products[idx];
    const oldPrice = pr.price;
    if (data.name !== undefined) pr.name = String(data.name).trim();
    if (data.description !== undefined) pr.description = String(data.description).trim();
    if (data.thickness !== undefined) pr.thickness = String(data.thickness).trim();
    if (data.color !== undefined) pr.color = String(data.color).trim();
    if (data.presentation !== undefined) pr.presentation = String(data.presentation).trim();
    if (data.unit !== undefined) pr.unit = String(data.unit).trim();
    if (data.categoryId !== undefined) pr.categoryId = data.categoryId || null;
    if (data.available !== undefined) pr.available = Boolean(data.available);
    if (data.featured !== undefined) pr.featured = Boolean(data.featured);
    if (data.discontinued !== undefined) pr.discontinued = Boolean(data.discontinued);
    if (data.price !== undefined) {
      const newPrice = Number(data.price);
      if (newPrice !== oldPrice) {
        pr.price = newPrice;
        appendPriceHistory({ productId: pr.id, companyId: pr.companyId, productName: pr.name, oldPrice, newPrice, changedAt: new Date().toISOString() });
      }
    }
    pr.updatedAt = new Date().toISOString();
    saveProducts(products);
    sendJson(res, 200, pr);
    return true;
  }

  // DELETE /api/admin/companies/:cid/products/:pid
  if (method === "DELETE" && parts[0] === "api" && parts[1] === "admin" && parts[2] === "companies" && parts[3] && parts[4] === "products" && parts[5] && !parts[6]) {
    if (!requireAdmin(req, res)) return true;
    const products = loadProducts();
    const idx = products.findIndex(pr => pr.id === parts[5] && pr.companyId === parts[3]);
    if (idx < 0) { sendJson(res, 404, { error: "Producto no encontrado." }); return true; }
    products.splice(idx, 1);
    saveProducts(products);
    logActivity({ actorType: "admin", actorId: "admin", actorLabel: "Admin", action: "catalog.product.deleted", meta: { productId: parts[5] } });
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/admin/price-history
  if (method === "GET" && p === "/api/admin/price-history") {
    if (!requireAdmin(req, res)) return true;
    const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
    const limit = Math.min(Number(q.limit) || 100, 500);
    sendJson(res, 200, loadPriceHistory(limit));
    return true;
  }

  // POST /api/admin/companies/:id/products/import — bulk JSON array
  if (method === "POST" && parts[0] === "api" && parts[1] === "admin" && parts[2] === "companies" && parts[3] && parts[4] === "products" && parts[5] === "import") {
    if (!requireAdmin(req, res)) return true;
    const body = await readBody(req);
    const rows = body ? JSON.parse(body) : [];
    if (!Array.isArray(rows)) { sendJson(res, 400, { error: "Se esperaba un array JSON." }); return true; }
    const products = loadProducts();
    const companyId = parts[3];
    const now = new Date().toISOString();
    let added = 0;
    for (const row of rows.slice(0, 1000)) {
      if (!row.name) continue;
      const product = {
        id: crypto.randomUUID(),
        companyId,
        categoryId: row.categoryId || null,
        name: String(row.name).trim(),
        description: String(row.description || "").trim(),
        thickness: String(row.thickness || "").trim(),
        color: String(row.color || "").trim(),
        presentation: String(row.presentation || "").trim(),
        unit: String(row.unit || "unidad").trim(),
        price: Number(row.price) || 0,
        currency: "USD",
        available: row.available !== false,
        featured: Boolean(row.featured),
        discontinued: false,
        createdAt: now,
        updatedAt: now
      };
      products.push(product);
      added++;
    }
    saveProducts(products);
    logActivity({ actorType: "admin", actorId: "admin", actorLabel: "Admin", action: "catalog.products.imported", meta: { companyId, added } });
    sendJson(res, 200, { ok: true, added });
    return true;
  }

  return false;
}

module.exports = { handle, loadCategories, loadProducts };
