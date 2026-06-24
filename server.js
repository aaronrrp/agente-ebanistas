const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { readFile } = require("node:fs/promises");

const rootDir = __dirname;
const port = Number(process.env.PORT || 5174);
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin1234";
const TENANTS_FILE = path.join(__dirname, "tenants.json");

// ── MIME types ─────────────────────────────────────────────────────────────
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml"
};

const allowedActions = ["fill_form", "add_to_quote", "calculate_cuts", "enhance_image", "mock_3d", "add_materials", "add_pieces", "breakdown"];

// ── Tenant helpers ──────────────────────────────────────────────────────────
function makeCode(companyName) {
  const prefix = String(companyName || "ebanista")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8) || "ebanista";
  // Deterministic hash — same company name = same code, survives redeploys
  const hash = crypto.createHash("sha256").update(String(companyName || "")).digest("hex").slice(0, 6);
  return `${prefix}-${hash}`;
}

function generatePassword() {
  return crypto.randomBytes(6).toString("base64url");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  const candidate = crypto.pbkdf2Sync(String(password || ""), salt, 100000, 64, "sha512").toString("hex");
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function publicTenant(t) {
  const { passwordHash, passwordSalt, ...rest } = t;
  return { ...rest, hasPassword: Boolean(passwordHash) };
}

function makeStableId(seed) {
  const h = crypto.createHash("sha256").update(seed).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

function defaultTenants() {
  return []; // Sin ebanistas de demo — el admin agrega los reales
}

function loadTenants() {
  try {
    return JSON.parse(fs.readFileSync(TENANTS_FILE, "utf-8"));
  } catch {
    const t = defaultTenants();
    saveTenants(t);
    return t;
  }
}

function saveTenants(list) {
  try { fs.writeFileSync(TENANTS_FILE, JSON.stringify(list, null, 2)); } catch {}
}

let tenants = loadTenants();

// ── Sellers (vendedores) ─────────────────────────────────────────────────────
const SELLERS_FILE = path.join(__dirname, "vendedores.json");

function makeSellerCode(name) {
  const prefix = String(name || "vendedor")
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "").slice(0, 8) || "vendedor";
  const hash = crypto.createHash("sha256").update(String(name || "")).digest("hex").slice(0, 6);
  return `${prefix}-${hash}`;
}

function defaultSellers() { return []; }

function loadSellers() {
  try { return JSON.parse(fs.readFileSync(SELLERS_FILE, "utf-8")); }
  catch { const s = defaultSellers(); saveSellers(s); return s; }
}

function saveSellers(list) {
  try { fs.writeFileSync(SELLERS_FILE, JSON.stringify(list, null, 2)); } catch {}
}

function publicSeller(s) {
  const { passwordHash, passwordSalt, ...rest } = s;
  return { ...rest, hasPassword: Boolean(passwordHash) };
}

let sellers = loadSellers();

// ── Handoffs (envíos ebanista ↔ vendedor) ────────────────────────────────────
const HANDOFFS_FILE = path.join(__dirname, "handoffs.json");

function defaultHandoffs() { return []; }

function loadHandoffs() {
  try { return JSON.parse(fs.readFileSync(HANDOFFS_FILE, "utf-8")); }
  catch { const h = defaultHandoffs(); saveHandoffs(h); return h; }
}

function saveHandoffs(list) {
  try { fs.writeFileSync(HANDOFFS_FILE, JSON.stringify(list, null, 2)); } catch {}
}

let handoffs = loadHandoffs();

function getCallerIdentity(req) {
  const token = getToken(req);
  const eb = getEbanistaSession(token);
  if (eb) return { role: "ebanista", tenantId: eb.tenantId };
  const se = getSellerSession(token);
  if (se) return { role: "vendedor", sellerId: se.sellerId };
  return null;
}

function canSeeHandoff(h, identity) {
  if (identity.role === "ebanista") return h.ebanistaTenantId === identity.tenantId;
  if (identity.role === "vendedor") {
    if (h.routing.mode === "direct") return h.routing.sellerId === identity.sellerId;
    return h.routing.claimedBySellerId === null || h.routing.claimedBySellerId === identity.sellerId;
  }
  return false;
}

// ── Prices ──────────────────────────────────────────────────────────────────
const PRICES_FILE = path.join(__dirname, "prices.json");

function defaultPrices() {
  return {
    melamina_std: 45,     // Lámina estándar 2440×1220mm
    melamina_lg: 85,      // Lámina grande 2750×1830mm
    canto_pvc: 0.80,      // Canto PVC 22mm por metro lineal
    canto_grueso: 2.20,   // Canto PVC grueso 2mm por metro
    backing_m2: 12,       // Fondo/backing por m²
    bisagra_std: 3.50,    // Bisagra estándar por unidad
    bisagra_sc: 7.00,     // Bisagra cierre suave por unidad
    corredera_std: 18,    // Corredera telescópica estándar por par
    corredera_sc: 32,     // Corredera cierre suave por par
    jalador_chico: 7,     // Jalador 128mm por unidad
    jalador_grande: 14,   // Jalador 320mm por unidad
    jalador_premium: 26,  // Jalador inox premium por unidad
    install_hour: 25,     // Mano de obra instalación por hora
    transport_base: 30,   // Transporte base (primer viaje)
    transport_km: 0.50,   // Transporte por km adicional
    kerf_mm: 5,            // Ancho del disco de corte (mm)
    canto_045mm_metro: 0.50,
    canto_100mm_metro: 0.80,
    canto_200mm_metro: 2.20
  };
}

function loadPrices() {
  try { return { ...defaultPrices(), ...JSON.parse(fs.readFileSync(PRICES_FILE, "utf-8")) }; }
  catch { return defaultPrices(); }
}

function savePrices(p) {
  try { fs.writeFileSync(PRICES_FILE, JSON.stringify(p, null, 2)); } catch {}
}

let prices = loadPrices();

// ── Admin sessions ──────────────────────────────────────────────────────────
const adminSessions = new Map();
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  adminSessions.set(token, Date.now());
  return token;
}

function isValidSession(token) {
  if (!token) return false;
  const ts = adminSessions.get(token);
  if (!ts) return false;
  if (Date.now() - ts > SESSION_TTL) { adminSessions.delete(token); return false; }
  return true;
}

function getToken(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

function requireAdmin(req, res) {
  if (!isValidSession(getToken(req))) {
    sendJson(res, 401, { error: "No autorizado. Inicia sesión como admin." });
    return false;
  }
  return true;
}

// ── Ebanista sessions (password login) ──────────────────────────────────────
const ebanistaSessions = new Map(); // token -> { tenantId, ts }
const EB_SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function createEbanistaSession(tenantId) {
  const token = crypto.randomBytes(32).toString("hex");
  ebanistaSessions.set(token, { tenantId, ts: Date.now() });
  return token;
}

function getEbanistaSession(token) {
  if (!token) return null;
  const s = ebanistaSessions.get(token);
  if (!s) return null;
  if (Date.now() - s.ts > EB_SESSION_TTL) { ebanistaSessions.delete(token); return null; }
  return s;
}

// ── Seller sessions (vendedor password login) ───────────────────────────────
const sellerSessions = new Map(); // token -> { sellerId, ts }
const SELLER_SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function createSellerSession(sellerId) {
  const token = crypto.randomBytes(32).toString("hex");
  sellerSessions.set(token, { sellerId, ts: Date.now() });
  return token;
}

function getSellerSession(token) {
  if (!token) return null;
  const s = sellerSessions.get(token);
  if (!s) return null;
  if (Date.now() - s.ts > SELLER_SESSION_TTL) { sellerSessions.delete(token); return null; }
  return s;
}

function requireSeller(req, res) {
  const session = getSellerSession(getToken(req));
  if (!session) { sendJson(res, 401, { error: "No autorizado. Inicia sesión como vendedor." }); return null; }
  return session;
}

function todayIso() { return new Date().toISOString().slice(0, 10); }

function isTenantActive(t) {
  return t.status === "active" && t.expiresAt >= todayIso();
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 10_000_000) reject(new Error("Too large")); });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// ── AI system prompt ────────────────────────────────────────────────────────
const systemPrompt = `
Eres un asistente de inteligencia artificial de uso general, con especialización profunda en ebanistería y fabricación de muebles a la medida en América Latina.
Puedes responder CUALQUIER pregunta: historia, ciencias, matemáticas, recetas, noticias, clima, consejos, programación, idiomas, negocios — lo que sea.
Tienes acceso a búsqueda web para información actualizada. Úsala cuando el usuario pregunte algo que requiera datos recientes.

══ MODO DE RESPUESTA ══

• Si el mensaje es sobre MUEBLES, cotización, cortes, materiales o ebanistería → responde en JSON con el schema de abajo.
• Si el mensaje es CUALQUIER OTRA COSA (preguntas generales, curiosidades, la hora, noticias, etc.) → responde en texto natural en español, SIN JSON.

Para preguntas generales: sé conversacional, útil y directo. Responde completo. No digas que "no puedes" buscar información — tienes web search. Si no sabes algo exacto, dilo honestamente pero siempre intenta ayudar.
IMPORTANTE sobre la hora: NO puedes saber la hora exacta actual — no tienes reloj en tiempo real. Si te preguntan "qué hora es", responde honestamente: "No tengo acceso a la hora en tiempo real — consulta el reloj de tu dispositivo. Lo que sí puedo decirte es que Panamá usa UTC-5 todo el año (sin horario de verano)."

══ CUANDO ES PREGUNTA DE MUEBLES — REGLAS ══
- Responde con JSON válido usando el schema de abajo.
- NUNCA digas que un mueble "no está disponible". Somos fabricantes a medida.
- Usa las medidas EXACTAS que pidió el cliente. NUNCA uses 120/90/55 como default.
- Si hay un mueble previo en currentItem, úsalo como base.
- Si pide "imagen" o "render": di que los renders no están disponibles, pero da la propuesta técnica completa.

══ ACCIONES (solo en respuestas de muebles) ══
- Propuesta normal → ["fill_form"]
- Pide cotizar, precio, presupuesto → ["fill_form", "add_to_quote"]
- Pide cortes, despiece, tabla de cortes → ["fill_form", "add_to_quote", "calculate_cuts"]

══ AGREGAR MATERIALES AL CARRITO DE COTIZACIÓN ══
Si el usuario pide agregar un material/herraje a su cotización (ej: "agrega 6 bisagras de cierre suave",
"ponme 2 láminas de melamina estándar", "necesito tapacanto de 1mm"), NO generes un mueble — responde con
actions: ["add_materials"] y un array "materials". Busca el precio en la lista de PRECIOS ACTUALES que se
te da en el contexto (ej: "Bisagra cierre suave: $7.00/un" → unitPrice 7, unit "Unidades"). Si no encuentras
un precio exacto, estima uno razonable y dilo en assistantText. Cada material:
{ "description": "Bisagra cierre suave", "qty": 6, "unit": "Unidades", "unitPrice": 7.00 }

══ AGREGAR PIEZAS A CORTES ══
Si el usuario pide crear piezas para la lista de cortes (ej: "necesito 3 piezas de 900 de largo por 550 de
ancho, grosor 15mm, canto en 1 ancho y 2 largos", "agrega una pieza 900x550 con veta al largo"), NO generes
un mueble — responde con actions: ["add_pieces"] y un array "pieces". El número de piezas puede venir en
dígito o en palabra ("cuatro piezas" = qty 4, comun en dictado por voz). Cortes trabaja TODO en milímetros:
cada número SIN unidad explícita ya está en mm (no lo dividas ni conviertas); si dice "cm"/"centímetros"
explícito, multiplica por 10 antes de poner el valor en el JSON. "Largo" y "ancho" son las dos dimensiones de
la pieza (no necesariamente largo > ancho). Grosor de la pieza: si dice "grosor de 15"/"15mm de grosor"/
"15 milímetros de grosor", usa el valor más cercano entre 15|18|25|36 → "15 mm"|"18 mm"|"25 mm"|"36 mm doble
laminado" (default "18 mm" si no lo menciona). Canto: grosor del canto si lo menciona ("canto de 0.45mm",
"1 milímetro de canto") → el más cercano entre 0.45|1.00|2.00 → "0.45mm"|"1.00mm"|"2.00mm" (default "1.00mm").
Los cantos van en 4 posibles lados: dos lados "largo" (largo1/largo2) y dos lados "ancho" (ancho1/ancho2, el
nombre que usa la UI para lo que antes se llamaba "corto") — si el usuario dice "canto en 1 ancho" marca solo
ancho1; "2 largos" marca largo1 y largo2; "canto en los anchos"/"ambos anchos" marca ancho1 y ancho2; "todos
los cantos" marca los 4. Veta: boolean + dirección "largo" o "ancho" (a qué eje corre la veta), default
"largo" si solo dice "con veta" sin especificar. Cada pieza:
{ "furniture": "", "name": "Pieza", "largo": 900, "ancho": 550, "qty": 3, "thickness": "15 mm",
  "cantoSides": { "l1": false, "l2": false, "c1": true, "c2": false }, "cantoThickness": "1.00mm",
  "grain": false, "grainDirection": "largo" }

══ DESGLOSE / DESPIECE (explicar cómo se construye, SIN agregar nada todavía) ══
Distinto de "AGREGAR PIEZAS A CORTES": ahí el usuario ya sabe las medidas exactas y quiere que
se agreguen YA. Aquí el usuario pide ENTENDER o VER cómo se construye un mueble — "desglósame
ese mueble", "despiece del closet", "explícame por partes", "qué materiales lleva", "cómo se
construye", "dame el breakdown" — normalmente sobre el mueble en currentItem o el último propuesto.
NO agregues piezas/materiales automáticamente: el humano decide qué enviar a Cortes después de ver
el desglose. Responde con actions: ["breakdown"], "items" null, y un objeto "breakdown":
{ "structure": "1-2 oraciones: estructura principal (laterales, repisas, fondo, etc.)",
  "materials": "1-2 oraciones: láminas, canto, herrajes que lleva",
  "cuts": "1-2 oraciones: cuántas piezas distintas salen y de qué tamaño aproximado",
  "assembly": "1-2 oraciones: orden de ensamblaje",
  "pieces": [
    { "name": "Lateral izquierdo", "largo": 900, "ancho": 550, "material": "Melamina 18mm RH01", "qty": 2,
      "thickness": "18 mm", "cantoSides": { "l1": false, "l2": false, "c1": true, "c2": false },
      "cantoThickness": "1.00mm", "grain": false, "grainDirection": "largo" }
  ] }
Mismas reglas de unidades (mm) y de canto/veta que en "AGREGAR PIEZAS A CORTES" aplican a cada pieza.

══ REGLAS TÉCNICAS ══
- Fondo interno/embutido: resta grosor melamina a profundidad de repisas y gavetas internas.
- Fondo exterior/sobrepuesto o sin fondo: NO restes profundidad a repisas internas.
- Repisas internas van entre laterales: restan grosor en ancho.
- Puertas sobrepuestas usan medidas exteriores; puertas embutidas usan hueco interior con holgura 0.3 cm.
- Sierra: agregar 3 mm de kerf por corte al calcular desperdicio.

══ DIMENSIONES ESTÁNDAR ══
- Muebles base cocina: 90 cm alto (con toe kick), profundidad 55–60 cm, vuelo cubierta 3–5 cm.
- Muebles altos cocina: profundidad 30–42 cm.
- Closets: profundidad 55–60 cm. Toe kick: 8–10 cm.
- Láminas en Latinoamérica: 2440×1220 mm (estándar), 2750×1830 mm (grande).

══ HARDWARE BLUM ══
- CLIP top BLUMOTION: cierre suave integrado, copa 35 mm, 110° o 165° apertura amplia.
- TANDEMBOX antaro: cajón lateral, carga 30–70 kg.
- MOVENTO: guía oculta bajo cajón, 30–70 kg, cierre suave.
- LEGRABOX: cajón premium metálico, 70 kg.

══ HARDWARE HÄFELE ══
- Matrix: corredera telescópica alta carga 45 kg. Copa 35 mm compatible Blum.

══ COLORES MELAMINA ══
RH01 Blanco Cotton | RH10 Gris Platino | RH15 Gris Marengo | RH20 Grafito |
RH30 Nogal Natural | RH35 Roble Arena | RH40 Wengué | RH50 Cerezo.

Si el usuario pide UN SOLO mueble → devuelve 1 objeto en el array "items".
Si pide VARIOS muebles en el mismo mensaje → devuelve TODOS en el array "items", uno por cada mueble pedido. NUNCA omitas ninguno.

Responde SOLO JSON válido:
{
  "assistantText": "2–3 oraciones directas en español, tono de WhatsApp. Menciona cada mueble con sus medidas. NUNCA uses 'Estimado', NUNCA firmes.",
  "actions": ["fill_form"],
  "items": [
    {
      "name": "Nombre descriptivo del mueble",
      "furnitureType": "Cocina|Closet|Vanity|Centro de entretenimiento|Mueble de lavandería|Escritorio|Otro",
      "dimensionBasis": "external|internal",
      "width": 0, "height": 0, "depth": 0,
      "complexityKey": "low|medium|high|premium",
      "doors": 0, "drawers": 0, "shelves": 0,
      "shelfPlacement": "internal|external",
      "doorPlacement": "overlay|inset|internal",
      "drawerPlacement": "external_front|inset_front|internal_box",
      "backPlacement": "external|internal|none",
      "melamineThickness": "15 mm|18 mm|25 mm|36 mm doble laminado",
      "edgeBanding": "No incluir canto|Solo frentes visibles|Frentes visibles y puertas|Todos los cantos expuestos|Canto premium en todo el mueble",
      "hinges": "Blum CLIP top BLUMOTION 110° (cierre suave)|Blum CLIP top 165° apertura amplia|Blum CLIP top estándar 110°|Häfele cierre suave 35mm|Häfele estándar 35mm|No incluir bisagras",
      "drawerSlides": "Blum LEGRABOX premium (70 kg)|Blum MOVENTO undermount (40 kg, cierre suave)|Blum TANDEMBOX antaro (30 kg)|Häfele Matrix cierre suave (45 kg)|Häfele telescópica estándar (25 kg)|No incluir correderas",
      "handles": "Barra aluminio 320mm|Barra aluminio 128mm|Jalador integrado / embutido|Sin jalador (push-to-open)|Inox premium acero inoxidable|No incluir jaladores",
      "color": "RH01|RH10|RH15|RH20|RH30|RH35|RH40|RH50",
      "notes": "detalle técnico",
      "manualPrice": 0
    }
  ],
  "materials": null,
  "pieces": null,
  "breakdown": null,
  "designPrompt": null
}

Si la accion es "add_materials", "items" va null/vacio y "materials" lleva el array descrito arriba.
Si la accion es "add_pieces", "items" va null/vacio y "pieces" lleva el array descrito arriba.
Si la accion es "breakdown", "items"/"materials"/"pieces" van null y "breakdown" lleva el objeto descrito arriba.
`.trim();

function getAiText(data) {
  if (data.output_text) return data.output_text;
  return (data.output || []).flatMap(o => (o.content || []).map(c => c.text || "")).join("\n").trim();
}

function parseJson(text) {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
}

function normalizeAi(payload, fallback) {
  const actions = Array.isArray(payload?.actions)
    ? payload.actions.filter(a => allowedActions.includes(a))
    : ["fill_form"];
  // Support both items[] (new) and single item (legacy)
  let items = null;
  if (Array.isArray(payload?.items) && payload.items.length > 0) {
    items = payload.items;
  } else if (payload?.item) {
    items = [payload.item];
  }
  const materials = Array.isArray(payload?.materials) ? payload.materials : null;
  const pieces = Array.isArray(payload?.pieces) ? payload.pieces : null;
  const breakdown = payload?.breakdown && typeof payload.breakdown === "object" ? payload.breakdown : null;
  return {
    source: "openai",
    assistantText: payload?.assistantText || fallback || "Propuesta generada.",
    actions: actions.length ? actions : ["fill_form"],
    items,
    item: items ? items[0] : null,
    materials,
    pieces,
    breakdown,
    designPrompt: payload?.designPrompt || null
  };
}

// ── Space analysis system prompt ────────────────────────────────────────────
const spacePrompt = `
Eres un experto en diseño de interiores y fabricación de muebles de melamina para América Latina.

El usuario te envía UNA FOTO DE UN ESPACIO real (habitación, cocina, sala, oficina, dormitorio, etc.).
Tu tarea es analizar visualmente ese espacio y proponer muebles de melamina específicos que quedarían bien.

CÓMO ANALIZAR LA FOTO:
1. Identifica el tipo de espacio (cocina, dormitorio, sala, oficina, baño, etc.)
2. Estima dimensiones usando referencias visuales:
   - Puerta estándar: 200 cm alto × 80 cm ancho
   - Enchufe en pared: 30–40 cm desde el piso
   - Persona adulta: ~170 cm
   - Ventana típica: 120 cm ancho × 100 cm alto
3. Describe el estilo (moderno, rústico, minimalista, clásico)
4. Identifica paredes/esquinas disponibles para muebles
5. Detecta necesidades (almacenamiento, organización, TV, ropa, cocina, etc.)

REGLAS PARA PROPONER MUEBLES:
- Propón 1 a 3 muebles específicos que resuelvan las necesidades del espacio
- Usa dimensiones reales basadas en el análisis de la foto
- Explica brevemente por qué cada mueble encaja en ese espacio
- Usa melamina 18 mm por defecto; 15 mm para muebles livianos
- Closets: profundidad 55–60 cm. Muebles de cocina base: 90 cm alto, 55 cm fondo.

Responde SOLO JSON válido:
{
  "assistantText": "Descripción del espacio analizado y por qué propones cada mueble. Sé específico: menciona la pared disponible, el estilo, las dimensiones estimadas del espacio. 2-4 oraciones.",
  "spaceType": "cocina|dormitorio|sala|oficina|baño|lavandería|otro",
  "designPrompt": "English DALL-E 3 prompt (under 900 chars) for a photorealistic interior design rendering showing the suggested furniture IN the space. Be specific: room type, furniture style, melamine color, dimensions, lighting. Example: 'Photorealistic interior design of a modern bedroom with a white melamine built-in closet 200cm tall x 150cm wide, soft close doors, minimalist style, warm lighting, high quality render'",
  "actions": ["fill_form", "add_to_quote"],
  "items": [
    {
      "name": "Nombre descriptivo del mueble (ej: Closet esquinero dormitorio)",
      "furnitureType": "Cocina|Closet|Vanity|Centro de entretenimiento|Mueble de lavandería|Escritorio|Otro",
      "dimensionBasis": "external",
      "width": 120,
      "height": 200,
      "depth": 55,
      "complexityKey": "low|medium|high|premium",
      "doors": 2,
      "drawers": 0,
      "shelves": 2,
      "shelfPlacement": "internal",
      "doorPlacement": "overlay",
      "drawerPlacement": "external_front",
      "backPlacement": "internal",
      "melamineThickness": "18 mm",
      "edgeBanding": "Frentes visibles y puertas",
      "hinges": "Blum CLIP top BLUMOTION 110° (cierre suave)",
      "drawerSlides": "No incluir correderas",
      "handles": "Barra aluminio 128mm",
      "color": "RH01",
      "notes": "Por qué este mueble encaja en el espacio analizado.",
      "manualPrice": 0
    }
  ]
}
`.trim();

// ── Route handlers ──────────────────────────────────────────────────────────

function friendlyAiError(e) {
  if (e.status === 429) return { status: 429, message: "Hay mucha demanda en este momento, espera unos segundos e intenta de nuevo." };
  if (e.status === 401) return { status: 500, message: "La clave de OpenAI configurada no es válida." };
  if (e.status === 400) return { status: 400, message: "No pude procesar esa solicitud, intenta reformularla." };
  return { status: 500, message: e.message || "Error inesperado." };
}

async function callOpenAI(sysPrompt, userContent) {
  // Use Responses API with web_search_preview for real-time web access
  const inputMessages = [{
    role: "user",
    content: userContent.map(c => {
      if (c.type === "input_text") return { type: "input_text", text: c.text };
      if (c.type === "input_image") return { type: "input_image", image_url: c.image_url };
      return c;
    })
  }];

  const apiRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: sysPrompt,
      tools: [{ type: "web_search_preview" }],
      input: inputMessages,
      max_output_tokens: 2000
    })
  });
  const data = await apiRes.json();
  if (!apiRes.ok) {
    console.error("[callOpenAI] error response:", JSON.stringify(data));
    const err = new Error(data.error?.message || `OpenAI ${apiRes.status}`);
    err.status = apiRes.status;
    throw err;
  }
  // Extract text from Responses API output array
  const text = (data.output || [])
    .filter(o => o.type === "message")
    .flatMap(o => o.content || [])
    .filter(c => c.type === "output_text")
    .map(c => c.text || "")
    .join("").trim();
  return parseJson(text) || { assistantText: text };
}

// Palabras que indican que el usuario quiere una IMAGEN generada, no una propuesta de mueble.
// "mueble"/"cocina"/"diseño" se excluyen a propósito: aparecen en casi cualquier pedido normal
// de cotización ("diseña un mueble de cocina") y dispararían el router por error.
const imageIntentWords = ["logo", "tatuaje", "plano", "render", "fachada", "dibujo"];
function detectImageIntent(message) {
  const text = String(message || "").toLowerCase();
  return imageIntentWords.some(w => text.includes(w));
}

async function handleAi(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    sendJson(res, 503, { error: "OPENAI_API_KEY no configurada. Usando modo local." });
    return;
  }
  const body = await readBody(req);
  const payload = body ? JSON.parse(body) : {};

  // Router texto vs imagen — solo si no viene una foto adjunta (eso es análisis, no generación).
  if (!payload.imageData && detectImageIntent(payload.message)) {
    const result = await generateImageCascade(payload.message);
    if (result.ok) {
      sendJson(res, 200, {
        source: "openai",
        assistantText: "Aquí está la imagen que pediste 🎨",
        actions: ["fill_form"],
        items: null, item: null, materials: null, pieces: null, breakdown: null,
        designPrompt: null,
        imageB64: result.imageB64 || null,
        imageUrl: result.imageUrl || null,
        imageSource: result.source
      });
    } else {
      sendJson(res, result.status || 500, { error: result.error || "No se pudo generar la imagen." });
    }
    return;
  }

  // Include custom price items sent from client (stored in client localStorage)
  const clientCustomItems = Array.isArray(payload.customPrices) ? payload.customPrices : [];
  const customBlock = clientCustomItems.length
    ? "\n" + clientCustomItems.map(i => `${String(i.name).slice(0,50)}: $${Number(i.price)||0}`).join("\n")
    : "";
  const pricesBlock = `\n══ PRECIOS ACTUALES (en USD) ══\nMadera/Melamina estándar 2440×1220: $${prices.melamina_std}\nMadera/Melamina grande 2750×1830: $${prices.melamina_lg}\nFondo/backing por m²: $${prices.backing_m2}\nCanto PVC 22mm/metro: $${prices.canto_pvc}\nCanto grueso 2mm/metro: $${prices.canto_grueso}\nBisagra estándar: $${prices.bisagra_std}/un\nBisagra cierre suave: $${prices.bisagra_sc}/un\nCorredera estándar: $${prices.corredera_std}/par\nCorredera cierre suave: $${prices.corredera_sc}/par\nJalador 128mm: $${prices.jalador_chico}/un\nJalador 320mm: $${prices.jalador_grande}/un\nJalador premium inox: $${prices.jalador_premium}/un\nInstalación: $${prices.install_hour}/hora\nTransporte base: $${prices.transport_base}${customBlock}`;

  // Conversation history: últimos 14 mensajes completos (≈7 interacciones) + resumen local
  // de lo más viejo (concatenación truncada, sin llamada extra a la API) para no perder
  // contexto de la conversación sin disparar el costo/tokens de mandar todo completo.
  const fullHistory = Array.isArray(payload.history) ? payload.history : [];
  const recentWindow = fullHistory.slice(-14);
  const older = fullHistory.slice(0, -14);
  let historyBlock = "";
  if (recentWindow.length > 0) {
    const summaryLine = older.length > 0
      ? `Resumen de ${older.length} mensaje(s) previos: ` + older.map(h => String(h.text || "").slice(0, 60)).join(" | ") + "\n"
      : "";
    const lines = recentWindow.map(h =>
      `${h.role === "user" ? "U" : "A"}: ${String(h.text || "").slice(0, 240)}`
    ).join("\n");
    historyBlock = `\n\n══ HISTORIAL ══\n${summaryLine}${lines}\n══ FIN ══`;
  }

  // Trim tenant to essentials only — avoids sending large catalog arrays
  const rawTenant = payload.tenant || {};
  const slimTenant = {
    companyName: rawTenant.companyName || "",
    margin: rawTenant.margin || 30,
    materials: String(rawTenant.materials || "").slice(0, 200),
    terms: String(rawTenant.terms || "").slice(0, 150)
  };

  const content = [{
    type: "input_text",
    text: JSON.stringify({ message: payload.message || "", tenant: slimTenant, currentItem: payload.currentItem || null })
  }];
  if (typeof payload.imageData === "string" && payload.imageData.startsWith("data:image/")) {
    content.push({ type: "input_image", image_url: payload.imageData });
  }
  try {
    const parsed = await callOpenAI(systemPrompt + pricesBlock + historyBlock, content);
    sendJson(res, 200, normalizeAi(parsed, parsed?.assistantText));
  } catch (e) {
    const { status, message } = friendlyAiError(e);
    sendJson(res, status, { error: message });
  }
}

// ── Space analysis — dedicated endpoint for room/photo analysis ─────────────
async function handleSpaceAnalysis(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    sendJson(res, 503, { error: "OPENAI_API_KEY no configurada. Sube tu clave en Render para usar análisis de espacios." });
    return;
  }
  const body = await readBody(req);
  const payload = body ? JSON.parse(body) : {};

  if (!payload.imageData?.startsWith("data:image/")) {
    sendJson(res, 400, { error: "Se requiere una imagen del espacio." });
    return;
  }

  const userContent = [
    { type: "input_text", text: payload.message || "Analiza este espacio y propón muebles de melamina que quedarían bien." },
    { type: "input_image", image_url: payload.imageData, detail: "high" }
  ];

  try {
    const parsed = await callOpenAI(spacePrompt, userContent);
    const firstItem = Array.isArray(parsed?.items) ? parsed.items[0] : parsed?.item || null;
    sendJson(res, 200, {
      source: "openai",
      assistantText: parsed?.assistantText || "Analicé el espacio.",
      spaceType: parsed?.spaceType || "otro",
      designPrompt: parsed?.designPrompt || null,
      actions: ["fill_form", "add_to_quote"],
      item: firstItem,
      items: parsed?.items || (firstItem ? [firstItem] : [])
    });
  } catch (e) {
    const { status, message } = friendlyAiError(e);
    sendJson(res, status, { error: message });
  }
}

// ── Image generation ────────────────────────────────────────────────────────
// Orden: Cloudflare FLUX (gratis) → Together FLUX (gratis) → gpt-image-1 (pago) → Pollinations (cliente)
async function generateImageCascade(prompt) {
  const imgPrompt = `${prompt.slice(0, 700)}, photorealistic interior design render, high quality, 4k, soft lighting`;

  // 1. Cloudflare Workers AI — FLUX.1-schnell (gratis, ~15 imgs/día, sin tarjeta)
  if (process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) {
    try {
      console.log("[CF] trying FLUX.1-schnell...");
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: imgPrompt, num_steps: 4 }),
          signal: AbortSignal.timeout(60000)
        }
      );
      const cfData = await cfRes.json();
      console.log(`[CF] status=${cfRes.status} success=${cfData.success} err="${cfData.errors?.[0]?.message || "ok"}"`);
      if (cfRes.ok && cfData.result?.image) {
        console.log("[CF] success!");
        return { ok: true, imageUrl: `data:image/jpeg;base64,${cfData.result.image}`, source: "cloudflare-flux" };
      }
    } catch (e) { console.log(`[CF] exception: ${e.message}`); }
  }

  // 2. Together.ai — FLUX.1-schnell-Free
  if (process.env.TOGETHER_API_KEY) {
    try {
      console.log("[Together] trying FLUX.1-schnell-Free...");
      const tr = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "black-forest-labs/FLUX.1-schnell-Free", prompt: imgPrompt, width: 1024, height: 1024, steps: 4, n: 1 }),
        signal: AbortSignal.timeout(60000)
      });
      const td = await tr.json();
      console.log(`[Together] status=${tr.status} err="${td.error?.message || "ok"}"`);
      if (tr.ok && td.data?.[0]?.url) {
        console.log("[Together] success!");
        return { ok: true, imageUrl: td.data[0].url, source: "together-flux" };
      }
    } catch (e) { console.log(`[Together] exception: ${e.message}`); }
  }

  // 3. gpt-image-1 (requiere cuenta OpenAI con organización verificada para imágenes)
  if (process.env.OPENAI_API_KEY) {
    try {
      console.log(`[gpt-image-1] trying...`);
      const ar = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: imageModel, prompt: prompt.slice(0, 900), n: 1, size: "1024x1024" }),
        signal: AbortSignal.timeout(60000)
      });
      const ad = await ar.json();
      console.log(`[gpt-image-1] status=${ar.status} err="${ad.error?.message || "ok"}"`);
      if (ar.ok && ad.data?.[0]?.b64_json) {
        return { ok: true, imageB64: ad.data[0].b64_json, source: imageModel };
      }
      if (ar.ok && ad.data?.[0]?.url) {
        return { ok: true, imageUrl: ad.data[0].url, source: imageModel };
      }
      if (ar.status === 429) return { ok: false, status: 429, error: "Demasiadas solicitudes de imagen, espera un momento." };
      if (ar.status === 403) return { ok: false, status: 403, error: "La cuenta de OpenAI no tiene acceso a gpt-image-1 (requiere organización verificada)." };
    } catch (e) { console.log(`[gpt-image-1] exception: ${e.message}`); }
  }

  // 4. Fallback: Pollinations desde el navegador del cliente (diferente IP)
  return { ok: false, status: 503, error: "Servidor de renders ocupado.", pollinations: true };
}

async function handleGenerateImage(req, res) {
  const body = await readBody(req);
  const { prompt } = body ? JSON.parse(body) : {};
  if (!prompt) { sendJson(res, 400, { error: "Se requiere prompt." }); return; }

  const result = await generateImageCascade(prompt);
  if (result.ok) {
    sendJson(res, 200, result);
  } else {
    sendJson(res, result.status || 503, { error: result.error, pollinations: result.pollinations });
  }
}

async function handleAuthAdmin(req, res) {
  const body = await readBody(req);
  const { password } = body ? JSON.parse(body) : {};
  if (password !== ADMIN_PASSWORD) {
    sendJson(res, 401, { error: "Contraseña incorrecta." });
    return;
  }
  const token = createSession();
  sendJson(res, 200, { token, message: "Sesión iniciada." });
}

function handleAuthCheck(req, res) {
  sendJson(res, 200, { valid: isValidSession(getToken(req)) });
}

async function handleAuthLogout(req, res) {
  const token = getToken(req);
  if (token) adminSessions.delete(token);
  sendJson(res, 200, { message: "Sesión cerrada." });
}

async function handleAuthEbanista(req, res) {
  const body = await readBody(req);
  const { code, password } = body ? JSON.parse(body) : {};
  const tenant = tenants.find(t => t.accessCode === code);
  if (!tenant) { sendJson(res, 401, { error: "Código no válido." }); return; }
  if (tenant.passwordHash && !verifyPassword(password, tenant.passwordSalt, tenant.passwordHash)) {
    sendJson(res, 401, { error: "Contraseña incorrecta." });
    return;
  }
  const token = createEbanistaSession(tenant.id);
  sendJson(res, 200, { token, tenant: { ...publicTenant(tenant), active: isTenantActive(tenant) } });
}

function handleAuthEbanistaCheck(req, res) {
  sendJson(res, 200, { valid: Boolean(getEbanistaSession(getToken(req))) });
}

async function handleAuthEbanistaLogout(req, res) {
  const token = getToken(req);
  if (token) ebanistaSessions.delete(token);
  sendJson(res, 200, { message: "Sesión cerrada." });
}

async function handleAuthSeller(req, res) {
  const body = await readBody(req);
  const { code, password } = body ? JSON.parse(body) : {};
  const s = sellers.find(s => s.accessCode === code);
  if (!s) { sendJson(res, 401, { error: "Código no válido." }); return; }
  if (s.status !== "active") { sendJson(res, 403, { error: "Cuenta de vendedor suspendida." }); return; }
  if (s.passwordHash && !verifyPassword(password, s.passwordSalt, s.passwordHash)) {
    sendJson(res, 401, { error: "Contraseña incorrecta." });
    return;
  }
  const token = createSellerSession(s.id);
  sendJson(res, 200, { token, seller: publicSeller(s) });
}

function handleAuthSellerCheck(req, res) {
  sendJson(res, 200, { valid: Boolean(getSellerSession(getToken(req))) });
}

async function handleAuthSellerLogout(req, res) {
  const token = getToken(req);
  if (token) sellerSessions.delete(token);
  sendJson(res, 200, { message: "Sesión cerrada." });
}

function handleSellerSelf(req, res) {
  const session = requireSeller(req, res);
  if (!session) return;
  const s = sellers.find(s => s.id === session.sellerId);
  if (!s) { sendJson(res, 404, { error: "No encontrado." }); return; }
  sendJson(res, 200, publicSeller(s));
}

async function handleSellerSelfPassword(req, res) {
  const session = requireSeller(req, res);
  if (!session) return;
  const s = sellers.find(s => s.id === session.sellerId);
  if (!s) { sendJson(res, 404, { error: "No encontrado." }); return; }
  const body = await readBody(req);
  const data = body ? JSON.parse(body) : {};
  if (!data.password || !String(data.password).trim()) { sendJson(res, 400, { error: "Contraseña requerida." }); return; }
  const { salt, hash } = hashPassword(String(data.password).trim());
  s.passwordSalt = salt;
  s.passwordHash = hash;
  saveSellers(sellers);
  sendJson(res, 200, { ok: true });
}

function handleGetTenants(req, res) {
  if (!requireAdmin(req, res)) return;
  sendJson(res, 200, tenants.map(t => ({
    id: t.id, companyName: t.companyName, contactName: t.contactName,
    phone: t.phone, email: t.email, plan: t.plan, status: t.status,
    expiresAt: t.expiresAt, margin: t.margin, accessCode: t.accessCode,
    hasPassword: Boolean(t.passwordHash),
    active: isTenantActive(t),
    prices: t.prices
  })));
}

async function handleCreateTenant(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  const data = body ? JSON.parse(body) : {};
  const passwordPlain = (data.password && String(data.password).trim()) || generatePassword();
  const { salt, hash } = hashPassword(passwordPlain);
  const tenant = {
    id: crypto.randomUUID(),
    companyName: data.companyName || "Nueva ebanistería",
    contactName: data.contactName || "Contacto",
    phone: data.phone || "+507",
    email: data.email || "",
    plan: data.plan || "Básico",
    status: "active",
    expiresAt: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })(),
    margin: Number(data.margin) || 30,
    installBase: Number(data.installBase) || 75,
    transportBase: Number(data.transportBase) || 30,
    materials: data.materials || "Melamina hidrófuga, canto PVC, herrajes estándar.",
    terms: data.terms || "60% para iniciar fabricación y 40% contra entrega.",
    accessCode: makeCode(data.companyName || "ebanista"),
    passwordSalt: salt,
    passwordHash: hash,
    catalog: data.catalog || { furnitureTypes: [], edgeOptions: [], hingeOptions: [], slideOptions: [], handleOptions: [] }
  };
  tenants.push(tenant);
  saveTenants(tenants);
  sendJson(res, 201, { ...publicTenant(tenant), passwordPlain });
}

async function handleUpdateTenant(req, res, id) {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  const data = body ? JSON.parse(body) : {};
  delete data.passwordHash; delete data.passwordSalt; // hash siempre se deriva de data.password, nunca se acepta directo
  const idx = tenants.findIndex(t => t.id === id);
  if (idx === -1) {
    // Upsert: this is the path the UI actually uses to create a tenant
    // (it PUTs a client-generated id instead of calling POST /api/tenants).
    const tenant = { ...data, id };
    if (!tenant.accessCode) tenant.accessCode = makeCode(tenant.companyName || "ebanista");
    const passwordPlain = (data.password && String(data.password).trim()) || generatePassword();
    const { salt, hash } = hashPassword(passwordPlain);
    tenant.passwordSalt = salt;
    tenant.passwordHash = hash;
    delete tenant.password;
    tenants.push(tenant);
    saveTenants(tenants);
    sendJson(res, 200, { ...publicTenant(tenant), passwordPlain });
    return;
  }
  let passwordPlain;
  if (data.password && String(data.password).trim()) {
    passwordPlain = String(data.password).trim();
    const { salt, hash } = hashPassword(passwordPlain);
    tenants[idx].passwordSalt = salt;
    tenants[idx].passwordHash = hash;
  }
  delete data.password;
  tenants[idx] = { ...tenants[idx], ...data, id };
  saveTenants(tenants);
  sendJson(res, 200, passwordPlain ? { ...publicTenant(tenants[idx]), passwordPlain } : publicTenant(tenants[idx]));
}

function handleToggleTenant(req, res, id) {
  if (!requireAdmin(req, res)) return;
  const t = tenants.find(t => t.id === id);
  if (!t) { sendJson(res, 404, { error: "No encontrado." }); return; }
  if (isTenantActive(t)) {
    t.status = "suspended";
  } else {
    t.status = "active";
    const d = new Date(); d.setDate(d.getDate() + 30);
    t.expiresAt = d.toISOString().slice(0, 10);
  }
  saveTenants(tenants);
  sendJson(res, 200, t);
}

function handleRenewTenant(req, res, id, days) {
  if (!requireAdmin(req, res)) return;
  const t = tenants.find(t => t.id === id);
  if (!t) { sendJson(res, 404, { error: "No encontrado." }); return; }
  t.status = "active";
  const d = new Date(); d.setDate(d.getDate() + days);
  t.expiresAt = d.toISOString().slice(0, 10);
  saveTenants(tenants);
  sendJson(res, 200, t);
}

function handleRegenerateCode(req, res, id) {
  if (!requireAdmin(req, res)) return;
  const t = tenants.find(t => t.id === id);
  if (!t) { sendJson(res, 404, { error: "No encontrado." }); return; }
  t.accessCode = makeCode(t.companyName);
  saveTenants(tenants);
  sendJson(res, 200, { accessCode: t.accessCode });
}

async function handleSetTenantPassword(req, res, id) {
  if (!requireAdmin(req, res)) return;
  const t = tenants.find(t => t.id === id);
  if (!t) { sendJson(res, 404, { error: "No encontrado." }); return; }
  const body = await readBody(req);
  const data = body ? JSON.parse(body) : {};
  const passwordPlain = (data.password && String(data.password).trim()) || generatePassword();
  const { salt, hash } = hashPassword(passwordPlain);
  t.passwordSalt = salt;
  t.passwordHash = hash;
  saveTenants(tenants);
  sendJson(res, 200, { passwordPlain });
}

function handleTenantByCode(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const code = url.searchParams.get("code") || "";
  const t = tenants.find(t => t.accessCode === code);
  if (!t) { sendJson(res, 404, { error: "Código no válido." }); return; }
  const active = isTenantActive(t);
  if (t.passwordHash) {
    sendJson(res, 200, { requiresPassword: true, companyName: t.companyName, active });
    return;
  }
  sendJson(res, 200, { ...publicTenant(t), active });
}

function handleGetSellers(req, res) {
  if (!requireAdmin(req, res)) return;
  sendJson(res, 200, sellers.map(publicSeller));
}

async function handleCreateSeller(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  const data = body ? JSON.parse(body) : {};
  const passwordPlain = (data.password && String(data.password).trim()) || generatePassword();
  const { salt, hash } = hashPassword(passwordPlain);
  const seller = {
    id: crypto.randomUUID(),
    name: data.name || "Vendedor",
    company: data.company || "",
    phone: data.phone || "",
    email: data.email || "",
    accessCode: makeSellerCode(data.name || data.company || "vendedor"),
    passwordSalt: salt,
    passwordHash: hash,
    status: "active",
    notes: data.notes || "",
    theme: data.theme || {},
    businessProfile: data.businessProfile || {},
    createdAt: todayIso()
  };
  sellers.push(seller);
  saveSellers(sellers);
  sendJson(res, 201, { ...publicSeller(seller), passwordPlain });
}

async function handleUpdateSeller(req, res, id) {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  const data = body ? JSON.parse(body) : {};
  delete data.passwordHash; delete data.passwordSalt; // hash siempre se deriva de data.password, nunca se acepta directo
  const s = sellers.find(s => s.id === id);
  if (!s) { sendJson(res, 404, { error: "No encontrado." }); return; }
  let passwordPlain;
  if (data.password && String(data.password).trim()) {
    passwordPlain = String(data.password).trim();
    const { salt, hash } = hashPassword(passwordPlain);
    s.passwordSalt = salt;
    s.passwordHash = hash;
  }
  delete data.password;
  Object.assign(s, data, { id });
  saveSellers(sellers);
  sendJson(res, 200, passwordPlain ? { ...publicSeller(s), passwordPlain } : publicSeller(s));
}

function handleToggleSeller(req, res, id) {
  if (!requireAdmin(req, res)) return;
  const s = sellers.find(s => s.id === id);
  if (!s) { sendJson(res, 404, { error: "No encontrado." }); return; }
  s.status = s.status === "active" ? "suspended" : "active";
  saveSellers(sellers);
  sendJson(res, 200, publicSeller(s));
}

async function handleSetSellerPassword(req, res, id) {
  if (!requireAdmin(req, res)) return;
  const s = sellers.find(s => s.id === id);
  if (!s) { sendJson(res, 404, { error: "No encontrado." }); return; }
  const body = await readBody(req);
  const data = body ? JSON.parse(body) : {};
  const passwordPlain = (data.password && String(data.password).trim()) || generatePassword();
  const { salt, hash } = hashPassword(passwordPlain);
  s.passwordSalt = salt;
  s.passwordHash = hash;
  saveSellers(sellers);
  sendJson(res, 200, { passwordPlain });
}

function handleDeleteSeller(req, res, id) {
  if (!requireAdmin(req, res)) return;
  const idx = sellers.findIndex(s => s.id === id);
  if (idx === -1) { sendJson(res, 404, { error: "No encontrado." }); return; }
  sellers.splice(idx, 1);
  saveSellers(sellers);
  sendJson(res, 200, { ok: true });
}

function handleSellerByCode(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const code = url.searchParams.get("code") || "";
  const s = sellers.find(s => s.accessCode === code);
  if (!s) { sendJson(res, 404, { error: "Código no válido." }); return; }
  if (s.passwordHash) { sendJson(res, 200, { requiresPassword: true, name: s.name, company: s.company }); return; }
  sendJson(res, 200, publicSeller(s));
}

async function handleCreateHandoff(req, res) {
  const identity = getCallerIdentity(req);
  if (!identity) { sendJson(res, 401, { error: "No autorizado." }); return; }
  const body = await readBody(req);
  const data = body ? JSON.parse(body) : {};
  const tenant = identity.role === "ebanista" ? tenants.find(t => t.id === identity.tenantId) : null;
  const ebanistaTenantId = identity.role === "ebanista" ? identity.tenantId : (data.ebanistaTenantId || null);
  if (!ebanistaTenantId) { sendJson(res, 400, { error: "Falta el ebanista del envío." }); return; }
  const authorName = identity.role === "ebanista"
    ? (tenant?.companyName || "Ebanista")
    : (sellers.find(s => s.id === identity.sellerId)?.name || "Vendedor");
  const now = new Date().toISOString();
  const handoff = {
    id: crypto.randomUUID(),
    type: data.type === "quote" ? "quote" : "cuts",
    status: "pending",
    routing: {
      mode: data.routing?.mode === "direct" ? "direct" : "pool",
      sellerId: data.routing?.mode === "direct" ? (data.routing.sellerId || null) : null,
      claimedBySellerId: null
    },
    ebanistaTenantId,
    ebanistaCompanyName: identity.role === "ebanista" ? (tenant?.companyName || "") : (data.ebanistaCompanyName || ""),
    createdAt: now,
    updatedAt: now,
    messages: [{
      id: crypto.randomUUID(),
      from: identity.role === "ebanista" ? "ebanista" : "vendedor",
      authorId: identity.role === "ebanista" ? identity.tenantId : identity.sellerId,
      authorName,
      createdAt: now,
      note: data.note || "",
      payload: data.payload || {}
    }]
  };
  handoffs.push(handoff);
  saveHandoffs(handoffs);
  sendJson(res, 201, handoff);
}

function handleListHandoffs(req, res) {
  const identity = getCallerIdentity(req);
  if (!identity) { sendJson(res, 401, { error: "No autorizado." }); return; }
  sendJson(res, 200, handoffs.filter(h => canSeeHandoff(h, identity) && h.status !== "closed"));
}

function handleGetHandoff(req, res, id) {
  const identity = getCallerIdentity(req);
  if (!identity) { sendJson(res, 401, { error: "No autorizado." }); return; }
  const h = handoffs.find(h => h.id === id);
  if (!h || !canSeeHandoff(h, identity)) { sendJson(res, 404, { error: "No encontrado." }); return; }
  sendJson(res, 200, h);
}

function handleClaimHandoff(req, res, id) {
  const identity = getCallerIdentity(req);
  if (!identity || identity.role !== "vendedor") { sendJson(res, 401, { error: "Solo vendedores pueden reclamar envíos." }); return; }
  const h = handoffs.find(h => h.id === id);
  if (!h) { sendJson(res, 404, { error: "No encontrado." }); return; }
  if (h.routing.mode !== "pool" || h.routing.claimedBySellerId !== null) {
    sendJson(res, 409, { error: "Ya fue reclamado por otro vendedor." });
    return;
  }
  h.routing.claimedBySellerId = identity.sellerId;
  h.status = "claimed";
  h.updatedAt = new Date().toISOString();
  saveHandoffs(handoffs);
  sendJson(res, 200, h);
}

async function handleAddHandoffMessage(req, res, id) {
  const identity = getCallerIdentity(req);
  if (!identity) { sendJson(res, 401, { error: "No autorizado." }); return; }
  const h = handoffs.find(h => h.id === id);
  if (!h || !canSeeHandoff(h, identity)) { sendJson(res, 404, { error: "No encontrado." }); return; }
  const body = await readBody(req);
  const data = body ? JSON.parse(body) : {};
  const authorName = identity.role === "ebanista"
    ? (tenants.find(t => t.id === identity.tenantId)?.companyName || "Ebanista")
    : (sellers.find(s => s.id === identity.sellerId)?.name || "Vendedor");
  h.messages.push({
    id: crypto.randomUUID(),
    from: identity.role === "ebanista" ? "ebanista" : "vendedor",
    authorId: identity.role === "ebanista" ? identity.tenantId : identity.sellerId,
    authorName,
    createdAt: new Date().toISOString(),
    note: data.note || "",
    payload: data.payload || {}
  });
  h.status = identity.role === "vendedor" ? "responded" : "pending";
  h.updatedAt = new Date().toISOString();
  saveHandoffs(handoffs);
  sendJson(res, 200, h);
}

function handleCloseHandoff(req, res, id) {
  const identity = getCallerIdentity(req);
  if (!identity) { sendJson(res, 401, { error: "No autorizado." }); return; }
  const h = handoffs.find(h => h.id === id);
  if (!h || !canSeeHandoff(h, identity)) { sendJson(res, 404, { error: "No encontrado." }); return; }
  h.status = "closed";
  h.updatedAt = new Date().toISOString();
  saveHandoffs(handoffs);
  sendJson(res, 200, h);
}

function handleListSellersActive(req, res) {
  const identity = getCallerIdentity(req);
  if (!identity) { sendJson(res, 401, { error: "No autorizado." }); return; }
  sendJson(res, 200, sellers.filter(s => s.status === "active").map(s => ({ id: s.id, name: s.name, company: s.company })));
}

function handleListTenantsActive(req, res) {
  const identity = getCallerIdentity(req);
  if (!identity) { sendJson(res, 401, { error: "No autorizado." }); return; }
  sendJson(res, 200, tenants.filter(isTenantActive).map(t => ({ id: t.id, companyName: t.companyName })));
}

function handleTenantAccess(req, res, id) {
  const t = tenants.find(t => t.id === id);
  if (!t) { sendJson(res, 404, { error: "No encontrado." }); return; }
  const active = isTenantActive(t);
  sendJson(res, 200, {
    allowed: active,
    reason: active ? "Cuenta activa" : t.status === "suspended" ? "Cuenta suspendida" : "Suscripción vencida"
  });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(rootDir, pathname));
  if (!filePath.startsWith(rootDir)) { res.writeHead(403); res.end("Forbidden"); return; }
  try {
    const file = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(file);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}

// ── Main router ─────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = url.pathname;
    const parts = p.split("/").filter(Boolean);
    const method = req.method;

    // CORS preflight
    if (method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type,Authorization", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS" }); res.end(); return; }

    // Health
    if (method === "GET" && p === "/api/health") {
      const keySet = Boolean(process.env.OPENAI_API_KEY);
      console.log(`[health] openaiConfigured=${keySet}, model=${model}, tenants=${tenants.length}`);
      sendJson(res, 200, {
        openaiConfigured: keySet,
        hfConfigured: Boolean(process.env.HF_TOKEN),
        model,
        adminPasswordSet: ADMIN_PASSWORD !== "admin1234",
        tenantsCount: tenants.length,
        apiEndpoint: "chat/completions",
        build: "2026-06-05-v37"
      });
      return;
    }

    // AI
    if (method === "POST" && p === "/api/ebanista-ai")     { await handleAi(req, res); return; }
    if (method === "POST" && p === "/api/analyze-space")   { await handleSpaceAnalysis(req, res); return; }
    if (method === "POST" && p === "/api/generate-image")  { await handleGenerateImage(req, res); return; }

    // Auth
    if (method === "POST" && p === "/api/auth/admin")  { await handleAuthAdmin(req, res); return; }
    if (method === "GET"  && p === "/api/auth/check")  { handleAuthCheck(req, res); return; }
    if (method === "POST" && p === "/api/auth/logout") { await handleAuthLogout(req, res); return; }
    if (method === "POST" && p === "/api/auth/ebanista")        { await handleAuthEbanista(req, res); return; }
    if (method === "GET"  && p === "/api/auth/ebanista/check")  { handleAuthEbanistaCheck(req, res); return; }
    if (method === "POST" && p === "/api/auth/ebanista/logout") { await handleAuthEbanistaLogout(req, res); return; }
    if (method === "POST" && p === "/api/auth/seller")        { await handleAuthSeller(req, res); return; }
    if (method === "GET"  && p === "/api/auth/seller/check")  { handleAuthSellerCheck(req, res); return; }
    if (method === "POST" && p === "/api/auth/seller/logout") { await handleAuthSellerLogout(req, res); return; }

    // Prices (GET public, PUT admin)
    if (method === "GET" && p === "/api/prices") { sendJson(res, 200, prices); return; }
    if (method === "PUT" && p === "/api/admin/prices") {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      const incoming = body ? JSON.parse(body) : {};
      prices = { ...defaultPrices(), ...incoming };
      savePrices(prices);
      sendJson(res, 200, prices);
      return;
    }

    // Ebanista updates their own prices (auth by access code, no admin token needed)
    if (method === "PUT" && p === "/api/ebanista-prices") {
      const body = await readBody(req);
      const { code, prices: incoming } = body ? JSON.parse(body) : {};
      const tenant = tenants.find(t => t.accessCode === code);
      if (!tenant) { sendJson(res, 401, { error: "Código inválido" }); return; }
      tenant.prices = { ...(tenant.prices || {}), ...incoming };
      saveTenants(tenants);
      sendJson(res, 200, { ok: true });
      return;
    }

    // Tenant by code (public)
    if (method === "GET" && p === "/api/tenant-by-code") { handleTenantByCode(req, res); return; }
    if (method === "GET" && p === "/api/seller-by-code") { handleSellerByCode(req, res); return; }

    // Seller self-service (must come before the generic /api/sellers/:id block)
    if (method === "GET" && p === "/api/sellers/me")          { handleSellerSelf(req, res); return; }
    if (method === "PUT" && p === "/api/sellers/me/password") { await handleSellerSelfPassword(req, res); return; }
    if (method === "GET" && p === "/api/sellers/active")      { handleListSellersActive(req, res); return; }
    if (method === "GET" && p === "/api/tenants/active")      { handleListTenantsActive(req, res); return; }

    // Handoffs (envíos ebanista ↔ vendedor)
    if (method === "POST" && p === "/api/handoffs") { await handleCreateHandoff(req, res); return; }
    if (method === "GET"  && p === "/api/handoffs") { handleListHandoffs(req, res); return; }
    if (parts[0] === "api" && parts[1] === "handoffs" && parts[2]) {
      const hid = parts[2];
      const haction = parts[3];
      if (method === "GET"  && !haction)               { handleGetHandoff(req, res, hid); return; }
      if (method === "POST" && haction === "claim")    { handleClaimHandoff(req, res, hid); return; }
      if (method === "POST" && haction === "messages") { await handleAddHandoffMessage(req, res, hid); return; }
      if (method === "POST" && haction === "close")    { handleCloseHandoff(req, res, hid); return; }
    }

    // Sellers (admin)
    if (method === "GET"  && p === "/api/sellers") { handleGetSellers(req, res); return; }
    if (method === "POST" && p === "/api/sellers") { await handleCreateSeller(req, res); return; }

    if (parts[0] === "api" && parts[1] === "sellers" && parts[2]) {
      const sellerId = parts[2];
      const sellerAction = parts[3];
      if (method === "PUT"    && !sellerAction) { await handleUpdateSeller(req, res, sellerId); return; }
      if (method === "DELETE" && !sellerAction) { handleDeleteSeller(req, res, sellerId); return; }
      if (method === "POST" && sellerAction === "toggle")       { handleToggleSeller(req, res, sellerId); return; }
      if (method === "POST" && sellerAction === "set-password") { await handleSetSellerPassword(req, res, sellerId); return; }
    }

    // Tenants (admin)
    if (method === "GET"  && p === "/api/tenants") { handleGetTenants(req, res); return; }
    if (method === "POST" && p === "/api/tenants") { await handleCreateTenant(req, res); return; }

    if (parts[0] === "api" && parts[1] === "tenants" && parts[2]) {
      const id = parts[2];
      const action = parts[3];
      if (method === "PUT"  && !action) { await handleUpdateTenant(req, res, id); return; }
      if (method === "POST" && action === "toggle")          { handleToggleTenant(req, res, id); return; }
      if (method === "POST" && action === "renew30")         { handleRenewTenant(req, res, id, 30); return; }
      if (method === "POST" && action === "renew365")        { handleRenewTenant(req, res, id, 365); return; }
      if (method === "POST" && action === "regenerate-code") { handleRegenerateCode(req, res, id); return; }
      if (method === "POST" && action === "set-password")    { await handleSetTenantPassword(req, res, id); return; }
      if (method === "GET"  && action === "access")          { handleTenantAccess(req, res, id); return; }
    }

    await serveStatic(req, res);
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Error interno" });
  }
});

server.listen(port, () => {
  console.log(`\n🪚  Agente Ebanistas SaaS — http://localhost:${port}`);
  console.log(`   Admin password  : ${ADMIN_PASSWORD === "admin1234" ? "admin1234 (⚠ cambia con ADMIN_PASSWORD=xxx)" : "configurada ✓"}`);
  console.log(`   OpenAI          : ${process.env.OPENAI_API_KEY ? "activo ✓" : "no configurado (modo local)"}`);
  console.log(`   Ebanistas       : ${tenants.length} registrados\n`);
  tenants.forEach(t => console.log(`   • ${t.companyName.padEnd(30)} código: ${t.accessCode}  [${t.status}]`));
  console.log();
});
