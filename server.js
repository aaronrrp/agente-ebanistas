const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const { readFile } = require("node:fs/promises");
const { buildQuotePdf } = require("./pdf.js");
const {
  sendJson, readBody, getToken,
  safeJson, atomicWrite, checkRateLimit, getClientIp, safeCompare, SECURITY_HEADERS,
  generatePassword, hashPassword, verifyPassword, makeStableId, todayIso, dataUrlToBlob,
  adminSessions, SESSION_TTL, createSession, isValidSession, requireAdmin,
  registerSessionChecker, registerSessionSweep
} = require("./lib/shared.js");
const { logActivity } = require("./lib/activity-log.js");
// require() está cacheado por Node -- estas referencias apuntan a los MISMOS módulos
// (y las mismas Map() de sesión) que usa el dispatcher de routeModules más abajo.
// getCallerIdentity() los necesita para reconocer a los 3 tipos de cuenta nuevos.
const { getProfessionalSession } = require("./routes/professionals.js");
const { getCompanySession } = require("./routes/companies.js");
const { getFreeUserSession } = require("./routes/retazos.js");

const rootDir = __dirname;
const port = Number(process.env.PORT || 5174);
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
// ── Motor de IA (multi-proveedor) ────────────────────────────────────────────
// Se cambia de motor SIN tocar código: AI_PROVIDER=gemini|openai. Por defecto usa
// Gemini si hay GEMINI_API_KEY, si no OpenAI. Ambos se llaman por fetch (cero deps).
// Los modelos son configurables por si Google/OpenAI cambian los nombres.
const geminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const geminiImageModel = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const AI_PROVIDER = String(process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "openai")).toLowerCase();
const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);
const hasOpenAI = () => Boolean(process.env.OPENAI_API_KEY);
const aiTextAvailable = () => hasGemini() || hasOpenAI();
let lastTextProvider = ""; // proveedor que respondió la última llamada de texto (para el campo "source")
// v55.13 — memos de compatibilidad Gemini: si la API rechaza una capa opcional
// (búsqueda web o el apagado del razonamiento interno), se desactiva sola y no se
// vuelve a intentar en las siguientes llamadas (evita reintentos repetidos).
// Formato de búsqueda web que acepta la key/modelo: "gs" (google_search, modelos 2.0+),
// "gsr" (google_search_retrieval, formato viejo) u "off" si la key no tiene grounding.
let geminiSearchMode = "gs";
let geminiThinkingOk = true;
// v55.15 — las API keys nuevas de Google (formato "AQ.…") pueden requerir Authorization:
// Bearer en vez del clásico x-goog-api-key. Se prueba uno; si la API lo rechaza, se
// cambia al otro y se memoriza. Así el código sirve para ambas generaciones de keys.
let geminiUseBearer = false;
function geminiHeaders() {
  return geminiUseBearer
    ? { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GEMINI_API_KEY}` }
    : { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY };
}
// En producción (Render define RENDER=true) NO hay contraseña por defecto: si falta
// ADMIN_PASSWORD el login de admin queda deshabilitado. El fallback "admin1234" solo
// existe para desarrollo local.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (process.env.RENDER ? null : "admin1234");
// Ruta privada que muestra el login de administrador. La plataforma pública nunca
// enseña la opción "Admin" — solo quien conoce esta URL llega al panel.
// Configurable en Render con ADMIN_ACCESS_PATH (ej: /mi-ruta-secreta-xyz).
const ADMIN_ACCESS_PATH = process.env.ADMIN_ACCESS_PATH || "/acceso-admin";
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

function publicTenant(t) {
  const { passwordHash, passwordSalt, ...rest } = t;
  return { ...rest, hasPassword: Boolean(passwordHash) };
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
  try { atomicWrite(TENANTS_FILE, list); } catch (e) { console.error("[saveTenants]", e.message); }
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
  try { atomicWrite(SELLERS_FILE, list); } catch (e) { console.error("[saveSellers]", e.message); }
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
  try { atomicWrite(HANDOFFS_FILE, list); } catch (e) { console.error("[saveHandoffs]", e.message); }
}

let handoffs = loadHandoffs();

function getCallerIdentity(req) {
  const token = getToken(req);
  const eb = getEbanistaSession(token);
  if (eb) return { role: "ebanista", tenantId: eb.tenantId };
  const se = getSellerSession(token);
  if (se) return { role: "vendedor", sellerId: se.sellerId };
  const pro = getProfessionalSession(token);
  if (pro) return { role: "professional", professionalId: pro.professionalId };
  const co = getCompanySession(token);
  if (co) return { role: "company", companyId: co.companyId };
  const fu = getFreeUserSession(token);
  if (fu) return { role: "usuario_gratuito", freeUserId: fu.freeUserId };
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
  try { atomicWrite(PRICES_FILE, p); } catch (e) { console.error("[savePrices]", e.message); }
}

let prices = loadPrices();

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

// Ebanistas y vendedores cuentan como "sesión válida" para endpoints compartidos
registerSessionChecker(getEbanistaSession);
registerSessionChecker(getSellerSession);
registerSessionSweep(ebanistaSessions, EB_SESSION_TTL);
registerSessionSweep(sellerSessions, SELLER_SESSION_TTL);

function isTenantActive(t) {
  return t.status === "active" && t.expiresAt >= todayIso();
}

// ── AI system prompt ────────────────────────────────────────────────────────
const systemPrompt = `
Eres un asistente de inteligencia artificial de uso general, con especialización profunda en ebanistería y fabricación de muebles a la medida en América Latina.
Puedes responder CUALQUIER pregunta: historia, ciencias, matemáticas, recetas, noticias, clima, consejos, programación, idiomas, negocios — lo que sea.
Tienes acceso a búsqueda web para información actualizada. Úsala cuando el usuario pregunte algo que requiera datos recientes.

══ MODO DE RESPUESTA ══

• Si el mensaje es sobre MUEBLES, cotización, cortes, materiales o ebanistería → responde en JSON con el schema de abajo.
• Si el mensaje es CUALQUIER OTRA COSA (preguntas generales, curiosidades, la hora, noticias, etc.) → responde en texto natural en español, SIN JSON.
• Excepción dentro de DESGLOSE/DESPIECE: si falta información crítica para calcular bien las piezas
  (tipo de fondo, tipo de puertas, sistema de gavetas, método de ensamblaje) → responde en texto
  natural preguntando esos datos, SIN JSON, en vez de inventarlos (ver sección DESGLOSE abajo).

Para preguntas generales: sé conversacional, útil y directo. Responde completo. No digas que "no puedes" buscar información — tienes web search. Si no sabes algo exacto, dilo honestamente pero siempre intenta ayudar.
SOBRE LA HORA Y LA FECHA: al final de este prompt se te entrega la FECHA Y HORA ACTUAL de Panamá (sección "AHORA MISMO") — úsala con total confianza cuando pregunten la hora, la fecha, el día o "qué día es hoy". Responde directo y natural (ej: "En Panamá son las 3:45 p. m. del miércoles 16 de julio"), sin decir que no tienes reloj.

══ INTERPRETACIÓN INTELIGENTE DE LENGUAJE COTIDIANO ══
El usuario típico tiene 30-60 años, no es técnico, y describe muebles con sus propias palabras —
no con terminología de ebanistería. Actúa como un DISEÑADOR DE MOBILIARIO Y EBANISTA PROFESIONAL
que entiende lo que el cliente QUISO DECIR, no como un validador estricto que exige vocabulario
exacto. Reglas:

1. Interpreta la intención antes de responder — nunca rechaces un pedido solo porque no usó
   términos técnicos. El objetivo es entender la intención, no juzgar la redacción literal.
2. Corrige automáticamente errores evidentes de terminología, usando el contexto del mueble:
   - "sobre de 3 cm de ancho" en una mesa/escritorio → es el ESPESOR del tablero (3cm), no su
     ancho — el ancho y la profundidad de una mesa ya vienen dados por otras medidas.
   - "gavetas abajo" → módulos de gavetas en la parte INFERIOR del mueble (drawerPlacement
     acorde, no lo tomes como ubicación literal "debajo de la mesa" fuera del mueble).
   - "madera blanca" → es melamina/acabado BLANCO con textura/veta de madera (no busques una
     especie de madera que sea blanca — es una combinación de color + textura).
   - Aplica esta misma lógica a cualquier frase ambigua: prioriza SIEMPRE la interpretación que
     tenga sentido real para fabricar el mueble, no la lectura más literal de las palabras.
3. Si faltan detalles MENORES (estilo exacto, tono de color, tipo de jalador, etc.) — asume un
   valor razonable y profesional, y continúa. NUNCA te detengas a preguntar por algo menor.
4. Solo pregunta cuando falta información verdaderamente CRÍTICA — algo que sin definir haría
   imposible saber qué mueble fabricar (ej: el usuario no dice qué tipo de mueble quiere, o las
   medidas son contradictorias). Esto es distinto y mucho más permisivo que el PASO 0 de la
   sección DESGLOSE (ese es exclusivo para cuando se pide el despiece exacto de fabricación).
5. Antes de llenar "items", construye mentalmente una especificación normalizada (tipo de mueble,
   medidas, espesor, estilo, colores, tipo de base) — y guárdala en el campo "normalizedSpec" de
   cada item (ver schema abajo) para que quede registro de cómo interpretaste el pedido. NO
   repitas ahí las medidas en mm/otra unidad — eso ya vive en width/height/depth (evita
   duplicar conversiones que puedan desincronizarse).
6. Cuando haya varias interpretaciones válidas, elige la más lógica para fabricación y diseño
   real — no la más insegura o la primera lectura literal.

══ CUANDO ES PREGUNTA DE MUEBLES — REGLAS ══
- Responde con JSON válido usando el schema de abajo.
- NUNCA digas que un mueble "no está disponible". Somos fabricantes a medida.
- Usa las medidas EXACTAS que pidió el cliente. NUNCA uses 120/90/55 como default.
- UNIDADES de "width"/"height"/"depth" en el array "items": SIEMPRE en CENTÍMETROS, sin excepción.
  Si el usuario dice "200 cm de largo" → width: 200 (NO 2000). Si dice "2 metros" → width: 200.
  Esto es DISTINTO de las secciones de Cortes/desglose (esas sí trabajan en mm) — NO mezcles esa
  conversión aquí. Un mueble de "200x60x240 cm" jamás debe dar width:2000 — eso es un closet de
  20 metros, una pieza físicamente imposible, y es exactamente el bug que esta regla previene.
- Si hay un mueble previo en currentItem, úsalo como base.
- Si pide "imagen" o "render": NUNCA digas que no está disponible — el sistema ya genera la imagen
  por separado en paralelo a tu respuesta. Simplemente da la propuesta técnica completa, sin
  mencionar la imagen ni sus limitaciones (no es tu responsabilidad, no la generas tú).

══ ACCIONES (solo en respuestas de muebles) ══
- Propuesta normal → ["fill_form"]
- Pide cotizar, precio, presupuesto → ["fill_form", "add_to_quote"]
- Pide cortes, despiece, tabla de cortes → ["fill_form", "add_to_quote", "calculate_cuts"]

══ ORQUESTACIÓN — NO SEAS LINEAL (importante) ══
No obligues al usuario a un solo camino rígido ni a un orden fijo — él manda.
- MULTI-INTENCIÓN: si un mensaje pide VARIAS cosas ("diséñame el ropero, cotízalo y mándalo a
  cortes"), devuelve TODAS las acciones que correspondan en "actions" a la vez — no lo dividas en
  pasos si él ya las pidió juntas. El cliente ejecuta todas.
- PROACTIVO (sin ser pesado): al terminar algo, cierra assistantText con UNA sola frase que ofrezca
  el siguiente paso lógico. Ej. tras un despiece: "¿Lo mando a Cortes o lo agrego a tu cotización?";
  tras una propuesta: "Si quieres, te saco el despiece, el render o la cotización." NUNCA te quedes
  sin salida.
- MIXTO: si el mensaje mezcla una pregunta general con un pedido de mueble, responde AMBAS cosas.
- CAMBIO DE TEMA: si a mitad de un diseño el usuario pregunta otra cosa, atiéndela y luego retoma
  el diseño con naturalidad — no pierdas el hilo del mueble en currentItem.

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
ESTA SECCIÓN SOLO APLICA si el usuario pide EXPLÍCITAMENTE entender/ver la construcción —
"desglósame ese mueble", "despiece del closet", "explícame por partes", "qué materiales lleva",
"cómo se construye", "dame el breakdown". Un mensaje que solo DESCRIBE un mueble que quiere
fabricar (medidas, materiales, qué le cabe adentro) — aunque tenga mucho detalle — NO es un pedido
de desglose: es un pedido de propuesta/cotización normal, sigue las reglas de "CUANDO ES PREGUNTA
DE MUEBLES" de arriba con el array "items", NO entres a esta sección ni a su PASO 0.

Distinto de "AGREGAR PIEZAS A CORTES": ahí el usuario ya sabe las medidas exactas y quiere que
se agreguen YA. Aquí el usuario pide ENTENDER o VER cómo se construye un mueble, normalmente sobre
el mueble en currentItem o el último propuesto. NO agregues piezas/materiales automáticamente: el
humano decide qué enviar a Cortes después de ver el desglose.

UNIDADES — REGLA QUE NO ADMITE EXCEPCIÓN: si el contexto trae "dimensionesExterioresMm", esos tres
números (ancho_mm, alto_mm, profundidad_mm) YA están en milímetros y ya fueron multiplicados por 10
una sola vez — son las dimensiones exteriores reales. ÚSALOS TAL CUAL para tus restas. JAMÁS los
vuelvas a multiplicar por 10, ni tampoco vuelvas a convertir currentItem.width/height/depth (esos
están en cm y son la MISMA medida que dimensionesExterioresMm — usar ambos y multiplicar fue lo que
en producción dio piezas de "24 metros" en un clóset de 2.4m). Si "dimensionesExterioresMm" no
viene en el contexto, ahí sí conviertes tú: cm del mensaje × 10 = mm, una sola vez.

PASO 0 — DEFAULTS DE FABRICACIÓN (NO bloquees al usuario con preguntas):
Revisa backPlacement, doorPlacement, sistema de gavetas/correderas y método de ensamblaje.
Si el mensaje o currentItem los definen, ÚSALOS TAL CUAL. Si alguno NO está definido, ASUME el
estándar de fabricación y CONTINÚA con el despiece — NO te detengas a preguntar:
  • fondo → embutido (entre los laterales)
  • puertas → sobrepuestas
  • correderas → telescópicas de cierre suave
  • ensamblaje → tornillos + tarugos
En "structure" declara claramente qué asumiste (ej: "Asumí fondo embutido, puertas sobrepuestas y
correderas telescópicas — avísame si alguno es distinto y lo recalculo") para que el usuario pueda
corregir. Estos supuestos solo mueven ±18mm y son seguros. Lo único que NUNCA se asume ni se
inventa es una MEDIDA EXTERIOR del mueble (ancho/alto/profundidad): si el usuario o la imagen no
dan alguna, usa un estándar razonable (profundidad 350mm arriba / 600mm abajo) y ANÓTALO.
→ SOLO responde con una pregunta en texto plano (sin JSON) si falta algo VERDADERAMENTE crítico e
  imposible de asumir: no hay NINGUNA medida exterior en el mensaje ni en la imagen, o las medidas
  son contradictorias o físicamente imposibles. En cualquier otro caso, entrega el despiece completo.

Si pasaste el PASO 0, actúa como un MAESTRO EBANISTA fabricando de verdad un mueble real, no como
un ilustrador ni diseñador conceptual. Prioriza exactitud técnica sobre rapidez. Reglas obligatorias:

1. NUNCA inventes una medida al azar. Toda medida de pieza sale de una resta/cálculo explícito a
   partir de: dimensiones exteriores del mueble, grosor del material, y el método de ensamblaje.
2. Cada reducción que apliques debe trazarse a un dato real (de currentItem o del mensaje), nunca a
   "lo más común". El PASO 0 ya garantizó que esos datos existen — úsalos, no los reinterpretes.
3. En el campo "cuts", muestra cada resta usada como cálculo explícito, igual que un maestro
   ebanista anotaría en su plano — no solo el resultado. Ejemplo: "Ancho útil interior:
   2000 - 18 - 18 = 1964mm" (no solo "1964mm").
4. Cada pieza en "pieces" lleva un campo "calculo" con la justificación numérica de esa medida
   exacta (ej: "Profundidad mueble 550mm − grosor fondo embutido 18mm = 532mm"). Si la pieza NO se
   reduce (ej: un lateral, que define la dimensión exterior), dilo igual (ej: "= dimensión
   exterior, no se reduce — define el ancho del mueble").
5. Antes de entregar el resultado, verifica en tu razonamiento (no lo escribas, solo asegúrate de
   que sea cierto antes de responder): ¿las piezas ensamblan entre sí sin pisarse ni dejar huecos
   no previstos?, ¿se descontó el grosor del material en cada reducción que correspondía?, ¿las
   gavetas dejan espacio real para las correderas elegidas?, ¿las divisiones internas caben en el
   hueco que les corresponde?, ¿las puertas, con su holgura, abren sin chocar entre sí ni con
   repisas/gavetas?, ¿el ALTO final armado coincide exactamente con el solicitado?, ¿el ANCHO final
   armado coincide exactamente con el solicitado?, ¿la PROFUNDIDAD final armada coincide exactamente
   con la solicitada? Las medidas que da el usuario son las del mueble TERMINADO — esa es la
   prioridad absoluta, ninguna pieza exterior puede quedar más chica que eso.
6. Aplica las reglas de reducción de "REGLAS TÉCNICAS" (abajo) en cada cálculo — son la base
   numérica de "calculo" en cada pieza, no las repitas como texto suelto. El canto/tapacanto NUNCA
   es una de esas reducciones: no resta nada de ninguna medida, sin excepción — solo el espesor de
   una pieza estructural ADYACENTE (otro panel de melamina) puede reducir una medida.

Responde con actions: ["breakdown"], "items" null, y un objeto "breakdown":
{ "structure": "Estructura principal (laterales, repisas, fondo, etc.) y qué método de ensamblaje
    se eligió — si había más de una forma válida, dilo y explica por qué se eligió esa.",
  "materials": "Láminas, canto, herrajes que lleva, con el grosor de cada uno.",
  "cuts": "Los cálculos de reducción aplicados, mostrados como resta explícita (ej:
    '2000 - 18 - 18 = 1964mm'), uno por cada reducción distinta usada en el despiece.",
  "assembly": "Orden de ensamblaje.",
  "pieces": [
    { "name": "Lateral izquierdo", "largo": 900, "ancho": 550, "material": "Melamina 18mm RH01", "qty": 2,
      "thickness": "18 mm", "calculo": "= dimensiones exteriores, no se reduce (pieza lateral)",
      "cantoSides": { "l1": false, "l2": false, "c1": true, "c2": false },
      "cantoThickness": "1.00mm", "grain": false, "grainDirection": "largo" }
  ] }
Mismas reglas de unidades (mm) y de canto/veta que en "AGREGAR PIEZAS A CORTES" aplican a cada pieza.

══ REGLAS TÉCNICAS ══
- Las medidas que da el usuario (o currentItem/dimensionesExterioresMm) son las del mueble
  TERMINADO/armado — nunca una medida de pieza individual ya reducida. Laterales y demás piezas
  que DEFINEN el exterior del mueble se cortan exactamente a esa medida, SIN reducción.
- El canto/tapacanto (PVC, cualquier grosor) NUNCA reduce ninguna medida de ninguna pieza — ni la
  exterior ni la interior. Solo registra en qué lados lleva canto (cantoSides), no restes nada por
  eso. La única reducción válida es el espesor de una pieza ESTRUCTURAL adyacente.
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
      "manualPrice": 0,
      "normalizedSpec": {
        "tipo": "ej: mesa de comedor",
        "estilo": "ej: moderno",
        "colores": "ej: blanco + textura madera natural",
        "notasInterpretacion": "qué corregiste o asumiste del lenguaje cotidiano del usuario, si aplica (ej: 'sobre de 3cm interpretado como espesor del tablero')"
      }
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

// Red de seguridad: ningún mueble de este catálogo mide más de 8m en un solo eje. Si llega así,
// es casi seguro un error de unidades de la IA (cm convertido a mm por accidente) — se corrige
// dividiendo por 10 en vez de dejar pasar una pieza físicamente imposible a Cortes/cotización.
const MAX_PLAUSIBLE_CM = 800;
function fixImplausibleDimensions(item) {
  if (!item || typeof item !== "object") return item;
  const fixed = { ...item };
  ["width", "height", "depth"].forEach(key => {
    const v = Number(fixed[key]);
    if (v > MAX_PLAUSIBLE_CM) {
      console.warn(`[normalizeAi] ${key}=${v} es físicamente imposible (>${MAX_PLAUSIBLE_CM}cm) — corrigiendo /10 a ${v / 10}`);
      fixed[key] = Math.round((v / 10) * 10) / 10;
    }
  });
  return fixed;
}

// Mismo techo de cordura, en mm, para piezas de Cortes/desglose (largo/ancho).
const MAX_PLAUSIBLE_MM = 6000;
function fixImplausiblePieceMm(p) {
  if (!p || typeof p !== "object") return p;
  const fixed = { ...p };
  ["largo", "ancho"].forEach(key => {
    const v = Number(fixed[key]);
    if (v > MAX_PLAUSIBLE_MM) {
      console.warn(`[normalizeAi] pieza "${fixed.name || "?"}" ${key}=${v}mm es físicamente imposible (>${MAX_PLAUSIBLE_MM}mm) — corrigiendo /10 a ${v / 10}`);
      fixed[key] = Math.round(v / 10);
    }
  });
  return fixed;
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
  if (items) items = items.map(fixImplausibleDimensions);
  const materials = Array.isArray(payload?.materials) ? payload.materials : null;
  let pieces = Array.isArray(payload?.pieces) ? payload.pieces.map(fixImplausiblePieceMm) : null;
  const breakdown = payload?.breakdown && typeof payload.breakdown === "object"
    ? { ...payload.breakdown, pieces: Array.isArray(payload.breakdown.pieces) ? payload.breakdown.pieces.map(fixImplausiblePieceMm) : payload.breakdown.pieces }
    : null;
  return {
    source: lastTextProvider || "openai",
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
  // "insufficient_quota" también llega con status 429, pero NO es un límite que se resuelva
  // esperando — significa que se acabó el crédito/plan de OpenAI. Hay que distinguirlo del
  // 429 real de "demasiadas solicitudes", que sí se resuelve solo en segundos.
  if (e.code === "insufficient_quota") return { status: 503, message: "La cuenta de OpenAI no tiene crédito/cuota disponible — revisa el plan y la facturación en platform.openai.com. Esperar no lo va a resolver." };
  if (e.status === 429) return { status: 429, message: "Hay mucha demanda en este momento, espera unos segundos e intenta de nuevo." };
  if (e.status === 401) return { status: 500, message: "La clave de OpenAI configurada no es válida." };
  if (e.status === 400) return { status: 400, message: "No pude procesar esa solicitud, intenta reformularla." };
  return { status: 500, message: e.message || "Error inesperado." };
}

// Precios aproximados por 1M tokens / por imagen — verificar en https://openai.com/api/pricing/
// y ajustar estas constantes si cambian. Son para tener una idea de costo relativo entre
// llamadas, no una factura exacta. gpt-image-1 factura por TOKENS (no por imagen a precio fijo
// como dall-e) — el número de tokens de salida depende de quality/size, así que cuando la API
// devuelve "usage" real lo usamos; el imagePerUnit de abajo es solo un respaldo si no viene.
const PRICE_USD = {
  textInputPer1M: 0.40,
  textOutputPer1M: 1.60,
  imageTextInputPer1M: 5.00,
  imageInputPer1M: 10.00,
  imageOutputPer1M: 40.00,
  imagePerUnit: { low: 0.011, medium: 0.042, high: 0.167 }, // respaldo si la API no manda "usage"
  // v55.17: precios estimados de Gemini (mucho más baratos que OpenAI). Ajústalos con env
  // GEMINI_PRICE_IN_1M / GEMINI_PRICE_OUT_1M si cambian. El costo REAL está en AI Studio.
  geminiInputPer1M: Number(process.env.GEMINI_PRICE_IN_1M || 0.30),
  geminiOutputPer1M: Number(process.env.GEMINI_PRICE_OUT_1M || 2.50)
};
// ── Acumulador de consumo IA (v51) ───────────────────────────────────────────
// Antes el costo estimado solo se veía en la consola de Render. Ahora cada
// llamada se acumula por día en ai_usage.json y el admin lo consulta desde el
// panel (tab "Consumo IA") sin acceso al servidor. Se conservan 90 días.
const AI_USAGE_FILE = path.join(__dirname, "ai_usage.json");
let aiUsage = (() => {
  try { return JSON.parse(fs.readFileSync(AI_USAGE_FILE, "utf-8")); }
  catch { return { days: {} }; }
})();
function recordAiUsage(kind, fields) {
  const day = todayIso();
  const d = aiUsage.days[day] || (aiUsage.days[day] = {
    textCalls: 0, textIn: 0, textOut: 0, textCost: 0,
    imagePaidCalls: 0, imageFreeCalls: 0, imageCost: 0
  });
  if (kind === "text") {
    d.textCalls++;
    d.textIn += fields.inTok; d.textOut += fields.outTok; d.textCost += fields.cost;
  } else if (kind === "imagePaid") {
    d.imagePaidCalls++; d.imageCost += fields.cost;
  } else if (kind === "imageFree") {
    d.imageFreeCalls++;
  }
  // Poda: solo los últimos 90 días
  const keys = Object.keys(aiUsage.days).sort();
  while (keys.length > 90) delete aiUsage.days[keys.shift()];
  try { atomicWrite(AI_USAGE_FILE, aiUsage); } catch (e) { console.error("[ai-usage]", e.message); }
}

function logEstimatedCost(label, usage) {
  if (!usage) { console.log(`[costo] ${label}: sin datos de uso de tokens`); return; }
  const inTok = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  const cost = (inTok / 1e6) * PRICE_USD.textInputPer1M + (outTok / 1e6) * PRICE_USD.textOutputPer1M;
  console.log(`[costo] ${label}: ${inTok} tokens entrada + ${outTok} tokens salida ≈ $${cost.toFixed(4)} USD (estimado)`);
  recordAiUsage("text", { inTok, outTok, cost });
}
// v55.17: consumo de Gemini → MISMO tablero "Consumo IA" (Gemini usa usageMetadata, no "usage").
function logGeminiCost(label, usageMetadata) {
  const inTok = usageMetadata?.promptTokenCount || 0;
  const outTok = usageMetadata?.candidatesTokenCount || 0;
  const cost = (inTok / 1e6) * PRICE_USD.geminiInputPer1M + (outTok / 1e6) * PRICE_USD.geminiOutputPer1M;
  console.log(`[costo] ${label}: ${inTok} entrada + ${outTok} salida ≈ $${cost.toFixed(4)} USD (estimado Gemini)`);
  recordAiUsage("text", { inTok, outTok, cost });
}
function logEstimatedImageCost(label, quality, source, usage) {
  if (source !== imageModel) {
    console.log(`[costo] ${label}: imagen gratis (${source})`);
    recordAiUsage("imageFree", {});
    return;
  }
  if (usage) {
    const textIn = usage.input_tokens_details?.text_tokens ?? 0;
    const imgIn = usage.input_tokens_details?.image_tokens ?? 0;
    const outTok = usage.output_tokens || 0;
    const cost = (textIn / 1e6) * PRICE_USD.imageTextInputPer1M + (imgIn / 1e6) * PRICE_USD.imageInputPer1M + (outTok / 1e6) * PRICE_USD.imageOutputPer1M;
    console.log(`[costo] ${label}: ${textIn} tokens texto + ${imgIn} tokens imagen entrada + ${outTok} tokens salida (${quality}, ${source}) ≈ $${cost.toFixed(4)} USD (estimado, real de la API)`);
    recordAiUsage("imagePaid", { cost });
    return;
  }
  const cost = PRICE_USD.imagePerUnit[quality] ?? PRICE_USD.imagePerUnit.low;
  console.log(`[costo] ${label}: 1 imagen ${quality} (${source}) ≈ $${cost.toFixed(4)} USD (estimado, respaldo sin "usage")`);
  recordAiUsage("imagePaid", { cost });
}

async function callOpenAI(sysPrompt, userContent, useWebSearch = true) {
  // Use Responses API with web_search_preview for real-time web access — pero solo cuando
  // de verdad puede hacer falta (preguntas generales). Para pedidos de muebles/materiales/
  // piezas/desglose nunca aporta nada y solo arriesga un costo extra si el modelo decide
  // invocarla sin necesidad.
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
      ...(useWebSearch ? { tools: [{ type: "web_search_preview" }] } : {}),
      input: inputMessages,
      // El desglose ahora pide cálculo explícito por pieza (más texto) — 2000 se quedaba corto
      // y la respuesta llegaba truncada a mitad del JSON (rompía el parseo).
      max_output_tokens: 3500
    })
  });
  const data = await apiRes.json();
  if (!apiRes.ok) {
    console.error("[callOpenAI] error response:", JSON.stringify(data));
    const err = new Error(data.error?.message || `OpenAI ${apiRes.status}`);
    err.status = apiRes.status;
    err.code = data.error?.code;
    throw err;
  }
  logEstimatedCost(`callOpenAI (${model})`, data.usage);
  const toolCalls = (data.output || []).filter(o => o.type !== "message").map(o => o.type);
  if (toolCalls.length) console.log(`[costo] callOpenAI invocó herramientas: ${toolCalls.join(", ")} (costo adicional no reflejado en el estimado de arriba)`);
  // Extract text from Responses API output array
  const text = (data.output || [])
    .filter(o => o.type === "message")
    .flatMap(o => o.content || [])
    .filter(c => c.type === "output_text")
    .map(c => c.text || "")
    .join("").trim();
  const parsed = parseJson(text);
  if (parsed) return parsed;
  // Si el texto claramente iba a ser JSON (empieza con "{") pero no parseó, es casi
  // siempre una respuesta cortada a mitad de camino (max_output_tokens) — mejor avisar
  // con un error claro que mostrarle al usuario el JSON crudo a medio terminar.
  if (text.startsWith("{")) {
    throw new Error("La respuesta se cortó a mitad de camino (era muy larga). Intenta de nuevo, o con un pedido más corto.");
  }
  return { assistantText: text };
}

// ── Gemini (texto/visión) — MISMO contrato que callOpenAI: devuelve el JSON
// parseado (acción) o { assistantText }. Cero dependencias (fetch + REST). ──
async function callGemini(sysPrompt, userContent, useWebSearch = true) {
  const parts = [];
  for (const c of userContent) {
    if (c.type === "input_text") parts.push({ text: c.text });
    else if (c.type === "input_image" && c.image_url) {
      const m = /^data:([^;]+);base64,(.+)$/.exec(c.image_url);
      if (m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
    }
  }
  const doCall = async (withSearch, withThinkingOff) => {
    const reqBody = {
      system_instruction: { parts: [{ text: sysPrompt }] },
      contents: [{ role: "user", parts }],
      generationConfig: { maxOutputTokens: 3500 }
    };
    // v55.13: los Gemini 2.5+/3.x traen razonamiento interno ("thinking") ACTIVADO por
    // defecto — suma segundos de latencia y cobra esos tokens. Para un asistente de chat
    // lo apagamos: respuestas más rápidas y más baratas, con la misma calidad práctica.
    if (withThinkingOff) reqBody.generationConfig.thinkingConfig = { thinkingBudget: 0 };
    if (withSearch === "gs") reqBody.tools = [{ google_search: {} }];
    else if (withSearch === "gsr") reqBody.tools = [{ google_search_retrieval: {} }];
    const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`, {
      method: "POST",
      headers: geminiHeaders(),
      body: JSON.stringify(reqBody)
    });
    const data = await apiRes.json();
    return { apiRes, data };
  };

  // Cascada de tolerancia (v55.12/13): búsqueda web y thinking-off son capas OPCIONALES —
  // si la API del modelo/tier rechaza alguna, se reintenta sin ella y se memoriza para
  // las próximas llamadas. Ninguna capa opcional debe tumbar una respuesta.
  const s0 = (useWebSearch && geminiSearchMode !== "off") ? geminiSearchMode : false;
  const t0 = geminiThinkingOk;
  const planes = [[s0, t0]];
  if (s0 === "gs") planes.push(["gsr", t0]);   // formato alterno de búsqueda
  if (s0) planes.push([false, t0]);            // sin búsqueda
  if (t0) planes.push([false, false]);         // sin búsqueda ni thinking-off
  let apiRes, data, usado = [s0, t0];
  for (const [s, t] of planes) {
    ({ apiRes, data } = await doCall(s, t));
    usado = [s, t];
    if (apiRes.ok) break;
    console.warn(`[callGemini] intento (búsqueda=${s}, sinPensar=${t}) falló: ${apiRes.status} ${data.error?.message || "?"}`);
  }
  if (apiRes.ok) {
    if (s0 && usado[0] !== s0) {
      geminiSearchMode = usado[0] || "off";
      console.warn(`[callGemini] búsqueda web: modo memorizado → ${geminiSearchMode}`);
    }
    if (t0 && !usado[1]) { geminiThinkingOk = false; console.warn("[callGemini] thinkingConfig no soportado — se deja el razonamiento por defecto (memorizado)"); }
  }
  // v55.15: si todo falló con pinta de AUTENTICACIÓN (400/401/403), prueba el otro estilo
  // de header (x-goog-api-key ↔ Authorization: Bearer) con la petición mínima. Las keys
  // nuevas de Google ("AQ.…") pueden requerir Bearer; las clásicas ("AIza…") usan el header.
  if (!apiRes.ok && [400, 401, 403].includes(apiRes.status)) {
    geminiUseBearer = !geminiUseBearer;
    console.warn(`[callGemini] probando estilo de auth alterno: ${geminiUseBearer ? "Authorization: Bearer" : "x-goog-api-key"}`);
    ({ apiRes, data } = await doCall(false, false));
    if (!apiRes.ok) { geminiUseBearer = !geminiUseBearer; } // tampoco sirvió → revertir
    else console.warn("[callGemini] estilo de auth alterno FUNCIONÓ (memorizado para las próximas llamadas)");
  }
  if (!apiRes.ok) {
    console.error("[callGemini] error response:", JSON.stringify(data));
    const err = new Error(data.error?.message || `Gemini ${apiRes.status}`);
    err.status = apiRes.status; err.code = data.error?.status;
    throw err;
  }
  // Consumo visible en logs (v55.11) — para comparar costos Gemini vs OpenAI.
  // Gemini 3.5 Flash cobra por token; estos números salen en los logs de Render.
  logGeminiCost(`callGemini (${geminiModel})`, data.usageMetadata);
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
  const parsed = parseJson(text);
  if (parsed) return parsed;
  if (text.startsWith("{")) throw new Error("La respuesta se cortó a mitad de camino (era muy larga). Intenta de nuevo, o con un pedido más corto.");
  return { assistantText: text };
}

// ── Despachador de IA de texto: elige el proveedor y, si el primario falla, hace
// respaldo automático al otro. Deja OpenAI como red de seguridad. ──
async function callAI(sysPrompt, userContent, useWebSearch = true) {
  const primary = (AI_PROVIDER === "gemini" && hasGemini()) ? "gemini"
                : hasOpenAI() ? "openai"
                : hasGemini() ? "gemini" : null;
  if (!primary) { const e = new Error("No hay motor de IA configurado (define GEMINI_API_KEY u OPENAI_API_KEY)."); e.status = 503; throw e; }
  const run = (prov) => prov === "gemini" ? callGemini(sysPrompt, userContent, useWebSearch) : callOpenAI(sysPrompt, userContent, useWebSearch);
  try {
    const r = await run(primary); lastTextProvider = primary; return r;
  } catch (e) {
    const fb = (primary === "gemini" && hasOpenAI()) ? "openai" : (primary === "openai" && hasGemini()) ? "gemini" : null;
    if (!fb) throw e;
    console.warn(`[callAI] ${primary} falló (${e.message}); usando respaldo ${fb}`);
    try {
      const r = await run(fb); lastTextProvider = fb; return r;
    } catch (e2) {
      // v55.12: si el respaldo TAMBIÉN falla, reporta ambos errores — antes solo se veía el del
      // respaldo (p.ej. "OpenAI sin crédito") y ocultaba la causa real del motor principal.
      const err = new Error(`Los dos motores fallaron — ${primary}: ${e.message} · ${fb}: ${e2.message}`);
      // Sin status/code a propósito: así friendlyAiError NO lo tapa con el mensaje enlatado
      // de un solo motor (p.ej. "OpenAI sin crédito") y el usuario ve la causa real de ambos.
      throw err;
    }
  }
}

// Palabras que indican que el usuario quiere una IMAGEN generada, no una propuesta de mueble.
// "mueble"/"cocina"/"diseño" se excluyen a propósito: aparecen en casi cualquier pedido normal
// de cotización ("diseña un mueble de cocina") y dispararían el router por error.
const imageIntentWords = ["logo", "tatuaje", "plano", "render", "fachada", "dibujo"];
function detectImageIntent(message) {
  const text = String(message || "").toLowerCase();
  return imageIntentWords.some(w => text.includes(w));
}

// ¿El mensaje es una PREGUNTA o saludo (conversación), no un pedido imperativo de
// generar una imagen? Ej: "¿puedes hacerlo render?", "hola", "qué materiales me
// recomiendas?". Estos NUNCA deben disparar generación automática de imagen — se
// responden en texto (chat normal). Un pedido real es imperativo: "hazme un render
// de...", "dibuja un logo", "muéstrame una cocina en L".
function isConversationalMessage(message) {
  const t = String(message || "").toLowerCase().trim();
  if (!t) return false;
  return t.endsWith("?")
    || /^[¿]/.test(t)
    || /^(hola|buenas|buenos d[ií]as|buenas (tardes|noches)|hey|qu[eé] tal|c[oó]mo est[aá]s|gracias|ok|vale)\b/.test(t)
    || /\b(puedes|puede|podr[ií]as|podr[ií]a|se\s+puede|eres\s+capaz|sabes|sab[eé]s|sirves?\s+para|qu[eé]\s+(puedes|haces|eres|sabes)|c[oó]mo\s+(funciona|te\s+us|se\s+us|trabaj))\b/.test(t);
}

// ── Optimización de costo: ¿el cambio afecta el ASPECTO del render, o es solo
// comercial/técnico? Un cambio comercial (precio, material, canto, herraje,
// cotización, desglose, cortes, proveedor, notas) NO necesita una imagen nueva.
// Uno visual (color, patas, gavetas, puertas, repisas, estilo, dimensiones
// visibles) sí conviene reflejarlo — editando el render anterior, no de cero.
const NON_VISUAL_RE = /\b(precio|precios|cotiz|desglos|despiec|corte|cortes|cantear|espesor|canto|cantos|herraj|bisagra|corredera|jalador|proveedor|observ|nota|notas|impuesto|itbms|iva|margen|descuento|garant[ií]a|material(es)?|melamina|mdf|triplay|contrachapado)\b/i;
const VISUAL_RE = /\b(color|colores|negr[oa]|blanc[oa]|gris|caf[eé]|roj[oa]|azul|verde|amarill[oa]|beige|madera (clara|oscura|natural)|pata|patas|gaveta|gavetas|caj[oó]n|cajones|puerta|puertas|repisa|repisas|entrepa[ñn]o|estilo|moderno|minimalista|r[uú]stico|cl[aá]sico|m[aá]s\s+(alt|baj|anch|angost|grand|peque|delgad|grues|larg|cort)|redonde|curv|recto)\b/i;

// Solo comercial/técnico si menciona algo NO-visual y NADA visual.
function isNonVisualEdit(message) {
  const t = String(message || "");
  return NON_VISUAL_RE.test(t) && !VISUAL_RE.test(t);
}
function isVisualEdit(message) {
  return VISUAL_RE.test(String(message || ""));
}

// Prompt corto para EDITAR el render anterior aplicando solo el cambio pedido —
// conserva el resto del diseño en vez de reconstruirlo desde cero.
function buildEditPrompt(message) {
  return `Modifica esta imagen de un mueble aplicando SOLO este cambio: ${String(message || "").slice(0, 160)}. Conserva EXACTAMENTE el resto del diseño, la forma, el encuadre y el estilo (render fotorrealista de mueble de melamina).`.replace(/\s+/g, " ").trim();
}

// Extrae "200 cm de largo, 60 cm de profundidad y 240 cm de altura" (y variantes de orden/
// sinónimo) del mensaje, para no depender de que la IA convierta cm→mm por su cuenta — eso fue
// lo que dio piezas de "24 metros" en un clóset de 2.4m (doble conversión por parte del modelo).
const AXIS_WORDS = { ancho: ["largo", "ancho", "longitud"], alto: ["alto", "altura"], profundidad: ["profundidad", "fondo"] };
function extractCmDimensionsFromText(message) {
  const t = String(message || "").toLowerCase();
  const found = {};
  for (const [axis, words] of Object.entries(AXIS_WORDS)) {
    for (const word of words) {
      let m = t.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*cm\\s*(?:de\\s*)?${word}\\b`));
      if (!m) m = t.match(new RegExp(`${word}\\s*(?:de\\s*)?(\\d+(?:[.,]\\d+)?)\\s*cm\\b`));
      if (m) { found[axis] = Number(m[1].replace(",", ".")); break; }
    }
  }
  if (found.ancho > 0 && found.alto > 0 && found.profundidad > 0) {
    return { ancho_mm: Math.round(found.ancho * 10), alto_mm: Math.round(found.alto * 10), profundidad_mm: Math.round(found.profundidad * 10) };
  }
  return null;
}

// Detector SEMÁNTICO (corre antes y tiene prioridad sobre el de palabras clave): cuenta
// cuántas categorías de detalle técnico aparecen en el mensaje. Una sola coincidencia
// ("una mesa") no alcanza — ahí hay demasiado riesgo de falso positivo con preguntas
// generales. Dos o más (medidas + material, o componentes + objeto, etc.) son suficiente
// señal de que el usuario está describiendo una pieza real y probablemente quiera verla.
function scoreImageSignals(message) {
  const text = String(message || "").toLowerCase();
  const signals = {
    medidas: /\d+(?:[.,]\d+)?\s*(?:cm|mm|m|mts?|metros?|cent[ií]metros?|mil[ií]metros?)\b/.test(text)
      || /\d+\s*[x×]\s*\d+/.test(text),
    materiales: /\b(melamina|mdf|madera|acero|vidrio|pvc|aluminio|f[oó]rmica|laminado|triplay|contrachapado|granito|m[aá]rmol|cuarzo)\b/.test(text),
    componentes: /\b(gavetas?|cajones?|cajonera|puertas?|repisas?|entrepa[ñn]os?|patas?|bisagras?|correderas?|jaladores?|tiradores?|mesones?|cubiertas?)\b/.test(text),
    estructural: /\b(espacio libre|compartimentos?|divisiones?|laterales?|central(es)?|interno|interna|externo|externa|integrado|empotrado|sobrepuesto|hueco)\b/.test(text),
    objeto: /\b(mesa|escritorio|closet|cl[oó]set|cocina|mueble|estanter[ií]a|recepci[oó]n|tocador|bar|oficina|fachada|vitrina|alacena|ropero|repisero|biblioteca|isla|c[oó]moda|librero|credenza)\b/.test(text)
  };
  const count = Object.values(signals).filter(Boolean).length;
  return { signals, count };
}

// Solo manda al modelo los items del catálogo que tengan alguna palabra en común con el mensaje
// — evita pagar tokens por miles de productos que no tienen nada que ver con el pedido actual.
const MAX_RELEVANT_CATALOG_ITEMS = 30;
function filterRelevantCatalogItems(items, message, max = MAX_RELEVANT_CATALOG_ITEMS) {
  if (!Array.isArray(items) || !items.length) return [];
  const words = String(message || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // quita acentos para que "bisagra"="bisagrá"
    .split(/[^a-z0-9]+/).filter(w => w.length >= 4);
  if (!words.length) return [];
  const scored = [];
  for (const item of items) {
    const name = String(item?.name || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
    const hits = words.reduce((n, w) => n + (name.includes(w) ? 1 : 0), 0);
    if (hits > 0) scored.push({ item, hits });
  }
  scored.sort((a, b) => b.hits - a.hits);
  return scored.slice(0, max).map(s => s.item);
}

// Corta prompts excesivamente largos/detallados antes de mandarlos a generar imagen —
// reduce la carga de gpt-image-1 sin gastar otra llamada a la API para "resumir".
const IMAGE_PROMPT_MAX_CHARS = 260;
function simplifyImagePrompt(rawPrompt) {
  const p = String(rawPrompt || "").trim();
  if (p.length <= IMAGE_PROMPT_MAX_CHARS) return p;
  const cut = p.slice(0, IMAGE_PROMPT_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > 100 ? cut.slice(0, lastSpace) : cut;
  console.log(`[image] prompt simplificado de ${p.length} a ${trimmed.length} caracteres`);
  return `${trimmed}...`;
}

function delay(ms, value) {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

// Techo duro: sin importar cuántos proveedores/reintentos corran por dentro, nunca
// dejamos correr la generación de imagen más de esto — deja margen bajo el timeout
// de 90s del cliente para que SIEMPRE llegue una respuesta a tiempo.
const IMAGE_GEN_BUDGET_MS = 80000;

// Caché en memoria: si el mismo prompt (texto→imagen) ya se generó hace poco, se devuelve esa
// imagen sin gastar otra llamada — misma calidad exacta, $0 de costo. No aplica a boceto→render
// (esa depende de la imagen subida, casi nunca es idéntica de una vez a otra).
const IMAGE_CACHE = new Map(); // key -> { result, expiresAt }
const IMAGE_CACHE_TTL_MS = 30 * 60 * 1000;
const IMAGE_CACHE_MAX_ENTRIES = 50;
function imageCacheGet(key) {
  const entry = IMAGE_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { IMAGE_CACHE.delete(key); return null; }
  return entry.result;
}
function imageCacheSet(key, result) {
  if (IMAGE_CACHE.size >= IMAGE_CACHE_MAX_ENTRIES) {
    const oldestKey = IMAGE_CACHE.keys().next().value;
    if (oldestKey !== undefined) IMAGE_CACHE.delete(oldestKey);
  }
  IMAGE_CACHE.set(key, { result, expiresAt: Date.now() + IMAGE_CACHE_TTL_MS });
}

async function generateImageWithRetry(rawPrompt, quality = "high") {
  const prompt = simplifyImagePrompt(rawPrompt);
  const cacheKey = `${quality}::${prompt.toLowerCase()}`;
  const cached = imageCacheGet(cacheKey);
  if (cached) {
    console.log(`[image] cache HIT — quality=${quality} prompt="${prompt.slice(0, 100)}" — $0 gastado`);
    return cached;
  }

  const start = Date.now();
  console.log(`[image] inicio generación — quality=${quality} prompt enviado: "${prompt.slice(0, 200)}"`);

  const work = (async () => {
    let result = await generateImageCascade(prompt, quality);
    // Sin cuota (402) o sin organización verificada (403) no tiene sentido reintentar — va a
    // fallar exactamente igual, y a $0.167/imagen en "high" un reintento ciego sale caro.
    // Sí vale la pena reintentar en timeout/excepción (503 genérico) o rate-limit (429),
    // que son transitorios.
    const NO_RETRY_STATUSES = [402, 403];
    if (!result.ok && !NO_RETRY_STATUSES.includes(result.status)) {
      console.log(`[image] primer intento falló (${result.error}), reintentando una vez...`);
      result = await generateImageCascade(prompt, quality);
    }
    return result;
  })();

  const result = await Promise.race([
    work,
    delay(IMAGE_GEN_BUDGET_MS, { ok: false, status: 504, error: "La generación de imagen tardó demasiado (>80s).", timedOut: true })
  ]);

  const elapsedMs = Date.now() - start;
  console.log(`[image] fin generación — ok=${result.ok} fuente=${result.source || "-"} tiempo=${elapsedMs}ms${result.ok ? "" : ` error="${result.error}"`}`);
  if (result.ok) {
    logEstimatedImageCost("generateImageWithRetry", quality, result.source, result.usage);
    imageCacheSet(cacheKey, result);
  }
  return result;
}

function imageOnlyResponse(result) {
  return {
    source: "openai",
    assistantText: "Aquí está la imagen que pediste 🎨",
    actions: ["fill_form"],
    items: null, item: null, materials: null, pieces: null, breakdown: null,
    designPrompt: null,
    imageB64: result.imageB64 || null,
    imageUrl: result.imageUrl || null,
    imageSource: result.source
  };
}

async function handleAi(req, res) {
  // Auditoría v51: cada llamada consume tokens de OpenAI — tope por IP contra abuso
  if (!checkRateLimit(`ai:chat:${getClientIp(req)}`, 12, 60000)) {
    sendJson(res, 429, { error: "Demasiadas consultas seguidas. Espera 1 minuto." });
    return;
  }
  if (!aiTextAvailable()) {
    sendJson(res, 503, { error: "IA no configurada. Define GEMINI_API_KEY (o OPENAI_API_KEY). Usando modo local." });
    return;
  }
  const body = await readBody(req);
  const payload = body ? JSON.parse(body) : {};

  // ── Router texto vs imagen ──────────────────────────────────────────────
  // 1) Detector semántico (prioridad): ≥2 señales técnicas → imagen automática + JSON de mueble.
  //    1 sola señal → respuesta normal + botón "Generar imagen" (ambiguo, no se gasta de más).
  // 2) Si no hay señales semánticas, cae al detector por palabras clave (logo/render/etc, imagen sola).
  // Solo aplica si no viene una foto adjunta (eso es análisis de espacio, no generación).
  let imageDecision = "none";
  const semantic = scoreImageSignals(payload.message);
  const keywordHit = detectImageIntent(payload.message);
  const conversational = isConversationalMessage(payload.message);
  if (!payload.imageData && !payload.skipImageRouter) {
    if (conversational) {
      // Una PREGUNTA o saludo NUNCA dispara una imagen automática (este era el bug:
      // "¿puedes hacerlo render?" intentaba generar una imagen y fallaba). Se responde
      // en texto; si además describe una pieza concreta, se ofrece el botón "Generar imagen".
      imageDecision = semantic.count >= 1 ? "button" : "none";
    } else if (semantic.count >= 2) imageDecision = "auto";
    else if (semantic.count === 1) imageDecision = "button";
    else if (keywordHit) imageDecision = "keyword";
  }
  // Si ya existe un mueble propuesto (currentItem) y el mensaje es un ajuste sobre ese mismo
  // mueble — no regenerar la imagen sola por eso. Solo si el usuario la pide explícitamente.
  // Evita pagar una imagen nueva por cada cambio chico ("cámbiale el color", "hazla más alta").
  const explicitImageRequest = /\b(imagen|render|foto|fotograf[íi]a|visualiza|mu[ée]stra(me)?|dibuj[oa]|vista nueva)\b/i.test(payload.message || "");
  if (imageDecision === "auto" && payload.currentItem && !explicitImageRequest) {
    imageDecision = "button";
  }
  // ── Optimización de costo (spec IA #2/#3/#4): decisiones sobre un DISEÑO ACTIVO ──
  let decisionReason = imageDecision === "none" ? "sin-senales" : "senales-tecnicas";
  if (payload.currentItem && !payload.imageData && !payload.skipImageRouter) {
    if (isNonVisualEdit(payload.message) && !explicitImageRequest) {
      // Solo cambió algo comercial/técnico (precio, material, canto, cotización…) → CERO imagen.
      imageDecision = "none";
      decisionReason = "cambio-no-visual (ahorro: sin imagen)";
    } else if (payload.baseImage && isVisualEdit(payload.message)) {
      // Cambio visual sobre un render existente → EDITAR esa imagen, no crear una de cero.
      imageDecision = "edit";
      decisionReason = "edicion-sobre-render-previo";
    }
  }
  console.log(`[intent] msg="${String(payload.message || "").slice(0, 80)}" count=${semantic.count} keywordHit=${keywordHit} skipRouter=${Boolean(payload.skipImageRouter)} baseImg=${Boolean(payload.baseImage)} decision=${imageDecision} motivo="${decisionReason}"`);

  // ── EDIT: modifica el render anterior con el cambio pedido, conservando el diseño (evita
  // "empezar de cero"). Si la edición falla, respaldo generando una imagen nueva. ──
  if (imageDecision === "edit") {
    const editPrompt = buildEditPrompt(payload.message);
    const t0 = Date.now();
    const result = await editImageWithReference(payload.baseImage, editPrompt, "high");
    console.log(`[intent] EDIT sobre render previo — ${Date.now() - t0}ms — ${result.ok ? "ok" : "fallo: " + result.error}`);
    if (result.ok) {
      sendJson(res, 200, {
        assistantText: "🎨 Actualicé el render con tu cambio — preparando el desglose técnico…",
        imageB64: result.imageB64 || null, imageUrl: result.imageUrl || null, imageSource: result.source,
        needsFollowup: true
      });
      return;
    }
    console.log(`[intent] edit falló → respaldo: generar imagen nueva`);
    const gen = await generateImageWithRetry(payload.message);
    if (gen.ok) {
      sendJson(res, 200, { ...imageOnlyResponse(gen), assistantText: "🎨 Aquí está el render — preparando el desglose técnico…", needsFollowup: true });
    } else {
      sendJson(res, 200, { ...imageOnlyResponse({}), assistantText: `⚠️ No pude actualizar la imagen (${gen.error || result.error || "error"}). Preparando la propuesta técnica…`, imageError: gen.error || result.error, needsFollowup: true });
    }
    return;
  }

  // Imagen primero, SIEMPRE en su propia respuesta — nunca junto al JSON de mueble/desglose
  // (eso fue la causa del timeout: una llamada que esperaba ambas cosas a la vez). El cliente
  // pide el desglose en una 2da llamada (con skipImageRouter:true) recién después de mostrar
  // la imagen, así nunca corren imagen y texto al mismo tiempo.
  if (imageDecision === "auto") {
    console.log(`[intent] detector activado: semántico (${semantic.count} señales) — SOLO imagen primero (calidad alta), desglose en 2da llamada`);
    const result = await generateImageWithRetry(payload.message);
    if (result.ok) {
      sendJson(res, 200, {
        ...imageOnlyResponse(result),
        assistantText: "🎨 Aquí está la imagen — preparando el desglose técnico…",
        needsFollowup: true
      });
    } else {
      console.error(`[intent] generación de imagen (auto) falló: ${result.error}`);
      // No perdemos el pedido: igual se pide el desglose técnico en la 2da llamada.
      sendJson(res, 200, {
        ...imageOnlyResponse({}),
        assistantText: `⚠️ No pude generar la imagen (${result.error || "error desconocido"}). Preparando la propuesta técnica…`,
        imageError: result.error || "No se pudo generar la imagen.",
        needsFollowup: true
      });
    }
    return;
  }

  if (imageDecision === "keyword") {
    console.log(`[intent] detector activado: palabras clave — generando SOLO imagen (calidad alta)`);
    const result = await generateImageWithRetry(payload.message);
    if (result.ok) {
      sendJson(res, 200, imageOnlyResponse(result));
    } else {
      console.error(`[intent] generación de imagen (keyword) falló: ${result.error}`);
      // Nunca dejamos que el error crudo de OpenAI llegue al usuario: respondemos en texto.
      sendJson(res, 200, { assistantText: `No pude generar la imagen en este momento (${result.error || "error temporal"}). Puedo describírtelo con detalle o lo intentamos de nuevo — dime cómo prefieres.` });
    }
    return;
  }

  // El catálogo de precios del cliente puede tener miles de items (ej: catálogo IMECA, 2611
  // productos ≈ 24,000 tokens si se manda completo) — eso es la mayor parte del costo de cada
  // llamada, y casi nunca son todos relevantes. Solo mandamos los que comparten palabras con el
  // mensaje del usuario (lo que de verdad podría necesitar el precio), tope 30 items.
  const clientCustomItems = Array.isArray(payload.customPrices) ? payload.customPrices : [];
  const relevantCustomItems = filterRelevantCatalogItems(clientCustomItems, payload.message);
  const customBlock = relevantCustomItems.length
    ? "\n" + relevantCustomItems.map(i => `${String(i.name).slice(0,50)}: $${Number(i.price)||0}`).join("\n")
    : "";
  const pricesBlock = `\n══ PRECIOS ACTUALES (en USD) ══\nMadera/Melamina estándar 2440×1220: $${prices.melamina_std}\nMadera/Melamina grande 2750×1830: $${prices.melamina_lg}\nFondo/backing por m²: $${prices.backing_m2}\nCanto PVC 22mm/metro: $${prices.canto_pvc}\nCanto grueso 2mm/metro: $${prices.canto_grueso}\nBisagra estándar: $${prices.bisagra_std}/un\nBisagra cierre suave: $${prices.bisagra_sc}/un\nCorredera estándar: $${prices.corredera_std}/par\nCorredera cierre suave: $${prices.corredera_sc}/par\nJalador 128mm: $${prices.jalador_chico}/un\nJalador 320mm: $${prices.jalador_grande}/un\nJalador premium inox: $${prices.jalador_premium}/un\nInstalación: $${prices.install_hour}/hora\nTransporte base: $${prices.transport_base}${customBlock}`;

  // Conversation history: últimos 5 mensajes completos (tope pedido para controlar costo) +
  // resumen local de lo más viejo (concatenación truncada, sin llamada extra a la API) para no
  // perder contexto de la conversación sin pagar tokens de mandar todo completo.
  const HISTORY_MAX_MESSAGES = 5;
  const fullHistory = Array.isArray(payload.history) ? payload.history : [];
  const recentWindow = fullHistory.slice(-HISTORY_MAX_MESSAGES);
  const older = fullHistory.slice(0, -HISTORY_MAX_MESSAGES);
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

  // currentItem.width/height/depth vienen en CM (convención del schema de muebles). Para el
  // desglose (que trabaja en mm) esa conversión NUNCA se le deja al modelo — se calcula aquí,
  // una sola vez, de forma determinística. El modelo solo debe restar a partir de estos valores,
  // nunca volver a multiplicar por 10 (eso fue lo que causó piezas de "24 metros" en producción).
  const ci = payload.currentItem || null;
  const dimensionesExterioresMm = (ci && Number(ci.width) > 0 && Number(ci.height) > 0 && Number(ci.depth) > 0)
    ? { ancho_mm: Math.round(Number(ci.width) * 10), alto_mm: Math.round(Number(ci.height) * 10), profundidad_mm: Math.round(Number(ci.depth) * 10) }
    : extractCmDimensionsFromText(payload.message);

  const content = [{
    type: "input_text",
    text: JSON.stringify({ message: payload.message || "", tenant: slimTenant, currentItem: ci, dimensionesExterioresMm })
  }];
  if (typeof payload.imageData === "string" && payload.imageData.startsWith("data:image/")) {
    content.push({ type: "input_image", image_url: payload.imageData });
  }
  try {
    if (payload.skipImageRouter) {
      console.log(`[intent] 2da llamada (skipImageRouter) — generando solo el desglose/JSON de mueble`);
    }
    // Dominio mueble (hay señales semánticas, o ya hay un currentItem, o es la 2da llamada de
    // desglose) → nunca necesita búsqueda web. Solo se deja activa para preguntas generales.
    const isFurnitureDomain = semantic.count > 0 || Boolean(payload.currentItem) || Boolean(payload.skipImageRouter);
    // v55.16: la IA recibe el reloj real del servidor — responde hora/fecha como una IA normal.
    const nowBlock = `\n\n══ AHORA MISMO ══\nFecha y hora actual en Panamá (UTC-5): ${new Date().toLocaleString("es-PA", { timeZone: "America/Panama", dateStyle: "full", timeStyle: "short" })}.`;
    const parsed = await callAI(systemPrompt + pricesBlock + historyBlock + nowBlock, content, !isFurnitureDomain);
    const normalized = normalizeAi(parsed, parsed?.assistantText);
    if (imageDecision === "button") {
      const why = semantic.count >= 2 ? "cambio chico sobre un mueble existente" : "1 señal, ambiguo";
      console.log(`[intent] detector activado: semántico (${why}) — botón "Generar imagen" en vez de gastar una imagen automática`);
      normalized.suggestImage = true;
    }
    sendJson(res, 200, normalized);
  } catch (e) {
    const { status, message } = friendlyAiError(e);
    sendJson(res, status, { error: message });
  }
}

// ── Space analysis — dedicated endpoint for room/photo analysis ─────────────
async function handleSpaceAnalysis(req, res) {
  if (!checkRateLimit(`ai:space:${getClientIp(req)}`, 6, 60000)) {
    sendJson(res, 429, { error: "Demasiados análisis seguidos. Espera 1 minuto." });
    return;
  }
  if (!aiTextAvailable()) {
    sendJson(res, 503, { error: "IA no configurada. Define GEMINI_API_KEY (o OPENAI_API_KEY) en Render para usar análisis de espacios." });
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
    const parsed = await callAI(spacePrompt, userContent);
    const firstItem = Array.isArray(parsed?.items) ? parsed.items[0] : parsed?.item || null;
    sendJson(res, 200, {
      source: lastTextProvider || "openai",
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
// Resolución fija 1024x1024 — nunca pedir algo más grande, para mantener la carga/costo bajos.
const IMAGE_SIZE = "1024x1024";
const PROVIDER_TIMEOUT_MS = 38000; // deja espacio para que el reintento entero quepa en IMAGE_GEN_BUDGET_MS
// Calidad alta por defecto en gpt-image-1 — la calidad visual no se negocia. "low"/"medium"
// quedan disponibles si algún día se pide explícitamente desde el cliente (más barato pero
// con menos detalle), pero NUNCA por default.
// Generación de imagen con Gemini 2.5 Flash Image ("Nano Banana"). Devuelve el mismo
// shape que la cascada, o null para dejar seguir a los otros proveedores.
async function generateImageGemini(prompt) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiImageModel}:generateContent`, {
    method: "POST",
    headers: geminiHeaders(),
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
  });
  const d = await r.json();
  const part = (d.candidates?.[0]?.content?.parts || []).find(p => p.inline_data || p.inlineData);
  const inline = part?.inline_data || part?.inlineData;
  if (r.ok && inline?.data) return { ok: true, imageB64: inline.data, source: geminiImageModel };
  console.log(`[gemini-image] status=${r.status} err="${d.error?.message || "sin imagen"}"`);
  return null;
}

async function generateImageCascade(prompt, quality = "high") {
  const imgPrompt = `${prompt}, photorealistic interior design render, high quality, 4k, soft lighting`;

  // 0. Gemini (si es el motor elegido) — antes que el resto de la cascada.
  if (AI_PROVIDER === "gemini" && hasGemini()) {
    try {
      console.log("[gemini-image] trying...");
      const g = await generateImageGemini(imgPrompt);
      if (g && g.ok) { console.log("[gemini-image] success!"); return g; }
    } catch (e) { console.log(`[gemini-image] exception: ${e.message}`); }
  }

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
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
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
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
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
      console.log(`[gpt-image-1] trying... quality=${quality} prompt="${prompt.slice(0, 150)}"`);
      const ar = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: imageModel, prompt, n: 1, size: IMAGE_SIZE, quality }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
      });
      const ad = await ar.json();
      console.log(`[gpt-image-1] status=${ar.status} err="${ad.error?.message || "ok"}" usage=${JSON.stringify(ad.usage || null)}`);
      if (ar.ok && ad.data?.[0]?.b64_json) {
        return { ok: true, imageB64: ad.data[0].b64_json, source: imageModel, usage: ad.usage };
      }
      if (ar.ok && ad.data?.[0]?.url) {
        return { ok: true, imageUrl: ad.data[0].url, source: imageModel, usage: ad.usage };
      }
      // 402 (no es un status real de la API, es nuestro marcador interno) para no confundir
      // "sin cuota" con el 503 genérico de "servidor ocupado/timeout" de más abajo — esos dos
      // necesitan trato distinto: sin cuota NUNCA hay que reintentar, timeout transitorio sí.
      if (ad.error?.code === "insufficient_quota") return { ok: false, status: 402, error: "La cuenta de OpenAI no tiene crédito/cuota disponible — revisa el plan y la facturación en platform.openai.com." };
      if (ar.status === 429) return { ok: false, status: 429, error: "Demasiadas solicitudes de imagen, espera un momento." };
      if (ar.status === 403) return { ok: false, status: 403, error: "La cuenta de OpenAI no tiene acceso a gpt-image-1 (requiere organización verificada)." };
    } catch (e) { console.log(`[gpt-image-1] exception: ${e.message}`); }
  }

  // 4. Fallback: Pollinations desde el navegador del cliente (diferente IP)
  return { ok: false, status: 503, error: "Servidor de renders ocupado.", pollinations: true };
}

// ── Boceto/referencia → render profesional (image-to-image) ────────────────
// Usa /v1/images/edits (no /generations) — toma la imagen subida por el usuario como base y la
// transforma según el prompt, en vez de generar algo desde cero. gpt-image-1 soporta esto vía
// multipart/form-data; FormData/Blob son globales nativos de Node (18+), cero dependencias nuevas.
const EDIT_TIMEOUT_MS = 75000; // sube un archivo + edita en alta calidad: necesita más margen que PROVIDER_TIMEOUT_MS

// Edición imagen→imagen con Gemini (referencia + instrucción). null → deja probar OpenAI.
async function editImageGemini(imageDataUrl, prompt) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(imageDataUrl || "");
  if (!m) return null;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiImageModel}:generateContent`, {
    method: "POST",
    headers: geminiHeaders(),
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: m[1], data: m[2] } }] }] }),
    signal: AbortSignal.timeout(EDIT_TIMEOUT_MS)
  });
  const d = await r.json();
  const part = (d.candidates?.[0]?.content?.parts || []).find(p => p.inline_data || p.inlineData);
  const inline = part?.inline_data || part?.inlineData;
  if (r.ok && inline?.data) return { ok: true, imageB64: inline.data, source: geminiImageModel };
  console.log(`[gemini-image-edit] status=${r.status} err="${d.error?.message || "sin imagen"}"`);
  return null;
}

async function editImageWithReference(imageDataUrl, prompt, quality = "high") {
  // Gemini primero si es el motor elegido; si no da resultado, cae a OpenAI (si hay clave).
  if (AI_PROVIDER === "gemini" && hasGemini()) {
    try {
      const g = await editImageGemini(imageDataUrl, prompt);
      if (g && g.ok) return g;
    } catch (e) { console.log(`[gemini-image-edit] exception: ${e.message}`); }
  }
  // Misma variable que el resto del archivo (texto y generación desde cero usan esta
  // misma process.env.OPENAI_API_KEY, sin cliente ni configuración aparte) -- el log deja
  // constancia explícita de que se detectó (o no) antes de seguir, para diagnosticar en Render
  // sin adivinar si esta ruta está leyendo algo distinto.
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  console.log(`[enhance-sketch] editImageWithReference: OPENAI_API_KEY detectada=${hasKey}`);
  if (!hasKey) {
    console.log(`[enhance-sketch] abortando: falta OPENAI_API_KEY (mismo nombre de variable que usan el chat de texto y la generación desde texto)`);
    // 401 (no 503) -- así el cliente puede distinguir "no hay clave" de cualquier otra falla
    // (timeout, excepción de red, etc.) que también cae en el catch de abajo con 503.
    return { ok: false, status: 401, error: hasGemini()
      ? "La edición con Gemini no dio resultado y no hay OPENAI_API_KEY de respaldo. Intenta de nuevo."
      : "OPENAI_API_KEY no configurada." };
  }
  const blob = dataUrlToBlob(imageDataUrl);
  if (!blob) {
    console.log(`[enhance-sketch] abortando: la imagen subida no es un data URL válido (dataUrlToBlob devolvió null)`);
    return { ok: false, status: 400, error: "Imagen inválida." };
  }

  const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
  const form = new FormData();
  form.append("model", imageModel);
  form.append("image", blob, `referencia.${ext}`);
  form.append("prompt", prompt);
  form.append("n", "1");
  form.append("size", IMAGE_SIZE);
  form.append("quality", quality);

  try {
    console.log(`[gpt-image-1-edit] trying... quality=${quality} prompt="${prompt.slice(0, 150)}"`);
    const ar = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, // sin Content-Type: FormData pone el boundary correcto
      body: form,
      // Más tiempo que la generación normal: aquí también se sube la imagen de referencia
      // (no solo texto), así que la subida + el procesamiento tardan más.
      signal: AbortSignal.timeout(EDIT_TIMEOUT_MS)
    });
    const ad = await ar.json();
    console.log(`[gpt-image-1-edit] status=${ar.status} err="${ad.error?.message || "ok"}" usage=${JSON.stringify(ad.usage || null)}`);
    if (ar.ok && ad.data?.[0]?.b64_json) {
      logEstimatedImageCost("editImageWithReference", quality, imageModel, ad.usage);
      return { ok: true, imageB64: ad.data[0].b64_json, source: imageModel, usage: ad.usage };
    }
    if (ar.ok && ad.data?.[0]?.url) {
      logEstimatedImageCost("editImageWithReference", quality, imageModel, ad.usage);
      return { ok: true, imageUrl: ad.data[0].url, source: imageModel, usage: ad.usage };
    }
    if (ad.error?.code === "insufficient_quota") return { ok: false, status: 402, error: "La cuenta de OpenAI no tiene crédito/cuota disponible." };
    if (ar.status === 429) return { ok: false, status: 429, error: "Demasiadas solicitudes, espera un momento." };
    if (ar.status === 403) return { ok: false, status: 403, error: "La cuenta de OpenAI no tiene acceso a edición de imágenes (requiere organización verificada)." };
    console.log(`[enhance-sketch] fallo no contemplado arriba: status=${ar.status} error="${ad.error?.message}"`);
    return { ok: false, status: ar.status || 500, error: ad.error?.message || "No se pudo mejorar la imagen." };
  } catch (e) {
    // Timeout (AbortSignal) o error de red al subir el archivo -- NO es un problema de
    // configuración de clave (eso ya se descartó arriba con status 401 antes de llegar aquí).
    console.log(`[enhance-sketch] excepción durante el fetch a /v1/images/edits: ${e.name}: ${e.message}`);
    return { ok: false, status: 503, error: "No se pudo procesar la imagen, intenta de nuevo." };
  }
}

function buildSketchEnhancePrompt(userNote) {
  const base = `Convierte este boceto/dibujo/referencia en un render fotorrealista profesional de
mueble de melamina para ebanistería. Mantén EXACTAMENTE la forma general, la distribución de
espacios, las proporciones y la intención de diseño original — NO inventes una estructura
distinta ni cambies el tipo de mueble. Solo eleva la calidad visual: mejora la iluminación,
los materiales, los acabados de melamina, y el realismo del render, como si fuera una
fotografía profesional de catálogo.`.replace(/\s+/g, " ").trim();
  const note = String(userNote || "").trim();
  return note ? `${base} Detalles adicionales del cliente: ${note}` : base;
}

async function handleEnhanceSketch(req, res) {
  if (!checkRateLimit(`ai:sketch:${getClientIp(req)}`, 5, 60000)) {
    sendJson(res, 429, { error: "Demasiadas imágenes seguidas. Espera 1 minuto." });
    return;
  }
  console.log(`[enhance-sketch] POST /api/enhance-sketch recibido`);
  const body = await readBody(req);
  const payload = body ? JSON.parse(body) : {};
  if (typeof payload.imageData !== "string" || !payload.imageData.startsWith("data:image/")) {
    console.log(`[enhance-sketch] abortando: payload sin imageData válido (tipo recibido: ${typeof payload.imageData})`);
    sendJson(res, 400, { error: "Se requiere una imagen del boceto/referencia." });
    return;
  }
  const prompt = buildSketchEnhancePrompt(payload.message);
  const result = await editImageWithReference(payload.imageData, prompt, "high");
  if (result.ok) {
    sendJson(res, 200, {
      assistantText: "Imagen profesional generada a partir del boceto.",
      imageB64: result.imageB64 || null,
      imageUrl: result.imageUrl || null,
      imageSource: result.source
    });
  } else {
    console.error(`[enhance-sketch] falló: ${result.error}`);
    sendJson(res, result.status || 500, { error: result.error || "No se pudo mejorar la imagen." });
  }
}

// ── Cotización en PDF real (sin depender del diálogo de impresión del navegador) ──
async function handleQuotePdf(req, res) {
  if (!checkRateLimit(`pdf:${getClientIp(req)}`, 15, 60000)) {
    sendJson(res, 429, { error: "Demasiados PDFs seguidos. Espera 1 minuto." });
    return;
  }
  const body = await readBody(req);
  const payload = body ? JSON.parse(body) : {};
  const { kind, quote } = payload;
  if (!quote || !Array.isArray(quote.items)) {
    sendJson(res, 400, { error: "Falta la cotización a exportar." });
    return;
  }

  let brand, taxLabel = null, defaultTaxPct = 0, extraLines = [], summary = null;
  if (kind === "seller") {
    const seller = payload.seller || {};
    const bp = seller.businessProfile || {};
    taxLabel = bp.taxLabel || "ITBMS";
    defaultTaxPct = Number(bp.taxPercent) || 0;
    brand = {
      name: seller.company || seller.name || "Cotización",
      footer: [bp.taxId, bp.website].filter(Boolean).join(" · ")
    };
    const bankLines = String(bp.bankAccounts || "").split("\n").map(l => l.trim()).filter(Boolean);
    if (bankLines.length) extraLines.push({ title: "Cuentas para pago", body: bankLines.join("  /  ") });
  } else {
    const tenant = payload.tenant || {};
    brand = {
      name: tenant.companyName || "Cotización",
      tagline: tenant.theme?.tagline || "",
      footer: [tenant.contactName, tenant.phone, tenant.email].filter(Boolean).join(" · ")
    };
    if (Number(quote.taxPercent) > 0) {
      taxLabel = "Impuesto";
      defaultTaxPct = Number(quote.taxPercent);
    }
    summary = tenant.materials || null;
    if (tenant.terms) extraLines.push({ title: "Condiciones adicionales", body: tenant.terms });
  }

  try {
    const pdfBuffer = buildQuotePdf({ quote, brand, taxLabel, defaultTaxPct, extraLines, summary });
    const filename = `cotizacion-${(quote.number || "sin-numero").replace(/[^a-zA-Z0-9_-]/g, "")}.pdf`;
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": pdfBuffer.length,
      "Access-Control-Allow-Origin": "*"
    });
    res.end(pdfBuffer);
  } catch (e) {
    console.error("[quote-pdf] error generando PDF:", e.message);
    sendJson(res, 500, { error: "No se pudo generar el PDF: " + e.message });
  }
}

async function handleGenerateImage(req, res) {
  if (!checkRateLimit(`ai:image:${getClientIp(req)}`, 5, 60000)) {
    sendJson(res, 429, { error: "Demasiadas imágenes seguidas. Espera 1 minuto." });
    return;
  }
  const body = await readBody(req);
  const { prompt, quality: requestedQuality } = body ? JSON.parse(body) : {};
  if (!prompt) { sendJson(res, 400, { error: "Se requiere prompt." }); return; }

  // Calidad alta por defecto — solo baja si el cliente la pide explícitamente como "low"/"medium".
  const quality = requestedQuality === "low" || requestedQuality === "medium" ? requestedQuality : "high";
  console.log(`[image] /api/generate-image quality=${quality} prompt="${String(prompt).slice(0, 200)}"`);
  const result = await generateImageWithRetry(prompt, quality);
  if (result.ok) {
    sendJson(res, 200, result);
  } else {
    console.error(`[image] /api/generate-image falló: ${result.error}`);
    sendJson(res, result.status || 503, { error: result.error, pollinations: result.pollinations });
  }
}

async function handleAuthAdmin(req, res) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`auth:admin:${ip}`, 8, 60000)) {
    logActivity({ actorType: "admin", actorId: "admin", actorLabel: "Admin", action: "auth.rate_limited", meta: { ip } });
    sendJson(res, 429, { error: "Demasiados intentos. Espera 1 minuto." });
    return;
  }
  if (!ADMIN_PASSWORD) {
    // Producción sin ADMIN_PASSWORD configurada: el acceso admin queda cerrado.
    logActivity({ actorType: "admin", actorId: "admin", actorLabel: "Admin", action: "auth.login.rejected_unconfigured", meta: { ip } });
    sendJson(res, 503, { error: "Acceso administrativo no configurado. Define ADMIN_PASSWORD en las variables de entorno." });
    return;
  }
  const body = await readBody(req);
  const { password } = safeJson(body, {});
  if (!password || !safeCompare(password, ADMIN_PASSWORD)) {
    logActivity({ actorType: "admin", actorId: "admin", actorLabel: "Admin", action: "auth.login.failed", meta: { ip } });
    sendJson(res, 401, { error: "Contraseña incorrecta." });
    return;
  }
  const token = createSession();
  logActivity({ actorType: "admin", actorId: "admin", actorLabel: "Admin", action: "auth.login", meta: { ip } });
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
  const ip = getClientIp(req);
  if (!checkRateLimit(`auth:ebanista:${ip}`, 15, 60000)) {
    sendJson(res, 429, { error: "Demasiados intentos. Espera 1 minuto." });
    return;
  }
  const body = await readBody(req);
  const { code, password } = safeJson(body, {});
  // El "usuario" del ebanista puede ser su CORREO o su código de acceso (compatibilidad).
  const q = String(code || "").trim().toLowerCase();
  const tenant = tenants.find(t => t.accessCode === code || (t.email && t.email.toLowerCase() === q));
  if (!tenant) { sendJson(res, 401, { error: "Correo o código no válido." }); return; }
  if (tenant.passwordHash && !verifyPassword(password, tenant.passwordSalt, tenant.passwordHash)) {
    logActivity({ actorType: "ebanista", actorId: tenant.id, actorLabel: tenant.companyName, action: "auth.login.failed", meta: { ip } });
    sendJson(res, 401, { error: "Contraseña incorrecta." });
    return;
  }
  if (!isTenantActive(tenant)) {
    sendJson(res, 403, { error: tenant.status === "pending"
      ? "Tu cuenta está en revisión. Te activaremos pronto y podrás entrar con tu correo y contraseña."
      : "Tu acceso está suspendido o venció. Contacta al administrador." });
    return;
  }
  const token = createEbanistaSession(tenant.id);
  logActivity({ actorType: "ebanista", actorId: tenant.id, actorLabel: tenant.companyName, action: "auth.login", meta: { ip } });
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

// Auto-registro de ebanista desde la portada: crea el tenant en estado "pending".
// No puede iniciar sesión hasta que el admin lo apruebe (botón "Activar" en Admin).
async function handleRegisterEbanista(req, res) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`ebreg:${ip}`, 5, 60000)) { sendJson(res, 429, { error: "Demasiados intentos. Espera 1 minuto." }); return; }
  const data = safeJson(await readBody(req), {});
  const companyName = String(data.companyName || "").trim();
  const emailNorm = String(data.email || "").trim().toLowerCase();
  const passwordPlain = data.password && String(data.password).trim();
  if (!companyName) { sendJson(res, 400, { error: "Falta el nombre del taller/ebanistería." }); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNorm)) { sendJson(res, 400, { error: "Ingresa un correo válido." }); return; }
  if (!passwordPlain || passwordPlain.length < 4) { sendJson(res, 400, { error: "La contraseña debe tener al menos 4 caracteres." }); return; }
  if (tenants.some(t => t.email && t.email.toLowerCase() === emailNorm)) { sendJson(res, 409, { error: "Ya existe una cuenta con ese correo." }); return; }
  const { salt, hash } = hashPassword(passwordPlain);
  const tenant = {
    id: crypto.randomUUID(),
    companyName,
    contactName: String(data.contactName || "").trim() || "Contacto",
    phone: String(data.phone || "").trim(),
    email: String(data.email || "").trim(),
    plan: "Básico",
    status: "pending",
    expiresAt: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })(),
    margin: 30, installBase: 75, transportBase: 30,
    materials: "Melamina hidrófuga, canto PVC, herrajes estándar.",
    terms: "60% para iniciar fabricación y 40% contra entrega.",
    accessCode: makeCode(companyName),
    passwordSalt: salt, passwordHash: hash,
    catalog: { furnitureTypes: [], edgeOptions: [], hingeOptions: [], slideOptions: [], handleOptions: [] },
    createdAt: new Date().toISOString(),
    selfRegistered: true
  };
  tenants.push(tenant);
  saveTenants(tenants);
  logActivity({ actorType: "ebanista", actorId: tenant.id, actorLabel: companyName, action: "ebanista.self_registered", meta: { email: emailNorm } });
  sendJson(res, 201, { ok: true, message: "¡Registro recibido! Tu cuenta queda en revisión. Te activaremos pronto y podrás entrar con tu correo y contraseña." });
}

async function handleAuthSeller(req, res) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`auth:seller:${ip}`, 15, 60000)) {
    sendJson(res, 429, { error: "Demasiados intentos. Espera 1 minuto." });
    return;
  }
  const body = await readBody(req);
  const { code, password } = safeJson(body, {});
  const s = sellers.find(s => s.accessCode === code);
  if (!s) { sendJson(res, 401, { error: "Código no válido." }); return; }
  if (s.status !== "active") { sendJson(res, 403, { error: "Cuenta de vendedor suspendida." }); return; }
  if (s.passwordHash && !verifyPassword(password, s.passwordSalt, s.passwordHash)) {
    logActivity({ actorType: "vendedor", actorId: s.id, actorLabel: s.name, action: "auth.login.failed", meta: { ip } });
    sendJson(res, 401, { error: "Contraseña incorrecta." });
    return;
  }
  const token = createSellerSession(s.id);
  logActivity({ actorType: "vendedor", actorId: s.id, actorLabel: s.name, action: "auth.login", meta: { ip } });
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
    // Upsert: the UI creates tenants via PUT with a client-generated id.
    // _restoring: true means syncTenantsFromServer is restoring after a server restart —
    // in that case we must NOT regenerate a random password (it would break the ebanista's
    // existing password; the plain text was shown once at creation and never stored).
    const isRestoring = Boolean(data._restoring);
    const tenant = { ...data, id };
    delete tenant._restoring;
    if (!tenant.accessCode) tenant.accessCode = makeCode(tenant.companyName || "ebanista");
    let passwordPlain;
    if (data.password && String(data.password).trim()) {
      passwordPlain = String(data.password).trim();
    } else if (!isRestoring) {
      passwordPlain = generatePassword();
    }
    if (passwordPlain) {
      const { salt, hash } = hashPassword(passwordPlain);
      tenant.passwordSalt = salt;
      tenant.passwordHash = hash;
    }
    delete tenant.password;
    tenants.push(tenant);
    saveTenants(tenants);
    sendJson(res, 200, passwordPlain ? { ...publicTenant(tenant), passwordPlain } : publicTenant(tenant));
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

// ── Cache-busting por build ────────────────────────────────────────────────
// index.html referencia /app.js y /styles.css. Sin versión, un navegador que
// cacheó esos assets en un deploy viejo los sigue usando aunque el HTML cambie.
// BUILD_ID = mtime más reciente de los 3 archivos → cambia en cada deploy. Se
// inyecta como ?v=BUILD_ID, forzando al navegador a bajar la versión nueva sin
// que el usuario tenga que limpiar caché (Ctrl+Shift+R).
function computeBuildId() {
  let m = 0;
  for (const f of ["app.js", "styles.css", "index.html"]) {
    try { m = Math.max(m, fs.statSync(path.join(rootDir, f)).mtimeMs); } catch {}
  }
  return Math.floor(m).toString(36);
}
const BUILD_ID = computeBuildId();
const _htmlCache = {}; // { normal:{raw,gz}, admin:{raw,gz} } — HTML versionado y gzip

function serveIndexHtml(req, res, adminGate) {
  try {
    const key = adminGate ? "admin" : "normal";
    let entry = _htmlCache[key];
    if (!entry) {
      let html = fs.readFileSync(path.join(rootDir, "index.html"), "utf-8")
        .replace('href="/styles.css"', `href="/styles.css?v=${BUILD_ID}"`)
        .replace('src="/app.js"', `src="/app.js?v=${BUILD_ID}"`);
      if (adminGate) html = html.replace("</head>", "<script>window.__PILLA_ADMIN_GATE__=1</script></head>");
      const raw = Buffer.from(html, "utf-8");
      entry = { raw, gz: zlib.gzipSync(raw, { level: 6 }) };
      _htmlCache[key] = entry;
    }
    const acceptsGzip = /\bgzip\b/.test(req.headers["accept-encoding"] || "");
    const body = acceptsGzip ? entry.gz : entry.raw;
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": body.length,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cache-Control": "no-cache",
      "Vary": "Accept-Encoding",
      ...(adminGate ? { "X-Robots-Tag": "noindex, nofollow" } : {}),
      ...(acceptsGzip ? { "Content-Encoding": "gzip" } : {})
    });
    res.end(body);
  } catch { res.writeHead(404); res.end("Not found"); }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const isAdminGate = url.pathname === ADMIN_ACCESS_PATH || url.pathname === ADMIN_ACCESS_PATH + "/";
  // Friendly profile URLs — sirven index.html (el JS detecta el slug). El slug
  // nunca lleva punto: así /c/app.js (un asset) NO cae aquí.
  const isProfileUrl = /^\/(p|c)\/[^/.]+\/?$/.test(url.pathname);
  // Toda página HTML pasa por serveIndexHtml (versión inyectada + admin gate)
  if (isAdminGate || isProfileUrl || url.pathname === "/" || url.pathname === "/index.html") {
    serveIndexHtml(req, res, isAdminGate);
    return;
  }

  const filePath = path.normalize(path.join(rootDir, url.pathname));
  if (!filePath.startsWith(rootDir)) { res.writeHead(403); res.end("Forbidden"); return; }

  // ── Seguridad (v55.0): serveStatic sirve CUALQUIER archivo bajo la raíz. Sin
  // este filtro se podían descargar los .json de datos (tenants/professionals…,
  // con hashes de contraseña + PII) o el código de server.js/routes/*/lib/*.
  // Solo se permiten assets web reales; los .js se limitan a los scripts cliente.
  {
    const pth = url.pathname.toLowerCase();
    const base = pth.slice(pth.lastIndexOf("/") + 1);
    const ext2 = path.extname(pth);
    const CLIENT_JS = new Set(["/app.js", "/mobile-bridge.js", "/icons.js"]);
    const DATA_EXT = new Set([".json", ".ndjson", ".env", ".md", ".mjs", ".lock", ".yaml", ".yml", ".map"]);
    const SRC_DIRS = /^\/(routes|lib|node_modules|movil|\.git|\.claude)\//;
    if (DATA_EXT.has(ext2) || (ext2 === ".js" && !CLIENT_JS.has(pth)) || SRC_DIRS.test(pth) || base.startsWith(".")) {
      res.writeHead(404); res.end("Not found"); return;
    }
  }
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile()) { res.writeHead(404); res.end("Not found"); return; }
    const ext = path.extname(filePath);
    const lastMod = new Date(st.mtimeMs).toUTCString();
    // Assets con ?v=BUILD_ID son inmutables (cambian de URL en cada deploy) →
    // caché larga. Sin versión → revalidar siempre (no-cache).
    const versioned = url.searchParams.has("v");
    const cacheHeader = versioned ? "public, max-age=31536000, immutable" : "no-cache";

    if (!versioned && req.headers["if-modified-since"] === lastMod) {
      res.writeHead(304, { "Last-Modified": lastMod, "Cache-Control": cacheHeader, "Vary": "Accept-Encoding" });
      res.end();
      return;
    }

    let entry = _staticCache.get(filePath);
    if (!entry || entry.mtimeMs !== st.mtimeMs || entry.size !== st.size) {
      const raw = await readFile(filePath);
      entry = { mtimeMs: st.mtimeMs, size: st.size, raw, gz: null };
      if (COMPRESSIBLE_EXT.has(ext) && raw.length > 1024) entry.gz = zlib.gzipSync(raw, { level: 6 });
      if (st.size <= 5_000_000) _staticCache.set(filePath, entry);
    }

    const acceptsGzip = /\bgzip\b/.test(req.headers["accept-encoding"] || "");
    const body = acceptsGzip && entry.gz ? entry.gz : entry.raw;
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Content-Length": body.length,
      "X-Content-Type-Options": "nosniff",
      "Last-Modified": lastMod,
      "Cache-Control": cacheHeader,
      "Vary": "Accept-Encoding",
      ...(acceptsGzip && entry.gz ? { "Content-Encoding": "gzip" } : {})
    });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}

// Caché de estáticos para serveStatic() — ver comentario arriba
const _staticCache = new Map(); // filePath -> { mtimeMs, size, raw, gz }
const COMPRESSIBLE_EXT = new Set([".html", ".css", ".js", ".json", ".svg", ".txt", ".xml"]);

// ── Backup / Restore ─────────────────────────────────────────────────────────
// Lee TODOS los archivos JSON de la app en un solo objeto para descarga.
// Permite restaurar los datos después de que Render (free plan) pierde el
// filesystem al reiniciar el contenedor — el único mecanismo viable sin pagar
// por un Render Disk o base de datos externa.
const BACKUP_DATA_FILES = {
  tenants:               TENANTS_FILE,
  sellers:               SELLERS_FILE,
  handoffs:              HANDOFFS_FILE,
  prices:                PRICES_FILE,
  professionals:         path.join(__dirname, "professionals.json"),
  professional_ratings:  path.join(__dirname, "professional_ratings.json"),
  companies:             path.join(__dirname, "companies.json"),
  retazos:               path.join(__dirname, "retazos.json"),
  usuarios_gratuitos:    path.join(__dirname, "usuarios_gratuitos.json"),
  ads:                   path.join(__dirname, "ads.json"),
  catalog_categories:    path.join(__dirname, "catalog_categories.json"),
  company_products:      path.join(__dirname, "company_products.json"),
  plans:                 path.join(__dirname, "plans.json"),
  roles:                 path.join(__dirname, "roles.json"),
  locations:             path.join(__dirname, "locations.json"),
  ai_usage:              AI_USAGE_FILE,
};

function createBackup() {
  const backup = { _version: 2, _created: new Date().toISOString(), _build: "v42" };
  for (const [key, file] of Object.entries(BACKUP_DATA_FILES)) {
    try { backup[key] = JSON.parse(fs.readFileSync(file, "utf-8")); }
    catch { backup[key] = null; }
  }
  return backup;
}

function restoreBackup(backup) {
  if (!backup || backup._version < 1) throw new Error("Formato de backup inválido.");
  const restored = [];
  for (const [key, file] of Object.entries(BACKUP_DATA_FILES)) {
    const data = backup[key];
    if (data === undefined || data === null) continue;
    try { atomicWrite(file, data); restored.push(key); }
    catch (e) { console.error(`[restore] ${key}: ${e.message}`); }
  }
  // Recargar arrays en memoria de server.js
  tenants  = loadTenants();
  sellers  = loadSellers();
  handoffs = loadHandoffs();
  prices   = loadPrices();
  // Recargar los módulos de rutas (cada uno expone reload() si tiene estado propio)
  for (const mod of routeModules) { if (typeof mod.reload === "function") mod.reload(); }
  return restored;
}

// ── Schema migrations ─────────────────────────────────────────────────────────
// Se ejecuta DESPUÉS de cargar cada archivo. Agrega campos con valores por
// defecto a registros antiguos que no los tienen, sin alterar los existentes.
// Nunca borra ni renombra campos — solo adiciones. Seguro de ejecutar varias veces.
function migrateTenants() {
  let dirty = false;
  tenants = tenants.map(t => {
    const patched = {
      plan: "Básico", status: "active", margin: 30, installBase: 75, transportBase: 30,
      materials: "", terms: "", prices: {}, theme: {},
      catalog: { furnitureTypes: [], edgeOptions: [], hingeOptions: [], slideOptions: [], handleOptions: [] },
      ...t
    };
    if (JSON.stringify(patched) !== JSON.stringify(t)) dirty = true;
    return patched;
  });
  if (dirty) saveTenants(tenants);
}
function migrateSellers() {
  let dirty = false;
  sellers = sellers.map(s => {
    const patched = { status: "active", notes: "", theme: {}, businessProfile: {}, ...s };
    if (JSON.stringify(patched) !== JSON.stringify(s)) dirty = true;
    return patched;
  });
  if (dirty) saveSellers(sellers);
}
function runMigrations() {
  try { migrateTenants(); } catch (e) { console.error("[migration] tenants:", e.message); }
  try { migrateSellers(); } catch (e) { console.error("[migration] sellers:", e.message); }
  console.log("[migrations] completadas");
}

// ── Módulos de rutas nuevos (uno por dominio: profesionales, empresas, retazos...) ──
// require() plano, sin librería de ruteo — mismo mecanismo que ya usa pdf.js arriba.
const routeModules = [
  require("./routes/professionals.js"),
  require("./routes/companies.js"),
  require("./routes/retazos.js"),
  require("./routes/upload.js"),
  require("./routes/admin-config.js"),
  require("./routes/admin-dashboard.js"),
  require("./routes/ads.js"),
  require("./routes/ratings.js"),
  require("./routes/catalog.js"),
  require("./routes/locations.js"),
  require("./routes/platform.js"),
  require("./routes/jobs.js"),
  require("./routes/marketplace.js"),
  require("./routes/academy.js"),
  require("./routes/inspiration.js"),
  require("./routes/referrals.js"),
  require("./routes/vacancies.js"),
  require("./routes/bookings.js"),
  require("./routes/analytics.js")
];

// ── Main router ─────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = url.pathname;
    const parts = p.split("/").filter(Boolean);
    const method = req.method;

    // CORS preflight
    if (method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type,Authorization", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", ...SECURITY_HEADERS }); res.end(); return; }

    // Health
    if (method === "GET" && p === "/api/health") {
      const keySet = Boolean(process.env.OPENAI_API_KEY);
      const activeProvider = (AI_PROVIDER === "gemini" && hasGemini()) ? "gemini" : hasOpenAI() ? "openai" : hasGemini() ? "gemini" : "none";
      console.log(`[health] aiProvider=${activeProvider}, openai=${keySet}, gemini=${hasGemini()}, tenants=${tenants.length}`);
      sendJson(res, 200, {
        aiProvider: activeProvider,
        aiModel: activeProvider === "gemini" ? geminiModel : model,
        openaiConfigured: keySet,
        geminiConfigured: hasGemini(),
        hfConfigured: Boolean(process.env.HF_TOKEN),
        model,
        adminPasswordSet: Boolean(process.env.ADMIN_PASSWORD),
        tenantsCount: tenants.length,
        apiEndpoint: activeProvider === "gemini" ? "generateContent" : "chat/completions",
        build: "2026-06-05-v37"
      });
      return;
    }

    // AI
    if (method === "POST" && p === "/api/ebanista-ai")     { await handleAi(req, res); return; }
    if (method === "POST" && p === "/api/analyze-space")   { await handleSpaceAnalysis(req, res); return; }
    if (method === "POST" && p === "/api/generate-image")  { await handleGenerateImage(req, res); return; }
    if (method === "POST" && p === "/api/enhance-sketch")  { await handleEnhanceSketch(req, res); return; }
    if (method === "POST" && p === "/api/quote-pdf")        { await handleQuotePdf(req, res); return; }

    // Auth
    if (method === "POST" && p === "/api/auth/admin")  { await handleAuthAdmin(req, res); return; }
    if (method === "GET"  && p === "/api/auth/check")  { handleAuthCheck(req, res); return; }
    if (method === "POST" && p === "/api/auth/logout") { await handleAuthLogout(req, res); return; }
    if (method === "POST" && p === "/api/auth/ebanista")        { await handleAuthEbanista(req, res); return; }
    if (method === "GET"  && p === "/api/auth/ebanista/check")  { handleAuthEbanistaCheck(req, res); return; }
    if (method === "POST" && p === "/api/auth/ebanista/logout") { await handleAuthEbanistaLogout(req, res); return; }
    if (method === "POST" && p === "/api/ebanistas/register")   { await handleRegisterEbanista(req, res); return; }
    if (method === "POST" && p === "/api/auth/seller")        { await handleAuthSeller(req, res); return; }
    if (method === "GET"  && p === "/api/auth/seller/check")  { handleAuthSellerCheck(req, res); return; }
    if (method === "POST" && p === "/api/auth/seller/logout") { await handleAuthSellerLogout(req, res); return; }

    // Consumo IA acumulado por día (admin only) — tab "Consumo IA" del panel
    if (method === "GET" && p === "/api/admin/ai-usage") {
      if (!requireAdmin(req, res)) return;
      sendJson(res, 200, { days: aiUsage.days, prices: PRICE_USD, model, imageModel });
      return;
    }

    // Backup / Restore (admin only)
    if (method === "GET" && p === "/api/admin/backup") {
      if (!requireAdmin(req, res)) return;
      const backup = createBackup();
      const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="ebanistas-backup-${ts}.json"`,
        ...SECURITY_HEADERS
      });
      res.end(JSON.stringify(backup, null, 2));
      logActivity({ actorType: "admin", actorId: "admin", actorLabel: "Admin", action: "system.backup.download", meta: {} });
      return;
    }
    if (method === "POST" && p === "/api/admin/restore") {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      const backup = safeJson(body);
      try {
        const restored = restoreBackup(backup);
        logActivity({ actorType: "admin", actorId: "admin", actorLabel: "Admin", action: "system.backup.restore", meta: { restored } });
        sendJson(res, 200, { ok: true, restored, message: `${restored.length} colecciones restauradas correctamente.` });
      } catch (e) {
        sendJson(res, 400, { error: e.message });
      }
      return;
    }

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

    // Módulos de rutas nuevos (profesionales, empresas, retazos, etc.) — cada uno
    // exporta handle(req,res,{method,p,parts}) y devuelve true si ya respondió. Se
    // prueban DESPUÉS de todo el if-chain de arriba (que queda intacto) para que
    // ninguna ruta existente cambie de comportamiento; esto es solo para lo nuevo.
    // tenants/sellers/handoffs son referencias de SOLO LECTURA para módulos que
    // necesitan tallar conteos (dashboard) -- igual que getCallerIdentity, evita que
    // un módulo nuevo tenga que requerir server.js de vuelta (circular).
    for (const mod of routeModules) {
      if (await mod.handle(req, res, { method, p, parts, getCallerIdentity, tenants, sellers, handoffs })) return;
    }

    await serveStatic(req, res);
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Error interno" });
  }
});

server.listen(port, () => {
  runMigrations();
  console.log(`\n🪚  Agente Ebanistas SaaS — http://localhost:${port}`);
  console.log(`   Admin password  : ${!ADMIN_PASSWORD ? "NO configurada — login admin DESHABILITADO (define ADMIN_PASSWORD)" : process.env.ADMIN_PASSWORD ? "configurada ✓" : "admin1234 solo-local (⚠ cambia con ADMIN_PASSWORD=xxx)"}`);
  console.log(`   Acceso admin    : ${ADMIN_ACCESS_PATH}${process.env.ADMIN_ACCESS_PATH ? " (personalizada)" : " (default — personaliza con ADMIN_ACCESS_PATH)"}`);
  const _activeProv = (AI_PROVIDER === "gemini" && hasGemini()) ? "gemini" : hasOpenAI() ? "openai" : hasGemini() ? "gemini" : "ninguno (modo local)";
  console.log(`   Motor IA        : ${_activeProv}${_activeProv === "gemini" ? " (" + geminiModel + ")" : _activeProv === "openai" ? " (" + model + ")" : ""}`);
  console.log(`   Claves IA       : OpenAI ${process.env.OPENAI_API_KEY ? "✓" : "✗"}   Gemini ${hasGemini() ? "✓" : "✗"}`);
  console.log(`   Ebanistas       : ${tenants.length} registrados\n`);
  tenants.forEach(t => console.log(`   • ${t.companyName.padEnd(30)} código: ${t.accessCode}  [${t.status}]`));
  console.log();
});
