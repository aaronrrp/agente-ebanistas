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
      plan: "Pro",
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
      plan: "Básico",
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
Eres un agente ebanista experto para empresas de muebles a la medida en América Latina.
Especialidad: melamina hidrófuga, muebles de cocina, closets, vanities, centros de entretenimiento, cortes, cantos, bisagras, correderas y jaladores.

Debes convertir instrucciones, fotos o bocetos en una propuesta técnica editable.
Si faltan datos, infiere valores razonables y explica la suposición en assistantText.

══ REGLAS DE RESPUESTA ══
- SIEMPRE responde con JSON válido, sin excepción. NUNCA respondas con texto plano.
- NUNCA digas "no puedo", "lo siento" ni "no es posible" — siempre propón algo.
- NUNCA digas que un mueble "no está disponible", "no hay stock", "estamos esperando material" ni nada similar. Somos fabricantes a medida: SIEMPRE podemos fabricar cualquier mueble pedido con los materiales que tenemos.
- Si el usuario pregunta por qué algo "no está disponible" o "no funciona", se refiere al render visual (un servicio externo lento). Responde brevemente: "El render tarda unos segundos en generarse, intenta pedirlo de nuevo." y vuelve a proponer el mueble.
- Si el usuario pide "imagen", "render", "foto real", "realista" o similar: describe el mueble en assistantText y rellena designPrompt con el prompt en inglés para generar el render visual (otra herramienta lo procesa automáticamente, tú no generas la imagen).
- Si hay un mueble previo en currentItem, úsalo como base para la respuesta.

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
    "width": 120, "height": 90, "depth": 55,
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
  "designPrompt": "English prompt under 800 chars for a photorealistic interior design render. Include: exact furniture description, melamine color, dimensions, beautiful aesthetic room background with soft warm lighting, lifestyle photography style, high-end interior design magazine quality, 4K render. Always generate this field — never leave it null."
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
  // Convert from internal input_text/input_image format to Chat Completions format
  const messages = [
    { role: "system", content: sysPrompt },
    { role: "user", content: userContent.map(c => {
      if (c.type === "input_text") return { type: "text", text: c.text };
      if (c.type === "input_image") return {
        type: "image_url",
        image_url: { url: c.image_url, detail: c.detail || "high" }
      };
      return c;
    })}
  ];

  const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: 2000 })
  });
  const data = await apiRes.json();
  if (!apiRes.ok) {
    console.error("[callOpenAI] error response:", JSON.stringify(data));
    throw new Error(data.error?.message || `OpenAI ${apiRes.status}`);
  }
  const text = data.choices?.[0]?.message?.content || "";
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
  const content = [{
    type: "input_text",
    text: JSON.stringify({ message: payload.message || "", tenant: payload.tenant || {}, currentItem: payload.currentItem || null })
  }];
  if (typeof payload.imageData === "string" && payload.imageData.startsWith("data:image/")) {
    content.push({ type: "input_image", image_url: payload.imageData, detail: "high" });
  }
  try {
    const parsed = await callOpenAI(systemPrompt + pricesBlock, content);
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
// Orden: DALL-E (si está disponible) → Hugging Face (HF_TOKEN) → error
async function handleGenerateImage(req, res) {
  const body = await readBody(req);
  const { prompt } = body ? JSON.parse(body) : {};
  if (!prompt) { sendJson(res, 400, { error: "Se requiere prompt." }); return; }

  // 1. DALL-E si hay clave OpenAI con acceso a imágenes
  if (process.env.OPENAI_API_KEY) {
    for (const cfg of [{ model: "dall-e-3", size: "1024x1024" }, { model: "dall-e-2", size: "512x512" }]) {
      try {
        const apiRes = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: cfg.model, prompt: prompt.slice(0, 900), n: 1, size: cfg.size })
        });
        const data = await apiRes.json();
        if (apiRes.ok && data.data?.[0]?.url) {
          sendJson(res, 200, { imageUrl: data.data[0].url, source: cfg.model });
          return;
        }
        const err = data.error?.message || "";
        if (err.includes("does not exist") || err.includes("billing") || err.includes("quota") || apiRes.status === 404) continue;
        break;
      } catch { /* try next */ }
    }
  }

  // 2. Hugging Face Inference API (gratis con HF_TOKEN)
  if (process.env.HF_TOKEN) {
    const hfPrompt = `${prompt.slice(0, 450)}, photorealistic interior design render, high quality, 4k`;
    // Models ordered: fastest first. FLUX-schnell = 4 steps, very fast.
    const hfModels = [
      { url: "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell", w: 512, h: 512, steps: 4 },
      { url: "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1", w: 768, h: 768, steps: 20 },
    ];
    for (const hfCfg of hfModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const modelName = hfCfg.url.split("/").slice(-1)[0];
          console.log(`[HF] model=${modelName} attempt=${attempt+1}`);
          const hfRes = await fetch(hfCfg.url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.HF_TOKEN}`,
              "Content-Type": "application/json",
              "x-wait-for-model": "true"
            },
            body: JSON.stringify({ inputs: hfPrompt, parameters: { num_inference_steps: hfCfg.steps, width: hfCfg.w, height: hfCfg.h } }),
            signal: AbortSignal.timeout(120000)
          });
          const ct = hfRes.headers.get("content-type") || "";
          console.log(`[HF] status=${hfRes.status} ct=${ct}`);
          if (hfRes.ok && ct.startsWith("image/")) {
            const buf = await hfRes.arrayBuffer();
            const b64 = Buffer.from(buf).toString("base64");
            sendJson(res, 200, { imageUrl: `data:${ct};base64,${b64}`, source: "huggingface" });
            return;
          }
          try {
            const errText = await hfRes.text();
            console.log(`[HF] error body: ${errText.slice(0, 300)}`);
            const errData = JSON.parse(errText);
            if (hfRes.status === 503 && errData.estimated_time) {
              const wait = Math.min(Number(errData.estimated_time) * 1000, 20000);
              console.log(`[HF] model loading, waiting ${wait}ms`);
              await new Promise(r => setTimeout(r, wait));
              continue;
            }
          } catch {}
          break;
        } catch (e) {
          console.log(`[HF] exception: ${e.message}`);
          break;
        }
      }
    }
    // HF failed — tell client to try Pollinations directly from their browser
    sendJson(res, 503, { error: "Servidor de renders ocupado.", pollinations: true });
    return;
  }

  sendJson(res, 503, { error: "Configura HF_TOKEN en Render para activar los renders (gratis en huggingface.co)." });
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
        build: "2026-06-03-v10"
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
