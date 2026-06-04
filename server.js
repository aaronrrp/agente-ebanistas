const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { readFile } = require("node:fs/promises");

const rootDir = __dirname;
const port = Number(process.env.PORT || 5174);
const model = process.env.OPENAI_MODEL || "gpt-4o";
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

const allowedActions = ["fill_form", "add_to_quote", "calculate_cuts", "enhance_image", "mock_3d"];

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

function makeStableId(seed) {
  const h = crypto.createHash("sha256").update(seed).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

function defaultTenants() {
  // IDs and codes are stable (deterministic) — survive redeploys
  return [
    {
      id: makeStableId("muebles-rivera-default"),
      companyName: "Muebles Rivera",
      contactName: "Luis Rivera",
      phone: "+507 6000-0001",
      email: "ventas@mueblesrivera.com",
      monthlyFee: 35,
      status: "active",
      expiresAt: "2027-01-01",
      margin: 35,
      installBase: 85,
      transportBase: 35,
      materials: "Melamina hidrófuga RH blanca, nogal y gris; canto PVC; bisagras cierre suave; correderas telescópicas.",
      terms: "60% para iniciar fabricación y 40% contra entrega. La cotización puede variar si cambian medidas o materiales.",
      accessCode: makeCode("Muebles Rivera"),
      catalog: { furnitureTypes: [], edgeOptions: [], hingeOptions: [], slideOptions: [], handleOptions: [] }
    },
    {
      id: makeStableId("ebanisteria-cedro-default"),
      companyName: "Ebanistería El Cedro",
      contactName: "María Santos",
      phone: "+507 6000-0002",
      email: "cotizaciones@elcedro.com",
      monthlyFee: 25,
      status: "active",
      expiresAt: "2027-01-01",
      margin: 28,
      installBase: 70,
      transportBase: 25,
      materials: "Melamina hidrófuga blanca, gris y madera clara. Herrajes estándar.",
      terms: "50% de abono inicial y 50% al finalizar.",
      accessCode: makeCode("Ebanistería El Cedro"),
      catalog: { furnitureTypes: [], edgeOptions: [], hingeOptions: [], slideOptions: [], handleOptions: [] }
    }
  ];
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
    transport_km: 0.50    // Transporte por km adicional
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

Responde SOLO JSON válido:
{
  "assistantText": "2–3 oraciones directas en español, tono de WhatsApp entre ebanista y cliente. NUNCA uses 'Estimado', NUNCA firmes, NUNCA escribas como carta formal. Ejemplo: 'Te propongo un closet de melamina blanca 200×60×55 cm con 4 puertas de cierre suave Blum. Incluye 2 repisas internas y canto PVC. Precio aprox $480 USD.'",
  "actions": ["fill_form"],
  "item": {
    "name": "Mueble propuesto",
    "furnitureType": "Cocina|Closet|Vanity|Centro de entretenimiento|Mueble de lavandería|Escritorio|Otro",
    "dimensionBasis": "external|internal",
    "width": 0, "height": 0, "depth": 0,
    "complexityKey": "low|medium|high|premium",
    "doors": 2, "drawers": 0, "shelves": 1,
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
  },
  "designPrompt": null
}
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
  return {
    source: "openai",
    assistantText: payload?.assistantText || fallback || "Propuesta generada.",
    actions: actions.length ? actions : ["fill_form"],
    item: payload?.item || null,
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
    throw new Error(data.error?.message || `OpenAI ${apiRes.status}`);
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

async function handleAi(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    sendJson(res, 503, { error: "OPENAI_API_KEY no configurada. Usando modo local." });
    return;
  }
  const body = await readBody(req);
  const payload = body ? JSON.parse(body) : {};
  const pricesBlock = `\n══ PRECIOS ACTUALES (en USD) ══\nLámina melamina estándar 2440×1220: $${prices.melamina_std}\nLámina melamina grande 2750×1830: $${prices.melamina_lg}\nCanto PVC 22mm/metro: $${prices.canto_pvc}\nCanto grueso 2mm/metro: $${prices.canto_grueso}\nFondo/backing por m²: $${prices.backing_m2}\nBisagra estándar: $${prices.bisagra_std}/un\nBisagra cierre suave: $${prices.bisagra_sc}/un\nCorredera estándar: $${prices.corredera_std}/par\nCorredera cierre suave: $${prices.corredera_sc}/par\nJalador 128mm: $${prices.jalador_chico}/un\nJalador 320mm: $${prices.jalador_grande}/un\nJalador premium inox: $${prices.jalador_premium}/un\nInstalación: $${prices.install_hour}/hora\nTransporte base: $${prices.transport_base}`;

  // Build conversation history context block
  const history = Array.isArray(payload.history) ? payload.history.slice(-12) : [];
  let historyBlock = "";
  if (history.length > 0) {
    const lines = history.map(h =>
      `${h.role === "user" ? "Usuario" : "Asistente"}: ${String(h.text || "").slice(0, 500)}`
    ).join("\n");
    historyBlock = `\n\n══ CONVERSACIÓN ANTERIOR (contexto) ══\n${lines}\n══ FIN CONTEXTO ══`;
  }

  const content = [{
    type: "input_text",
    text: JSON.stringify({ message: payload.message || "", tenant: payload.tenant || {}, currentItem: payload.currentItem || null })
  }];
  if (typeof payload.imageData === "string" && payload.imageData.startsWith("data:image/")) {
    content.push({ type: "input_image", image_url: payload.imageData });
  }
  try {
    const parsed = await callOpenAI(systemPrompt + pricesBlock + historyBlock, content);
    sendJson(res, 200, normalizeAi(parsed, parsed?.assistantText));
  } catch (e) {
    sendJson(res, 500, { error: e.message });
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
    sendJson(res, 500, { error: e.message });
  }
}

// ── Image generation ────────────────────────────────────────────────────────
// Orden: Together.ai FLUX (rápido, gratis) → DALL-E → Pollinations (cliente)
async function handleGenerateImage(req, res) {
  const body = await readBody(req);
  const { prompt } = body ? JSON.parse(body) : {};
  if (!prompt) { sendJson(res, 400, { error: "Se requiere prompt." }); return; }

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
        sendJson(res, 200, { imageUrl: `data:image/jpeg;base64,${cfData.result.image}`, source: "cloudflare-flux" });
        return;
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
        sendJson(res, 200, { imageUrl: td.data[0].url, source: "together-flux" });
        return;
      }
    } catch (e) { console.log(`[Together] exception: ${e.message}`); }
  }

  // 3. DALL-E (si la cuenta tiene acceso a imagen)
  if (process.env.OPENAI_API_KEY) {
    for (const cfg of [{ model: "dall-e-3", size: "1024x1024" }, { model: "dall-e-2", size: "512x512" }]) {
      try {
        console.log(`[DALLE] trying ${cfg.model}...`);
        const ar = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: cfg.model, prompt: prompt.slice(0, 900), n: 1, size: cfg.size }),
          signal: AbortSignal.timeout(45000)
        });
        const ad = await ar.json();
        console.log(`[DALLE] ${cfg.model} → status=${ar.status} err="${ad.error?.message || "ok"}"`);
        if (ar.ok && ad.data?.[0]?.url) {
          sendJson(res, 200, { imageUrl: ad.data[0].url, source: cfg.model });
          return;
        }
      } catch (e) { console.log(`[DALLE] exception: ${e.message}`); }
    }
  }

  // 4. Fallback: Pollinations desde el navegador del cliente (diferente IP)
  sendJson(res, 503, { error: "Servidor de renders ocupado.", pollinations: true });
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

function handleGetTenants(req, res) {
  if (!requireAdmin(req, res)) return;
  sendJson(res, 200, tenants.map(t => ({
    id: t.id, companyName: t.companyName, contactName: t.contactName,
    phone: t.phone, email: t.email, plan: t.plan, status: t.status,
    expiresAt: t.expiresAt, margin: t.margin, accessCode: t.accessCode,
    active: isTenantActive(t)
  })));
}

async function handleCreateTenant(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  const data = body ? JSON.parse(body) : {};
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
    catalog: data.catalog || { furnitureTypes: [], edgeOptions: [], hingeOptions: [], slideOptions: [], handleOptions: [] }
  };
  tenants.push(tenant);
  saveTenants(tenants);
  sendJson(res, 201, tenant);
}

async function handleUpdateTenant(req, res, id) {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  const data = body ? JSON.parse(body) : {};
  const idx = tenants.findIndex(t => t.id === id);
  if (idx === -1) {
    // Upsert: tenant was cleared by redeploy, recreate it
    const tenant = { ...data, id };
    if (!tenant.accessCode) tenant.accessCode = makeCode(tenant.companyName || "ebanista");
    tenants.push(tenant);
    saveTenants(tenants);
    sendJson(res, 200, tenant);
    return;
  }
  tenants[idx] = { ...tenants[idx], ...data, id };
  saveTenants(tenants);
  sendJson(res, 200, tenants[idx]);
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

function handleTenantByCode(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const code = url.searchParams.get("code") || "";
  const t = tenants.find(t => t.accessCode === code);
  if (!t) { sendJson(res, 404, { error: "Código no válido." }); return; }
  const active = isTenantActive(t);
  sendJson(res, 200, { ...t, active });
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
        build: "2026-06-04-v21"
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

    // Tenant by code (public)
    if (method === "GET" && p === "/api/tenant-by-code") { handleTenantByCode(req, res); return; }

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
