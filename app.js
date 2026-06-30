const todayIso = new Date().toISOString().slice(0, 10);

// ── Hardware catalog (must be defined before defaultCatalog) ───────────────
const hardwareCatalog = {
  hinges: [
    { id: "blum_blumotion_110", label: "Blum CLIP top BLUMOTION 110° (cierre suave)", unitCost: 8.50, angle: 110, softClose: true },
    { id: "blum_clip_165", label: "Blum CLIP top 165° apertura amplia", unitCost: 10.00, angle: 165, softClose: false },
    { id: "blum_clip_std", label: "Blum CLIP top estándar 110°", unitCost: 5.50, angle: 110, softClose: false },
    { id: "hafele_softclose", label: "Häfele cierre suave 35mm", unitCost: 7.00, angle: 110, softClose: true },
    { id: "hafele_std", label: "Häfele estándar 35mm", unitCost: 4.00, angle: 110, softClose: false },
    { id: "none", label: "No incluir bisagras", unitCost: 0, angle: 0, softClose: false },
  ],
  drawerSystems: [
    { id: "blum_legrabox", label: "Blum LEGRABOX premium (70 kg)", unitCost: 72, brand: "Blum", maxLoad: 70 },
    { id: "blum_movento", label: "Blum MOVENTO undermount (40 kg, cierre suave)", unitCost: 45, brand: "Blum", maxLoad: 40 },
    { id: "blum_tandem", label: "Blum TANDEMBOX antaro (30 kg)", unitCost: 28, brand: "Blum", maxLoad: 30 },
    { id: "hafele_matrix", label: "Häfele Matrix cierre suave (45 kg)", unitCost: 32, brand: "Häfele", maxLoad: 45 },
    { id: "hafele_std", label: "Häfele telescópica estándar (25 kg)", unitCost: 18, brand: "Häfele", maxLoad: 25 },
    { id: "none", label: "No incluir correderas", unitCost: 0, brand: "", maxLoad: 0 },
  ],
  handles: [
    { id: "bar_320", label: "Barra aluminio 320mm", unitCost: 14 },
    { id: "bar_128", label: "Barra aluminio 128mm", unitCost: 7 },
    { id: "recess_int", label: "Jalador integrado / embutido", unitCost: 15 },
    { id: "push_open", label: "Sin jalador (push-to-open)", unitCost: 18 },
    { id: "premium_inox", label: "Inox premium acero inoxidable", unitCost: 26 },
    { id: "none", label: "No incluir jaladores", unitCost: 0 },
  ]
};

// Derived cost maps from catalog
const hingeCost = Object.fromEntries(hardwareCatalog.hinges.map(h => [h.label, h.unitCost]));
const slideCost = Object.fromEntries(hardwareCatalog.drawerSystems.map(d => [d.label, d.unitCost]));
const handleCost = Object.fromEntries(hardwareCatalog.handles.map(h => [h.label, h.unitCost]));

// ── Melamine color catalog ─────────────────────────────────────────────────
const melaminaColors = [
  { code: "RH01", name: "Blanco Cotton", hex: "#F5F5F0" },
  { code: "RH10", name: "Gris Platino", hex: "#C4C4C0" },
  { code: "RH15", name: "Gris Marengo", hex: "#6B6B6B" },
  { code: "RH20", name: "Grafito", hex: "#3D3D3D" },
  { code: "RH30", name: "Nogal Natural", hex: "#8B6914" },
  { code: "RH35", name: "Roble Arena", hex: "#C8A96E" },
  { code: "RH40", name: "Wengué", hex: "#3D2B1F" },
  { code: "RH50", name: "Cerezo", hex: "#A0522D" },
];

// ── Default catalog (uses hardwareCatalog) ─────────────────────────────────
const defaultCatalog = {
  furnitureTypes: ["Cocina", "Closet", "Vanity", "Centro de entretenimiento", "Mueble de lavandería", "Escritorio", "Otro"],
  edgeOptions: ["No incluir canto", "Solo frentes visibles", "Frentes visibles y puertas", "Todos los cantos expuestos", "Canto premium en todo el mueble"],
  hingeOptions: hardwareCatalog.hinges.map(h => h.label),
  slideOptions: hardwareCatalog.drawerSystems.map(d => d.label),
  handleOptions: hardwareCatalog.handles.map(h => h.label)
};

function cloneCatalog() {
  return JSON.parse(JSON.stringify(defaultCatalog));
}

const defaultTenants = []; // Sin ebanistas de demo — el admin agrega los reales

const complexityMap = {
  low: { label: "Baja", multiplier: 1, days: "5 a 7 días hábiles" },
  medium: { label: "Media", multiplier: 1.3, days: "7 a 12 días hábiles" },
  high: { label: "Alta", multiplier: 1.65, days: "12 a 18 días hábiles" },
  premium: { label: "Premium / especial", multiplier: 2.05, days: "18 a 28 días hábiles" }
};

const furnitureBase = {
  Cocina: 420,
  Closet: 340,
  Vanity: 300,
  "Centro de entretenimiento": 320,
  "Mueble de lavandería": 280,
  Escritorio: 240,
  Otro: 300
};

const thicknessFactor = {
  "15 mm": 0.92,
  "18 mm": 1,
  "25 mm": 1.18,
  "36 mm doble laminado": 1.36
};

const edgeFactor = {
  "No incluir canto": 1,
  "Solo frentes visibles": 1,
  "Frentes visibles y puertas": 1.08,
  "Todos los frentes visibles y puertas": 1.08,
  "Todos los cantos expuestos": 1.14,
  "Canto premium en todo el mueble": 1.25
};

const defaultGlobalPrices = {
  melamina_std: 45, melamina_lg: 85,
  canto_pvc: 0.80, canto_grueso: 2.20, backing_m2: 12,
  bisagra_std: 3.50, bisagra_sc: 7.00,
  corredera_std: 18, corredera_sc: 32,
  jalador_chico: 7, jalador_grande: 14, jalador_premium: 26,
  install_hour: 25, transport_base: 30, transport_km: 0.50,
  kerf_mm: 5, canto_045mm_metro: 0.50, canto_100mm_metro: 0.80, canto_200mm_metro: 2.20
};

// Default display names for each standard price key (editable by admin)
const defaultPriceNames = {
  melamina_std: "Lámina 2440×1220mm",
  melamina_lg: "Lámina 2750×1830mm",
  backing_m2: "Fondo/backing /m²",
  canto_pvc: "Canto PVC 22mm /metro",
  canto_grueso: "Canto grueso 2mm /metro",
  bisagra_std: "Bisagra estándar /un",
  bisagra_sc: "Bisagra cierre suave /un",
  corredera_std: "Corredera estándar /par",
  corredera_sc: "Corredera cierre suave /par",
  jalador_chico: "Jalador 128mm /un",
  jalador_grande: "Jalador 320mm /un",
  jalador_premium: "Jalador inox premium /un",
  install_hour: "Instalación /hora",
  transport_base: "Transporte base",
  transport_km: "Transporte /km adicional",
  kerf_mm: "Kerf de sierra (mm)",
  canto_045mm_metro: "Canto 0.45mm /metro",
  canto_100mm_metro: "Canto 1.00mm /metro",
  canto_200mm_metro: "Canto 2.00mm /metro"
};

function tenantPrices() {
  const tenant = currentTenant();
  if (!tenant?.prices) return state.globalPrices;
  // Un customItems vacío en el tenant NO debe tapar el catálogo global (ej: el catálogo
  // IMECA recién cargado) — solo un tenant que ya agregó sus propios items debe divergir.
  const tenantCustom = Array.isArray(tenant.prices.customItems) && tenant.prices.customItems.length
    ? tenant.prices.customItems
    : (state.globalPrices.customItems || []);
  return {
    ...state.globalPrices,
    ...tenant.prices,
    customItems: tenantCustom,
    _names: { ...(state.globalPrices._names || {}), ...(tenant.prices._names || {}) }
  };
}

// Price groups — defines which keys belong to each group
const priceGroups = [
  { id: "madera",       icon: "🪵", title: "Madera / Melamina",        keys: ["melamina_std","melamina_lg","backing_m2"] },
  { id: "canto",        icon: "🔄", title: "Canto PVC",                keys: ["canto_pvc","canto_grueso","canto_045mm_metro","canto_100mm_metro","canto_200mm_metro"] },
  { id: "cortes",       icon: "✂️", title: "Cortes / nesting",          keys: ["kerf_mm"] },
  { id: "bisagras",     icon: "🔩", title: "Bisagras y correderas",    keys: ["bisagra_std","bisagra_sc","corredera_std","corredera_sc"] },
  { id: "jaladores",    icon: "🪝", title: "Jaladores",                keys: ["jalador_chico","jalador_grande","jalador_premium"] },
  { id: "mano",         icon: "🚚", title: "Mano de obra y transporte",keys: ["install_hour","transport_base","transport_km"] },
  { id: "adhesivos",    icon: "🧴", title: "Pegamentos y solventes",   keys: [] },
  { id: "cerraduras",   icon: "🔐", title: "Cerraduras y herrajes",    keys: [] },
  { id: "herramientas", icon: "🛠️", title: "Herramientas y equipo",    keys: [] },
  { id: "organizacion", icon: "🗄️", title: "Cocina y organización",    keys: [] }
];

const state = {
  tenants: load("tm_tenants", defaultTenants),
  quotes: load("tm_quotes", []),
  selectedTenantId: localStorage.getItem("tm_selected_tenant") || null,
  draftItems: [],
  manualPieces: [],
  editablePieces: [],       // editable cuts table — regenerated per session
  currentImageData: null,
  lastDesignItems: [],
  editingItemId: null,
  aiBackendAvailable: false,
  globalPrices: load("tm_global_prices", defaultGlobalPrices),
  chatHistory: [],          // conversation memory — last N turns for AI context
  sellers: [],                // vendedores — siempre desde servidor, no localStorage
  sellerQuoteItems: [],       // líneas de la cotización de materiales que arma un vendedor
  materialCartItems: [],      // líneas de materiales que arma el ebanista en Cotizar
  currentQuoteForPdf: null    // { kind, quote, tenant?, seller? } — lo que ve "Descargar PDF"
};

if (!state.selectedTenantId || !state.tenants.some((tenant) => tenant.id === state.selectedTenantId)) {
  state.selectedTenantId = state.tenants[0]?.id || null;
}

let _tenantPrices = null; // working copy for ebanista editing their own prices
let _modalPrices  = null; // working copy for admin modal per-tenant prices

// Recuerda la última contraseña en texto plano que se mostró por ebanista/vendedor,
// SOLO en memoria de esta carga de página (nunca a localStorage ni al servidor) — el
// servidor solo guarda el hash y no puede devolverla, así que esto es lo único que
// permite volver a verla si cierras un modal sin copiarla, sin guardar contraseñas
// en texto plano en ningún lado persistente. Se pierde al recargar la página.
const _lastShownPasswords = {};

const els = {
  navItems: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view"),
  tenantSelect: document.getElementById("tenantSelect"),
  tenantList: document.getElementById("tenantList"),
  tenantForm: document.getElementById("tenantForm"),
  tenantId: document.getElementById("tenantId"),
  companyName: document.getElementById("companyName"),
  contactName: document.getElementById("contactName"),
  phone: document.getElementById("phone"),
  email: document.getElementById("email"),
  status: document.getElementById("status"),
  expiresAt: document.getElementById("expiresAt"),
  margin: document.getElementById("margin"),
  installBase: document.getElementById("installBase"),
  transportBase: document.getElementById("transportBase"),
  materials: document.getElementById("materials"),
  terms: document.getElementById("terms"),
  catalogFurnitureTypes: document.getElementById("catalogFurnitureTypes"),
  catalogEdgeOptions: document.getElementById("catalogEdgeOptions"),
  catalogHingeOptions: document.getElementById("catalogHingeOptions"),
  catalogSlideOptions: document.getElementById("catalogSlideOptions"),
  catalogHandleOptions: document.getElementById("catalogHandleOptions"),
  activeCount: document.getElementById("activeCount"),
  suspendedCount: document.getElementById("suspendedCount"),
  quoteCount: document.getElementById("quoteCount"),
  addTenantBtn: document.getElementById("addTenantBtn"),
  resetDemoBtn: document.getElementById("resetDemoBtn"),
  subscriptionBanner: document.getElementById("subscriptionBanner"),
  clientTitle: document.getElementById("clientTitle"),
  clientSummary: document.getElementById("clientSummary"),
  quoteHistory: document.getElementById("quoteHistory"),
  designerLock: document.getElementById("designerLock"),
  designerWorkspace: document.getElementById("designerWorkspace"),
  designImage: document.getElementById("designImage"),
  aiConnectionStatus: document.getElementById("aiConnectionStatus"),
  chatMessages: document.getElementById("chatMessages"),
  chatInput: document.getElementById("chatInput"),
  sendChatBtn: document.getElementById("sendChatBtn"),
  enhanceImageBtn: null,
  mock3dBtn: null,
  imagePreview: null,
  assistantOutput: null,
  sendDesignToQuoteBtn: null,
  quoteLock: document.getElementById("quoteLock"),
  quoteWorkspace: document.getElementById("quoteWorkspace"),
  quoteForm: document.getElementById("quoteForm"),
  quoteItemsList: document.getElementById("quoteItemsList"),
  manualPiecesInput: document.getElementById("manualPiecesInput"),
  addManualPiecesBtn: document.getElementById("addManualPiecesBtn"),
  manualPiecesList: document.getElementById("manualPiecesList"),
  quotePaper: document.getElementById("quotePaper"),
  printQuoteBtn: document.getElementById("printQuoteBtn"),
  cutsLock: document.getElementById("cutsLock"),
  cutsWorkspace: document.getElementById("cutsWorkspace"),
  sheetWidth: document.getElementById("sheetWidth"),
  sheetHeight: document.getElementById("sheetHeight"),
  applySheetPresetBtn: document.getElementById("applySheetPresetBtn"),
  generateCutsBtn: document.getElementById("generateCutsBtn"),
  cutsOutput: document.getElementById("cutsOutput"),
  cutsLayoutOutput: document.getElementById("cutsLayoutOutput"),
  exportCutsBtn: document.getElementById("exportCutsBtn"),
  voiceBtn: document.getElementById("voiceBtn"),
  marginPercent: document.getElementById("marginPercent")
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save() {
  localStorage.setItem("tm_tenants", JSON.stringify(state.tenants));
  localStorage.setItem("tm_quotes", JSON.stringify(state.quotes));
  localStorage.setItem("tm_selected_tenant", state.selectedTenantId);
}

// ── Global prices ────────────────────────────────────────────────────────────
// localStorage is the source of truth for the admin.
// loadGlobalPrices() pushes local → server (never overwrites local with server).
async function loadGlobalPrices() {
  if (window.location.protocol === "file:" || !AUTH.token) return;
  renderPricesForm(); // render immediately from local state
  try {
    await fetch("/api/admin/prices", {
      method: "PUT",
      headers: adminApiHeader(),
      body: JSON.stringify(state.globalPrices)
    });
  } catch {}
}

async function saveGlobalPrices() {
  localStorage.setItem("tm_global_prices", JSON.stringify(state.globalPrices));
  if (!AUTH.token) return;
  try {
    await fetch("/api/admin/prices", {
      method: "PUT",
      headers: adminApiHeader(),
      body: JSON.stringify(state.globalPrices)
    });
  } catch {}
}

// ── Return display label for a melamineSheet key ──────────────────────────
function getMelamineSheetLabel(key) {
  if (!key) return "";
  const tp = tenantPrices();
  if (key.startsWith("custom_")) {
    const ci = (tp.customItems || [])[ Number(key.slice(7)) ];
    return ci ? ci.name : key;
  }
  const names = tp._names || {};
  return names[key] || defaultPriceNames[key] || key;
}

// ── Populate the melamine sheet selector from the prices catalog ─────────
function renderMelamineSheetOptions() {
  const sel = document.getElementById("melamineSheet");
  if (!sel) return;
  const tp = tenantPrices();
  const names = tp._names || {};
  const prev = sel.value;

  // Standard melamine sheets (exclude backing which is a different material)
  const stdOptions = ["melamina_std", "melamina_lg"].map(k => {
    const label = names[k] || defaultPriceNames[k];
    const price = tp[k] ?? defaultGlobalPrices[k];
    return `<option value="${k}">${escapeHtml(label)} — $${price}</option>`;
  });

  // Custom items placed in the "madera" category (may be extra sheet sizes, etc.)
  const customItems = tp.customItems || [];
  const customOptions = customItems
    .filter(item => (item.category || "madera") === "madera")
    .map((item, i) => `<option value="custom_${i}">${escapeHtml(item.name)} — $${item.price}</option>`);

  sel.innerHTML = `<option value="">— Seleccionar lámina —</option>` +
    stdOptions.join("") + customOptions.join("");

  // Restore previous selection if the option still exists
  if (prev && sel.querySelector(`option[value="${CSS.escape(prev)}"]`)) sel.value = prev;
}

function renderPricesFormFor(gridId, pricesObj) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  const names = pricesObj._names || {};
  const customItems = pricesObj.customItems || [];
  grid.innerHTML = priceGroups.map(group => {
    const stdRows = group.keys.map(k => {
      const label = escapeHtml(names[k] || defaultPriceNames[k]);
      const price = pricesObj[k] ?? defaultGlobalPrices[k];
      return `<label class="price-row">
        <input class="price-name-input" data-name-key="${k}" type="text" value="${label}" aria-label="Nombre de ${label}">
        <span class="price-input-wrap">$<input id="price_${k}" data-price-key="${k}" type="number" step="0.01" min="0" class="price-input" value="${price}" aria-label="Precio de ${label}"></span>
      </label>`;
    }).join("");
    const customRows = customItems
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => (item.category || "madera") === group.id)
      .map(({ item, i }) => `<label class="price-row">
        <input class="price-name-input" data-custom-name="${i}" type="text" value="${escapeHtml(item.name)}" aria-label="Nombre ítem">
        <span class="price-input-wrap" style="gap:4px">$<input data-custom-idx="${i}" type="number" step="0.01" min="0" class="price-input" value="${item.price}" style="width:70px" aria-label="Precio ítem">
          <button data-rm-custom="${i}" class="tiny-btn danger" type="button" title="Eliminar" style="font-size:.7rem;padding:2px 6px;line-height:1">✕</button>
        </span>
      </label>`).join("");
    return `<div class="price-group" data-group="${group.id}">
      <h4 class="price-group-title">${group.icon} ${group.title}</h4>
      ${stdRows}${customRows}
    </div>`;
  }).join("");
}

function renderPricesForm() {
  renderPricesFormFor("pricesGrid", state.globalPrices);
  renderMelamineSheetOptions();
}

function collectPricesFromForm() {
  // Collect prices for standard keys from dynamic grid
  const priceInputs = document.querySelectorAll("#pricesGrid [data-price-key]");
  priceInputs.forEach(el => {
    const k = el.dataset.priceKey;
    if (k) state.globalPrices[k] = parseFloat(el.value) || defaultGlobalPrices[k];
  });
  // Collect custom names from dynamic grid
  const nameInputs = document.querySelectorAll("#pricesGrid [data-name-key]");
  if (nameInputs.length) {
    if (!state.globalPrices._names) state.globalPrices._names = {};
    nameInputs.forEach(el => {
      const k = el.dataset.nameKey;
      const defaultName = defaultPriceNames[k];
      const entered = el.value.trim();
      // Only store if different from default to keep storage lean
      if (entered && entered !== defaultName) {
        state.globalPrices._names[k] = entered;
      } else {
        delete state.globalPrices._names[k];
      }
    });
  }
}

function money(value) {
  return new Intl.NumberFormat("es-PA", {
    style: "currency",
    currency: "USD"
  }).format(Number(value || 0));
}

function currentTenant() {
  return state.tenants.find((tenant) => tenant.id === state.selectedTenantId) || state.tenants[0];
}

function ensureCatalog(tenant) {
  if (!tenant.catalog) tenant.catalog = cloneCatalog();
  Object.keys(defaultCatalog).forEach((key) => {
    if (!Array.isArray(tenant.catalog[key]) || tenant.catalog[key].length === 0) {
      tenant.catalog[key] = [...defaultCatalog[key]];
    } else {
      tenant.catalog[key] = [...new Set([...defaultCatalog[key], ...tenant.catalog[key]])];
    }
  });
  return tenant.catalog;
}

function linesToList(value, fallback = []) {
  const list = value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? [...new Set(list)] : [...fallback];
}

function listToLines(list) {
  return (list || []).join("\n");
}

function setSelectOptions(selectId, options, preferred) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const previous = preferred || select.value;
  select.innerHTML = options.map((option) => `<option>${option}</option>`).join("");
  if (options.includes(previous)) select.value = previous;
}

function setAiStatus(mode, text) {
  if (!els.aiConnectionStatus) return;
  els.aiConnectionStatus.className = `ai-status ${mode}`;
  els.aiConnectionStatus.textContent = text;
}

async function checkAiBackend() {
  if (window.location.protocol === "file:") {
    setAiStatus("local", "Modo local activo");
    return;
  }

  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const data = response.ok ? await response.json() : null;
    state.aiBackendAvailable = Boolean(data?.openaiConfigured);
    setAiStatus(
      state.aiBackendAvailable ? "online" : "local",
      state.aiBackendAvailable ? "OpenAI conectado" : "Modo local activo"
    );
  } catch {
    state.aiBackendAvailable = false;
    setAiStatus("local", "Modo local activo");
  }
}

function renderCatalogOptions() {
  const tenant = currentTenant();
  if (!tenant) return;
  const catalog = ensureCatalog(tenant);
  // Furniture type — blank placeholder so nothing is pre-selected
  const ftSel = document.getElementById("furnitureType");
  if (ftSel) {
    ftSel.innerHTML = `<option value="" disabled selected>— Tipo de mueble —</option>` +
      catalog.furnitureTypes.map(t => `<option>${escapeHtml(t)}</option>`).join("");
    ftSel.selectedIndex = 0; // ensure placeholder is visible
  }
  // Hardware selects — blank placeholder; user or AI must pick explicitly
  [
    ["edgeBanding",  catalog.edgeOptions],
    ["hinges",       catalog.hingeOptions],
    ["drawerSlides", catalog.slideOptions],
    ["handles",      catalog.handleOptions]
  ].forEach(([id, options]) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="" disabled selected>— Seleccionar —</option>` +
      options.map(o => `<option>${escapeHtml(o)}</option>`).join("");
    sel.selectedIndex = 0; // ensure placeholder is visible (fillFormFromItem overrides when editing)
  });
}

// Reset every field in the "Agregar mueble" form back to blank/default
function resetModuleForm() {
  // Text and number inputs → empty
  ["itemName","widthCm","heightCm","depthCm","itemManualPrice","itemNotes",
   "doors","drawers","shelves"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  // All selects that must start blank
  ["complexity","melamineSheet","melamineThickness",
   "doorPlacement","drawerPlacement","shelfPlacement","backPlacement"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  // Dimension basis keeps its structural default (external = exterior del mueble)
  const db = document.getElementById("dimensionBasis");
  if (db) db.value = "external";
  // Catalog selects (furnitureType blank, hardware → "No incluir")
  renderCatalogOptions();
  // Color picker → default
  const colorHidden = document.getElementById("selectedColor");
  if (colorHidden) colorHidden.value = "RH01";
  renderColorPicker();
  // Button label
  document.getElementById("addQuoteItemBtn").textContent = "Agregar módulo";
  state.editingItemId = null;
}

function isTenantActive(tenant) {
  return tenant.status === "active" && tenant.expiresAt >= todayIso;
}

function statusLabel(status) {
  return {
    active: "Activo",
    past_due: "Vencido",
    suspended: "Suspendido"
  }[status] || status;
}

function showView(viewId) {
  els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  render();
  if (viewId === "adminView" && AUTH.mode === "admin") loadAdminDashboard();
  if (viewId === "sellersView" && AUTH.mode === "admin") loadSellersFromServer();
  if (viewId === "quoteView" && AUTH.mode === "vendedor") loadSellerQuoteClientOptions();
  if (viewId === "quoteView" && AUTH.mode === "ebanista") { populateQuoteCatalogCompanySelect(); resetMaterialCombo(); }
  if (viewId === "handoffsView") {
    const canSend = AUTH.mode === "ebanista" || AUTH.mode === "vendedor";
    document.getElementById("handoffSendActions")?.classList.toggle("hidden", !canSend);
    document.getElementById("handoffSellerTabs")?.classList.toggle("hidden", AUTH.mode !== "vendedor");
    const sendBtn = document.getElementById("sendHandoffBtn");
    if (sendBtn) sendBtn.textContent = AUTH.mode === "vendedor" ? "Enviar al ebanista" : "Enviar lo que tengo ahora";
    if (canSend) loadHandoffTargetOptions();
    loadHandoffsFromServer();
  }
}

function render() {
  renderTenantSelect();
  renderAdmin();
  renderTenantForm(currentTenant());
  renderCatalogOptions();
  renderColorPicker();
  renderClient();
  renderAccess();
  renderDraftItems();
  renderManualPieces();
  renderSellers();
  updateSendButtonLabels();
  renderSellerQuoteForm();
}

function renderSellerQuoteForm() {
  const ebSection = document.getElementById("ebanistaQuoteFormSection");
  const sqSection = document.getElementById("sellerQuoteFormSection");
  if (!ebSection || !sqSection) return;
  const isSeller = AUTH.mode === "vendedor";
  ebSection.classList.toggle("hidden", isSeller);
  sqSection.classList.toggle("hidden", !isSeller);
  if (!isSeller) return;

  const list = document.getElementById("sellerQuoteItemsList");
  if (!state.sellerQuoteItems.length) {
    list.innerHTML = '<p class="muted">Sin líneas todavía — agrega materiales, herrajes, etc.</p>';
    return;
  }
  list.innerHTML = state.sellerQuoteItems.map(it => `
    <article class="quote-item-card">
      <header>
        <strong>${escapeHtml(it.description)}</strong>
        <span>$${(it.qty * it.unitPrice).toFixed(2)}</span>
      </header>
      <p>${it.qty} ${escapeHtml(it.unit)} × $${Number(it.unitPrice).toFixed(2)} · ${it.taxPercent}% imp.</p>
      <div class="item-btns"><button class="tiny-btn danger" type="button" data-rm-sq-item="${it.id}">Quitar</button></div>
    </article>
  `).join("");
}

function renderTenantSelect() {
  els.tenantSelect.innerHTML = state.tenants.map((tenant) => {
    const selected = tenant.id === state.selectedTenantId ? "selected" : "";
    return `<option value="${tenant.id}" ${selected}>${tenant.companyName}</option>`;
  }).join("");
}

function renderAdmin() {
  const active = state.tenants.filter(isTenantActive).length;
  const suspended = state.tenants.filter(t => !isTenantActive(t)).length;
  els.activeCount.textContent = active;
  els.suspendedCount.textContent = suspended;
  els.quoteCount.textContent = state.quotes.length;

  if (!state.tenants.length) {
    els.tenantList.innerHTML = '<p class="muted" style="padding:1.5rem 0">No hay ebanistas. Haz clic en <strong>+ Nuevo ebanista</strong> para agregar el primero.</p>';
    return;
  }

  els.tenantList.innerHTML = state.tenants.map(t => {
    const act = isTenantActive(t);
    const daysLeft = Math.ceil((new Date(t.expiresAt) - new Date()) / 86400000);
    const badge = act
      ? `<span class="days-badge ${daysLeft > 10 ? "ok" : daysLeft > 3 ? "warn" : "critical"}">${daysLeft}d</span>`
      : `<span class="days-badge critical">Vencido</span>`;
    const feeLabel = t.monthlyFee ? `$${t.monthlyFee}/mes` : "Sin tarifa";
    return `
      <article class="tenant-card">
        <header>
          <div>
            <strong>${escapeHtml(t.companyName)}</strong>
            <p>${feeLabel} · ${t.phone || "—"} · acceso hasta ${t.expiresAt} ${badge}</p>
          </div>
          <span class="status-pill ${act ? "status-active" : "status-suspended"}">${act ? "Activo" : "Vencido"}</span>
        </header>
        <div class="card-actions">
          <button class="tiny-btn highlight-btn" type="button" data-link-tenant="${t.id}">🔗 Ver link</button>
          <button class="tiny-btn" type="button" data-renew-tenant="${t.id}">+30 días</button>
          <button class="tiny-btn" type="button" data-edit-tenant="${t.id}">✏ Editar</button>
          <button class="tiny-btn ${act ? "danger-btn" : ""}" type="button" data-toggle-tenant="${t.id}">${act ? "Suspender" : "Activar"}</button>
          <button class="tiny-btn danger" type="button" data-delete-tenant="${t.id}">🗑 Eliminar</button>
        </div>
      </article>`;
  }).join("");
}

// ── Sub-tabs del Panel de Admin (Dashboard/Profesionales/Empresas/Retazos/...) ──
// Mismo patrón que showView(): toggle de .active/.hidden + carga perezosa de datos
// al entrar a cada sub-tab (no todo de una vez al loguearse como admin).
function adminAuthHeaderAdmin() {
  return { Authorization: `Bearer ${AUTH.token}`, "Content-Type": "application/json" };
}

const ADMIN_TAB_LOADERS = {
  dashboard: loadAdminDashboard,
  profesionales: loadAdminProfessionalsTab,
  empresas: loadAdminCompaniesTab,
  retazos: loadAdminRetazosTab,
  publicidad: loadAdminAdsTab,
  analiticas: loadAdminAnalytics,
  moderacion: loadAdminModeration,
  configuracion: loadAdminPlansEditor,
  logs: () => loadAdminLogs(),
  seguridad: loadAdminRolesView,
  ebanistas: renderAdmin,
  valoraciones: loadAdminRatingsTab,
  catalogo: loadAdminCatalogTab
};

function showAdminTab(tabId) {
  document.querySelectorAll("[data-admin-tab]").forEach(b => b.classList.toggle("active", b.dataset.adminTab === tabId));
  document.querySelectorAll("[data-admin-panel]").forEach(p => p.classList.toggle("hidden", p.dataset.adminPanel !== tabId));
  ADMIN_TAB_LOADERS[tabId]?.();
}
document.querySelectorAll("[data-admin-tab]").forEach(btn => {
  btn.addEventListener("click", () => showAdminTab(btn.dataset.adminTab));
});

function statusBadgeHtml(status) {
  const labels = { pending: "Pendiente", approved: "Aprobado", rejected: "Rechazado", suspended: "Suspendido", active: "Activo", removed: "Eliminado" };
  return `<span class="admin-status-badge ${status}">${labels[status] || status}</span>`;
}

async function loadAdminDashboard() {
  const metricsEl = document.getElementById("adm_dashboardMetrics");
  const activityEl = document.getElementById("adm_dashboardActivity");
  if (!metricsEl) return;
  metricsEl.innerHTML = '<p class="login-hint">Cargando…</p>';
  try {
    const res = await fetch("/api/admin/dashboard", { headers: adminAuthHeaderAdmin() });
    if (!res.ok) { metricsEl.innerHTML = '<p class="login-hint">No se pudo cargar.</p>'; return; }
    const d = await res.json();
    metricsEl.innerHTML = `
      <article class="metric-card"><span>Ebanistas</span><strong>${d.ebanistas.total}</strong></article>
      <article class="metric-card"><span>Vendedores</span><strong>${d.vendedores.total}</strong></article>
      <article class="metric-card"><span>Profesionales</span><strong>${d.professionals.total}</strong></article>
      <article class="metric-card"><span>Pend. profesionales</span><strong>${d.professionals.pending}</strong></article>
      <article class="metric-card"><span>Empresas</span><strong>${d.companies.total}</strong></article>
      <article class="metric-card"><span>Pend. empresas</span><strong>${d.companies.pending}</strong></article>
      <article class="metric-card"><span>Retazos activos</span><strong>${d.retazos.total}</strong></article>
      <article class="metric-card"><span>Envíos a vendedores</span><strong>${d.handoffs.total}</strong></article>`;
    activityEl.innerHTML = d.recentActivity.length
      ? d.recentActivity.map(e => `<div class="admin-log-row"><time>${new Date(e.ts).toLocaleString("es-PA")}</time><span>${escapeHtml(e.actorLabel || e.actorType)} — ${escapeHtml(e.action)}</span></div>`).join("")
      : '<p class="login-hint">Sin actividad registrada todavía.</p>';
  } catch {
    metricsEl.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>';
  }
}

function adminEntityRowHtml(entity, kind) {
  const name = entity.name || entity.company || "(sin nombre)";
  const sub = kind === "professional"
    ? [professionalCategoryLabel(entity.category), entity.specialty, entity.location?.city].filter(Boolean).join(" · ")
    : [companyCategoryLabel(entity.category), entity.location?.city].filter(Boolean).join(" · ");
  const featuredTag = entity.featured ? ' <span class="admin-status-badge approved">★ Destacado</span>' : "";
  return `
    <div class="admin-entity-row" data-entity-id="${entity.id}">
      <div class="admin-entity-info">
        <strong>${escapeHtml(name)}</strong>${statusBadgeHtml(entity.status)}${featuredTag}
        <span>${escapeHtml(sub)}</span>
      </div>
      <div class="admin-entity-actions">
        ${entity.status !== "approved" ? `<button class="tiny-btn" type="button" data-admin-action="approve" data-kind="${kind}" data-id="${entity.id}">✓ Aprobar</button>` : ""}
        ${entity.status !== "rejected" ? `<button class="tiny-btn danger" type="button" data-admin-action="reject" data-kind="${kind}" data-id="${entity.id}">✕ Rechazar</button>` : ""}
        ${entity.status !== "suspended" ? `<button class="tiny-btn" type="button" data-admin-action="suspend" data-kind="${kind}" data-id="${entity.id}">⏸ Suspender</button>` : ""}
        ${entity.featured
          ? `<button class="tiny-btn" type="button" data-admin-action="unfeature" data-kind="${kind}" data-id="${entity.id}">☆ Quitar destacado</button>`
          : `<button class="tiny-btn highlight-btn" type="button" data-admin-action="feature" data-kind="${kind}" data-id="${entity.id}">★ Destacar</button>`}
      </div>
    </div>`;
}

async function runAdminEntityAction(kind, id, action) {
  const endpoint = kind === "professional" ? "professionals" : "companies";
  let body = {};
  if (action === "feature") {
    const days = prompt("¿Por cuántos días queda destacado? (vacío = sin fecha límite)", "30");
    if (days && Number(days) > 0) {
      const d = new Date(); d.setDate(d.getDate() + Number(days));
      body = { featuredUntil: d.toISOString().slice(0, 10) };
    }
  }
  try {
    const res = await fetch(`/api/admin/${endpoint}/${id}/${action}`, { method: "POST", headers: adminAuthHeaderAdmin(), body: JSON.stringify(body) });
    if (!res.ok) { toast("No se pudo completar la acción.", "error"); return; }
    toast("Listo ✓");
    if (kind === "professional") loadAdminProfessionalsTab(); else loadAdminCompaniesTab();
  } catch {
    toast("Sin conexión al servidor.", "error");
  }
}

document.getElementById("adm_professionalsList")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-admin-action]");
  if (!btn) return;
  runAdminEntityAction(btn.dataset.kind, btn.dataset.id, btn.dataset.adminAction);
});
document.getElementById("adm_companiesList")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-admin-action]");
  if (!btn) return;
  runAdminEntityAction(btn.dataset.kind, btn.dataset.id, btn.dataset.adminAction);
});

async function loadAdminProfessionalsTab() {
  const el = document.getElementById("adm_professionalsList");
  if (!el) return;
  el.innerHTML = '<p class="login-hint">Cargando…</p>';
  try {
    const res = await fetch("/api/admin/professionals", { headers: adminAuthHeaderAdmin() });
    const list = res.ok ? await res.json() : [];
    el.innerHTML = list.length ? list.map(p => adminEntityRowHtml(p, "professional")).join("") : '<p class="login-hint">No hay profesionales registrados todavía.</p>';
  } catch { el.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>'; }
}
document.getElementById("adm_refreshProfessionalsBtn")?.addEventListener("click", loadAdminProfessionalsTab);

document.getElementById("adm_addProfessionalBtn")?.addEventListener("click", () => {
  const form = document.getElementById("adm_newProfessionalForm");
  if (!form) return;
  form.classList.toggle("hidden");
  const catSel = document.getElementById("adm_pf_category");
  if (catSel && !catSel.options.length) {
    catSel.innerHTML = PROFESSIONAL_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join("");
  }
});

document.getElementById("adm_saveProfessionalBtn")?.addEventListener("click", async () => {
  const name = document.getElementById("adm_pf_name")?.value.trim();
  const errEl = document.getElementById("adm_pf_error");
  const resultEl = document.getElementById("adm_pf_result");
  errEl.classList.add("hidden");
  resultEl.classList.add("hidden");
  if (!name) { errEl.textContent = "El nombre es obligatorio."; errEl.classList.remove("hidden"); return; }
  const btn = document.getElementById("adm_saveProfessionalBtn");
  btn.disabled = true;
  try {
    const res = await fetch("/api/admin/professionals", {
      method: "POST",
      headers: adminAuthHeaderAdmin(),
      body: JSON.stringify({
        name,
        category: document.getElementById("adm_pf_category")?.value || "otra",
        phone: document.getElementById("adm_pf_phone")?.value.trim() || "",
        whatsapp: document.getElementById("adm_pf_whatsapp")?.value.trim() || "",
        province: document.getElementById("adm_pf_province")?.value.trim() || "",
        city: document.getElementById("adm_pf_city")?.value.trim() || "",
        password: document.getElementById("adm_pf_password")?.value.trim() || ""
      })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || "Error al crear."; errEl.classList.remove("hidden"); return; }
    resultEl.innerHTML = `<strong>✅ Profesional creado</strong><br>Código: <code>${escapeHtml(data.accessCode)}</code> &nbsp; Contraseña: <code>${escapeHtml(data.passwordPlain)}</code><br><em style="color:#6B7280">Comparte estos datos para que el profesional ingrese a su panel.</em>`;
    resultEl.classList.remove("hidden");
    document.getElementById("adm_pf_name").value = "";
    document.getElementById("adm_pf_phone").value = "";
    document.getElementById("adm_pf_whatsapp").value = "";
    document.getElementById("adm_pf_province").value = "";
    document.getElementById("adm_pf_city").value = "";
    document.getElementById("adm_pf_password").value = "";
    loadAdminProfessionalsTab();
  } catch { errEl.textContent = "Sin conexión al servidor."; errEl.classList.remove("hidden"); }
  finally { btn.disabled = false; }
});

async function loadAdminCompaniesTab() {
  const el = document.getElementById("adm_companiesList");
  if (!el) return;
  el.innerHTML = '<p class="login-hint">Cargando…</p>';
  try {
    const res = await fetch("/api/admin/companies", { headers: adminAuthHeaderAdmin() });
    const list = res.ok ? await res.json() : [];
    el.innerHTML = list.length ? list.map(c => adminEntityRowHtml(c, "company")).join("") : '<p class="login-hint">No hay empresas registradas todavía.</p>';
  } catch { el.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>'; }
}
document.getElementById("adm_refreshCompaniesBtn")?.addEventListener("click", loadAdminCompaniesTab);

async function loadAdminRetazosTab() {
  const el = document.getElementById("adm_retazosList");
  if (!el) return;
  el.innerHTML = '<p class="login-hint">Cargando…</p>';
  try {
    const res = await fetch("/api/admin/retazos", { headers: adminAuthHeaderAdmin() });
    const list = res.ok ? await res.json() : [];
    el.innerHTML = list.length ? list.map(r => `
      <div class="admin-entity-row" data-entity-id="${r.id}">
        <div class="admin-entity-info">
          <strong>${escapeHtml(materialLabel(r.material))}${r.color ? " · " + escapeHtml(r.color) : ""}${r.isInspiration ? " (inspiración)" : ""}</strong>${statusBadgeHtml(r.status)}
          <span>${r.thickness ? r.thickness + "mm · " : ""}Cant: ${r.quantity} · ${escapeHtml(r.location?.city || "")} · ${r.ownerType}</span>
        </div>
        <div class="admin-entity-actions">
          ${r.status !== "removed" ? `<button class="tiny-btn danger" type="button" data-remove-retazo="${r.id}">🗑 Eliminar</button>` : ""}
        </div>
      </div>`).join("") : '<p class="login-hint">No hay publicaciones todavía.</p>';
  } catch { el.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>'; }
}
document.getElementById("adm_refreshRetazosBtn")?.addEventListener("click", loadAdminRetazosTab);
document.getElementById("adm_retazosList")?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-remove-retazo]");
  if (!btn) return;
  if (!confirm("¿Eliminar esta publicación?")) return;
  try {
    const res = await fetch(`/api/admin/retazos/${btn.dataset.removeRetazo}`, { method: "DELETE", headers: adminAuthHeaderAdmin() });
    if (res.ok) { toast("Eliminado ✓"); loadAdminRetazosTab(); } else toast("No se pudo eliminar.", "error");
  } catch { toast("Sin conexión al servidor.", "error"); }
});

function categoryBarsHtml(list, labelFn) {
  const counts = {};
  list.forEach(item => { const k = item.category || "otra"; counts[k] = (counts[k] || 0) + 1; });
  const max = Math.max(1, ...Object.values(counts));
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => `
    <div class="admin-bar-row">
      <span class="admin-bar-label">${escapeHtml(labelFn(cat))}</span>
      <div class="util-bar-wrap"><div class="util-bar" style="width:${Math.round(count / max * 100)}%"></div></div>
      <span class="admin-bar-count">${count}</span>
    </div>`).join("") || '<p class="login-hint">Sin datos todavía.</p>';
}

async function loadAdminAnalytics() {
  const profEl = document.getElementById("adm_analyticsProfessionals");
  const coEl = document.getElementById("adm_analyticsCompanies");
  if (!profEl) return;
  profEl.innerHTML = coEl.innerHTML = '<p class="login-hint">Cargando…</p>';
  try {
    const [profs, cos] = await Promise.all([
      fetch("/api/admin/professionals", { headers: adminAuthHeaderAdmin() }).then(r => r.ok ? r.json() : []),
      fetch("/api/admin/companies", { headers: adminAuthHeaderAdmin() }).then(r => r.ok ? r.json() : [])
    ]);
    profEl.innerHTML = categoryBarsHtml(profs, professionalCategoryLabel);
    coEl.innerHTML = categoryBarsHtml(cos, companyCategoryLabel);
  } catch {
    profEl.innerHTML = coEl.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>';
  }
}

async function loadAdminModeration() {
  const el = document.getElementById("adm_moderationList");
  if (!el) return;
  el.innerHTML = '<p class="login-hint">Cargando…</p>';
  try {
    const [profs, cos] = await Promise.all([
      fetch("/api/admin/professionals", { headers: adminAuthHeaderAdmin() }).then(r => r.ok ? r.json() : []),
      fetch("/api/admin/companies", { headers: adminAuthHeaderAdmin() }).then(r => r.ok ? r.json() : [])
    ]);
    const pendingProfs = profs.filter(p => p.status === "pending");
    const pendingCos = cos.filter(c => c.status === "pending");
    if (!pendingProfs.length && !pendingCos.length) { el.innerHTML = '<p class="login-hint">No hay nada pendiente de revisión — todo al día ✓</p>'; return; }
    el.innerHTML = [
      ...pendingProfs.map(p => adminEntityRowHtml(p, "professional")),
      ...pendingCos.map(c => adminEntityRowHtml(c, "company"))
    ].join("");
  } catch { el.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>'; }
}
// Reusa el mismo listener de acciones que profesionales/empresas (delegado por id, no por contenedor)
document.getElementById("adm_moderationList")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-admin-action]");
  if (!btn) return;
  runAdminEntityAction(btn.dataset.kind, btn.dataset.id, btn.dataset.adminAction).then(loadAdminModeration);
});

async function loadAdminPlansEditor() {
  const el = document.getElementById("adm_plansEditor");
  if (!el) return;
  el.innerHTML = '<p class="login-hint">Cargando…</p>';
  try {
    const plans = await (await fetch("/api/plans")).json();
    el.innerHTML = Object.entries(plans).map(([key, plan]) => `
      <div class="subsection" style="margin-bottom:10px">
        <strong>${escapeHtml(plan.label)}</strong>
        <div class="form-grid" style="margin-top:8px">
          <label>Máx. fotos portafolio
            <input type="number" min="0" data-plan-field="maxPortfolioPhotos" data-plan-key="${key}" value="${plan.maxPortfolioPhotos ?? ""}" placeholder="Sin límite">
          </label>
          <label>Máx. publicaciones de retazos
            <input type="number" min="0" data-plan-field="maxRetazoListings" data-plan-key="${key}" value="${plan.maxRetazoListings ?? ""}" placeholder="Sin límite">
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-weight:400">
            <input type="checkbox" data-plan-field="canFeature" data-plan-key="${key}" ${plan.canFeature ? "checked" : ""}> Puede destacarse
          </label>
        </div>
      </div>`).join("");
  } catch { el.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>'; }
}
document.getElementById("adm_savePlansBtn")?.addEventListener("click", async () => {
  const updates = {};
  document.querySelectorAll("[data-plan-key]").forEach(input => {
    const key = input.dataset.planKey, field = input.dataset.planField;
    updates[key] = updates[key] || {};
    if (input.type === "checkbox") updates[key][field] = input.checked;
    else updates[key][field] = input.value === "" ? null : Number(input.value);
  });
  try {
    const res = await fetch("/api/admin/plans", { method: "PUT", headers: adminAuthHeaderAdmin(), body: JSON.stringify(updates) });
    if (res.ok) toast("Planes guardados ✓"); else toast("No se pudo guardar.", "error");
  } catch { toast("Sin conexión al servidor.", "error"); }
});

// ── Backup / Restore ─────────────────────────────────────────────────────────
document.getElementById("adm_downloadBackupBtn")?.addEventListener("click", async () => {
  const btn = document.getElementById("adm_downloadBackupBtn");
  const statusEl = document.getElementById("adm_backupStatus");
  btn.disabled = true;
  btn.textContent = "Generando backup…";
  statusEl.textContent = "";
  try {
    const res = await fetch("/api/admin/backup", { headers: adminAuthHeaderAdmin() });
    if (!res.ok) { statusEl.innerHTML = '<span style="color:#B91C1C">Error al generar backup.</span>'; return; }
    const blob = await res.blob();
    const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ebanistas-backup-${ts}.json`; a.click();
    URL.revokeObjectURL(url);
    statusEl.innerHTML = '<span style="color:#15803D">✅ Backup descargado. Guárdalo en un lugar seguro.</span>';
    toast("Backup descargado ✓");
  } catch (e) {
    statusEl.innerHTML = `<span style="color:#B91C1C">Error: ${escapeHtml(e.message)}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "⬇️ Descargar Backup Completo";
  }
});

document.getElementById("adm_restoreFileInput")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  const statusEl = document.getElementById("adm_backupStatus");
  if (!file) return;
  e.target.value = "";
  if (!confirm(`¿Restaurar el backup "${file.name}"?\n\nEsto REEMPLAZARÁ TODOS los datos actuales del servidor con los del backup. Esta acción no se puede deshacer.`)) return;
  statusEl.innerHTML = '<span style="color:#92400E">Restaurando…</span>';
  try {
    const text = await file.text();
    const res = await fetch("/api/admin/restore", {
      method: "POST",
      headers: { ...adminAuthHeaderAdmin(), "Content-Type": "application/json" },
      body: text
    });
    const data = await res.json();
    if (res.ok) {
      statusEl.innerHTML = `<span style="color:#15803D">✅ ${data.message} (${data.restored?.join(", ")})</span>`;
      toast("Backup restaurado ✓");
    } else {
      statusEl.innerHTML = `<span style="color:#B91C1C">Error: ${escapeHtml(data.error || "desconocido")}</span>`;
    }
  } catch (err) {
    statusEl.innerHTML = `<span style="color:#B91C1C">Error al restaurar: ${escapeHtml(err.message)}</span>`;
  }
});

async function loadAdminRolesView() {
  const el = document.getElementById("adm_rolesList");
  if (!el) return;
  el.innerHTML = '<p class="login-hint">Cargando…</p>';
  try {
    const res = await fetch("/api/roles", { headers: adminAuthHeaderAdmin() });
    const roles = res.ok ? await res.json() : {};
    el.innerHTML = Object.entries(roles).map(([key, role]) => `
      <div class="subsection" style="margin-bottom:8px">
        <strong>${escapeHtml(role.label)}</strong>
        <p class="login-hint" style="margin-top:4px">${role.permissions.map(escapeHtml).join(", ")}</p>
      </div>`).join("");
  } catch { el.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>'; }
}

async function loadAdminLogs() {
  const el = document.getElementById("adm_logsList");
  if (!el) return;
  el.innerHTML = '<p class="login-hint">Cargando…</p>';
  const today = new Date().toISOString().slice(0, 10);
  const from = document.getElementById("adm_logFrom")?.value || today;
  const to = document.getElementById("adm_logTo")?.value || today;
  const action = document.getElementById("adm_logActionFilter")?.value.trim();
  const params = new URLSearchParams({ from, to });
  if (action) params.set("action", action);
  try {
    const res = await fetch(`/api/admin/activity-log?${params.toString()}`, { headers: adminAuthHeaderAdmin() });
    const list = res.ok ? await res.json() : [];
    el.innerHTML = list.length
      ? list.map(e => `<div class="admin-log-row"><time>${new Date(e.ts).toLocaleString("es-PA")}</time><span><strong>${escapeHtml(e.actorType)}</strong> ${escapeHtml(e.actorLabel || "")} — ${escapeHtml(e.action)}</span></div>`).join("")
      : '<p class="login-hint">Sin eventos en ese rango.</p>';
  } catch { el.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>'; }
}
document.getElementById("adm_loadLogsBtn")?.addEventListener("click", loadAdminLogs);

// ── Publicidad / Marketplace (Fase 6) ────────────────────────────────────────
const AD_TYPE_LABELS = { banner_principal: "Banner principal", banner_lateral: "Banner lateral", promocion: "Promoción", cupon: "Cupón" };

async function loadAdminAdsTab() {
  const el = document.getElementById("adm_adsList");
  if (!el) return;
  el.innerHTML = '<p class="login-hint">Cargando…</p>';
  try {
    const res = await fetch("/api/admin/ads", { headers: adminAuthHeaderAdmin() });
    const list = res.ok ? await res.json() : [];
    el.innerHTML = list.length ? list.map(ad => `
      <div class="admin-entity-row" data-entity-id="${ad.id}">
        <div class="admin-entity-info">
          <strong>${escapeHtml(ad.title)}</strong>${statusBadgeHtml(ad.active ? "active" : "pending")}
          <span>${escapeHtml(AD_TYPE_LABELS[ad.type] || ad.type)} · 👁 ${ad.stats.impressions} · 🖱 ${ad.stats.clicks}${ad.endsAt ? " · vence " + ad.endsAt : ""}</span>
          ${ad.paymentNote ? `<span>💲 ${escapeHtml(ad.paymentNote)}</span>` : ""}
        </div>
        <div class="admin-entity-actions">
          <button class="tiny-btn ${ad.active ? "" : "highlight-btn"}" type="button" data-toggle-ad="${ad.id}">${ad.active ? "⏸ Desactivar" : "▶ Activar"}</button>
          <button class="tiny-btn danger" type="button" data-delete-ad="${ad.id}">🗑 Eliminar</button>
        </div>
      </div>`).join("") : '<p class="login-hint">No hay anuncios todavía.</p>';
  } catch { el.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>'; }
}
document.getElementById("adm_refreshAdsBtn")?.addEventListener("click", loadAdminAdsTab);
document.getElementById("adm_adsList")?.addEventListener("click", async (e) => {
  const toggleBtn = e.target.closest("[data-toggle-ad]");
  const delBtn = e.target.closest("[data-delete-ad]");
  if (toggleBtn) {
    await fetch(`/api/admin/ads/${toggleBtn.dataset.toggleAd}/toggle-active`, { method: "POST", headers: adminAuthHeaderAdmin() });
    loadAdminAdsTab();
  } else if (delBtn) {
    if (!confirm("¿Eliminar este anuncio?")) return;
    await fetch(`/api/admin/ads/${delBtn.dataset.deleteAd}`, { method: "DELETE", headers: adminAuthHeaderAdmin() });
    loadAdminAdsTab();
  }
});

document.getElementById("adm_createAdBtn")?.addEventListener("click", async () => {
  const title = document.getElementById("adm_adTitle").value.trim();
  if (!title) { toast("Falta el título.", "error"); return; }
  const payload = {
    type: document.getElementById("adm_adType").value,
    title,
    imageUrl: document.getElementById("adm_adImageUrl").value.trim(),
    linkUrl: document.getElementById("adm_adLinkUrl").value.trim(),
    couponCode: document.getElementById("adm_adCouponCode").value.trim(),
    paymentNote: document.getElementById("adm_adPaymentNote").value.trim(),
    endsAt: document.getElementById("adm_adEndsAt").value || null
  };
  try {
    const res = await fetch("/api/admin/ads", { method: "POST", headers: adminAuthHeaderAdmin(), body: JSON.stringify(payload) });
    if (!res.ok) { toast("No se pudo crear el anuncio.", "error"); return; }
    toast("Anuncio creado (inactivo hasta que lo actives) ✓");
    document.getElementById("adm_adTitle").value = "";
    document.getElementById("adm_adImageUrl").value = "";
    document.getElementById("adm_adLinkUrl").value = "";
    document.getElementById("adm_adCouponCode").value = "";
    document.getElementById("adm_adPaymentNote").value = "";
    document.getElementById("adm_adEndsAt").value = "";
    loadAdminAdsTab();
  } catch { toast("Sin conexión al servidor.", "error"); }
});

function renderTenantForm(tenant) {
  if (!tenant) return;
  const catalog = ensureCatalog(tenant);
  els.tenantId.value = tenant.id;
  els.companyName.value = tenant.companyName;
  els.contactName.value = tenant.contactName;
  els.phone.value = tenant.phone;
  els.email.value = tenant.email;
  els.status.value = tenant.status;
  els.expiresAt.value = tenant.expiresAt;
  els.margin.value = tenant.margin;
  // Sync visible margin input in quote form (only if not actively editing)
  if (els.marginPercent && document.activeElement !== els.marginPercent) {
    els.marginPercent.value = tenant.margin ?? 30;
  }
  els.installBase.value = tenant.installBase;
  els.transportBase.value = tenant.transportBase;
  els.materials.value = tenant.materials;
  els.terms.value = tenant.terms;
  els.catalogFurnitureTypes.value = listToLines(catalog.furnitureTypes);
  els.catalogEdgeOptions.value = listToLines(catalog.edgeOptions);
  els.catalogHingeOptions.value = listToLines(catalog.hingeOptions);
  els.catalogSlideOptions.value = listToLines(catalog.slideOptions);
  els.catalogHandleOptions.value = listToLines(catalog.handleOptions);
}

function applyTenantTheme(tenant) {
  const root = document.documentElement;
  const theme = tenant?.theme || {};

  // ── Accent color ──────────────────────────────────────────
  if (theme.accentColor) {
    root.style.setProperty("--accent", theme.accentColor);
    root.style.setProperty("--accent-dark", theme.accentColor);
  } else {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-dark");
  }

  // ── Sidebar background ────────────────────────────────────
  if (theme.headerBg) {
    root.style.setProperty("--sidebar-bg", theme.headerBg);
  } else {
    root.style.removeProperty("--sidebar-bg");
  }

  // ── Sidebar text color ────────────────────────────────────
  if (theme.sidebarTextColor) {
    root.style.setProperty("--sidebar-text", theme.sidebarTextColor);
  } else {
    root.style.removeProperty("--sidebar-text");
  }

  // ── Brand-lockup logo (replaces the TM box) ───────────────
  const brandMark = document.querySelector(".brand-mark");
  if (brandMark) {
    brandMark.innerHTML = theme.logoBase64
      ? `<img src="${theme.logoBase64}" alt="Logo">`
      : "TM";
  }

  // ── Chat assistant bubble color ───────────────────────────
  if (theme.chatBubbleColor) {
    root.style.setProperty("--chat-bubble-assistant-bg", theme.chatBubbleColor);
  } else {
    root.style.removeProperty("--chat-bubble-assistant-bg");
  }

  // ── Font family ───────────────────────────────────────────
  document.body.style.fontFamily = theme.fontFamily || "";

  // ── Tagline ───────────────────────────────────────────────
  const taglineEl = document.getElementById("tenantTagline");
  if (taglineEl) taglineEl.textContent = theme.tagline || "";

  // ── Chat greeting bubble ──────────────────────────────────
  const firstBubble = document.querySelector("#chatMessages .chat-bubble.assistant:first-child");
  if (firstBubble) {
    firstBubble.textContent = theme.greeting ||
      "👋 ¡Hola! Cuéntame qué mueble necesitas — tipo, medidas, color y cuarto. Te preparo el diseño técnico con render visual.";
  }

  // ── Tab visibility (only in ebanista mode to avoid hiding admin tabs) ──
  if (AUTH.mode === "ebanista") {
    const navDesign = document.querySelector('[data-view="designerView"]');
    const navQuote  = document.querySelector('[data-view="quoteView"]');
    const navCuts   = document.querySelector('[data-view="cutsView"]');
    if (navDesign) navDesign.style.display = theme.showDesign === false ? "none" : "";
    if (navQuote)  navQuote.style.display  = theme.showQuote  === false ? "none" : "";
    if (navCuts)   navCuts.style.display   = theme.showCuts   === false ? "none" : "";
  }
}

function resetTheme() {
  const root = document.documentElement;
  root.style.removeProperty("--accent");
  root.style.removeProperty("--accent-dark");
  root.style.removeProperty("--sidebar-bg");
  root.style.removeProperty("--sidebar-text");
  root.style.removeProperty("--chat-bubble-assistant-bg");
  document.body.style.fontFamily = "";
  const brandMark = document.querySelector(".brand-mark");
  if (brandMark) brandMark.innerHTML = "TM";
  const taglineEl = document.getElementById("tenantTagline");
  if (taglineEl) taglineEl.textContent = "";
}

function renderClient() {
  const tenant = currentTenant();
  if (!tenant) return;
  const active = isTenantActive(tenant);

  // In ebanista mode: hide tenant switcher so they can't switch to other profiles
  const switcher = document.getElementById("tenantSwitcher");
  if (switcher) switcher.style.display = (AUTH.mode === "ebanista" || AUTH.mode === "vendedor") ? "none" : "";

  // Apply tenant theme only in ebanista mode — admin UI must not change when switching profiles
  if (AUTH.mode === "ebanista") {
    applyTenantTheme(tenant);
  } else {
    resetTheme();
  }

  // Show logo if available (from theme or legacy logoBase64)
  const logoSrc = tenant.theme?.logoBase64 || tenant.logoBase64;
  if (logoSrc) {
    els.clientTitle.innerHTML = `<img src="${logoSrc}" alt="Logo" style="max-height:32px;max-width:80px;object-fit:contain;vertical-align:middle;margin-right:.5rem">Agente IA de ${tenant.companyName}`;
  } else {
    els.clientTitle.textContent = `Agente IA de ${tenant.companyName}`;
  }

  els.subscriptionBanner.className = `subscription-banner active ${active ? "ok" : "danger"}`;
  els.subscriptionBanner.textContent = active
    ? `Acceso activo hasta ${tenant.expiresAt}.`
    : "Acceso vencido. Contacta al administrador para renovar.";

  els.clientSummary.innerHTML = summaryItem("Ebanista", escapeHtml(tenant.contactName || tenant.companyName))
    + summaryItem("Empresa", escapeHtml(tenant.companyName))
    + summaryItem("Estado", active ? "✅ Activo" : "⛔ Vencido")
    + summaryItem("Acceso hasta", tenant.expiresAt)
    + summaryItem("Margen", `${tenant.margin}%`)
    + summaryItem("Contacto", tenant.phone || "—");

  // Populate per-tenant prices grid if present
  if (document.getElementById("tenantPricesGrid")) {
    _tenantPrices = { ...tenantPrices(), customItems: [...(tenantPrices().customItems || [])] };
    renderPricesFormFor("tenantPricesGrid", _tenantPrices);
  }

  const tenantQuotes = state.quotes.filter((quote) => quote.tenantId === tenant.id);
  els.quoteHistory.innerHTML = tenantQuotes.length ? tenantQuotes.map((quote) => `
    <article class="history-card" data-view-quote="${quote.id}" style="cursor:pointer" title="Ver cotización">
      <header>
        <strong>${escapeHtml(quote.finalClient || "Sin cliente")}</strong>
        <div style="display:flex;align-items:center;gap:8px">
          <span>${money(quote.total)}</span>
          <button class="tiny-btn danger" data-delete-quote="${quote.id}" type="button" title="Borrar cotización" style="font-size:.7rem;padding:2px 7px;line-height:1.4">✕</button>
        </div>
      </header>
      <p>${quote.items?.length || 1} mueble(s) · ${quote.createdAt}</p>
    </article>
  `).join("") : `<p class="muted">Todavía no hay cotizaciones para esta empresa.</p>`;
}

function summaryItem(label, value) {
  return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
}

function renderAccess() {
  const tenant = currentTenant();
  const active = tenant && isTenantActive(tenant);
  els.quoteLock.classList.toggle("hidden", active);
  els.quoteWorkspace.classList.toggle("hidden", !active);
  els.designerLock.classList.toggle("hidden", active);
  els.designerWorkspace.classList.toggle("hidden", !active);
  els.cutsLock.classList.toggle("hidden", active);
  els.cutsWorkspace.classList.toggle("hidden", !active);
}

function addTenant() { openEbanistaModal(null); }

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getTenantLink(tenant) {
  // Ensure accessCode is always set before generating the link
  if (!tenant.accessCode) {
    const prefix = (tenant.companyName || "ebanista")
      .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "").slice(0, 8) || "ebanista";
    tenant.accessCode = `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
    save();
  }
  // Short link — ebanista always fetches fresh data from server (theme, etc. always up to date)
  return `${window.location.origin}/?code=${tenant.accessCode}`;
}

function getSellerLink(seller) {
  return `${window.location.origin}/?scode=${seller.accessCode}`;
}

let _ebModalEditId = null;

function openEbanistaModal(editId) {
  _ebModalEditId = editId || null;
  const t = editId ? state.tenants.find(t => t.id === editId) : null;
  document.getElementById("ebanistaModalTitle").textContent = editId ? "Editar ebanista" : "Nuevo ebanista";
  document.getElementById("em_company").value = t?.companyName || "";
  document.getElementById("em_contact").value = t?.contactName || "";
  document.getElementById("em_phone").value = t?.phone || "";
  document.getElementById("em_fee").value = t?.monthlyFee || "";
  document.getElementById("em_margin").value = t?.margin ?? 30;
  document.getElementById("em_expires").value = t?.expiresAt || addDays(30);
  document.getElementById("em_password").value = "";
  // Theme fields
  const theme = t?.theme || {};
  document.getElementById("em_accentColor").value       = theme.accentColor       || "#6366F1";
  document.getElementById("em_headerBg").value          = theme.headerBg          || "#162a25";
  document.getElementById("em_sidebarTextColor").value  = theme.sidebarTextColor  || "#ffffff";
  document.getElementById("em_chatBubbleColor").value   = theme.chatBubbleColor   || "#f3f4f6";
  document.getElementById("em_fontFamily").value     = theme.fontFamily     || "";
  document.getElementById("em_tagline").value        = theme.tagline        || "";
  document.getElementById("em_greeting").value       = theme.greeting       || "";
  const cbShowDesign = document.getElementById("em_showDesign");
  const cbShowQuote  = document.getElementById("em_showQuote");
  const cbShowCuts   = document.getElementById("em_showCuts");
  if (cbShowDesign) cbShowDesign.checked = theme.showDesign !== false;
  if (cbShowQuote)  cbShowQuote.checked  = theme.showQuote  !== false;
  if (cbShowCuts)   cbShowCuts.checked   = theme.showCuts   !== false;
  // Always clear pending logo from a previous modal open so it doesn't leak to other ebanistas
  const logoFile = document.getElementById("em_logoFile");
  if (logoFile) { logoFile.value = ""; logoFile._pendingB64 = null; }
  const preview = document.getElementById("em_logoPreview");
  const logoImg = document.getElementById("em_logoImg");
  if (preview && logoImg) {
    if (theme.logoBase64) { logoImg.src = theme.logoBase64; preview.style.display = ""; }
    else preview.style.display = "none";
  }
  document.getElementById("em_result").classList.add("hidden");
  document.getElementById("em_actions").style.display = "";
  const btn = document.getElementById("saveEbanistaModalBtn");
  if (btn) { btn.textContent = "Guardar y ver link →"; btn.disabled = false; }
  document.getElementById("ebanistaModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("em_company").focus(), 80);

  // Initialize per-tenant prices for this modal
  const existingPrices = t?.prices || {};
  _modalPrices = { ...state.globalPrices, ...existingPrices,
    customItems: [...(existingPrices.customItems || state.globalPrices.customItems || [])],
    _names: { ...(state.globalPrices._names || {}), ...(existingPrices._names || {}) }
  };
  renderPricesFormFor("em_pricesGrid", _modalPrices);
}

function closeEbanistaModal() {
  document.getElementById("ebanistaModal").classList.add("hidden");
  _ebModalEditId = null;
}

async function saveEbanistaFromModal() {
  const company = document.getElementById("em_company").value.trim();
  if (!company) {
    document.getElementById("em_company").focus();
    return;
  }
  const btn = document.getElementById("saveEbanistaModalBtn");
  btn.textContent = "Guardando…"; btn.disabled = true;

  const id = _ebModalEditId || crypto.randomUUID();
  const existing = state.tenants.find(t => t.id === id);
  const accessCode = existing?.accessCode ||
    `${company.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "").slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`;

  const tenantData = {
    ...(existing || {}), id,
    companyName: company,
    contactName: document.getElementById("em_contact").value.trim() || "Contacto",
    phone: document.getElementById("em_phone").value.trim() || "+507",
    email: existing?.email || "",
    monthlyFee: Number(document.getElementById("em_fee").value || 0),
    status: existing?.status || "active",
    expiresAt: document.getElementById("em_expires").value || addDays(30),
    margin: Number(document.getElementById("em_margin").value) || existing?.margin || 30,
    installBase: existing?.installBase ?? 75,
    transportBase: existing?.transportBase ?? 30,
    materials: existing?.materials || "Melamina hidrófuga, canto PVC, herrajes estándar.",
    terms: existing?.terms || "60% para iniciar fabricación y 40% contra entrega.",
    accessCode,
    catalog: existing?.catalog || cloneCatalog(),
    prices: _modalPrices ? { ..._modalPrices } : (existing?.prices || {}),
    theme: {
      accentColor:    document.getElementById("em_accentColor")?.value     || existing?.theme?.accentColor    || "",
      headerBg:       document.getElementById("em_headerBg")?.value        || existing?.theme?.headerBg       || "",
      chatBubbleColor:  document.getElementById("em_chatBubbleColor")?.value   || existing?.theme?.chatBubbleColor   || "",
      sidebarTextColor: document.getElementById("em_sidebarTextColor")?.value  || existing?.theme?.sidebarTextColor  || "",
      fontFamily:       document.getElementById("em_fontFamily")?.value        || existing?.theme?.fontFamily        || "",
      tagline:        document.getElementById("em_tagline")?.value?.trim() || existing?.theme?.tagline        || "",
      greeting:       document.getElementById("em_greeting")?.value?.trim()|| existing?.theme?.greeting       || "",
      logoBase64:     document.getElementById("em_logoFile")?._pendingB64  || existing?.theme?.logoBase64     || "",
      showDesign:     document.getElementById("em_showDesign")?.checked    ?? (existing?.theme?.showDesign ?? true),
      showQuote:      document.getElementById("em_showQuote")?.checked     ?? (existing?.theme?.showQuote  ?? true),
      showCuts:       document.getElementById("em_showCuts")?.checked      ?? (existing?.theme?.showCuts   ?? true)
    }
  };

  if (existing) { Object.assign(existing, tenantData); }
  else { state.tenants.unshift(tenantData); state.selectedTenantId = id; }
  save(); render();

  // La contraseña en texto plano nunca se guarda en tenantData/state — solo se manda
  // al servidor en este request. Si se deja en blanco, el servidor genera una (ebanista
  // nuevo) o no toca la actual (ebanista existente).
  const newPassword = document.getElementById("em_password")?.value.trim() || "";
  const bodyWithPassword = newPassword ? { ...tenantData, password: newPassword } : tenantData;

  // Server sync: siempre se espera la respuesta — el servidor es el que genera/cambia
  // y hashea la contraseña, así que su respuesta es la única forma de mostrársela al admin.
  let passwordPlain = "";
  if (window.location.protocol !== "file:" && AUTH.token) {
    try {
      const res = await fetch(`/api/tenants/${id}`, { method: "PUT", headers: adminApiHeader(), body: JSON.stringify(bodyWithPassword) });
      if (res.ok) { const data = await res.json(); passwordPlain = data.passwordPlain || ""; }
    } catch {}
  }

  const link = getTenantLink(tenantData);
  document.getElementById("em_link").value = link;
  const pwRow = document.getElementById("em_passwordRow");
  if (pwRow) {
    const shown = passwordPlain || _lastShownPasswords[id] || "";
    if (passwordPlain) _lastShownPasswords[id] = passwordPlain;
    if (shown) { document.getElementById("em_passwordDisplay").value = shown; pwRow.classList.remove("hidden"); }
    else { document.getElementById("em_passwordDisplay").value = ""; pwRow.classList.add("hidden"); }
  }
  document.getElementById("em_result").classList.remove("hidden");
  document.getElementById("em_actions").style.display = "none";
  btn.textContent = "Guardado ✓";
  toast(`${company} guardado ✓`);
}

function saveTenant(event) {
  event.preventDefault();
  const tenant = state.tenants.find((item) => item.id === els.tenantId.value);
  if (!tenant) return;

  Object.assign(tenant, {
    companyName: els.companyName.value.trim(),
    contactName: els.contactName.value.trim(),
    phone: els.phone.value.trim(),
    email: els.email.value.trim(),
    status: els.status.value,
    expiresAt: els.expiresAt.value,
    margin: Number(els.margin.value),
    installBase: Number(els.installBase.value),
    transportBase: Number(els.transportBase.value),
    materials: els.materials.value.trim(),
    terms: els.terms.value.trim(),
    catalog: {
      furnitureTypes: linesToList(els.catalogFurnitureTypes.value, defaultCatalog.furnitureTypes),
      edgeOptions: linesToList(els.catalogEdgeOptions.value, defaultCatalog.edgeOptions),
      hingeOptions: linesToList(els.catalogHingeOptions.value, defaultCatalog.hingeOptions),
      slideOptions: linesToList(els.catalogSlideOptions.value, defaultCatalog.slideOptions),
      handleOptions: linesToList(els.catalogHandleOptions.value, defaultCatalog.handleOptions)
    }
  });

  // Logo upload
  const logoFile = document.getElementById("tenantLogo")?.files?.[0];
  if (logoFile) {
    const reader = new FileReader();
    reader.onload = () => { tenant.logoBase64 = reader.result; save(); };
    reader.readAsDataURL(logoFile);
  }

  save();
  render();
  toast("Configuración guardada ✓");
}

function readItemFromForm() {
  const item = {
    id: crypto.randomUUID(),
    name: document.getElementById("itemName").value.trim() || document.getElementById("furnitureType").value,
    furnitureType: document.getElementById("furnitureType").value,
    dimensionBasis: document.getElementById("dimensionBasis").value,
    width: Number(document.getElementById("widthCm").value || 0),
    height: Number(document.getElementById("heightCm").value || 0),
    depth: Number(document.getElementById("depthCm").value || 0),
    complexityKey: document.getElementById("complexity").value,
    doors: Number(document.getElementById("doors").value || 0),
    drawers: Number(document.getElementById("drawers").value || 0),
    shelves: Number(document.getElementById("shelves").value || 0),
    shelfPlacement: document.getElementById("shelfPlacement").value,
    doorPlacement: document.getElementById("doorPlacement").value,
    drawerPlacement: document.getElementById("drawerPlacement").value,
    backPlacement: document.getElementById("backPlacement").value,
    melamineSheet: document.getElementById("melamineSheet")?.value || "",
    melamineThickness: document.getElementById("melamineThickness")?.value || "18 mm",
    edgeBanding: document.getElementById("edgeBanding").value,
    hinges: document.getElementById("hinges").value,
    drawerSlides: document.getElementById("drawerSlides").value,
    handles: document.getElementById("handles").value,
    color: document.getElementById("selectedColor")?.value || "RH01",
    notes: document.getElementById("itemNotes").value.trim(),
    manualPrice: Number(document.getElementById("itemManualPrice").value || 0)
  };

  return calculateItem(item);
}

function calculateItem(item) {
  const complexity = complexityMap[item.complexityKey] || complexityMap.medium;
  const linearMeters = item.width / 100;
  const heightFactor = Math.max(0.85, Math.min(1.55, item.height / 200));
  const depthFactor = Math.max(0.85, Math.min(1.25, item.depth / 55));
  const base = furnitureBase[item.furnitureType] || furnitureBase.Otro;
  const technicalFactor = (thicknessFactor[item.melamineThickness || "18 mm"] || 1) * (edgeFactor[item.edgeBanding] || 1);

  // Scale material cost by the actual melamine sheet price vs reference ($45 std)
  const refSheetPrice = defaultGlobalPrices.melamina_std; // 45
  let sheetPrice = refSheetPrice;
  const sheetKey = item.melamineSheet;
  if (sheetKey) {
    const tp = tenantPrices();
    if (sheetKey.startsWith("custom_")) {
      const ci = (tp.customItems || [])[ Number(sheetKey.slice(7)) ];
      if (ci?.price > 0) sheetPrice = ci.price;
    } else if (tp[sheetKey] > 0) {
      sheetPrice = tp[sheetKey];
    }
  }
  // Weighted factor: 40% fixed + 60% proportional to sheet price
  const melamineFactor = 0.4 + 0.6 * (sheetPrice / refSheetPrice);

  const materialCost = Math.max(85, linearMeters * base * heightFactor * depthFactor * technicalFactor * melamineFactor);
  const hardwareCost = (item.doors * optionCost(hingeCost, item.hinges, 10))
    + (item.drawers * optionCost(slideCost, item.drawerSlides, 20))
    + ((item.doors + item.drawers) * optionCost(handleCost, item.handles, 8))
    + (item.shelves * 5);
  const laborCost = (materialCost * 0.55) + (item.doors * 9) + (item.drawers * 18) + (item.shelves * 6);
  const calculated = Math.ceil(((materialCost + hardwareCost + laborCost) * complexity.multiplier) / 5) * 5;
  const finalPrice = item.manualPrice > 0 ? item.manualPrice : calculated;

  return {
    ...item,
    complexityLabel: complexity.label,
    days: complexity.days,
    materialCost,
    hardwareCost,
    laborCost,
    calculated,
    finalPrice
  };
}

// Returns true if an item spec is empty or "No incluir…" (should not appear in the quote doc)
function noInc(val) { return !val || /^no incluir/i.test(String(val).trim()); }

function optionCost(map, key, fallback) {
  if (!key || String(key).toLowerCase().startsWith("no incluir")) return 0;
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback;
}

function placementLabel(value) {
  return {
    internal: "internas",
    external: "externas",
    overlay: "sobrepuestas exteriores",
    inset: "embutidas / a ras",
    external_front: "frente exterior",
    inset_front: "frente embutido",
    internal_box: "caja interna",
    none: "sin fondo"
  }[value] || value || "sin definir";
}

function renderDraftItems() {
  if (!els.quoteItemsList) return;
  if (!state.materialCartItems.length) {
    els.quoteItemsList.innerHTML = `<p class="muted">Sin materiales. Agrégalos del catálogo, a mano, o pídeselo a la IA en el chat.</p>`;
    return;
  }

  const subtotal = state.materialCartItems.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const cards = state.materialCartItems.map((item, index) => `
    <article class="quote-item-card">
      <header>
        <div>
          <strong>${index + 1}. ${escapeHtml(item.description)}</strong>
          <p>${item.qty} ${escapeHtml(item.unit)} × $<input type="number" class="price-edit-input" min="0" step="0.01" value="${Number(item.unitPrice).toFixed(2)}" data-edit-price="${item.id}" title="Precio del catálogo — edítalo si quieres usar otro para esta cotización"></p>
        </div>
        <span class="item-price">$${(item.qty * item.unitPrice).toFixed(2)}</span>
      </header>
      <div class="item-btns">
        <button class="tiny-btn danger" type="button" data-remove-item="${item.id}">× Quitar</button>
      </div>
    </article>
  `).join("");

  els.quoteItemsList.innerHTML = cards + `
    <div class="draft-subtotal">
      <span>${state.materialCartItems.length} material(es) · Subtotal:</span>
      <strong>$${subtotal.toFixed(2)}</strong>
    </div>
  `;
}

function autoFillCostFields() {
  const tenant = currentTenant();
  if (!tenant) return;
  const tp = tenantPrices();
  const mField = document.getElementById("manoObraField");
  if (mField && mField.value === "") {
    mField.value = Math.ceil((tenant.installBase || 75) + (state.draftItems.length * 28));
  }
  const tField = document.getElementById("transportField");
  if (tField && tField.value === "") {
    tField.value = tp.transport_base ?? tenant.transportBase ?? 30;
  }
}

function fillFormFromItem(item, sourceText = "") {
  document.getElementById("itemName").value = item.name.replace(" propuesto por asistente", "");
  setSelectIfExists("furnitureType", item.furnitureType);
  setSelectIfExists("dimensionBasis", item.dimensionBasis);
  document.getElementById("widthCm").value = item.width;
  document.getElementById("heightCm").value = item.height;
  document.getElementById("depthCm").value = item.depth;
  setSelectIfExists("complexity", item.complexityKey);
  document.getElementById("doors").value = item.doors;
  document.getElementById("drawers").value = item.drawers;
  document.getElementById("shelves").value = item.shelves;
  setSelectIfExists("shelfPlacement", item.shelfPlacement);
  setSelectIfExists("doorPlacement", item.doorPlacement);
  setSelectIfExists("drawerPlacement", item.drawerPlacement);
  setSelectIfExists("backPlacement", item.backPlacement);
  setSelectIfExists("melamineSheet", item.melamineSheet);
  setSelectIfExists("melamineThickness", item.melamineThickness);
  setSelectIfExists("edgeBanding", item.edgeBanding);
  setSelectIfExists("hinges", item.hinges);
  setSelectIfExists("drawerSlides", item.drawerSlides);
  setSelectIfExists("handles", item.handles);
  document.getElementById("itemManualPrice").value = item.manualPrice || "";
  document.getElementById("itemNotes").value = sourceText ? `Interpretado desde solicitud: ${sourceText}` : item.notes || "";
  document.getElementById("addQuoteItemBtn").textContent = state.editingItemId ? "Guardar cambios del mueble" : "Agregar mueble";
  // Restore color picker selection
  if (item.color) {
    const hidden = document.getElementById("selectedColor");
    if (hidden) {
      hidden.value = item.color;
      document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
      document.querySelector(`[data-color-code="${item.color}"]`)?.classList.add("selected");
    }
  }
}

function parseManualPieces(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const parts = line.split(/[;,|]/).map((part) => part.trim());
      const name = parts[0] || "Pieza manual";
      const width = Number(parts[1]);
      const height = Number(parts[2]);
      const qty = Math.max(1, Number(parts[3] || 1));
      const thickness = parts[4] || "18 mm";
      const edge = parts[5] || "Según indicación";

      if (!width || !height) return [];

      return Array.from({ length: qty }, (_, index) => ({
        id: crypto.randomUUID(),
        furniture: "Piezas manuales",
        name: qty > 1 ? `${name} ${index + 1}` : name,
        width: roundCm(width),
        height: roundCm(height),
        thickness,
        edge,
        area: roundCm(width * height)
      }));
    });
}

function renderManualPieces() {
  if (!els.manualPiecesList) return;
  if (!state.manualPieces.length) {
    els.manualPiecesList.innerHTML = `<p class="muted">No hay piezas manuales agregadas.</p>`;
    return;
  }

  els.manualPiecesList.innerHTML = state.manualPieces.map((pieceItem, index) => `
    <article class="quote-item-card">
      <header>
        <div>
          <strong>${index + 1}. ${pieceItem.name}</strong>
          <p>${pieceItem.width} x ${pieceItem.height} cm · ${pieceItem.thickness}</p>
        </div>
        <span>${(pieceItem.area / 10000).toFixed(2)} m²</span>
      </header>
      <p>Canto: ${pieceItem.edge}</p>
      <button class="tiny-btn" type="button" data-remove-manual-piece="${pieceItem.id}">Quitar</button>
    </article>
  `).join("");
}

function buildQuote(form) {
  const tenant = currentTenant();
  const manoObra  = Number(document.getElementById("manoObraField")?.value)  || 0;
  const transport = Number(document.getElementById("transportField")?.value) || 0;
  const itemsSubtotal = state.draftItems.reduce((sum, item) => sum + item.finalPrice, 0);
  const marginPct = Number(els.marginPercent?.value) > 0 ? Number(els.marginPercent.value) : (tenant.margin ?? 30);
  const marginAmount = itemsSubtotal * (marginPct / 100);
  const contingency = itemsSubtotal * 0.08;
  const calculatedTotal = Math.ceil((itemsSubtotal + manoObra + transport + marginAmount + contingency) / 5) * 5;
  const manualTotal = Number(document.getElementById("manualTotal").value || 0);
  const total = manualTotal > 0 ? manualTotal : calculatedTotal;
  const maxDays = state.draftItems.some((item) => item.complexityKey === "premium")
    ? "18 a 28 días hábiles"
    : state.draftItems.some((item) => item.complexityKey === "high")
      ? "12 a 18 días hábiles"
      : "7 a 12 días hábiles";

  return {
    id: crypto.randomUUID(),
    tenantId: tenant.id,
    finalClient: document.getElementById("finalClient").value.trim(),
    projectLocation: document.getElementById("projectLocation").value.trim(),
    validity: Number(document.getElementById("quoteValidity").value || 15),
    notes: document.getElementById("clientNotes").value.trim(),
    items: [...state.draftItems],
    manoObra,
    transport,
    installCost: manoObra,
    transportCost: transport,
    itemsSubtotal,
    calculatedTotal,
    manualTotal,
    total,
    days: maxDays,
    createdAt: todayIso
  };
}

function renderQuotePaper(quote) {
  const tenant = currentTenant();
  state.currentQuoteForPdf = { kind: "ebanista", quote, tenant };
  const logoHtml = tenant.logoBase64
    ? `<img src="${tenant.logoBase64}" alt="Logo" style="max-height:48px;max-width:120px;object-fit:contain;">`
    : `<div class="quote-brand-mark">${tenant.companyName[0]}</div>`;

  els.quotePaper.innerHTML = `
    <article class="quote-doc">
      <header>
        <div class="quote-brand">
          ${logoHtml}
          <strong>${tenant.companyName}</strong>
          <span>Agente cotizador impulsado por TodomarketMR</span>
        </div>
        <div class="quote-meta">
          <strong>Cotización</strong><br>
          Fecha: ${quote.createdAt}<br>
          Cliente: ${quote.finalClient}<br>
          ${quote.projectLocation ? `Ubicación: ${quote.projectLocation}` : ""}
        </div>
      </header>

      <h4>Resumen del proyecto</h4>
      <p>Fabricación de mobiliario a la medida en melamina hidrófuga, según muebles, medidas y especificaciones técnicas indicadas.</p>
      ${quote.notes ? `<p><strong>Notas generales:</strong> ${quote.notes}</p>` : ""}

      <h4>Muebles incluidos</h4>
      <table class="quote-table">
        <thead>
          <tr><th>Mueble</th><th>Medidas y especificaciones</th><th>Monto</th></tr>
        </thead>
        <tbody>
          ${quote.items.map((item) => `
            <tr>
              <td><strong>${item.name}</strong><br>${item.furnitureType} · ${item.complexityLabel}</td>
              <td>
                ${item.width} x ${item.height} x ${item.depth} cm<br>
                Melamina: ${item.melamineThickness}${item.melamineSheet ? ` (${escapeHtml(getMelamineSheetLabel(item.melamineSheet))})` : ""}
                ${noInc(item.edgeBanding)     ? "" : `<br>Canto: ${item.edgeBanding}`}
                ${noInc(item.hinges)          ? "" : `<br>Bisagras: ${item.hinges}`}
                ${noInc(item.drawerSlides)    ? "" : `<br>Correderas: ${item.drawerSlides}`}
                ${noInc(item.handles)         ? "" : `<br>Jaladores: ${item.handles}`}
                ${item.doors || item.drawers || item.shelves ? `<br>Puertas: ${item.doors} (${placementLabel(item.doorPlacement)}) · Gavetas: ${item.drawers} (${placementLabel(item.drawerPlacement)}) · Repisas: ${item.shelves} (${placementLabel(item.shelfPlacement)}) · Fondo: ${placementLabel(item.backPlacement)}` : ""}
                ${item.notes ? `<br>Notas: ${item.notes}` : ""}
              </td>
              <td>${money(item.finalPrice)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <h4>Inversión</h4>
      <table class="quote-table">
        <tbody>
          <tr><th>Muebles cotizados</th><td>${money(quote.itemsSubtotal)}</td></tr>
          <tr><th>Mano de obra</th><td>${quote.manoObra > 0 ? money(quote.manoObra) : "No incluida"}</td></tr>
          <tr><th>Transporte</th><td>${quote.transport > 0 ? money(quote.transport) : "No incluido"}</td></tr>
          <tr><th>Subtotal</th><td>${money(quote.calculatedTotal)}</td></tr>
          ${quote.manualTotal > 0 ? `<tr><th>Ajuste manual</th><td>Total final editado por el ebanista</td></tr>` : ""}
        </tbody>
      </table>
      <div class="quote-total">
        <div>
          <span>Total de la propuesta</span>
          <strong>${money(quote.total)}</strong>
        </div>
      </div>

      <h4>Tiempo estimado</h4>
      <p>${quote.days} luego de aprobación, medidas finales y abono inicial.</p>

      <h4>Condiciones</h4>
      <p>Validez de la oferta: ${quote.validity} días.</p>
      <p>${tenant.terms}</p>
      <p>No incluye plomería, electricidad, albañilería, pintura, retiro de muebles existentes ni accesorios no detallados en esta propuesta.</p>

      <h4>Contacto</h4>
      <p>${tenant.contactName} · ${tenant.phone}${tenant.email ? ` · ${tenant.email}` : ""}</p>
    </article>
  `;
}

// Cotización de materiales que arma un vendedor — formato tipo factura (logo, datos fiscales,
// cuentas bancarias), distinto de la cotización de muebles del ebanista (renderQuotePaper).
function renderSellerQuotePaper(quote, seller) {
  state.currentQuoteForPdf = { kind: "seller", quote, seller };
  const theme = seller?.theme || {};
  const bp = seller?.businessProfile || {};
  const logoHtml = theme.logoBase64
    ? `<img src="${theme.logoBase64}" alt="Logo" style="max-height:60px;max-width:160px;object-fit:contain;">`
    : `<div class="quote-brand-mark">${escapeHtml((seller?.company || seller?.name || "V")[0] || "V")}</div>`;

  const taxLabel = bp.taxLabel || "ITBMS";
  const defaultTaxPct = Number(bp.taxPercent) || 0;
  const subtotal = quote.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const taxAmount = quote.items.reduce((s, it) => s + (it.qty * it.unitPrice) * ((Number(it.taxPercent ?? defaultTaxPct)) / 100), 0);
  const total = subtotal + taxAmount;
  const bankLines = String(bp.bankAccounts || "").split("\n").map(l => l.trim()).filter(Boolean);

  els.quotePaper.innerHTML = `
    <article class="quote-doc">
      <header>
        <div class="quote-brand">
          ${logoHtml}
          <strong>${escapeHtml(seller?.company || seller?.name || "")}</strong>
          <span>${escapeHtml(bp.address || "")}</span>
        </div>
        <div class="quote-meta">
          ${quote.clientName ? `<strong>${escapeHtml(quote.clientName)}</strong>` : "Cliente sin asignar"}
        </div>
      </header>

      <h4>Número de cotización ${escapeHtml(quote.number)}</h4>
      <table class="quote-table" style="margin-bottom:1rem">
        <tbody>
          <tr>
            <th>Fecha de cotización</th><th>Vencimiento</th><th>Vendedor</th>
          </tr>
          <tr>
            <td>${quote.date}</td><td>${quote.dueDate}</td><td>${escapeHtml(seller?.name || "")}</td>
          </tr>
        </tbody>
      </table>

      <table class="quote-table">
        <thead>
          <tr><th>Descripción</th><th>Cantidad</th><th>Precio unitario</th><th>Impuestos</th><th>Importe</th></tr>
        </thead>
        <tbody>
          ${quote.items.map(it => `
            <tr>
              <td>${escapeHtml(it.description)}</td>
              <td>${it.qty} ${escapeHtml(it.unit)}</td>
              <td>$${Number(it.unitPrice).toFixed(2)}</td>
              <td>${it.taxPercent ?? defaultTaxPct}% ${escapeHtml(taxLabel)}</td>
              <td>$${(it.qty * it.unitPrice).toFixed(2)}</td>
            </tr>`).join("")}
        </tbody>
      </table>

      <div class="quote-total">
        <div>
          <span>Subtotal $${subtotal.toFixed(2)} · ${escapeHtml(taxLabel)} $${taxAmount.toFixed(2)}</span>
          <strong>Total ${"$" + total.toFixed(2)}</strong>
        </div>
      </div>

      ${bankLines.length ? `<h4>Cuentas para pago</h4><p>${bankLines.map(escapeHtml).join("<br>")}</p>` : ""}

      <p class="muted" style="font-size:.78rem;margin-top:1rem">${escapeHtml(bp.taxId || "")}${bp.website ? ` · ${escapeHtml(bp.website)}` : ""}</p>
    </article>
  `;
}

// Cotización de materiales del ebanista — mismo formato que renderSellerQuotePaper,
// pero con el branding del ebanista (tenant) en vez del vendedor.
// Fecha formal con día de la semana, ej. "lunes, 22 de junio de 2026".
function formatQuoteDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  if (isNaN(d)) return isoDate;
  const text = d.toLocaleDateString("es-PA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function renderEbanistaMaterialQuotePaper(quote, tenant) {
  state.currentQuoteForPdf = { kind: "ebanista", quote, tenant };
  const theme = tenant?.theme || {};
  const logoHtml = (theme.logoBase64 || tenant?.logoBase64)
    ? `<img src="${theme.logoBase64 || tenant.logoBase64}" alt="Logo" style="max-height:64px;max-width:170px;object-fit:contain;">`
    : `<div class="quote-brand-mark">${escapeHtml((tenant?.companyName || "E")[0] || "E")}</div>`;

  const subtotalItems = quote.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const subtotal = subtotalItems + (quote.manoObra || 0) + (quote.transport || 0);
  const taxPercent = Number(quote.taxPercent) || 0;
  const taxAmount = taxPercent > 0 ? subtotal * (taxPercent / 100) : 0;
  const total = quote.manualTotal > 0 ? quote.manualTotal : subtotal + taxAmount;
  const validityDays = Math.max(1, Math.round((new Date(quote.dueDate) - new Date(quote.date)) / 86400000));

  const benefitLines = String(quote.benefits || "").split(/\n|·|•/).map(s => s.trim()).filter(Boolean);
  const terms = [
    quote.deliveryTime ? { label: "Tiempo de entrega", value: quote.deliveryTime } : null,
    quote.paymentTerms ? { label: "Forma de pago", value: quote.paymentTerms } : null,
    quote.warranty ? { label: "Garantía", value: quote.warranty } : null,
    { label: "Vigencia de la oferta", value: `${validityDays} día(s), hasta el ${formatQuoteDate(quote.dueDate)}` }
  ].filter(Boolean);

  els.quotePaper.innerHTML = `
    <article class="quote-doc quote-doc-premium">
      <header class="quote-doc-cover">
        <div class="quote-brand">
          ${logoHtml}
          <div>
            <strong>${escapeHtml(tenant?.companyName || "")}</strong>
            ${theme.tagline ? `<span>${escapeHtml(theme.tagline)}</span>` : ""}
          </div>
        </div>
        <div class="quote-meta">
          <span class="quote-doc-pill">Cotización ${escapeHtml(quote.number)}</span>
          <strong>${quote.clientName ? escapeHtml(quote.clientName) : "Cliente sin asignar"}</strong>
          ${quote.location ? `<span>${escapeHtml(quote.location)}</span>` : ""}
          <span class="muted">${formatQuoteDate(quote.date)}</span>
        </div>
      </header>

      ${tenant?.materials ? `<p class="quote-doc-summary">${escapeHtml(tenant.materials)}</p>` : ""}

      <table class="quote-table">
        <thead><tr><th>Descripción</th><th>Cantidad</th><th>Precio unitario</th><th>Importe</th></tr></thead>
        <tbody>
          ${quote.items.map(it => `
            <tr>
              <td>${escapeHtml(it.description)}</td>
              <td>${it.qty} ${escapeHtml(it.unit)}</td>
              <td>$${Number(it.unitPrice).toFixed(2)}</td>
              <td>$${(it.qty * it.unitPrice).toFixed(2)}</td>
            </tr>`).join("")}
          ${quote.manoObra > 0 ? `<tr><td>Mano de obra / instalación</td><td></td><td></td><td>$${quote.manoObra.toFixed(2)}</td></tr>` : ""}
          ${quote.transport > 0 ? `<tr><td>Transporte</td><td></td><td></td><td>$${quote.transport.toFixed(2)}</td></tr>` : ""}
        </tbody>
      </table>

      <div class="quote-total">
        <div>
          ${taxAmount > 0 ? `<span>Subtotal $${subtotal.toFixed(2)} · Impuesto (${taxPercent}%) $${taxAmount.toFixed(2)}</span>` : ""}
          <strong>Total $${total.toFixed(2)}</strong>
        </div>
      </div>

      ${benefitLines.length ? `
        <h4>Beneficios incluidos</h4>
        <ul class="quote-doc-benefits">${benefitLines.map(b => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
      ` : ""}

      ${quote.notes ? `<h4>Notas</h4><p>${escapeHtml(quote.notes)}</p>` : ""}

      <h4>Condiciones comerciales</h4>
      <dl class="quote-doc-terms">
        ${terms.map(t => `<div><dt>${escapeHtml(t.label)}</dt><dd>${escapeHtml(t.value)}</dd></div>`).join("")}
      </dl>
      ${tenant?.terms ? `<p class="muted">${escapeHtml(tenant.terms)}</p>` : ""}

      <p class="muted quote-doc-footer">${escapeHtml(tenant?.contactName || "")}${tenant?.phone ? ` · ${escapeHtml(tenant.phone)}` : ""}${tenant?.email ? ` · ${escapeHtml(tenant.email)}` : ""}</p>
    </article>
  `;
}

// item llega en cm (pipeline de muebles de IA) — Cortes trabaja en mm, así que se
// convierte aquí, en el límite entre los dos mundos.
// El canto/tapacanto NUNCA reduce la medida de la pieza — la medida final del mueble
// armado debe coincidir exactamente con lo pedido. Solo el espesor de piezas
// estructurales adyacentes (laterales, fondo, etc.) puede reducir una medida, y eso ya
// se descontó más arriba, en generatePiecesForItem, antes de llegar aquí.
function piece(item, name, width, height, qty = 1) {
  const edgeSides = computeEdgeSides(name, item.edgeBanding);
  const widthMm = roundMm(width * 10);
  const heightMm = roundMm(height * 10);
  return Array.from({ length: qty }, (_, index) => ({
    id: crypto.randomUUID(),
    furniture: item.name,
    name: qty > 1 ? `${name} ${index + 1}` : name,
    width: widthMm,
    height: heightMm,
    thickness: item.melamineThickness,
    edgeSides,
    edge: describeEdgeSides(edgeSides),
    grain: false,
    area: roundMm(widthMm * heightMm)
  }));
}

function roundCm(value) {
  return Math.max(0, Math.round(Number(value || 0) * 10) / 10);
}

function thicknessCm(value) {
  const match = String(value || "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) / 10 : 1.8;
}

function safeDimension(value) {
  return Math.max(0.1, roundCm(value));
}

// Cortes trabaja en mm (a diferencia del pipeline de muebles de IA, que sigue en cm).
function roundMm(value) {
  return Math.max(0, Math.round(Number(value || 0) * 10) / 10);
}

const EDGE_THICKNESS_OPTIONS = ["0.45mm", "1.00mm", "2.00mm"];

function defaultEdgeThickness() {
  const mm = Number(state.globalPrices?.canto_default_mm) || 1;
  return EDGE_THICKNESS_OPTIONS.find(t => t.startsWith(mm.toFixed(2))) || "1.00mm";
}

// Reemplaza el viejo edgeForPiece(): devuelve qué lados llevan canto y de qué grosor,
// en vez de un string descriptivo — describeEdgeSides() genera el texto para la UI vieja.
function computeEdgeSides(name, edgeBanding, thicknessLabel = defaultEdgeThickness()) {
  const edgeText = String(edgeBanding || "").toLowerCase();
  const pieceName = String(name || "").toLowerCase();
  const none = { top: null, bottom: null, left: null, right: null };
  if (edgeText.startsWith("no incluir")) return { ...none };
  if (edgeText.includes("todos los cantos") || edgeText.includes("premium")) {
    return { top: thicknessLabel, bottom: thicknessLabel, left: thicknessLabel, right: thicknessLabel };
  }
  if (pieceName.includes("puerta") || pieceName.includes("frente")) {
    return { top: thicknessLabel, bottom: thicknessLabel, left: thicknessLabel, right: thicknessLabel };
  }
  if (edgeText.includes("frentes")) return { ...none, right: thicknessLabel };
  return { ...none };
}

function describeEdgeSides(edgeSides) {
  const sides = [
    ["top", "arriba"], ["bottom", "abajo"], ["left", "izq"], ["right", "der"]
  ].filter(([key]) => edgeSides[key]);
  if (!sides.length) return "Sin canto";
  if (sides.length === 4) {
    const thicknesses = new Set(sides.map(([key]) => edgeSides[key]));
    return thicknesses.size === 1 ? `Todos los cantos (${[...thicknesses][0]})` : "Todos los cantos expuestos";
  }
  return `Canto en ${sides.map(([, label]) => label).join("/")} (${sides.map(([key]) => edgeSides[key]).join("/")})`;
}

function generatePiecesForItem(item) {
  const thickness = thicknessCm(item.melamineThickness);
  const usesInternalDimensions = item.dimensionBasis === "internal";
  const outerWidth = usesInternalDimensions ? safeDimension(item.width + (thickness * 2)) : item.width;
  const outerHeight = usesInternalDimensions ? safeDimension(item.height + (thickness * 2)) : item.height;
  const backConsumesDepth = item.backPlacement === "internal";
  const outerDepth = usesInternalDimensions && backConsumesDepth ? safeDimension(item.depth + thickness) : item.depth;
  const innerWidth = usesInternalDimensions ? item.width : safeDimension(item.width - (thickness * 2));
  const innerHeight = usesInternalDimensions ? item.height : safeDimension(item.height - (thickness * 2));
  const innerDepth = usesInternalDimensions ? item.depth : safeDimension(item.depth - (backConsumesDepth ? thickness : 0));
  const pieces = [
    ...piece(item, "Lateral izquierdo", outerDepth, outerHeight),
    ...piece(item, "Lateral derecho", outerDepth, outerHeight),
    ...piece(item, "Tapa superior", outerWidth, outerDepth),
    ...piece(item, "Piso inferior", outerWidth, outerDepth)
  ];

  if (item.backPlacement !== "none") {
    const backWidth = item.backPlacement === "internal" ? innerWidth : outerWidth;
    const backHeight = item.backPlacement === "internal" ? innerHeight : outerHeight;
    const backName = item.backPlacement === "internal" ? "Fondo interno" : "Fondo exterior";
    pieces.push(...piece(item, backName, backWidth, backHeight));
  }

  if (item.doors === 0 && item.drawers === 0) {
    pieces.push(...piece(item, "Frente", outerWidth, outerHeight));
  }

  if (item.shelves > 0) {
    const shelfWidth = item.shelfPlacement === "internal" ? innerWidth : outerWidth;
    const shelfDepth = item.shelfPlacement === "internal"
      ? safeDimension(outerDepth - (backConsumesDepth ? thickness : 0))
      : outerDepth;
    const shelfName = item.shelfPlacement === "internal" ? "Repisa interna" : "Repisa externa";
    pieces.push(...piece(item, shelfName, shelfWidth, shelfDepth, item.shelves));
  }

  if (item.doors > 0) {
    const doorGap = 0.3;
    const doorWidth = item.doorPlacement === "overlay"
      ? outerWidth / item.doors
      : safeDimension((innerWidth / item.doors) - doorGap);
    const doorHeight = item.doorPlacement === "overlay"
      ? outerHeight
      : safeDimension(innerHeight - doorGap);
    const doorName = item.doorPlacement === "overlay"
      ? "Puerta sobrepuesta"
      : item.doorPlacement === "internal"
        ? "Puerta interna"
        : "Puerta embutida";
    pieces.push(...piece(item, doorName, doorWidth, doorHeight, item.doors));
  }

  if (item.drawers > 0) {
    const drawerColumns = Math.max(1, Math.min(item.drawers, 3));
    const drawerBoxWidth = safeDimension((innerWidth / drawerColumns) - 1);
    const drawerDepth = safeDimension(innerDepth - 3);
    const drawerFrontWidth = item.drawerPlacement === "external_front"
      ? outerWidth / drawerColumns
      : safeDimension((innerWidth / drawerColumns) - 0.3);
    const drawerFrontHeight = item.drawerPlacement === "internal_box" ? 0 : 22;

    if (drawerFrontHeight > 0) {
      const frontName = item.drawerPlacement === "inset_front" ? "Frente de gaveta embutido" : "Frente de gaveta exterior";
      pieces.push(...piece(item, frontName, drawerFrontWidth, drawerFrontHeight, item.drawers));
    }

    pieces.push(...piece(item, "Lateral de gaveta interno", drawerDepth, 14, item.drawers * 2));
    pieces.push(...piece(item, "Fondo de gaveta interno", drawerBoxWidth, drawerDepth, item.drawers));
  }

  return pieces;
}

function renderCuts() {
  if (!state.draftItems.length && !state.manualPieces.length && !state.editablePieces.length) {
    els.cutsOutput.innerHTML = `<p class="muted">Agrega módulos en Cotizar y presiona Calcular cortes.</p>`;
    if (els.cutsLayoutOutput) els.cutsLayoutOutput.innerHTML = "";
    return;
  }
  // Generate fresh pieces from draftItems + manualPieces
  const fresh = [];
  state.draftItems.forEach(item => {
    generatePiecesForItem(item).forEach(p => fresh.push({ ...p, id: crypto.randomUUID() }));
  });
  state.manualPieces.forEach(p => fresh.push({ ...p, id: p.id || crypto.randomUUID() }));
  state.editablePieces = fresh;
  renderCutsPiecesTable();
  recalcCutsLayout();
}

function renderCutsPiecesTable() {
  if (!state.editablePieces.length) {
    els.cutsOutput.innerHTML = `<p class="muted">No hay piezas. Usa "Regenerar desde módulos".</p>`;
    return;
  }
  const thick = ["15 mm","18 mm","25 mm","36 mm doble laminado"];
  const edgeOpts = (val) => ["", ...EDGE_THICKNESS_OPTIONS].map(o =>
    `<option value="${o}"${(val||"")===o?' selected':''}>${o || "—"}</option>`).join('');
  // Largo = height (lados largo = left/right) · Ancho = width (lados corto = top/bottom)
  const rows = state.editablePieces.map(p => {
    const es = p.edgeSides || { top: null, bottom: null, left: null, right: null };
    return `
    <tr data-piece-id="${p.id}">
      <td><input type="checkbox" class="cut-select-row" data-select-id="${p.id}" ${_selectedCutPieceIds.has(p.id) ? "checked" : ""}></td>
      <td><input class="cut-input" data-field="furniture" value="${escapeHtml(p.furniture||'')}" placeholder="Mueble"></td>
      <td><input class="cut-input" data-field="name" value="${escapeHtml(p.name||'')}" placeholder="Pieza"></td>
      <td><select class="cut-input" data-field="thickness">${thick.map(t=>`<option${p.thickness===t?' selected':''}>${t}</option>`).join('')}</select></td>
      <td><input class="cut-input cut-num" data-field="height" type="number" min="1" step="1" value="${p.height||''}" title="Largo mm"></td>
      <td><input class="cut-input cut-num" data-field="width" type="number" min="1" step="1" value="${p.width||''}" title="Ancho mm"></td>
      <td><select class="cut-input" data-edge-side="left" title="Canto lado largo 1">${edgeOpts(es.left)}</select></td>
      <td><select class="cut-input" data-edge-side="right" title="Canto lado largo 2">${edgeOpts(es.right)}</select></td>
      <td><select class="cut-input" data-edge-side="top" title="Canto lado ancho 1">${edgeOpts(es.top)}</select></td>
      <td><select class="cut-input" data-edge-side="bottom" title="Canto lado ancho 2">${edgeOpts(es.bottom)}</select></td>
      <td>
        <label style="display:flex;align-items:center;gap:2px;font-size:.72rem;font-weight:400"><input type="checkbox" data-field="grain" ${p.grain ? "checked" : ""}>veta</label>
        <select class="cut-input" data-field="grainDirection" style="margin-top:2px" ${p.grain ? "" : "disabled"}>
          <option value="largo" ${p.grainDirection!=="ancho"?"selected":""}>al largo</option>
          <option value="ancho" ${p.grainDirection==="ancho"?"selected":""}>al ancho</option>
        </select>
      </td>
      <td><button class="tiny-btn danger" data-rm-cut="${p.id}" type="button">×</button></td>
    </tr>`;
  }).join('');

  els.cutsOutput.innerHTML = `
    <p style="font-size:.8rem;color:#6B7280;margin:0 0 8px">
      ✏️ Haz clic en cualquier celda para editar. Largo/Ancho son la medida exacta de corte — el canto no le resta nada. L1/L2 = canto en cada lado largo, A1/A2 = canto en cada lado ancho. Los cambios se reflejan en el cálculo de láminas al instante.
    </p>
    <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
      <button id="addCutPieceBtn" class="secondary-btn" type="button">＋ Agregar pieza</button>
      <button id="regenCutPiecesBtn" class="secondary-btn" type="button">↻ Regenerar desde módulos</button>
      <button id="deleteSelectedCutsBtn" class="secondary-btn danger" type="button">🗑 Borrar seleccionadas (<span id="selectedCutsCount">0</span>)</button>
      <label style="display:flex;align-items:center;gap:4px;font-weight:400;font-size:.85rem"><input type="checkbox" id="selectAllCutsCheckbox">Seleccionar todo</label>
    </div>
    <div style="overflow-x:auto">
      <table class="quote-table cuts-editable">
        <thead><tr><th></th><th>Mueble</th><th>Pieza</th><th>Grosor</th><th title="Largo">Largo mm</th><th title="Ancho">Ancho mm</th><th title="Canto lado largo 1">L1</th><th title="Canto lado largo 2">L2</th><th title="Canto lado ancho 1">A1</th><th title="Canto lado ancho 2">A2</th><th>Veta</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Motor de empaquetado: Guillotine free-rectangle (best-area-fit) ─────────
// Reemplaza al shelf-packing anterior (shelves de altura fija). La diferencia clave:
// en vez de "bandas" de altura fija que nunca liberan su sobrante vertical, esta
// versión mantiene una lista de rectángulos libres explícitos por lámina. Al
// colocar una pieza, el rectángulo libre usado se parte en guillotina (1 corte
// recto de borde a borde) en hasta 2 rectángulos nuevos que quedan disponibles
// para piezas futuras — así una pieza baja SÍ puede aprovechar el sobrante que
// dejó una pieza alta, que era justo lo que el shelf-packing no podía hacer.
//
// Se prueban varios órdenes de pieza (área/lado mayor/alto/ancho/perímetro,
// todos descendente) y se elige la combinación con menos láminas (y, si hay
// empate, menos desperdicio) — software profesional de nesting hace lo mismo:
// ninguna heurística de orden único es óptima para todos los conjuntos de piezas.

// Reparte un rectángulo libre en hasta 2 rectángulos tras colocar una pieza
// usedW×usedH en su esquina superior izquierda. Heurística "shorter leftover
// axis": se corte por el eje que deje el sobrante más grande lo más cuadrado
// posible, para fragmentar menos el espacio restante.
function _splitFreeRect(rect, usedW, usedH, kerf) {
  const rightW = rect.w - usedW - kerf;
  const bottomH = rect.h - usedH - kerf;
  const out = [];
  if (rightW <= bottomH) {
    if (bottomH > 0) out.push({ x: rect.x, y: rect.y + usedH + kerf, w: rect.w, h: bottomH });
    if (rightW > 0) out.push({ x: rect.x + usedW + kerf, y: rect.y, w: rightW, h: usedH });
  } else {
    if (rightW > 0) out.push({ x: rect.x + usedW + kerf, y: rect.y, w: rightW, h: rect.h });
    if (bottomH > 0) out.push({ x: rect.x, y: rect.y + usedH + kerf, w: usedW, h: bottomH });
  }
  return out.filter(r => r.w > 0.5 && r.h > 0.5);
}

// Best-area-fit: el rectángulo libre MÁS CHICO que aún contiene la pieza —
// deja los huecos grandes intactos para piezas grandes futuras, en vez de
// fragmentar el primer rectángulo que calce (first-fit sería peor aquí).
function _bestFreeRectFor(freeRects, pw, ph) {
  let best = null, bestArea = Infinity;
  for (let i = 0; i < freeRects.length; i++) {
    const r = freeRects[i];
    if (pw <= r.w + 0.01 && ph <= r.h + 0.01) {
      const area = r.w * r.h;
      if (area < bestArea) { bestArea = area; best = i; }
    }
  }
  return best;
}

function _packGuillotine(sortedPieces, sheetW, sheetH, kerf, marginX, marginY) {
  const usableW = sheetW - marginX * 2;
  const usableH = sheetH - marginY * 2;
  const sheets = [];
  const oversized = [];

  const tryPlaceOnSheet = (sheet, pw, ph, allowRotate) => {
    let idx = _bestFreeRectFor(sheet.freeRects, pw, ph);
    let w = pw, h = ph, rotated = false;
    if (idx == null && allowRotate && pw !== ph) {
      idx = _bestFreeRectFor(sheet.freeRects, ph, pw);
      if (idx != null) { w = ph; h = pw; rotated = true; }
    }
    if (idx == null) return null;
    const rect = sheet.freeRects[idx];
    const placement = { x: rect.x, y: rect.y, w, h, rotated };
    sheet.freeRects.splice(idx, 1, ..._splitFreeRect(rect, w, h, kerf));
    return placement;
  };

  sortedPieces.forEach(piece => {
    const pw = Math.max(1, Number(piece.width) || 1);
    const ph = Math.max(1, Number(piece.height) || 1);
    // Piezas con veta (grain=true) no se rotan — un giro de 90° invertiría la
    // dirección de la veta respecto a la lámina, así que "rotar solo cuando la
    // veta lo permite" en la práctica es "rotar solo si no tiene veta marcada".
    const allowRotate = !piece.grain;
    const fitsNormal = pw <= usableW && ph <= usableH;
    const fitsRotated = allowRotate && ph <= usableW && pw <= usableH;
    if (!fitsNormal && !fitsRotated) { oversized.push(piece); return; }

    let placed = false;
    for (const sheet of sheets) {
      const r = tryPlaceOnSheet(sheet, pw, ph, allowRotate);
      if (r) {
        sheet.placements.push({ piece, x: marginX + r.x, y: marginY + r.y, w: r.w, h: r.h, rotated: r.rotated });
        placed = true;
        break;
      }
    }
    if (!placed) {
      const sheet = { number: sheets.length + 1, freeRects: [{ x: 0, y: 0, w: usableW, h: usableH }], placements: [] };
      const r = tryPlaceOnSheet(sheet, pw, ph, allowRotate);
      if (r) {
        sheet.placements.push({ piece, x: marginX + r.x, y: marginY + r.y, w: r.w, h: r.h, rotated: r.rotated });
        sheets.push(sheet);
      } else {
        oversized.push(piece); // no debería pasar (ya se filtró arriba), pero por si acaso no se crea lámina vacía
      }
    }
  });
  sheets.oversized = oversized;
  return sheets;
}

// MaxRects (best-area-fit): variante más fuerte que guillotine puro. En vez de partir el
// espacio libre en una única partición fija al colocar cada pieza, mantiene TODOS los
// rectángulos libres candidatos (pueden superponerse entre sí) y los recorta/depura después
// de cada colocación. Esto evita la limitación de guillotine puro: el primer corte reparte el
// espacio entre dos zonas ANTES de saber cuánto va a necesitar cada una, y a veces esa
// partición temprana deja sin lugar a una pieza que sí cabría con un reparto distinto.
// Nota: el resultado de MaxRects no siempre es "cortable en guillotina" (cortes rectos de
// borde a borde) — para una sierra de panel solo sirven los acomodos guillotine; para CNC con
// mesa de vacío (que sí puede rutear cualquier rectángulo en cualquier posición) no hay problema.
function _maxRectsPlaceAndSplit(freeRects, x, y, w, h) {
  const px2 = x + w, py2 = y + h;
  const next = [];
  for (const r of freeRects) {
    const rx2 = r.x + r.w, ry2 = r.y + r.h;
    if (x >= rx2 || px2 <= r.x || y >= ry2 || py2 <= r.y) { next.push(r); continue; } // no se superponen
    if (r.x < x)   next.push({ x: r.x, y: r.y, w: x - r.x,   h: r.h });   // franja izquierda
    if (rx2 > px2) next.push({ x: px2,  y: r.y, w: rx2 - px2, h: r.h });   // franja derecha
    if (r.y < y)   next.push({ x: r.x, y: r.y, w: r.w, h: y - r.y });     // franja arriba
    if (ry2 > py2) next.push({ x: r.x, y: py2,  w: r.w, h: ry2 - py2 });   // franja abajo
  }
  const filtered = next.filter(r => r.w > 0.5 && r.h > 0.5);
  const isContained = (a, b) => a !== b && a.x >= b.x - 0.01 && a.y >= b.y - 0.01 &&
    a.x + a.w <= b.x + b.w + 0.01 && a.y + a.h <= b.y + b.h + 0.01;
  return filtered.filter(r => !filtered.some(other => isContained(r, other))); // descarta redundantes
}

function _packMaxRects(sortedPieces, sheetW, sheetH, kerf, marginX, marginY) {
  const usableW = sheetW - marginX * 2;
  const usableH = sheetH - marginY * 2;
  const sheets = [];
  const oversized = [];

  const tryPlaceOnSheet = (sheet, pw, ph, allowRotate) => {
    let idx = _bestFreeRectFor(sheet.freeRects, pw, ph);
    let w = pw, h = ph, rotated = false;
    if (idx == null && allowRotate && pw !== ph) {
      idx = _bestFreeRectFor(sheet.freeRects, ph, pw);
      if (idx != null) { w = ph; h = pw; rotated = true; }
    }
    if (idx == null) return null;
    const rect = sheet.freeRects[idx];
    const placement = { x: rect.x, y: rect.y, w, h, rotated };
    // El corte (kerf) se "gasta" agrandando el área recortada del espacio libre — la pieza en
    // sí queda con sus medidas reales, solo el hueco disponible para la siguiente se reduce.
    sheet.freeRects = _maxRectsPlaceAndSplit(sheet.freeRects, rect.x, rect.y, w + kerf, h + kerf);
    return placement;
  };

  sortedPieces.forEach(piece => {
    const pw = Math.max(1, Number(piece.width) || 1);
    const ph = Math.max(1, Number(piece.height) || 1);
    const allowRotate = !piece.grain;
    const fitsNormal = pw <= usableW && ph <= usableH;
    const fitsRotated = allowRotate && ph <= usableW && pw <= usableH;
    if (!fitsNormal && !fitsRotated) { oversized.push(piece); return; }

    let placed = false;
    for (const sheet of sheets) {
      const r = tryPlaceOnSheet(sheet, pw, ph, allowRotate);
      if (r) {
        sheet.placements.push({ piece, x: marginX + r.x, y: marginY + r.y, w: r.w, h: r.h, rotated: r.rotated });
        placed = true;
        break;
      }
    }
    if (!placed) {
      const sheet = { number: sheets.length + 1, freeRects: [{ x: 0, y: 0, w: usableW, h: usableH }], placements: [] };
      const r = tryPlaceOnSheet(sheet, pw, ph, allowRotate);
      if (r) {
        sheet.placements.push({ piece, x: marginX + r.x, y: marginY + r.y, w: r.w, h: r.h, rotated: r.rotated });
        sheets.push(sheet);
      } else {
        oversized.push(piece);
      }
    }
  });
  sheets.oversized = oversized;
  return sheets;
}

const _PACK_STRATEGIES = [
  (a, b) => (Number(b.width)||1)*(Number(b.height)||1) - (Number(a.width)||1)*(Number(a.height)||1),       // área desc
  (a, b) => Math.max(Number(b.width)||1,Number(b.height)||1) - Math.max(Number(a.width)||1,Number(a.height)||1), // lado mayor desc
  (a, b) => (Number(b.height)||1) - (Number(a.height)||1),                                                    // alto desc
  (a, b) => (Number(b.width)||1) - (Number(a.width)||1),                                                      // ancho desc
  (a, b) => 2*((Number(b.width)||1)+(Number(b.height)||1)) - 2*((Number(a.width)||1)+(Number(a.height)||1))   // perímetro desc
];

function packPiecesGuillotine(pieces, sheetW, sheetH, kerfMm = 5) {
  const marginX = 20, marginY = 20;
  let best = null, bestSheets = Infinity, bestWaste = Infinity, bestOversized = Infinity;
  const candidates = [];
  for (const sortFn of _PACK_STRATEGIES) {
    const sorted = [...pieces].sort(sortFn);
    candidates.push(_packGuillotine(sorted, sheetW, sheetH, kerfMm, marginX, marginY));
    candidates.push(_packMaxRects(sorted, sheetW, sheetH, kerfMm, marginX, marginY));
  }
  for (const sheets of candidates) {
    const usedArea = sheets.reduce((s, sh) => s + sh.placements.reduce((s2, p) => s2 + p.w * p.h, 0), 0);
    const waste = sheetW * sheetH * sheets.length - usedArea;
    const oversizedCount = sheets.oversized.length;
    // Prioridad: 1) menos piezas sin acomodar, 2) menos láminas, 3) menos desperdicio.
    const better = oversizedCount < bestOversized ||
      (oversizedCount === bestOversized && sheets.length < bestSheets) ||
      (oversizedCount === bestOversized && sheets.length === bestSheets && waste < bestWaste);
    if (!best || better) { best = sheets; bestSheets = sheets.length; bestWaste = waste; bestOversized = oversizedCount; }
  }
  return best;
}

// Cuenta cortes guillotina para una lámina ya empacada: 1 corte horizontal entre cada
// banda (shelf), 1 corte vertical entre cada pieza dentro de una banda, y 1 corte extra
// de recorte por cada pieza más baja que el alto de su banda (separarla del sobrante).
// Las piezas con posición manual no tienen una banda conocida — se cuentan 1 a 1 como
// aproximación simple, ya que su secuencia real de corte no se puede inferir.
// N piezas en fila necesitan N-1 cortes para separarse ENTRE ellas, pero si la última no
// llega hasta el borde útil de la lámina (queda sobrante detrás), separarla de ese sobrante
// es un corte más → N cortes, no N-1. Lo mismo aplica entre bandas (shelves) y el sobrante
// de abajo. marginX/marginY deben coincidir con los que usa packPiecesGuillotine.
function countGuillotineCuts(sheet, sheetW, sheetH) {
  const autoPlacements = sheet.placements.filter(p => !p.manual);
  const manualCount = sheet.placements.length - autoPlacements.length;
  if (!autoPlacements.length) return manualCount;

  const marginX = 20, marginY = 20, tol = 0.5;
  const usableRight = sheetW - marginX;
  const usableBottom = sheetH - marginY;

  const byY = {};
  autoPlacements.forEach(p => { (byY[p.y] = byY[p.y] || []).push(p); });
  const shelfYs = Object.keys(byY).map(Number).sort((a, b) => a - b);

  let cuts = Math.max(0, shelfYs.length - 1);
  const lastShelfY = shelfYs[shelfYs.length - 1];
  const lastShelfH = Math.max(...byY[lastShelfY].map(p => p.h));
  if (lastShelfY + lastShelfH < usableBottom - tol) cuts += 1; // sobra alto debajo de la última banda

  shelfYs.forEach(y => {
    const piecesInShelf = [...byY[y]].sort((a, b) => a.x - b.x);
    cuts += Math.max(0, piecesInShelf.length - 1);
    const lastPiece = piecesInShelf[piecesInShelf.length - 1];
    if (lastPiece.x + lastPiece.w < usableRight - tol) cuts += 1; // sobra ancho a la derecha de la última pieza
    const shelfHeight = Math.max(...piecesInShelf.map(p => p.h));
    cuts += piecesInShelf.filter(p => p.h < shelfHeight - tol).length; // recorte de piezas más bajas que su banda
  });
  return cuts + manualCount;
}

function recalcCutsLayout() {
  if (!els.cutsLayoutOutput) return;
  if (!state.editablePieces.length) { els.cutsLayoutOutput.innerHTML = ""; return; }

  const sheetW   = Number(document.getElementById("sheetWidth")?.value  || 2440);
  const sheetH   = Number(document.getElementById("sheetHeight")?.value || 1220);
  const totalArea = state.editablePieces.reduce((s, p) => s + (Number(p.width)||0)*(Number(p.height)||0), 0);

  // Group by thickness for separate sheet stacks
  const byThickness = {};
  state.editablePieces.forEach(p => {
    const t = p.thickness || "18 mm";
    if (!byThickness[t]) byThickness[t] = [];
    byThickness[t].push(p);
  });

  const kerfMmInput = document.getElementById("kerfMm");
  const kerfMm = Number(kerfMmInput?.value) || Number(tenantPrices()?.kerf_mm) || 5;
  const grainDir = document.getElementById("sheetGrainDirection")?.value || "";
  const allSheetGroups = Object.entries(byThickness).map(([thickness, pieces]) => {
    // Piezas con manualPlacement no entran al auto-nesting — se reservan en su posición fija.
    const autoPieces = pieces.filter(p => !p.manualPlacement);
    const manualPieces = pieces.filter(p => p.manualPlacement);
    const sheets = packPiecesGuillotine(autoPieces, sheetW, sheetH, kerfMm);
    const oversized = sheets.oversized || [];
    manualPieces.forEach(p => {
      const si = Math.max(0, Number(p.manualPlacement.sheetIndex) || 0);
      while (sheets.length <= si) sheets.push({ number: sheets.length + 1, shelves: [], placements: [] });
      const rotated = Boolean(p.manualPlacement.rotated);
      const w = rotated ? Number(p.height) || 1 : Number(p.width) || 1;
      const h = rotated ? Number(p.width) || 1 : Number(p.height) || 1;
      sheets[si].placements.push({
        piece: p, x: Number(p.manualPlacement.x) || 0, y: Number(p.manualPlacement.y) || 0,
        w, h, rotated, manual: true
      });
    });
    return { thickness, sheets };
  });

  const totalSheets = allSheetGroups.reduce((s, g) => s + g.sheets.length, 0);

  // Build cards + SVG per thickness group
  const colors = ["#DBEAFE","#FEF3C7","#D1FAE5","#FCE7F3","#EDE9FE","#FEE2E2","#DCFCE7","#FFF7ED"];
  const SW = 380, SH = 190;
  const scale = x => (x / sheetW) * (SW - 4);
  const scaleH = y => (y / sheetH) * (SH - 4);

  const groupsHtml = allSheetGroups.map(({ thickness, sheets }) => {
    const sheetCards = sheets.map((sh, si) => {
      const usedArea = sh.placements.reduce((s, p) => s + p.w * p.h, 0);
      const pct = Math.min(100, Math.round(usedArea / (sheetW * sheetH) * 100));
      const cls = pct > 90 ? "full" : pct > 75 ? "warn" : "";
      return `<div class="sheet-card">
        <strong>Lámina ${sh.number} (${thickness})</strong>
        <div class="util-bar-wrap"><div class="util-bar ${cls}" style="width:${pct}%"></div></div>
        <span>${pct}% · ${sh.placements.length} piezas</span>
      </div>`;
    }).join('');

    const kerfPxV = Math.max(0.6, scale(kerfMm));
    const kerfPxH = Math.max(0.6, scaleH(kerfMm));
    const lineDir = grainDir === "horizontal" ? "horizontal" : "vertical"; // dirección de las líneas de veta de pieza, default vertical

    const sheetGrainBg = (() => {
      if (!grainDir) return "";
      const lines = [];
      if (grainDir === "vertical") {
        for (let x = 8; x < SW - 4; x += 12) lines.push(`<line x1="${x}" y1="2" x2="${x}" y2="${SH-2}" stroke="#E5E7EB" stroke-width="0.6"/>`);
      } else {
        for (let y = 8; y < SH - 4; y += 12) lines.push(`<line x1="2" y1="${y}" x2="${SW-2}" y2="${y}" stroke="#E5E7EB" stroke-width="0.6"/>`);
      }
      return `<g class="sheet-grain-bg" style="pointer-events:none">${lines.join('')}</g>`;
    })();

    const svgs = sheets.map((sh, si) => {
      // Área desperdiciada: los rectángulos libres que dejó el empacador automático, dibujados
      // como una franja diagonal tenue debajo de las piezas. Solo es exacto mientras nadie haya
      // movido piezas a mano en esta lámina (el reacomodo manual no actualiza freeRects) — por
      // eso se omite apenas hay alguna pieza con posición manual, para no mostrar un área
      // "libre" que en realidad ya está ocupada.
      const hasManual = sh.placements.some(pl => pl.manual);
      const wasteRects = (!hasManual && Array.isArray(sh.freeRects)) ? sh.freeRects.map((fr, fi) => {
        const wx = 2 + scale(fr.x), wy = 2 + scaleH(fr.y);
        const ww = scale(fr.w), wh = scaleH(fr.h);
        if (ww < 3 || wh < 3) return ""; // huecos minúsculos (sobrante de kerf) no aportan nada visual
        const hatchLines = [];
        for (let off = 0; off < ww + wh; off += 6) {
          const x1 = wx + Math.max(0, off - wh), y1 = wy + Math.min(off, wh);
          const x2 = wx + Math.min(off, ww), y2 = wy + Math.max(0, off - ww);
          hatchLines.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#D97706" stroke-width="0.4" opacity="0.4"/>`);
        }
        return `<g class="waste-area-g" style="pointer-events:none">
          <rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${ww.toFixed(1)}" height="${wh.toFixed(1)}" fill="#FFFBEB" opacity="0.5"/>
          <clipPath id="waste-clip-${si}-${fi}"><rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${ww.toFixed(1)}" height="${wh.toFixed(1)}"/></clipPath>
          <g clip-path="url(#waste-clip-${si}-${fi})">${hatchLines.join('')}</g>
        </g>`;
      }).join('') : '';
      const rects = sh.placements.map((pl, pi) => {
        const rx = 2 + scale(pl.x);
        const ry = 2 + scaleH(pl.y);
        const rw = Math.max(8, scale(pl.w));
        const rh = Math.max(5, scaleH(pl.h));
        const label = (pl.piece.name || '').slice(0, 12);
        const pieceLineDir = pl.piece.grainDirection === "ancho" ? "horizontal" : pl.piece.grainDirection === "largo" ? "vertical" : lineDir;
        const grainLines = pl.piece.grain ? (pieceLineDir === "vertical"
          ? Array.from({ length: Math.max(2, Math.floor(rw / 6)) }, (_, gi) => {
              const gx = (rx + 3 + gi * 6).toFixed(1);
              if (Number(gx) >= rx + rw - 1) return "";
              return `<line x1="${gx}" y1="${(ry+1.5).toFixed(1)}" x2="${gx}" y2="${(ry+rh-1.5).toFixed(1)}" stroke="#9CA3AF" stroke-width="0.3"/>`;
            }).join('')
          : Array.from({ length: Math.max(2, Math.floor(rh / 6)) }, (_, gi) => {
              const gy = (ry + 3 + gi * 6).toFixed(1);
              if (Number(gy) >= ry + rh - 1) return "";
              return `<line x1="${(rx+1.5).toFixed(1)}" y1="${gy}" x2="${(rx+rw-1.5).toFixed(1)}" y2="${gy}" stroke="#9CA3AF" stroke-width="0.3"/>`;
            }).join('')
        ) : '';
        // Franjas rojas: representan el kerf (lo que se pierde al cortar) a la derecha y abajo de cada pieza.
        const kerfStripes = `
          <rect x="${(rx+rw).toFixed(1)}" y="${ry.toFixed(1)}" width="${kerfPxV.toFixed(1)}" height="${rh.toFixed(1)}" fill="#EF4444" opacity="0.55"/>
          <rect x="${rx.toFixed(1)}" y="${(ry+rh).toFixed(1)}" width="${rw.toFixed(1)}" height="${kerfPxH.toFixed(1)}" fill="#EF4444" opacity="0.55"/>`;
        return `<g class="cut-piece-g" data-piece-id="${pl.piece.id}" data-rotated="${pl.rotated ? 1 : 0}" style="cursor:move">
          ${kerfStripes}
          <rect class="piece-rect" x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}"
          fill="${colors[pi % colors.length]}" stroke="${pl.piece.grain ? "#374151" : "#6B7280"}" stroke-width="${pl.piece.grain ? 0.9 : 0.4}"
          stroke-dasharray="${pl.manual ? "2,1.5" : "none"}" rx="1"/>
          ${grainLines}
          <text x="${(rx+rw/2).toFixed(1)}" y="${(ry+rh/2+3).toFixed(1)}" text-anchor="middle"
            font-size="6" fill="#1F2937" overflow="hidden" style="pointer-events:none">${label}${pl.piece.grain ? " 🌳" : ""}</text>
        </g>`;
      }).join('');
      return `<div style="display:inline-block;margin:.3rem;vertical-align:top">
        <p style="font-size:.72rem;font-weight:600;margin:0 0 3px">Lámina ${sh.number} — ${thickness}</p>
        <svg width="${SW}" height="${SH}" data-thickness="${thickness}" data-sheet-index="${si}" data-sheet-w="${sheetW}" data-sheet-h="${sheetH}"
          style="border:1px solid #D1D5DB;border-radius:5px;background:#F9FAFB;touch-action:none">${sheetGrainBg}${wasteRects}${rects}</svg>
      </div>`;
    }).join('');

    return `<h5 style="margin:10px 0 4px;color:#374151">Grosor: ${thickness} — ${sheets.length} lámina(s)</h5>
      <div class="sheet-list">${sheetCards}</div>
      <div style="overflow-x:auto;margin-top:6px">${svgs}</div>`;
  }).join('<hr style="margin:12px 0;border-color:#E5E7EB">');

  const estimatedCuts = allSheetGroups.reduce((sum, g) =>
    sum + g.sheets.reduce((s, sh) => s + countGuillotineCuts(sh, sheetW, sheetH), 0), 0);

  // Canto total: suma la longitud de cada lado con canto (arriba/abajo = ancho, izq/der = alto),
  // agrupado por grosor, con costo estimado usando los precios por metro ya configurados.
  const cantoPriceByThickness = {
    "0.45mm": Number(tenantPrices()?.canto_045mm_metro) || 0,
    "1.00mm": Number(tenantPrices()?.canto_100mm_metro) || 0,
    "2.00mm": Number(tenantPrices()?.canto_200mm_metro) || 0
  };
  const cantoMetersByThickness = { "0.45mm": 0, "1.00mm": 0, "2.00mm": 0 };
  state.editablePieces.forEach(p => {
    const es = p.edgeSides || {};
    if (es.top)    cantoMetersByThickness[es.top]    = (cantoMetersByThickness[es.top]    || 0) + (Number(p.width)  || 0) / 1000;
    if (es.bottom) cantoMetersByThickness[es.bottom] = (cantoMetersByThickness[es.bottom] || 0) + (Number(p.width)  || 0) / 1000;
    if (es.left)   cantoMetersByThickness[es.left]   = (cantoMetersByThickness[es.left]   || 0) + (Number(p.height) || 0) / 1000;
    if (es.right)  cantoMetersByThickness[es.right]  = (cantoMetersByThickness[es.right]  || 0) + (Number(p.height) || 0) / 1000;
  });
  const totalCantoMeters = Object.values(cantoMetersByThickness).reduce((s, v) => s + v, 0);
  const totalCantoCost = Object.entries(cantoMetersByThickness)
    .reduce((s, [t, m]) => s + m * (cantoPriceByThickness[t] || 0), 0);
  const cantoBreakdown = Object.entries(cantoMetersByThickness)
    .filter(([, m]) => m > 0)
    .map(([t, m]) => `${t}: ${m.toFixed(2)}m`)
    .join(" · ") || "Sin canto";

  // Guardado para "Enviar materiales a cotización" — evita recalcular el layout otra vez.
  state.lastCutsSummary = { totalSheets, cantoMetersByThickness, cantoPriceByThickness };

  const allOversized = allSheetGroups.flatMap(g => g.oversized || []);
  const oversizedWarning = allOversized.length
    ? `<div style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;padding:.75rem 1rem;margin-top:10px">
        <strong style="color:#991B1B">⚠ ${allOversized.length} pieza(s) no caben en ninguna lámina (ni rotadas) y no se dibujaron:</strong>
        <p style="margin:.35rem 0 0;font-size:.82rem;color:#7F1D1D">${allOversized.map(p => `${escapeHtml(p.name||'')} (${p.width}×${p.height}mm)`).join(", ")}. Revisa el tamaño de lámina o esa pieza — probablemente la medida está mal capturada.</p>
      </div>`
    : "";

  const sheetLabelBanner = state.cutsSheetLabel
    ? `<p style="margin:0 0 10px;font-size:.85rem"><strong>📋 Lámina seleccionada:</strong> ${escapeHtml(state.cutsSheetLabel)} — ${sheetW}×${sheetH}mm${state.cutsSheetPrice != null ? ` · $${state.cutsSheetPrice.toFixed(2)}` : ""}</p>`
    : `<p style="margin:0 0 10px;font-size:.85rem;color:#92722a">⚠ No hay lámina seleccionada — usando tamaño por defecto ${sheetW}×${sheetH}mm. Elígela arriba en "Lámina (de precios del mercado)".</p>`;

  els.cutsLayoutOutput.innerHTML = `
    ${sheetLabelBanner}
    <div class="cuts-summary" style="margin-top:14px">
      <article><span>Piezas</span><strong>${state.editablePieces.length}</strong></article>
      <article><span>Láminas totales</span><strong>${totalSheets}</strong></article>
      <article><span>Área total</span><strong>${(totalArea/1000000).toFixed(2)} m²</strong></article>
      <article><span>Lámina</span><strong>${sheetW}×${sheetH} mm</strong></article>
      <article><span>Cortes estimados</span><strong>${estimatedCuts}</strong></article>
      <article><span>Canto total</span><strong>${totalCantoMeters.toFixed(2)} m</strong></article>
    </div>
    ${oversizedWarning}
    <p style="font-size:.78rem;color:#6B7280;margin:6px 0 0">Canto por grosor: ${cantoBreakdown}${totalCantoMeters > 0 ? ` · costo estimado $${totalCantoCost.toFixed(2)}` : ""}. "Cortes estimados" cuenta cortes guillotina por banda (estante) + recortes de piezas más bajas que su banda — es una estimación, no la secuencia exacta de corte.</p>
    <h4 style="margin:14px 0 6px">Distribución por grosor</h4>
    ${groupsHtml}`;
}

// ── Manual drag/rotate in cuts SVG ──────────────────────────────────────────
let _selectedCutPieceIds = new Set(); // selección para borrado múltiple en la tabla de cortes

function updateSelectedCutsCount() {
  const span = document.getElementById("selectedCutsCount");
  if (span) span.textContent = _selectedCutPieceIds.size;
}

els.cutsOutput?.addEventListener("change", (e) => {
  if (e.target.classList.contains("cut-select-row")) {
    const id = e.target.dataset.selectId;
    if (e.target.checked) _selectedCutPieceIds.add(id); else _selectedCutPieceIds.delete(id);
    updateSelectedCutsCount();
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "selectAllCutsCheckbox") {
    _selectedCutPieceIds = e.target.checked ? new Set(state.editablePieces.map(p => p.id)) : new Set();
    renderCutsPiecesTable();
    updateSelectedCutsCount();
  }
});
document.addEventListener("click", (e) => {
  if (e.target.id === "deleteSelectedCutsBtn") {
    if (!_selectedCutPieceIds.size) { toast("No has seleccionado ninguna pieza."); return; }
    if (!confirm(`¿Eliminar ${_selectedCutPieceIds.size} pieza(s) seleccionada(s)?`)) return;
    state.editablePieces = state.editablePieces.filter(p => !_selectedCutPieceIds.has(p.id));
    state.manualPieces = state.manualPieces.filter(p => !_selectedCutPieceIds.has(p.id));
    _selectedCutPieceIds = new Set();
    renderCutsPiecesTable();
    recalcCutsLayout();
    toast("Piezas eliminadas ✓");
  }
});

let _cutDrag = null; // { pieceId, svg, sheetIndex, sheetW, sheetH, startX, startY, origX, origY }
const SNAP_PX = 5; // distancia (en px del SVG, ~380x190 de viewBox) para que una guía "atrape"

function _svgPxToCm(svg, px, py) {
  const sheetW = Number(svg.dataset.sheetW) || 244;
  const sheetH = Number(svg.dataset.sheetH) || 122;
  const SW = 380, SH = 190;
  const cmX = ((px - 2) / (SW - 4)) * sheetW;
  const cmY = ((py - 2) / (SH - 4)) * sheetH;
  return { cmX: Math.max(0, cmX), cmY: Math.max(0, cmY) };
}

function _eventToSvgPoint(svg, e) {
  const rect = svg.getBoundingClientRect();
  const scaleX = svg.width.baseVal.value / rect.width;
  const scaleY = svg.height.baseVal.value / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

// Guías magnéticas: alinea el borde que se está moviendo con el borde de la lámina o de
// cualquier otra pieza ya colocada en el mismo SVG, si queda a menos de SNAP_PX. Devuelve además
// qué eje "atrapó" para poder dibujar la línea guía correspondiente.
function _snapDragPosition(svg, excludeG, x, y, w, h) {
  const SW = 380, SH = 190;
  const targetsX = [2, SW - 2], targetsY = [2, SH - 2];
  svg.querySelectorAll(".cut-piece-g").forEach(other => {
    if (other === excludeG) return;
    const r = other.querySelector("rect.piece-rect");
    if (!r) return;
    const ox = Number(r.getAttribute("x")), oy = Number(r.getAttribute("y"));
    const ow = Number(r.getAttribute("width")), oh = Number(r.getAttribute("height"));
    targetsX.push(ox, ox + ow);
    targetsY.push(oy, oy + oh);
  });
  let snapX = x, snapY = y, lineX = null, lineY = null;
  for (const t of targetsX) {
    if (lineX == null && Math.abs(x - t) < SNAP_PX) { snapX = t; lineX = t; }
    else if (lineX == null && Math.abs((x + w) - t) < SNAP_PX) { snapX = t - w; lineX = t; }
  }
  for (const t of targetsY) {
    if (lineY == null && Math.abs(y - t) < SNAP_PX) { snapY = t; lineY = t; }
    else if (lineY == null && Math.abs((y + h) - t) < SNAP_PX) { snapY = t - h; lineY = t; }
  }
  return { x: snapX, y: snapY, lineX, lineY };
}

// Solapamiento o fuera de los límites dibujables de la lámina (2..SW-2 / 2..SH-2, mismo
// margen que usa el render) — usado tanto para el tinte rojo en vivo como para invalidar el
// soltado y revertir en vez de guardar una posición imposible.
function _dragInvalid(svg, excludeG, x, y, w, h) {
  const SW = 380, SH = 190, tol = 0.5;
  if (x < 2 - tol || y < 2 - tol || x + w > SW - 2 + tol || y + h > SH - 2 + tol) return true;
  let collision = false;
  svg.querySelectorAll(".cut-piece-g").forEach(other => {
    if (other === excludeG || collision) return;
    const r = other.querySelector("rect.piece-rect");
    if (!r) return;
    const ox = Number(r.getAttribute("x")), oy = Number(r.getAttribute("y"));
    const ow = Number(r.getAttribute("width")), oh = Number(r.getAttribute("height"));
    if (x < ox + ow - tol && ox < x + w - tol && y < oy + oh - tol && oy < y + h - tol) collision = true;
  });
  return collision;
}

// Crea (si no existen) las 2 líneas guía + el contorno de error, ocultos hasta que se usen.
function _ensureDragOverlay(svg) {
  let g = svg.querySelector(".drag-overlay-g");
  if (g) return g;
  g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", "drag-overlay-g");
  g.style.pointerEvents = "none";
  g.innerHTML = `
    <line class="snap-guide-v" x1="0" y1="0" x2="0" y2="190" stroke="#2563EB" stroke-width="0.6" stroke-dasharray="3,2" display="none"/>
    <line class="snap-guide-h" x1="0" y1="0" x2="380" y2="0" stroke="#2563EB" stroke-width="0.6" stroke-dasharray="3,2" display="none"/>`;
  svg.appendChild(g);
  return g;
}

let _lastPieceClick = null; // { pieceId, time } — usado para detectar doble clic a mano

function rotatePieceManually(piece, g, svg) {
  if (piece.grain && !confirm("Esta pieza tiene veta marcada — rotarla manualmente puede no calzar con el resto. ¿Rotar igual?")) return;
  const sheetIndex = Number(svg.dataset.sheetIndex) || 0;
  const rectEl = g.querySelector("rect.piece-rect");
  // Rotar intercambia ancho/alto en el mismo lugar -- puede salirse de la lámina o pisar otra
  // pieza que antes no tocaba. Se valida ANTES de aplicar, igual que al soltar un arrastre.
  const x = Number(rectEl.getAttribute("x")), y = Number(rectEl.getAttribute("y"));
  const w = Number(rectEl.getAttribute("width")), h = Number(rectEl.getAttribute("height"));
  if (_dragInvalid(svg, g, x, y, h, w)) {
    toast("No se puede rotar aquí — la pieza girada se saldría de la lámina o pisaría otra.", "error");
    return;
  }
  if (piece.manualPlacement) {
    piece.manualPlacement.rotated = !piece.manualPlacement.rotated;
  } else {
    const { cmX, cmY } = _svgPxToCm(svg, x, y);
    piece.manualPlacement = { sheetIndex, x: cmX, y: cmY, rotated: g.dataset.rotated !== "1" };
  }
  recalcCutsLayout();
}

els.cutsLayoutOutput?.addEventListener("pointerdown", (e) => {
  const g = e.target.closest(".cut-piece-g");
  if (!g) return;
  const svg = g.closest("svg");
  if (!svg) return;
  const rectEl = g.querySelector("rect.piece-rect");
  const pt = _eventToSvgPoint(svg, e);
  const kerfRects = Array.from(g.querySelectorAll("rect")).filter(r => r !== rectEl);
  _cutDrag = {
    pieceId: g.dataset.pieceId,
    svg, g,
    sheetIndex: Number(svg.dataset.sheetIndex) || 0,
    startX: pt.x, startY: pt.y,
    origX: Number(rectEl.getAttribute("x")), origY: Number(rectEl.getAttribute("y")),
    origFill: rectEl.getAttribute("fill"),
    // Las franjas de kerf (a la derecha/abajo de la pieza) deben moverse junto con ella durante
    // el arrastre -- si no, se quedan "atrás" hasta que recalcCutsLayout() las reubique al
    // soltar, lo que se ve como un glitch visual mientras se arrastra.
    kerfRects: kerfRects.map(r => ({ el: r, dx: Number(r.getAttribute("x")) - Number(rectEl.getAttribute("x")), dy: Number(r.getAttribute("y")) - Number(rectEl.getAttribute("y")) })),
    rectEl, textEl: g.querySelector("text"), moved: false
  };
  g.setPointerCapture?.(e.pointerId);
  // No preventDefault aquí: en eventos de puntero, cancelar pointerdown suprime
  // los eventos de mouse de compatibilidad (click/dblclick) — por eso el doble
  // clic para rotar se detecta a mano (ver pointerup) en vez de usar "dblclick".
});

els.cutsLayoutOutput?.addEventListener("pointermove", (e) => {
  if (!_cutDrag) return;
  const pt = _eventToSvgPoint(_cutDrag.svg, e);
  const dx = pt.x - _cutDrag.startX, dy = pt.y - _cutDrag.startY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) _cutDrag.moved = true;
  if (!_cutDrag.moved) return;
  const w = Number(_cutDrag.rectEl.getAttribute("width")), h = Number(_cutDrag.rectEl.getAttribute("height"));
  const rawX = _cutDrag.origX + dx, rawY = _cutDrag.origY + dy;
  const snap = _snapDragPosition(_cutDrag.svg, _cutDrag.g, rawX, rawY, w, h);
  const newX = snap.x, newY = snap.y;
  _cutDrag.lastX = newX; _cutDrag.lastY = newY;

  _cutDrag.rectEl.setAttribute("x", newX.toFixed(1));
  _cutDrag.rectEl.setAttribute("y", newY.toFixed(1));
  if (_cutDrag.textEl) {
    _cutDrag.textEl.setAttribute("x", (newX + w / 2).toFixed(1));
    _cutDrag.textEl.setAttribute("y", (newY + h / 2 + 3).toFixed(1));
  }
  _cutDrag.kerfRects.forEach(({ el, dx: kdx, dy: kdy }) => {
    el.setAttribute("x", (newX + kdx).toFixed(1));
    el.setAttribute("y", (newY + kdy).toFixed(1));
  });

  // Guías magnéticas: solo se ven mientras el eje correspondiente está "atrapado".
  const overlay = _ensureDragOverlay(_cutDrag.svg);
  const vLine = overlay.querySelector(".snap-guide-v"), hLine = overlay.querySelector(".snap-guide-h");
  if (snap.lineX != null) { vLine.setAttribute("x1", snap.lineX); vLine.setAttribute("x2", snap.lineX); vLine.setAttribute("display", ""); }
  else vLine.setAttribute("display", "none");
  if (snap.lineY != null) { hLine.setAttribute("y1", snap.lineY); hLine.setAttribute("y2", snap.lineY); hLine.setAttribute("display", ""); }
  else hLine.setAttribute("display", "none");

  // Tinte rojo en vivo si la posición actual se superpone con otra pieza o sale de la lámina —
  // feedback inmediato de que soltar aquí se va a revertir, sin esperar a soltar para enterarse.
  const invalid = _dragInvalid(_cutDrag.svg, _cutDrag.g, newX, newY, w, h);
  _cutDrag.rectEl.setAttribute("fill", invalid ? "#FCA5A5" : _cutDrag.origFill);
  _cutDrag.invalid = invalid;
});

els.cutsLayoutOutput?.addEventListener("pointerup", (e) => {
  if (!_cutDrag) return;
  const { pieceId, svg, g, moved, rectEl, sheetIndex, origX, origY, origFill, invalid } = _cutDrag;
  const piece = state.editablePieces.find(p => p.id === pieceId);
  const overlay = svg.querySelector(".drag-overlay-g");
  overlay?.querySelectorAll("line").forEach(l => l.setAttribute("display", "none"));

  if (!moved) {
    // Clic sin arrastre — si es el segundo clic rápido sobre la misma pieza, rotar.
    const now = Date.now();
    if (_lastPieceClick && _lastPieceClick.pieceId === pieceId && now - _lastPieceClick.time < 400) {
      _lastPieceClick = null;
      _cutDrag = null;
      if (piece) rotatePieceManually(piece, g, svg);
      return;
    }
    _lastPieceClick = { pieceId, time: now };
    _cutDrag = null;
    return;
  }

  _lastPieceClick = null;
  if (invalid) {
    // Se suelta sobre otra pieza o fuera de la lámina — revertir a la posición original en vez
    // de guardar un acomodo imposible (la pieza física no puede ocupar ese lugar).
    rectEl.setAttribute("x", origX.toFixed(1));
    rectEl.setAttribute("y", origY.toFixed(1));
    rectEl.setAttribute("fill", origFill);
    toast("No se puede soltar ahí — se superpone con otra pieza o sale de la lámina.", "error");
    _cutDrag = null;
    return;
  }
  if (piece && rectEl) {
    const { cmX, cmY } = _svgPxToCm(svg, Number(rectEl.getAttribute("x")), Number(rectEl.getAttribute("y")));
    const wasRotated = piece.manualPlacement?.rotated ?? (g.dataset.rotated === "1");
    piece.manualPlacement = { sheetIndex, x: cmX, y: cmY, rotated: Boolean(wasRotated) };
  }
  _cutDrag = null;
  recalcCutsLayout();
});

document.getElementById("resetCutPlacementsBtn")?.addEventListener("click", () => {
  state.editablePieces.forEach(p => { delete p.manualPlacement; });
  recalcCutsLayout();
  toast("Posiciones automáticas restauradas ✓");
});

function exportCutsCSV() {
  const pieces = state.editablePieces.length ? state.editablePieces : (() => {
    if (!state.draftItems.length && !state.manualPieces.length) return [];
    const all = [];
    state.draftItems.forEach(item => generatePiecesForItem(item).forEach(p => all.push(p)));
    state.manualPieces.forEach(p => all.push(p));
    return all;
  })();
  if (!pieces.length) { toast("Calcula los cortes primero.", "error"); return; }
  const rows = [["Mueble","Pieza","Ancho mm (sustrato)","Alto mm (sustrato)","Grosor","Canto arriba","Canto abajo","Canto izq","Canto der","Veta","Canto (resumen)"]];
  pieces.forEach(p => {
    const es = p.edgeSides || {};
    rows.push([p.furniture||'', p.name, p.width, p.height, p.thickness||'18 mm',
      es.top||'', es.bottom||'', es.left||'', es.right||'', p.grain ? "Sí" : "No", p.edge||'']);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿"+csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "cortes.csv"; a.click();
  URL.revokeObjectURL(url);
}

function appendChat(role, text, loading = false) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}`;
  bubble.textContent = text;
  if (loading) {
    const dots = document.createElement("span");
    dots.className = "loading-dots";
    dots.innerHTML = "<span></span><span></span><span></span>";
    bubble.appendChild(dots);
  }
  els.chatMessages.appendChild(bubble);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  return bubble;
}

const AI_REQUEST_TIMEOUT_MS = 90000;

async function postAi(endpoint, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: controller.signal
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function describeAiError(status, data) {
  const icon = status === 503 ? "⚠️" : status === 429 ? "⏳" : "❌";
  return status === 503
    ? "⚠️ Sin clave de OpenAI. Configura OPENAI_API_KEY en Render."
    : `${icon} ${data?.error || "Error desconocido, intenta de nuevo."}`;
}

// Pinta items/materiales/piezas/desglose en una burbuja dada — usado tanto para la
// respuesta única (sin imagen automática) como para la 2da llamada de seguimiento
// (cuando la 1ra llamada solo trajo la imagen).
function renderAssistantContentBlocks(bubble, data, message) {
  const items = data.items?.length ? data.items : (data.item ? [data.item] : []);
  const hasMaterials = Array.isArray(data.materials) && data.materials.length > 0;
  const hasPieces = Array.isArray(data.pieces) && data.pieces.length > 0;
  const hasBreakdown = Boolean(data.breakdown && typeof data.breakdown === "object");
  if (items.length > 0 || hasMaterials || hasPieces || hasBreakdown || data.suggestImage) {
    const nextLabel = document.createElement("p");
    nextLabel.className = "next-step-label";
    nextLabel.textContent = "¿Qué quieres hacer ahora?";
    bubble.appendChild(nextLabel);
  }
  if (items.length > 0) {
    const normalized = items.map(it => normalizeAssistantItem(it, message));
    state.lastDesignItems = normalized;
    bubble.appendChild(document.createElement("br"));
    const cutsBtn = document.createElement("button");
    cutsBtn.className = "chat-quote-btn";
    cutsBtn.textContent = "✂️ Ir a cortes";
    cutsBtn.onclick = () => { addItemsToQuote(normalized); showView("cutsView"); renderCuts(); };
    bubble.appendChild(cutsBtn);
  }

  if (Array.isArray(data.materials) && data.materials.length) {
    data.materials.forEach(m => {
      state.materialCartItems.push({
        id: crypto.randomUUID(),
        description: m.description || "Material",
        qty: Number(m.qty) || 1,
        unit: m.unit || "Unidades",
        unitPrice: Number(m.unitPrice) || 0
      });
    });
    renderDraftItems();
    bubble.appendChild(document.createElement("br"));
    const btn = document.createElement("button");
    btn.className = "chat-quote-btn";
    btn.textContent = "📋 Ver en Cotizar";
    btn.onclick = () => showView("quoteView");
    bubble.appendChild(btn);
    toast(`${data.materials.length} material(es) agregado(s) por la IA ✓`);
  }

  if (Array.isArray(data.pieces) && data.pieces.length) {
    const allPieces = data.pieces.flatMap(p => buildManualPieces({
      furniture: p.furniture || "",
      name: p.name || "Pieza",
      largo: Number(p.largo) || 1,
      ancho: Number(p.ancho) || 1,
      qty: Math.max(1, Number(p.qty) || 1),
      thickness: p.thickness || "18 mm",
      cantoSides: p.cantoSides || { l1: false, l2: false, c1: false, c2: false },
      cantoThickness: p.cantoThickness || "1.00mm",
      grain: Boolean(p.grain),
      grainDir: p.grainDirection || "largo"
    }));
    addPiecesToCuts(allPieces);
    bubble.appendChild(document.createElement("br"));
    const btn = document.createElement("button");
    btn.className = "chat-quote-btn";
    btn.textContent = "✂️ Ver en Cortes";
    btn.onclick = () => showView("cutsView");
    bubble.appendChild(btn);
    toast(`${allPieces.length} pieza(s) creada(s) por la IA ✓`);
  }

  if (data.breakdown && typeof data.breakdown === "object") {
    renderBreakdownSection(bubble, data.breakdown);
  }

  if (data.suggestImage) {
    bubble.appendChild(document.createElement("br"));
    const genBtn = document.createElement("button");
    genBtn.className = "chat-quote-btn";
    genBtn.textContent = "🖼️ Generar imagen";
    genBtn.type = "button";
    genBtn.onclick = () => requestStandaloneImage(genBtn, message);
    bubble.appendChild(genBtn);
  }
}

function pushChatHistory(message, assistantReply) {
  state.chatHistory.push({ role: "user", text: message });
  state.chatHistory.push({ role: "assistant", text: assistantReply });
  if (state.chatHistory.length > 30) state.chatHistory = state.chatHistory.slice(-30);
}

async function sendToAI() {
  // Evita disparar una 2da solicitud superpuesta (ej: Ctrl+Enter mientras la anterior sigue
  // esperando respuesta) — cada llamada a la IA tiene costo, no tiene sentido pagar dos veces
  // por una doble pulsación.
  if (els.sendChatBtn.disabled) return;

  const message = els.chatInput.value.trim();
  const hasImage = Boolean(state.currentImageData);

  if (!message && !hasImage) {
    appendChat("assistant", "⚠️ Escribe un mensaje o sube una foto primero.");
    return;
  }

  // User bubble — show thumbnail if image attached
  if (hasImage) {
    const userBubble = document.createElement("div");
    userBubble.className = "chat-bubble user";
    if (message) { const t = document.createElement("span"); t.textContent = message; userBubble.appendChild(t); }
    const img = document.createElement("img");
    img.src = state.currentImageData;
    img.style.cssText = "display:block;max-width:180px;border-radius:8px;margin-top:6px";
    userBubble.appendChild(img);
    els.chatMessages.appendChild(userBubble);
  } else {
    appendChat("user", message);
  }

  els.chatInput.value = "";
  const imgDataForRequest = state.currentImageData;
  clearImageState();

  const pending = appendChat("assistant", hasImage
    ? "🔍 Analizando imagen… 15–30 seg"
    : "⚙️ Diseñando…", true);
  els.sendChatBtn.disabled = true;
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;

  try {
    if (hasImage) {
      const { ok, status, data } = await postAi("/api/analyze-space", {
        message: message || "Analiza este espacio y propón muebles de melamina.",
        imageData: imgDataForRequest
      });
      if (!ok) { pending.textContent = describeAiError(status, data); return; }
      pending.textContent = data.assistantText || "Propuesta generada.";
      renderAssistantContentBlocks(pending, data, message);
      return;
    }

    // Se manda todo lo que el cliente tiene guardado (tope de 30 = 15 turnos, ver pushChatHistory);
    // el servidor es quien decide cuánto usar tal cual (últimos 5) y cuánto resumir — así el
    // resumen compacto de lo viejo tiene algo real que resumir en vez de quedar sin efecto.
    const recentHistory = state.chatHistory;
    const baseBody = { message, tenant: currentTenant(), currentItem: state.lastDesignItems[0] || null, history: recentHistory, customPrices: tenantPrices().customItems || [] };

    const first = await postAi("/api/ebanista-ai", baseBody);
    if (!first.ok) { pending.textContent = describeAiError(first.status, first.data); return; }
    const data1 = first.data;

    pending.textContent = data1.assistantText || "Propuesta generada.";
    if (data1.imageB64 || data1.imageUrl) {
      renderImageBlock(pending, data1.imageB64 ? `data:image/png;base64,${data1.imageB64}` : data1.imageUrl);
    }

    // Nunca corremos imagen y desglose a la vez: si el servidor ya entregó (o intentó) la
    // imagen y falta el desglose técnico, se pide en una 2da llamada secuencial — recién
    // ahí se habilita "Ir a cortes"/"Enviar a Cortes".
    if (data1.needsFollowup) {
      if (message) state.chatHistory.push({ role: "user", text: message });
      const followupPending = appendChat("assistant", "📝 Generando desglose técnico…", true);
      els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
      const second = await postAi("/api/ebanista-ai", { ...baseBody, skipImageRouter: true });
      if (!second.ok) { followupPending.textContent = describeAiError(second.status, second.data); return; }
      const data2 = second.data;
      const reply2 = data2.assistantText || "Propuesta generada.";
      followupPending.textContent = reply2;
      renderAssistantContentBlocks(followupPending, data2, message);
      if (message) state.chatHistory.push({ role: "assistant", text: reply2 });
      if (state.chatHistory.length > 30) state.chatHistory = state.chatHistory.slice(-30);
      return;
    }

    renderAssistantContentBlocks(pending, data1, message);
    if (message) pushChatHistory(message, data1.assistantText || "Propuesta generada.");

  } catch (e) {
    pending.textContent = e.name === "AbortError"
      ? "⏱ Tiempo agotado (90s). Intenta con una descripción más corta."
      : `❌ Error: ${e.message}`;
  } finally {
    els.sendChatBtn.disabled = false;
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }
}

function renderImageBlock(container, src) {
  container.appendChild(document.createElement("br"));
  const wrap = document.createElement("div");
  wrap.className = "chat-render";
  const img = document.createElement("img");
  img.src = src;
  img.alt = "Imagen generada por IA";
  wrap.appendChild(img);
  container.appendChild(wrap);
  const dl = document.createElement("a");
  dl.className = "chat-quote-btn";
  dl.textContent = "⬇ Descargar imagen";
  dl.href = src;
  dl.download = `agente-ebanistas-${Date.now()}.png`;
  container.appendChild(document.createElement("br"));
  container.appendChild(dl);
}

// Caso ambiguo (1 sola señal técnica): el usuario pide la imagen a mano con el botón
// "🖼️ Generar imagen" en vez de gastar una llamada automática que tal vez no quería.
async function requestStandaloneImage(btn, prompt) {
  btn.disabled = true;
  btn.textContent = "🖼️ Generando…";
  try {
    const res = await fetch("/api/generate-image", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    if (!res.ok) {
      btn.textContent = "🖼️ Generar imagen";
      btn.disabled = false;
      toast(data.error || "No se pudo generar la imagen.", "error");
      return;
    }
    const src = data.imageB64 ? `data:image/png;base64,${data.imageB64}` : data.imageUrl;
    renderImageBlock(btn.parentElement, src);
    btn.remove();
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  } catch (e) {
    btn.textContent = "🖼️ Generar imagen";
    btn.disabled = false;
    toast(`Error: ${e.message}`, "error");
  }
}

// Desglose interactivo: texto en 4 partes + piezas con botón individual "Enviar a Cortes".
// A diferencia de data.pieces (que se auto-aplica), aquí el humano decide qué mandar.
function renderBreakdownSection(pending, breakdown) {
  const wrap = document.createElement("div");
  wrap.className = "breakdown-block";

  [["structure", "🏗️ Estructura"], ["materials", "🧱 Materiales"], ["cuts", "✂️ Cortes"], ["assembly", "🔧 Ensamblaje"]]
    .forEach(([key, label]) => {
      if (!breakdown[key]) return;
      const p = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = `${label}: `;
      p.appendChild(strong);
      p.appendChild(document.createTextNode(String(breakdown[key])));
      wrap.appendChild(p);
    });

  const pieces = Array.isArray(breakdown.pieces) ? breakdown.pieces : [];
  if (pieces.length) {
    const heading = document.createElement("h4");
    heading.textContent = "📐 Cortes / despiece";
    wrap.appendChild(heading);

    const list = document.createElement("div");
    list.className = "breakdown-pieces";

    pieces.forEach((p, idx) => {
      const card = document.createElement("div");
      card.className = "breakdown-piece-card";

      const info = document.createElement("div");
      info.className = "breakdown-piece-info";
      const name = document.createElement("strong");
      name.textContent = p.name || `Pieza ${idx + 1}`;
      const meta = document.createElement("span");
      const qty = Math.max(1, Number(p.qty) || 1);
      meta.textContent = `${Number(p.largo) || 0}×${Number(p.ancho) || 0}mm · ${p.material || p.thickness || "—"} · x${qty}`;
      info.appendChild(name);
      info.appendChild(meta);
      if (p.calculo) {
        const calc = document.createElement("span");
        calc.className = "breakdown-piece-calc";
        calc.textContent = `📐 ${p.calculo}`;
        info.appendChild(calc);
      }

      const sendBtn = document.createElement("button");
      sendBtn.className = "tiny-btn";
      sendBtn.textContent = "✂️ Enviar a Cortes";
      sendBtn.type = "button";
      sendBtn.onclick = () => {
        const built = buildManualPieces({
          furniture: p.furniture || "",
          name: p.name || "Pieza",
          largo: Number(p.largo) || 1,
          ancho: Number(p.ancho) || 1,
          qty,
          thickness: p.thickness || "18 mm",
          cantoSides: p.cantoSides || { l1: false, l2: false, c1: false, c2: false },
          cantoThickness: p.cantoThickness || "1.00mm",
          grain: Boolean(p.grain),
          grainDir: p.grainDirection || "largo"
        });
        addPiecesToCuts(built);
        sendBtn.textContent = "✓ Enviada";
        sendBtn.disabled = true;
        toast(`"${p.name || "Pieza"}" enviada a Cortes ✓`);
      };

      card.appendChild(info);
      card.appendChild(sendBtn);
      list.appendChild(card);
    });
    wrap.appendChild(list);

    const allBtn = document.createElement("button");
    allBtn.className = "chat-quote-btn";
    allBtn.textContent = "✂️ Enviar todas a Cortes";
    allBtn.type = "button";
    allBtn.onclick = () => {
      list.querySelectorAll("button.tiny-btn").forEach(b => { if (!b.disabled) b.click(); });
      showView("cutsView");
    };
    wrap.appendChild(allBtn);
  }

  pending.appendChild(wrap);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function numberBefore(text, words, fallback) {
  for (const word of words) {
    const match = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:cm)?\\s*(?:de\\s*)?${word}`));
    if (match) return Number(match[1]);
    const reverse = text.match(new RegExp(`${word}\\s*(?:de\\s*)?(\\d+(?:\\.\\d+)?)`));
    if (reverse) return Number(reverse[1]);
  }
  return fallback;
}

function dimensionsFromText(text) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:cm)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:cm)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:cm)?/);
  if (!match) return {};
  return {
    width: Number(match[1]),
    height: Number(match[2]),
    depth: Number(match[3])
  };
}

function parseFurnitureType(text, fallback = "Otro") {
  if (text.includes("closet")) return "Closet";
  if (text.includes("vanity") || text.includes("bano") || text.includes("baño")) return "Vanity";
  if (text.includes("entretenimiento") || text.includes("tv")) return "Centro de entretenimiento";
  if (text.includes("lavanderia")) return "Mueble de lavandería";
  if (text.includes("escritorio")) return "Escritorio";
  if (text.includes("cocina")) return "Cocina";
  return fallback;
}

function parseMelamineThickness(text, fallback = "18 mm") {
  if (/(^|\D)15\s*(mm)?(\D|$)/.test(text)) return "15 mm";
  if (/(^|\D)18\s*(mm)?(\D|$)/.test(text)) return "18 mm";
  if (/(^|\D)25\s*(mm)?(\D|$)/.test(text)) return "25 mm";
  if (/(^|\D)36\s*(mm)?(\D|$)/.test(text)) return "36 mm doble laminado";
  return fallback;
}

function buildAssistantItemFromText(message, baseItem = null) {
  const text = normalizeText(message);
  const dimensions = dimensionsFromText(text);
  const type = parseFurnitureType(text, baseItem?.furnitureType || "Otro");
  const defaultHeight = type === "Cocina" ? 90 : 180;
  const width = dimensions.width || numberBefore(text, ["ancho", "anchura"], baseItem?.width || 120);
  const height = dimensions.height || numberBefore(text, ["alto", "altura"], baseItem?.height || defaultHeight);
  const depth = dimensions.depth || numberBefore(text, ["profundidad", "fondo"], baseItem?.depth || 55);
  const doors = text.includes("sin puerta") ? 0 : numberBefore(text, ["puerta", "puertas"], baseItem?.doors ?? (type === "Closet" ? 4 : 2));
  const drawers = text.includes("sin gaveta") || text.includes("sin cajon") ? 0 : numberBefore(text, ["gaveta", "gavetas", "cajon", "cajones"], baseItem?.drawers ?? 0);
  const shelves = text.includes("sin repisa") || text.includes("sin division") ? 0 : numberBefore(text, ["repisa", "repisas", "division", "divisiones"], baseItem?.shelves ?? 1);
  const name = text.includes("cubo")
    ? "Cubo propuesto por asistente"
    : baseItem?.name || `${type} propuesto por asistente`;

  return calculateItem({
    id: crypto.randomUUID(),
    name,
    furnitureType: type,
    dimensionBasis: text.includes("medidas internas")
      ? "internal"
      : text.includes("medidas externas") || text.includes("medidas exteriores")
        ? "external"
        : baseItem?.dimensionBasis || "external",
    width,
    height,
    depth,
    complexityKey: text.includes("premium") || text.includes("lujo")
      ? "premium"
      : text.includes("alta") || text.includes("complej")
        ? "high"
        : text.includes("baja") || text.includes("simple")
          ? "low"
          : baseItem?.complexityKey || "medium",
    doors,
    drawers,
    shelves,
    shelfPlacement: text.includes("repisa externa") || text.includes("repisas externas")
      ? "external"
      : text.includes("repisa interna") || text.includes("repisas internas")
        ? "internal"
        : baseItem?.shelfPlacement || "internal",
    doorPlacement: text.includes("puerta interna") || text.includes("puertas internas")
      ? "internal"
      : text.includes("embutida") || text.includes("a ras")
        ? "inset"
        : text.includes("puerta externa") || text.includes("puertas externas") || text.includes("sobrepuesta")
          ? "overlay"
          : baseItem?.doorPlacement || "overlay",
    drawerPlacement: text.includes("gaveta interna") || text.includes("caja interna")
      ? "internal_box"
      : text.includes("frente embutido")
        ? "inset_front"
        : text.includes("frente exterior") || text.includes("gaveta externa")
          ? "external_front"
          : baseItem?.drawerPlacement || "external_front",
    backPlacement: text.includes("sin fondo")
      ? "none"
      : text.includes("fondo interno") || text.includes("fondo embutido")
        ? "internal"
        : text.includes("fondo exterior") || text.includes("fondo externo") || text.includes("fondo sobrepuesto")
          ? "external"
          : baseItem?.backPlacement || "external",
    melamineThickness: parseMelamineThickness(text, baseItem?.melamineThickness || "18 mm"),
    edgeBanding: text.includes("sin canto") || text.includes("no incluir canto")
      ? "No incluir canto"
      : text.includes("todos los cantos")
        ? "Todos los cantos expuestos"
        : baseItem?.edgeBanding || "Frentes visibles y puertas",
    hinges: text.includes("sin bisagra") || text.includes("no incluir bisagra")
      ? "No incluir bisagras"
      : baseItem?.hinges || "Blum CLIP top BLUMOTION 110° (cierre suave)",
    drawerSlides: text.includes("sin corredera") || text.includes("no incluir corredera")
      ? "No incluir correderas"
      : baseItem?.drawerSlides || "Blum TANDEMBOX antaro (30 kg)",
    handles: text.includes("sin jalador") || text.includes("no incluir jalador")
      ? "No incluir jaladores"
      : text.includes("push")
        ? "Sin jalador (push-to-open)"
        : baseItem?.handles || "Barra aluminio 128mm",
    color: baseItem?.color || "RH01",
    notes: `Generado desde mini chat: ${message}`,
    manualPrice: baseItem?.manualPrice || 0
  });
}

function inferAssistantActions(message) {
  const text = normalizeText(message);
  const actions = [];
  const wantsImage = text.includes("imagen") || text.includes("foto") || text.includes("mejora");
  const wants3d = text.includes("3d") || text.includes("render") || text.includes("boceto");
  const wantsQuote = text.includes("cotiz") || text.includes("presupuesto") || text.includes("precio") || text.includes("agrega");
  const wantsCuts = text.includes("corte") || text.includes("cortes") || text.includes("despiece") || text.includes("lamina") || text.includes("lámina");
  const wantsEdit = text.includes("modifica") || text.includes("cambia") || text.includes("corrige") || text.includes("editable") || text.includes("medida");

  if (wantsImage) actions.push("enhance_image");
  if (wants3d) actions.push("mock_3d");
  if (wantsQuote || wantsCuts) actions.push("add_to_quote");
  if (wantsCuts) actions.push("calculate_cuts");
  if (wantsEdit || (!wantsQuote && !wantsCuts)) actions.push("fill_form");

  return [...new Set(actions)];
}

function buildLocalAssistantPlan(message) {
  const item = buildAssistantItemFromText(message, state.lastDesignItems[0] || null);
  const actions = inferAssistantActions(message);
  const pieces = generatePiecesForItem(item);
  const shelf = pieces.find((pieceItem) => normalizeText(pieceItem.name).includes("repisa"));
  const shelfText = shelf ? ` La primera repisa queda en ${shelf.width} x ${shelf.height} cm.` : "";

  return {
    source: "local",
    item,
    actions,
    assistantText: `Listo: preparé ${item.name} de ${item.width} x ${item.height} x ${item.depth} cm, con fondo ${placementLabel(item.backPlacement)}, ${item.shelves} repisa(s) ${placementLabel(item.shelfPlacement)} y ${item.doors} puerta(s) ${placementLabel(item.doorPlacement)}.${shelfText}`
  };
}


// ── Generate concept image with DALL-E 3 ────────────────────────────────────
async function generateConceptImage(designPrompt, parentEl) {
  const wrap = document.createElement("div");
  wrap.className = "chat-render";
  wrap.innerHTML = `<div class="render-loading">🎨 Generando render… puede tardar 1–2 min la primera vez</div>`;
  if (parentEl) { parentEl.appendChild(wrap); els.chatMessages.scrollTop = els.chatMessages.scrollHeight; }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 130000);
    const res = await fetch("/api/generate-image", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: designPrompt }),
      signal: ctrl.signal
    });
    clearTimeout(t);
    const data = await res.json();

    // Helper: show image in the wrap element
    function showRenderImage(imgUrl) {
      wrap.innerHTML = "";
      const img = document.createElement("img");
      img.alt = "Render conceptual";
      img.style.cssText = "width:100%;border-radius:8px;display:block;cursor:pointer";
      img.title = "Clic para ampliar";
      img.addEventListener("click", () => window.open(imgUrl, "_blank"));
      img.src = imgUrl;
      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;gap:8px;margin-top:6px";
      const dlBtn = document.createElement("button");
      dlBtn.style.cssText = "font-size:0.75rem;background:none;border:none;color:#059669;cursor:pointer;padding:0";
      dlBtn.textContent = "⬇ Descargar";
      dlBtn.addEventListener("click", () => downloadRender(imgUrl));
      btnRow.appendChild(dlBtn);
      wrap.appendChild(img);
      wrap.appendChild(btnRow);
    }

    if (data.imageUrl) {
      showRenderImage(data.imageUrl);
    } else if (data.pollinations) {
      // Server HF failed → Pollinations direct from client browser (different IP, no blocking)
      wrap.innerHTML = "";
      const seed = Math.floor(Math.random() * 999999);
      const pText = (designPrompt.slice(0, 250) + ", photorealistic furniture interior design 4k soft lighting").replace(/\s+/g, " ");
      const pUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(pText)}?nologo=true&seed=${seed}&width=512&height=512`;

      // Show loading text while image downloads in background
      const loadTxt = document.createElement("div");
      loadTxt.className = "render-loading";
      loadTxt.textContent = "🎨 Generando render… puede tardar 1-2 min";
      wrap.appendChild(loadTxt);

      const img = document.createElement("img");
      img.alt = "Render conceptual";
      img.style.cssText = "width:100%;border-radius:8px;display:none;cursor:pointer";
      img.title = "Clic para ampliar";
      wrap.appendChild(img);

      // 2-minute hard timeout
      const pTimer = setTimeout(() => {
        img.src = "";
        wrap.innerHTML = `<p style="color:#991b1b;font-size:0.8rem">⚠ El render tardó demasiado. Escribe "hazme el render" para reintentar.</p>`;
        if (els.chatMessages) els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
      }, 120000);

      img.onerror = () => {
        clearTimeout(pTimer);
        wrap.innerHTML = `<p style="color:#991b1b;font-size:0.8rem">⚠ Error generando render. Escribe "hazme el render" para reintentar.</p>`;
        if (els.chatMessages) els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
      };
      img.onload = () => {
        clearTimeout(pTimer);
        loadTxt.remove();
        img.style.display = "block";
        img.addEventListener("click", () => window.open(pUrl, "_blank"));
        const dlBtn = document.createElement("button");
        dlBtn.style.cssText = "display:block;margin-top:6px;font-size:0.75rem;background:none;border:none;color:#059669;cursor:pointer;padding:0";
        dlBtn.textContent = "⬇ Descargar";
        dlBtn.addEventListener("click", () => downloadRender(pUrl));
        wrap.appendChild(dlBtn);
        if (els.chatMessages) els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
      };
      img.src = pUrl; // starts downloading immediately, non-blocking
    } else {
      wrap.innerHTML = `<p style="color:#991b1b;font-size:0.8rem">⚠ ${data.error || "No se pudo generar render"}</p>`;
    }
  } catch {
    wrap.innerHTML = `<p style="color:#991b1b;font-size:0.8rem">⚠ No se pudo generar render.</p>`;
  }
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function clearImageState() {
  state.currentImageData = null;
  const thumb = document.getElementById("imgThumb");
  if (thumb) {
    thumb.style.display = "none";
    const img = thumb.querySelector("img");
    if (img) img.remove();
  }
  const inp = document.getElementById("designImage");
  if (inp) inp.value = "";
}

// Boceto/dibujo/captura/referencia subida por el usuario -> render profesional de alta calidad,
// manteniendo forma/distribución/proporciones originales (server.js: /api/enhance-sketch, usa
// /v1/images/edits en vez de /generations). Distinto de "Analizar espacio" (esa interpreta una
// foto de un cuarto vacío y propone muebles; esta toma una referencia de UN mueble y la mejora).
// Error específico de este flujo -- a propósito NO reutiliza describeAiError(), que asume
// que TODO status 503 significa "falta OPENAI_API_KEY". Esa suposición no aplica aquí: el
// servidor (editImageWithReference en server.js) ahora usa 401 solo para "falta la clave" y
// reserva 503 para timeouts/excepciones reales de red al subir la imagen -- mezclar ambos bajo
// el mismo mensaje fue justo el bug reportado (decía "sin clave" cuando la clave sí existía).
function describeSketchError(status, data) {
  if (status === 401) return "⚠️ Sin clave de OpenAI configurada en el servidor. Configura OPENAI_API_KEY en Render.";
  if (status === 429) return `⏳ ${data?.error || "Demasiadas solicitudes, espera un momento."}`;
  return `❌ ${data?.error || "No se pudo mejorar la imagen, intenta de nuevo."}`;
}

let enhanceSketchInFlight = false;
async function enhanceSketchUpload() {
  if (enhanceSketchInFlight) return;
  if (!state.currentImageData) { toast("Adjunta una foto, boceto o referencia primero.", "error"); return; }
  enhanceSketchInFlight = true;
  const btn = document.getElementById("enhanceSketchBtn");
  if (btn) { btn.disabled = true; btn.textContent = "✏️ Mejorando…"; }

  const message = els.chatInput.value.trim();
  const imageDataForRequest = state.currentImageData;

  const userBubble = document.createElement("div");
  userBubble.className = "chat-bubble user";
  if (message) { const t = document.createElement("span"); t.textContent = message; userBubble.appendChild(t); }
  const img = document.createElement("img");
  img.src = imageDataForRequest;
  img.style.cssText = "display:block;max-width:180px;border-radius:8px;margin-top:6px";
  userBubble.appendChild(img);
  els.chatMessages.appendChild(userBubble);

  els.chatInput.value = "";
  clearImageState();

  const pending = appendChat("assistant", "✏️ Mejorando tu boceto a render profesional… 15–30 seg", true);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;

  try {
    const { ok, status, data } = await postAi("/api/enhance-sketch", { imageData: imageDataForRequest, message });
    if (!ok) { pending.textContent = describeSketchError(status, data); return; }
    pending.textContent = data.assistantText || "Imagen profesional generada a partir del boceto.";
    if (data.imageB64 || data.imageUrl) {
      renderImageBlock(pending, data.imageB64 ? `data:image/png;base64,${data.imageB64}` : data.imageUrl);
    }
  } catch (e) {
    pending.textContent = e.name === "AbortError"
      ? "⏱ Tiempo agotado (90s). Intenta con una imagen más liviana."
      : `❌ Error: ${e.message}`;
  } finally {
    enhanceSketchInFlight = false;
    if (btn) { btn.disabled = false; btn.textContent = "✏️ Mejorar a render"; }
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }
}
document.getElementById("enhanceSketchBtn")?.addEventListener("click", enhanceSketchUpload);

async function downloadRender(url) {
  try {
    let blobUrl;
    if (url.startsWith("data:")) {
      // Convert data URL → Blob directly (avoids fetch issues with large base64)
      const parts = url.split(",");
      const mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/jpeg";
      const raw = atob(parts[1]);
      const arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      blobUrl = URL.createObjectURL(new Blob([arr], { type: mime }));
    } else {
      const r = await fetch(url);
      blobUrl = URL.createObjectURL(await r.blob());
    }
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `render-mueble-${Date.now()}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  } catch {
    window.open(url, "_blank");
  }
}

function normalizeBackendPlan(data, message) {
  const item = data.item ? normalizeAssistantItem(data.item, message) : buildAssistantItemFromText(message, state.lastDesignItems[0] || null);
  const actions = Array.isArray(data.actions) && data.actions.length ? data.actions : inferAssistantActions(message);
  return {
    source: data.source || "openai",
    item,
    actions,
    assistantText: data.assistantText || `Propuesta generada: ${item.name}, ${item.width} x ${item.height} x ${item.depth} cm.`
  };
}

function normalizeAssistantItem(input, message) {
  const base = buildAssistantItemFromText(message, state.lastDesignItems[0] || null);
  const catalog = ensureCatalog(currentTenant());
  const item = { ...base, ...input, id: crypto.randomUUID() };
  item.furnitureType = catalog.furnitureTypes.includes(item.furnitureType) ? item.furnitureType : "Otro";
  item.width  = (Number(input.width)  > 0) ? Number(input.width)  : Number(base.width)  || 120;
  item.height = (Number(input.height) > 0) ? Number(input.height) : Number(base.height) || 90;
  item.depth  = (Number(input.depth)  > 0) ? Number(input.depth)  : Number(base.depth)  || 55;
  item.doors    = Number(input.doors    ?? base.doors    ?? 0);
  item.drawers  = Number(input.drawers  ?? base.drawers  ?? 0);
  item.shelves  = Number(input.shelves  ?? base.shelves  ?? 0);
  item.manualPrice = Number(input.manualPrice ?? 0);
  return calculateItem(item);
}

function executeAssistantPlan(plan, message) {
  const item = plan.item;
  state.lastDesignItems = [item];

  if (plan.actions.includes("enhance_image")) enhanceLoadedImage({ silent: true });
  if (plan.actions.includes("fill_form")) {
    state.editingItemId = null;
    fillFormFromItem(item, message);
  }
  if (plan.actions.includes("add_to_quote")) addItemsToQuote([item]);
  if (plan.actions.includes("calculate_cuts")) {
    addItemsToQuote([item]);
    showView("cutsView");
    renderCuts();
  }

  renderAssistantOutput(item, message, plan);
  renderDraftItems();
}

function applyFurnitureBrief(message, options = {}) {
  const base = state.lastDesignItems[0] || null;
  const item = buildAssistantItemFromText(message || "", base);
  state.lastDesignItems = [item];
  fillFormFromItem(item, message || "");
  renderAssistantOutput(item, message || "Solicitud desde cotizador", {
    source: "local",
    actions: ["fill_form"],
    assistantText: "Creé una propuesta editable con los datos escritos."
  });

  if (options.addToQuote || options.calculateCuts) {
    addItemsToQuote([item]);
  }

  if (options.calculateCuts) {
    showView("cutsView");
    renderCuts();
  }

  return item;
}

function setSelectIfExists(id, value) {
  const select = document.getElementById(id);
  if (!select) return;
  const option = [...select.options].find((item) => item.value === value || item.textContent === value);
  if (option) select.value = option.value;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAssistantOutput(item, prompt, plan = {}) {
  if (!els.assistantOutput) return;
  const pieces = generatePiecesForItem(item);
  const pieceRows = pieces.slice(0, 12).map((pieceItem) => `
    <tr>
      <td>${escapeHtml(pieceItem.name)}</td>
      <td>${pieceItem.width} x ${pieceItem.height} cm</td>
      <td>${escapeHtml(pieceItem.edge)}</td>
    </tr>
  `).join("");
  const hiddenPieces = Math.max(0, pieces.length - 12);
  const sourceText = plan.source === "openai" ? "OpenAI conectado" : "modo local operativo";

  els.assistantOutput.innerHTML = `
    <div class="ai-result">
      <h4>Propuesta del asistente ebanista</h4>
      <p>Interpreté tu solicitud como un ${item.furnitureType.toLowerCase()} fabricable en melamina hidrófuga, con criterio de casework: diferenciar piezas interiores/exteriores, frente, fondo, repisas y herrajes.</p>
      <p><strong>Solicitud:</strong> ${escapeHtml(prompt)}</p>
      <h4>Mueble sugerido</h4>
      <ul>
        <li>${escapeHtml(item.name)}: ${item.width} x ${item.height} x ${item.depth} cm.</li>
        <li>Puertas ${placementLabel(item.doorPlacement)}, gavetas ${placementLabel(item.drawerPlacement)}, repisas ${placementLabel(item.shelfPlacement)}, fondo ${placementLabel(item.backPlacement)}.</li>
        <li>Material: ${escapeHtml(item.melamineThickness)}, ${escapeHtml(item.edgeBanding)}, ${escapeHtml(item.hinges)}, ${escapeHtml(item.drawerSlides)}, ${escapeHtml(item.handles)}.</li>
      </ul>
      <div class="ai-pieces">
        <table class="quote-table">
          <thead><tr><th>Pieza</th><th>Medida</th><th>Canto</th></tr></thead>
          <tbody>${pieceRows}</tbody>
        </table>
      </div>
      ${hiddenPieces ? `<p class="muted">Hay ${hiddenPieces} pieza(s) adicional(es) que se verán en Cortes.</p>` : ""}
      <div class="ai-actions">
        <button class="secondary-btn" type="button" data-ai-action="fill">Editar medidas</button>
        <button class="secondary-btn" type="button" data-ai-action="quote">Agregar a cotización</button>
        <button class="primary-btn" type="button" data-ai-action="cuts">Agregar y calcular cortes</button>
      </div>
      <p class="muted">Motor usado: ${sourceText}. Puedes corregir cualquier dato hablando con el chat o editando el formulario.</p>
    </div>
  `;
}

function enhanceLoadedImage(options = {}) {
  const silent = Boolean(options.silent);
  if (!state.currentImageData) {
    if (!silent) {
      els.assistantOutput.innerHTML = `<p class="muted">Sube una imagen primero para mejorarla.</p>`;
      appendChat("assistant", "Sube una imagen primero y luego te puedo aplicar una mejora visual básica.");
    }
    return false;
  }

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.filter = "brightness(1.08) contrast(1.12) saturate(1.08)";
    ctx.drawImage(img, 0, 0);
    const enhanced = canvas.toDataURL("image/png");
    els.imagePreview.innerHTML = `<img src="${enhanced}" alt="Imagen mejorada">`;
    if (!silent) {
      els.assistantOutput.innerHTML = `
        <div class="ai-result">
          <h4>Imagen mejorada</h4>
          <p>Apliqué una mejora local de brillo, contraste y saturación para que el mueble o referencia se vea más presentable.</p>
          <p class="muted">Para cambiar materiales, colocar un mueble real sobre la foto o generar renders, se requiere IA generativa conectada por backend.</p>
        </div>
      `;
    }
  };
  img.src = state.currentImageData;
  return true;
}

function itemSignature(item) {
  return [
    item.name,
    item.width,
    item.height,
    item.depth,
    item.doors,
    item.drawers,
    item.shelves,
    item.shelfPlacement,
    item.doorPlacement,
    item.backPlacement,
    item.melamineThickness
  ].join("|");
}

function addItemsToQuote(items) {
  const additions = items
    .filter(Boolean)
    .map((item) => calculateItem({ ...item, id: crypto.randomUUID() }));
  state.draftItems = [...state.draftItems, ...additions];
  renderDraftItems();
  if (additions.length > 0) toast(`${additions.length} módulo(s) agregado(s) ✓`);
  return additions.length;
}

function sendDesignToQuote() {
  if (!state.lastDesignItems.length) return;
  addItemsToQuote(state.lastDesignItems);
  showView("quoteView");
}

// ── Toast notification system ──────────────────────────────────────────────
function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type === "error" ? "toast-error" : ""}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ── Color picker ───────────────────────────────────────────────────────────
function renderColorPicker() {
  const container = document.getElementById("colorPicker");
  if (!container) return;
  container.innerHTML = melaminaColors.map(c => `
    <span class="color-swatch"
          data-color-code="${c.code}"
          style="background:${c.hex}"
          title="${c.code} — ${c.name}"></span>
  `).join("");
  const hidden = document.getElementById("selectedColor");
  if (hidden) {
    const val = hidden.value || "RH01";
    container.querySelector(`[data-color-code="${val}"]`)?.classList.add("selected");
  }
}

// ── Event listeners ────────────────────────────────────────────────────────
els.navItems.forEach((item) => item.addEventListener("click", () => showView(item.dataset.view)));

document.querySelectorAll("[data-view-jump]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.viewJump));
});

els.tenantSelect.addEventListener("change", (event) => {
  state.selectedTenantId = event.target.value;
  save();
  render();
});

els.tenantList.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-link-tenant], button[data-edit-tenant], button[data-toggle-tenant], button[data-renew-tenant], button[data-delete-tenant]");
  if (!btn) return;

  const linkId   = btn.dataset.linkTenant;
  const editId   = btn.dataset.editTenant;
  const toggleId = btn.dataset.toggleTenant;
  const renewId  = btn.dataset.renewTenant;
  const deleteId = btn.dataset.deleteTenant;

  if (deleteId) {
    const t = state.tenants.find(t => t.id === deleteId);
    if (!t) return;
    if (!confirm(`¿Eliminar a "${t.companyName}" permanentemente?\n\nEsta acción no se puede deshacer.`)) return;
    state.tenants = state.tenants.filter(t => t.id !== deleteId);
    // If we just deleted the active tenant, switch to the next one
    if (state.selectedTenantId === deleteId) {
      state.selectedTenantId = state.tenants[0]?.id || null;
    }
    save(); render();
    toast(`"${t.companyName}" eliminado ✓`);
    return;
  }

  if (renewId) {
    const t = state.tenants.find(t => t.id === renewId);
    if (!t) return;
    const base = t.expiresAt >= todayIso ? t.expiresAt : todayIso;
    const d = new Date(base); d.setDate(d.getDate() + 30);
    t.expiresAt = d.toISOString().slice(0, 10);
    t.status = "active";
    save(); render();
    toast(`${escapeHtml(t.companyName)} renovado hasta ${t.expiresAt} ✓`);
    return;
  }

  if (linkId) {
    await syncTenantsFromServer();
    openEbanistaModal(linkId);
    // After modal opens, also show the link immediately
    const t = state.tenants.find(t => t.id === linkId);
    if (t) {
      const link = getTenantLink(t);
      document.getElementById("em_link").value = link;
      document.getElementById("em_result").classList.remove("hidden");
      document.getElementById("em_actions").style.display = "none";
      document.getElementById("saveEbanistaModalBtn").textContent = "Guardado ✓";
      // La contraseña en texto plano solo existe en memoria justo después de generarse —
      // si ya se mostró para este ebanista en esta sesión del navegador, se vuelve a
      // mostrar; si no, se oculta (nunca se debe arrastrar la de otro ebanista visto antes).
      const pwRow = document.getElementById("em_passwordRow");
      const cached = _lastShownPasswords[linkId];
      if (pwRow) {
        if (cached) { document.getElementById("em_passwordDisplay").value = cached; pwRow.classList.remove("hidden"); }
        else { document.getElementById("em_passwordDisplay").value = ""; pwRow.classList.add("hidden"); }
      }
    }
    return;
  }

  if (editId) { await syncTenantsFromServer(); openEbanistaModal(editId); return; }

  if (toggleId) {
    const t = state.tenants.find(t => t.id === toggleId);
    if (!t) return;
    const wasActive = isTenantActive(t);
    t.status = wasActive ? "suspended" : "active";
    if (!wasActive) t.expiresAt = addDays(30);
    save(); render();
    toast(`${t.companyName} ${wasActive ? "suspendida" : "activada"} ✓`);
    if (window.location.protocol !== "file:" && AUTH.token) {
      fetch(`/api/tenants/${toggleId}/toggle`, { method: "POST", headers: adminApiHeader() }).catch(() => {});
    }
  }
});

// ── Sellers (vendedores) ─────────────────────────────────────────────────────
function renderSellers() {
  const wrap = document.getElementById("sellerListWrap");
  const selfPanel = document.getElementById("sellerSelfPanel");
  if (!wrap || !selfPanel) return;
  document.getElementById("addSellerBtn")?.classList.toggle("hidden", AUTH.mode !== "admin");

  if (AUTH.mode === "vendedor") {
    wrap.classList.add("hidden");
    selfPanel.classList.remove("hidden");
    const s = AUTH.sellerInfo || {};
    applyTenantTheme(s);
    document.getElementById("sellerSelfSummary").innerHTML = `
      <div><dt>Nombre</dt><dd>${escapeHtml(s.name || "")}</dd></div>
      <div><dt>Empresa</dt><dd>${escapeHtml(s.company || "—")}</dd></div>
      <div><dt>Teléfono</dt><dd>${escapeHtml(s.phone || "—")}</dd></div>
      <div><dt>Correo</dt><dd>${escapeHtml(s.email || "—")}</dd></div>
    `;
    return;
  }

  selfPanel.classList.add("hidden");
  if (AUTH.mode !== "admin") { wrap.classList.add("hidden"); return; }
  wrap.classList.remove("hidden");

  const list = document.getElementById("sellerList");
  if (!state.sellers.length) {
    list.innerHTML = '<p class="muted" style="padding:1.5rem 0">No hay vendedores. Haz clic en <strong>+ Nuevo vendedor</strong> para agregar el primero.</p>';
    return;
  }

  list.innerHTML = state.sellers.map(s => `
    <article class="tenant-card">
      <header>
        <div>
          <strong>${escapeHtml(s.name)}</strong>
          <p>${escapeHtml(s.company || "Sin empresa")} · ${escapeHtml(s.phone || "—")}</p>
          <p class="tenant-code-line">código: <code>${s.accessCode}</code></p>
        </div>
        <span class="status-pill ${s.status === "active" ? "status-active" : "status-suspended"}">${s.status === "active" ? "Activo" : "Suspendido"}</span>
      </header>
      <div class="card-actions">
        <button class="secondary-btn" type="button" data-edit-seller="${s.id}">Editar</button>
        <button class="tiny-btn" type="button" data-link-seller="${s.id}">Link</button>
        <button class="tiny-btn" type="button" data-pass-seller="${s.id}">🔑 Contraseña</button>
        <button class="tiny-btn" type="button" data-toggle-seller="${s.id}">${s.status === "active" ? "Suspender" : "Activar"}</button>
        <button class="tiny-btn danger" type="button" data-delete-seller="${s.id}">Eliminar</button>
      </div>
    </article>
  `).join("");
}

async function loadSellersFromServer() {
  if (AUTH.mode !== "admin" || !AUTH.token || window.location.protocol === "file:") return;
  try {
    const res = await fetch("/api/sellers", { headers: { Authorization: `Bearer ${AUTH.token}` } });
    if (res.ok) { state.sellers = await res.json(); renderSellers(); }
  } catch {}
}

let _sellerModalEditId = null;

function openSellerModal(editId) {
  _sellerModalEditId = editId || null;
  const s = editId ? state.sellers.find(s => s.id === editId) : null;
  document.getElementById("sellerModalTitle").textContent = editId ? "Editar vendedor" : "Nuevo vendedor";
  document.getElementById("sm_name").value = s?.name || "";
  document.getElementById("sm_company").value = s?.company || "";
  document.getElementById("sm_phone").value = s?.phone || "";
  document.getElementById("sm_email").value = s?.email || "";
  document.getElementById("sm_notes").value = s?.notes || "";
  document.getElementById("sm_password").value = "";
  const theme = s?.theme || {};
  document.getElementById("sm_accentColor").value      = theme.accentColor      || "#6366F1";
  document.getElementById("sm_headerBg").value         = theme.headerBg         || "#162a25";
  document.getElementById("sm_sidebarTextColor").value = theme.sidebarTextColor || "#ffffff";
  const smLogoFile = document.getElementById("sm_logoFile");
  if (smLogoFile) { smLogoFile.value = ""; smLogoFile._pendingB64 = null; }
  const smPreview = document.getElementById("sm_logoPreview");
  const smLogoImg = document.getElementById("sm_logoImg");
  if (smPreview && smLogoImg) {
    if (theme.logoBase64) { smLogoImg.src = theme.logoBase64; smPreview.style.display = ""; }
    else smPreview.style.display = "none";
  }
  const bp = s?.businessProfile || {};
  document.getElementById("sm_bp_address").value      = bp.address      || "";
  document.getElementById("sm_bp_taxId").value        = bp.taxId       || "";
  document.getElementById("sm_bp_website").value      = bp.website     || "";
  document.getElementById("sm_bp_taxLabel").value     = bp.taxLabel    || "ITBMS";
  document.getElementById("sm_bp_taxPercent").value   = bp.taxPercent ?? 7;
  document.getElementById("sm_bp_bankAccounts").value = bp.bankAccounts || "";
  document.getElementById("sm_result").classList.add("hidden");
  document.getElementById("sm_actions").style.display = "";
  const btn = document.getElementById("saveSellerModalBtn");
  if (btn) { btn.textContent = "Guardar y ver link →"; btn.disabled = false; }
  document.getElementById("sellerModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("sm_name").focus(), 80);

  // Si ya se generó/mostró una contraseña para este vendedor en esta misma sesión del
  // navegador (al crearlo o al regenerarla), se vuelve a mostrar en vez de perderla.
  const cached = editId && _lastShownPasswords[editId];
  if (cached) {
    document.getElementById("sm_link").value = getSellerLink(s);
    document.getElementById("sm_passwordDisplay").value = cached;
    document.getElementById("sm_passwordRow")?.classList.remove("hidden");
    document.getElementById("sm_result").classList.remove("hidden");
    document.getElementById("sm_actions").style.display = "none";
    if (btn) btn.textContent = "Guardado ✓";
  }
}

function closeSellerModal() {
  document.getElementById("sellerModal").classList.add("hidden");
  _sellerModalEditId = null;
}

async function saveSellerFromModal() {
  const name = document.getElementById("sm_name").value.trim();
  if (!name) { document.getElementById("sm_name").focus(); return; }
  const btn = document.getElementById("saveSellerModalBtn");
  btn.textContent = "Guardando…"; btn.disabled = true;

  const existing = _sellerModalEditId ? state.sellers.find(s => s.id === _sellerModalEditId) : null;
  const password = document.getElementById("sm_password").value.trim();
  const payload = {
    name,
    company: document.getElementById("sm_company").value.trim(),
    phone: document.getElementById("sm_phone").value.trim(),
    email: document.getElementById("sm_email").value.trim(),
    notes: document.getElementById("sm_notes").value.trim(),
    theme: {
      accentColor:      document.getElementById("sm_accentColor")?.value      || "",
      headerBg:         document.getElementById("sm_headerBg")?.value         || "",
      sidebarTextColor: document.getElementById("sm_sidebarTextColor")?.value || "",
      logoBase64: (() => {
        const pending = document.getElementById("sm_logoFile")?._pendingB64;
        if (pending === "__clear__") return "";
        return pending || existing?.theme?.logoBase64 || "";
      })()
    },
    businessProfile: {
      address:      document.getElementById("sm_bp_address")?.value.trim()      || "",
      taxId:        document.getElementById("sm_bp_taxId")?.value.trim()        || "",
      website:      document.getElementById("sm_bp_website")?.value.trim()      || "",
      taxLabel:     document.getElementById("sm_bp_taxLabel")?.value.trim()     || "ITBMS",
      taxPercent:   Number(document.getElementById("sm_bp_taxPercent")?.value) || 0,
      bankAccounts: document.getElementById("sm_bp_bankAccounts")?.value.trim() || ""
    }
  };
  if (password) payload.password = password;

  try {
    const res = _sellerModalEditId
      ? await fetch(`/api/sellers/${_sellerModalEditId}`, { method: "PUT", headers: adminApiHeader(), body: JSON.stringify(payload) })
      : await fetch("/api/sellers", { method: "POST", headers: adminApiHeader(), body: JSON.stringify(payload) });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      toast(`No se pudo guardar el vendedor${errBody.error ? ": " + errBody.error : ` (error ${res.status})`}`, "error");
      btn.textContent = "Guardar y ver link →"; btn.disabled = false; return;
    }
    const data = await res.json();
    await loadSellersFromServer();

    document.getElementById("sm_link").value = getSellerLink(data);
    const pwRow = document.getElementById("sm_passwordRow");
    if (data.passwordPlain) _lastShownPasswords[data.id] = data.passwordPlain;
    const shownSm = data.passwordPlain || _lastShownPasswords[data.id] || "";
    if (shownSm) { document.getElementById("sm_passwordDisplay").value = shownSm; pwRow.classList.remove("hidden"); }
    else { document.getElementById("sm_passwordDisplay").value = ""; pwRow.classList.add("hidden"); }
    document.getElementById("sm_result").classList.remove("hidden");
    document.getElementById("sm_actions").style.display = "none";
    btn.textContent = "Guardado ✓";
    toast(`${name} guardado ✓`);
  } catch {
    toast("Sin conexión al servidor.");
    btn.textContent = "Guardar y ver link →"; btn.disabled = false;
  }
}

document.getElementById("sellerList")?.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-link-seller], button[data-edit-seller], button[data-toggle-seller], button[data-pass-seller], button[data-delete-seller]");
  if (!btn) return;
  const linkId = btn.dataset.linkSeller, editId = btn.dataset.editSeller,
        toggleId = btn.dataset.toggleSeller, passId = btn.dataset.passSeller, deleteId = btn.dataset.deleteSeller;

  if (deleteId) {
    const s = state.sellers.find(s => s.id === deleteId);
    if (!s) return;
    if (!confirm(`¿Eliminar a "${s.name}" permanentemente?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      await fetch(`/api/sellers/${deleteId}`, { method: "DELETE", headers: adminApiHeader() });
      await loadSellersFromServer();
      toast(`"${s.name}" eliminado ✓`);
    } catch { toast("Sin conexión al servidor."); }
    return;
  }
  if (editId) { openSellerModal(editId); return; }
  if (linkId) {
    const s = state.sellers.find(s => s.id === linkId);
    if (!s) return;
    navigator.clipboard.writeText(getSellerLink(s)).then(() => toast("Link copiado ✓")).catch(() => toast(getSellerLink(s)));
    return;
  }
  if (passId) {
    try {
      const res = await fetch(`/api/sellers/${passId}/set-password`, { method: "POST", headers: adminApiHeader(), body: JSON.stringify({}) });
      if (res.ok) {
        const data = await res.json();
        _lastShownPasswords[passId] = data.passwordPlain;
        await navigator.clipboard.writeText(data.passwordPlain).catch(() => {});
        alert(`Nueva contraseña (ya copiada al portapapeles):\n\n${data.passwordPlain}\n\nSi cierras esto sin copiarla, puedes volver a verla abriendo "Editar" — pero solo mientras no recargues la página.`);
      } else toast("No se pudo generar la contraseña.");
    } catch { toast("Sin conexión al servidor."); }
    return;
  }
  if (toggleId) {
    try {
      const res = await fetch(`/api/sellers/${toggleId}/toggle`, { method: "POST", headers: adminApiHeader() });
      if (res.ok) { await loadSellersFromServer(); toast("Estado actualizado ✓"); }
    } catch { toast("Sin conexión al servidor."); }
  }
});

document.getElementById("addSellerBtn")?.addEventListener("click", () => openSellerModal(null));
document.getElementById("closeSellerModalBtn")?.addEventListener("click", closeSellerModal);
document.getElementById("cancelSellerModalBtn")?.addEventListener("click", closeSellerModal);
document.getElementById("saveSellerModalBtn")?.addEventListener("click", saveSellerFromModal);
document.getElementById("sellerModal")?.addEventListener("click", e => {
  if (e.target.id === "sellerModal") closeSellerModal();
});
document.getElementById("sm_copyBtn")?.addEventListener("click", () => {
  const val = document.getElementById("sm_link").value;
  navigator.clipboard.writeText(val).then(() => toast("Link copiado ✓")).catch(() => toast("No se pudo copiar"));
});
document.getElementById("sm_copyPasswordBtn")?.addEventListener("click", () => {
  const val = document.getElementById("sm_passwordDisplay").value;
  navigator.clipboard.writeText(val).then(() => toast("Contraseña copiada ✓")).catch(() => toast("No se pudo copiar"));
});
document.getElementById("sellerChangePasswordBtn")?.addEventListener("click", async () => {
  const input = document.getElementById("sellerNewPassword");
  const password = input.value;
  if (!password || password.length < 4) { toast("Escribe una contraseña de al menos 4 caracteres."); return; }
  try {
    const res = await fetch("/api/sellers/me/password", {
      method: "PUT",
      headers: { Authorization: `Bearer ${AUTH.sellerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (res.ok) { toast("Contraseña actualizada ✓"); input.value = ""; }
    else toast("No se pudo actualizar la contraseña.");
  } catch { toast("Sin conexión al servidor."); }
});

// ── Handoffs (envíos ebanista ↔ vendedor) ────────────────────────────────────
let _handoffSellerTab = "mine";
let _activeHandoffId = null;
let _activeHandoffData = null;

function handoffAuthHeader() {
  const token = AUTH.mode === "ebanista" ? AUTH.ebToken : AUTH.mode === "vendedor" ? AUTH.sellerToken : null;
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

// Combo buscable para elegir a quién enviar (vendedor o ebanista, según el rol) — reemplaza
// al <select> nativo de antes. El <select> vacío (sin <option>) no mostraba nada al hacer clic
// en algunos navegadores/zooms; este combo es HTML/CSS propio (mismo patrón que el buscador de
// láminas en Cortes), así que no depende de cómo cada navegador dibuje su lista nativa.
let _handoffTargetList = []; // [{id, label}] -- vacío = solo "Bandeja compartida" (modo ebanista) o sin opciones (modo vendedor)
let _handoffTargetId = "";

async function loadHandoffTargetOptions() {
  const input = document.getElementById("handoffTargetSearchInput");
  if (!input) return;
  _handoffTargetList = [];
  _handoffTargetId = "";
  try {
    if (AUTH.mode === "ebanista") {
      const res = await fetch("/api/sellers/active", { headers: handoffAuthHeader() });
      if (res.ok) {
        const list = await res.json();
        _handoffTargetList = list.map(s => ({ id: s.id, label: `${s.name}${s.company ? " — " + s.company : ""}` }));
      }
      input.placeholder = "Bandeja compartida";
    } else if (AUTH.mode === "vendedor") {
      const res = await fetch("/api/tenants/active", { headers: handoffAuthHeader() });
      if (res.ok) {
        const list = await res.json();
        _handoffTargetList = list.map(t => ({ id: t.id, label: t.companyName }));
      }
      input.placeholder = _handoffTargetList.length ? "Elige un ebanista…" : "No hay ebanistas activos";
    }
  } catch {}
  input.value = "";
}

function handoffTargetComboItemRow(entry, query, matchIdx) {
  let nameHtml = escapeHtml(entry.label);
  if (query && matchIdx !== -1) {
    nameHtml = escapeHtml(entry.label.slice(0, matchIdx)) + "<mark>" + escapeHtml(entry.label.slice(matchIdx, matchIdx + query.length)) + "</mark>" + escapeHtml(entry.label.slice(matchIdx + query.length));
  }
  return `<div class="material-combo-item" data-handoff-target-id="${entry.id}" data-handoff-target-label="${escapeHtml(entry.label)}"><span class="name">${nameHtml}</span></div>`;
}

function renderHandoffTargetCombo(query) {
  const panel = document.getElementById("handoffTargetResults");
  if (!panel) return;
  const q = (query || "").trim().toLowerCase();
  const pool = AUTH.mode === "ebanista"
    ? [{ id: "", label: "Bandeja compartida" }, ..._handoffTargetList]
    : _handoffTargetList;
  const matches = q
    ? pool.map(e => ({ e, idx: e.label.toLowerCase().indexOf(q) })).filter(x => x.idx !== -1).sort((a, b) => a.idx - b.idx)
    : pool.map(e => ({ e, idx: -1 }));
  panel.innerHTML = matches.length
    ? matches.map(({ e, idx }) => handoffTargetComboItemRow(e, q, idx)).join("")
    : `<p class="material-combo-empty">Sin resultados.</p>`;
}

document.getElementById("handoffTargetSearchInput")?.addEventListener("focus", (e) => {
  document.getElementById("handoffTargetResults").classList.remove("hidden");
  renderHandoffTargetCombo(e.target.value);
});
document.getElementById("handoffTargetSearchInput")?.addEventListener("input", (e) => {
  _handoffTargetId = "";
  document.getElementById("handoffTargetResults").classList.remove("hidden");
  renderHandoffTargetCombo(e.target.value);
});
document.getElementById("handoffTargetSearchInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { document.getElementById("handoffTargetResults").classList.add("hidden"); e.target.blur(); }
});
document.getElementById("handoffTargetSearchInput")?.addEventListener("blur", () => {
  setTimeout(() => document.getElementById("handoffTargetResults")?.classList.add("hidden"), 120);
});
document.getElementById("handoffTargetResults")?.addEventListener("mousedown", (e) => {
  e.preventDefault(); // evita que el input pierda foco antes de procesar el click
  const itemEl = e.target.closest("[data-handoff-target-id]");
  if (itemEl) {
    _handoffTargetId = itemEl.dataset.handoffTargetId;
    document.getElementById("handoffTargetSearchInput").value = itemEl.dataset.handoffTargetLabel;
    document.getElementById("handoffTargetResults").classList.add("hidden");
  }
});

function handoffSummary(h) {
  const last = h.messages[h.messages.length - 1];
  const typeLabel = h.type === "quote" ? "Cotización" : "Cortes";
  const pieceCount = last?.payload?.pieces?.length;
  const itemCount = last?.payload?.items?.length;
  const detail = pieceCount ? `${pieceCount} pieza(s)` : itemCount ? `${itemCount} módulo(s)` : "";
  return `${typeLabel}${detail ? " · " + detail : ""}`;
}

async function loadHandoffsFromServer() {
  if (window.location.protocol === "file:") return;
  const list = document.getElementById("handoffList");
  if (!list) return;
  try {
    const res = await fetch("/api/handoffs", { headers: handoffAuthHeader() });
    if (!res.ok) { list.innerHTML = '<p class="muted">Inicia sesión para ver tus envíos.</p>'; return; }
    let items = await res.json();
    if (AUTH.mode === "vendedor") {
      items = items.filter(h => _handoffSellerTab === "pool"
        ? (h.routing.mode === "pool" && h.routing.claimedBySellerId === null)
        : (h.routing.mode === "direct" || h.routing.claimedBySellerId === AUTH.sellerId));
    }
    if (!items.length) { list.innerHTML = '<p class="muted" style="padding:1.5rem 0">No hay envíos aquí todavía.</p>'; return; }
    list.innerHTML = items.map(h => {
      const last = h.messages[h.messages.length - 1];
      const statusLabel = { pending: "Pendiente", claimed: "Tomado", responded: "Respondido", closed: "Cerrado" }[h.status] || h.status;
      const who = AUTH.mode === "vendedor" ? h.ebanistaCompanyName : (last?.authorName || "");
      return `
        <article class="tenant-card">
          <header>
            <div>
              <strong>${escapeHtml(who || "Envío")}</strong>
              <p>${handoffSummary(h)} · último mensaje de ${escapeHtml(last?.authorName || "")}</p>
            </div>
            <span class="status-pill ${h.status === "responded" ? "status-active" : h.status === "pending" ? "status-past_due" : "status-suspended"}">${statusLabel}</span>
          </header>
          <div class="card-actions">
            <button class="secondary-btn" type="button" data-open-handoff="${h.id}">Abrir</button>
          </div>
        </article>`;
    }).join("");
  } catch { list.innerHTML = '<p class="muted">Sin conexión al servidor.</p>'; }
}

function renderHandoffThread() {
  const h = _activeHandoffData;
  const box = document.getElementById("handoffThreadMessages");
  if (!h || !box) return;
  box.innerHTML = h.messages.map(m => `
    <div style="margin-bottom:.75rem;padding:.6rem .75rem;border-radius:8px;background:${m.from === "vendedor" ? "#f0fdf4" : "#f8fafc"};border:1px solid #e2e8f0">
      <p style="margin:0;font-size:.75rem;font-weight:700;color:#475569">${escapeHtml(m.authorName)} · ${new Date(m.createdAt).toLocaleString()}</p>
      <p style="margin:.25rem 0 0;font-size:.85rem">${escapeHtml(m.note || "(sin nota)")}</p>
    </div>
  `).join("");
  document.getElementById("handoffClaimBtn").classList.toggle("hidden",
    !(AUTH.mode === "vendedor" && h.routing.mode === "pool" && h.routing.claimedBySellerId === null));
}

async function openHandoffThread(id) {
  try {
    const res = await fetch(`/api/handoffs/${id}`, { headers: handoffAuthHeader() });
    if (!res.ok) { toast("No se pudo abrir el envío."); return; }
    _activeHandoffId = id;
    _activeHandoffData = await res.json();
    renderHandoffThread();
    document.getElementById("handoffThreadModal").classList.remove("hidden");
  } catch { toast("Sin conexión al servidor."); }
}

function closeHandoffThreadModal() {
  document.getElementById("handoffThreadModal").classList.add("hidden");
  _activeHandoffId = null; _activeHandoffData = null;
}

document.getElementById("handoffList")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-open-handoff]");
  if (btn) openHandoffThread(btn.dataset.openHandoff);
});

document.getElementById("handoffSellerTabs")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-handoff-tab]");
  if (!btn) return;
  document.querySelectorAll("#handoffSellerTabs [data-handoff-tab]").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  _handoffSellerTab = btn.dataset.handoffTab;
  loadHandoffsFromServer();
});

document.getElementById("closeHandoffThreadBtn")?.addEventListener("click", closeHandoffThreadModal);
document.getElementById("handoffThreadModal")?.addEventListener("click", e => {
  if (e.target.id === "handoffThreadModal") closeHandoffThreadModal();
});

function goToHandoffWithType(type) {
  if (AUTH.mode !== "ebanista" && AUTH.mode !== "vendedor") { toast("Inicia sesión como ebanista o vendedor para enviar."); return; }
  showView("handoffsView");
  const typeSel = document.getElementById("handoffNewType");
  if (typeSel) typeSel.value = type;
  document.getElementById("handoffTargetCombo")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
}
async function loadSellerQuoteClientOptions() {
  const sel = document.getElementById("sq_client");
  if (!sel || AUTH.mode !== "vendedor") return;
  try {
    const res = await fetch("/api/tenants/active", { headers: handoffAuthHeader() });
    if (!res.ok) return;
    const list = await res.json();
    sel.innerHTML = '<option value="">— Sin asignar —</option>' +
      list.map(t => `<option value="${t.id}">${escapeHtml(t.companyName)}</option>`).join("");
  } catch {}
}

document.getElementById("addSellerQuoteItemBtn")?.addEventListener("click", () => {
  const description = document.getElementById("sq_itemDesc").value.trim();
  if (!description) { document.getElementById("sq_itemDesc").focus(); return; }
  state.sellerQuoteItems.push({
    id: crypto.randomUUID(),
    description,
    qty: Number(document.getElementById("sq_itemQty").value) || 1,
    unit: document.getElementById("sq_itemUnit").value,
    unitPrice: Number(document.getElementById("sq_itemPrice").value) || 0,
    taxPercent: Number(document.getElementById("sq_itemTax").value) || 0
  });
  document.getElementById("sq_itemDesc").value = "";
  document.getElementById("sq_itemQty").value = "1";
  document.getElementById("sq_itemPrice").value = "0";
  renderSellerQuoteForm();
});

document.getElementById("sellerQuoteItemsList")?.addEventListener("click", (e) => {
  const id = e.target.dataset.rmSqItem;
  if (!id) return;
  state.sellerQuoteItems = state.sellerQuoteItems.filter(it => it.id !== id);
  renderSellerQuoteForm();
});

document.getElementById("generateSellerQuoteBtn")?.addEventListener("click", () => {
  if (!state.sellerQuoteItems.length) { toast("Agrega al menos una línea."); return; }
  const clientId = document.getElementById("sq_client").value;
  const clientName = document.getElementById("sq_client").selectedOptions[0]?.textContent || "";
  const validityDays = Number(document.getElementById("sq_validityDays").value) || 30;
  const quote = {
    number: "S" + Date.now().toString().slice(-7),
    date: new Date().toISOString().slice(0, 10),
    dueDate: (() => { const d = new Date(); d.setDate(d.getDate() + validityDays); return d.toISOString().slice(0, 10); })(),
    clientId, clientName: clientId ? clientName : "",
    items: state.sellerQuoteItems
  };
  renderSellerQuotePaper(quote, AUTH.sellerInfo || {});
  toast("Cotización generada ✓");
});

document.getElementById("sendQuoteToSellerBtn")?.addEventListener("click", () => goToHandoffWithType("quote"));
document.getElementById("sendCutsToSellerBtn")?.addEventListener("click", () => goToHandoffWithType("cuts"));

document.getElementById("sendCutsToQuoteBtn")?.addEventListener("click", () => {
  if (AUTH.mode !== "ebanista") { toast("Esta opción es solo para la cotización del ebanista.", "error"); return; }
  if (!state.editablePieces.length) { toast("No hay piezas en Cortes para enviar.", "error"); return; }
  if (!state.lastCutsSummary) recalcCutsLayout();
  const summary = state.lastCutsSummary || {};
  const totalSheets = summary.totalSheets || 0;
  const cantoMetersByThickness = summary.cantoMetersByThickness || {};
  const cantoPriceByThickness = summary.cantoPriceByThickness || {};
  let added = 0;

  if (totalSheets > 0) {
    if (state.cutsSheetPrice != null) {
      state.materialCartItems.push({
        id: crypto.randomUUID(),
        description: state.cutsSheetLabel || "Lámina",
        qty: totalSheets,
        unit: "Unidades",
        unitPrice: state.cutsSheetPrice
      });
      added++;
    } else {
      toast("Elige una lámina de precios del mercado arriba para incluir su costo.", "error");
    }
  }

  Object.entries(cantoMetersByThickness).forEach(([thickness, meters]) => {
    if (meters > 0.01) {
      state.materialCartItems.push({
        id: crypto.randomUUID(),
        description: `Canto ${thickness}`,
        qty: Math.round(meters * 100) / 100,
        unit: "m",
        unitPrice: cantoPriceByThickness[thickness] || 0
      });
      added++;
    }
  });

  if (!added) { toast("Nada para enviar — revisa la lámina elegida y el canto de las piezas.", "error"); return; }
  renderDraftItems();
  toast(`${added} línea(s) de materiales enviada(s) a la cotización ✓`);
  showView("quoteView");
});

function updateSendButtonLabels() {
  const label = AUTH.mode === "vendedor" ? "📨 Enviar a ebanista" : "📨 Enviar a vendedor";
  const qBtn = document.getElementById("sendQuoteToSellerBtn");
  const cBtn = document.getElementById("sendCutsToSellerBtn");
  if (qBtn) qBtn.textContent = label;
  if (cBtn) cBtn.textContent = label;
  document.getElementById("sendCutsToQuoteBtn")?.classList.toggle("hidden", AUTH.mode === "vendedor");
}

document.getElementById("sendHandoffBtn")?.addEventListener("click", async () => {
  const type = document.getElementById("handoffNewType").value;
  const targetId = _handoffTargetId;
  const quoteItems = AUTH.mode === "vendedor" ? state.sellerQuoteItems : state.materialCartItems;
  const payload = type === "cuts" ? { pieces: state.editablePieces } : { items: quoteItems };
  const count = type === "cuts" ? state.editablePieces.length : quoteItems.length;
  if (!count) { toast(type === "cuts" ? "No hay piezas en Cortes para enviar." : "No hay materiales en la cotización para enviar."); return; }

  let body;
  if (AUTH.mode === "vendedor") {
    if (!targetId) { toast("Elige a qué ebanista enviar."); return; }
    body = {
      type,
      ebanistaTenantId: targetId,
      routing: { mode: "direct", sellerId: AUTH.sellerId },
      note: `Envío de ${type === "cuts" ? "cortes" : "cotización"}`,
      payload
    };
  } else {
    body = {
      type,
      routing: targetId ? { mode: "direct", sellerId: targetId } : { mode: "pool" },
      note: `Envío de ${type === "cuts" ? "cortes" : "cotización"}`,
      payload
    };
  }

  try {
    const res = await fetch("/api/handoffs", { method: "POST", headers: handoffAuthHeader(), body: JSON.stringify(body) });
    if (res.ok) { toast("Enviado ✓"); loadHandoffsFromServer(); }
    else toast("No se pudo enviar.");
  } catch { toast("Sin conexión al servidor."); }
});

document.getElementById("handoffClaimBtn")?.addEventListener("click", async () => {
  if (!_activeHandoffId) return;
  try {
    const res = await fetch(`/api/handoffs/${_activeHandoffId}/claim`, { method: "POST", headers: handoffAuthHeader() });
    if (res.ok) { _activeHandoffData = await res.json(); renderHandoffThread(); loadHandoffsFromServer(); toast("Envío tomado ✓"); }
    else { const d = await res.json().catch(() => ({})); toast(d.error || "No se pudo tomar."); }
  } catch { toast("Sin conexión al servidor."); }
});

document.getElementById("handoffCloseBtn")?.addEventListener("click", async () => {
  if (!_activeHandoffId) return;
  if (!confirm("¿Cerrar este envío? Ya no aparecerá en la lista activa.")) return;
  try {
    await fetch(`/api/handoffs/${_activeHandoffId}/close`, { method: "POST", headers: handoffAuthHeader() });
    closeHandoffThreadModal();
    loadHandoffsFromServer();
  } catch { toast("Sin conexión al servidor."); }
});

document.getElementById("handoffReplyBtn")?.addEventListener("click", async () => {
  if (!_activeHandoffId) return;
  const note = document.getElementById("handoffReplyNote").value.trim();
  if (!note) { toast("Escribe una nota antes de responder."); return; }
  const payload = _activeHandoffData.type === "cuts" ? { pieces: state.editablePieces } : { items: state.draftItems };
  try {
    const res = await fetch(`/api/handoffs/${_activeHandoffId}/messages`, {
      method: "POST", headers: handoffAuthHeader(), body: JSON.stringify({ note, payload })
    });
    if (res.ok) {
      _activeHandoffData = await res.json();
      renderHandoffThread();
      document.getElementById("handoffReplyNote").value = "";
      loadHandoffsFromServer();
      toast("Respuesta enviada ✓");
    } else toast("No se pudo responder.");
  } catch { toast("Sin conexión al servidor."); }
});

document.getElementById("handoffLoadCutsBtn")?.addEventListener("click", () => {
  const last = _activeHandoffData?.messages?.[_activeHandoffData.messages.length - 1];
  const pieces = last?.payload?.pieces;
  if (!pieces || !pieces.length) { toast("Este envío no tiene piezas de cortes."); return; }
  state.editablePieces = pieces.map(p => ({ ...p, id: crypto.randomUUID() }));
  closeHandoffThreadModal();
  showView("cutsView");
  renderCutsPiecesTable();
  recalcCutsLayout();
  toast("Piezas cargadas en Cortes ✓");
});

document.getElementById("handoffLoadQuoteBtn")?.addEventListener("click", () => {
  const last = _activeHandoffData?.messages?.[_activeHandoffData.messages.length - 1];
  const items = last?.payload?.items;
  if (!items || !items.length) { toast("Este envío no tiene módulos de cotización."); return; }
  state.draftItems = items.map(i => ({ ...i, id: crypto.randomUUID() }));
  closeHandoffThreadModal();
  showView("quoteView");
  renderDraftItems();
  toast("Módulos cargados en Cotización ✓");
});

els.addTenantBtn.addEventListener("click", () => openEbanistaModal(null));
document.getElementById("closeEbanistaModalBtn")?.addEventListener("click", closeEbanistaModal);
document.getElementById("cancelEbanistaModalBtn")?.addEventListener("click", closeEbanistaModal);
document.getElementById("saveEbanistaModalBtn")?.addEventListener("click", saveEbanistaFromModal);
document.getElementById("ebanistaModal")?.addEventListener("click", e => {
  if (e.target.id === "ebanistaModal") closeEbanistaModal();
});
document.getElementById("em_copyBtn")?.addEventListener("click", () => {
  const val = document.getElementById("em_link").value;
  navigator.clipboard.writeText(val).then(() => {
    toast("Link copiado ✓");
    const btn = document.getElementById("em_copyBtn");
    btn.textContent = "¡Copiado!";
    setTimeout(() => { btn.textContent = "Copiar"; }, 2000);
  }).catch(() => {
    const inp = document.getElementById("em_link");
    inp.select(); document.execCommand("copy");
    toast("Link copiado ✓");
  });
});
document.getElementById("em_copyPasswordBtn")?.addEventListener("click", () => {
  const val = document.getElementById("em_passwordDisplay").value;
  navigator.clipboard.writeText(val).then(() => {
    toast("Contraseña copiada ✓");
    const btn = document.getElementById("em_copyPasswordBtn");
    btn.textContent = "¡Copiado!";
    setTimeout(() => { btn.textContent = "Copiar"; }, 2000);
  }).catch(() => {
    const inp = document.getElementById("em_passwordDisplay");
    inp.select(); document.execCommand("copy");
    toast("Contraseña copiada ✓");
  });
});
document.getElementById("em_company")?.addEventListener("keydown", e => {
  if (e.key === "Enter") saveEbanistaFromModal();
});

els.resetDemoBtn.addEventListener("click", () => {
  localStorage.removeItem("tm_tenants");
  localStorage.removeItem("tm_quotes");
  localStorage.removeItem("tm_selected_tenant");
  window.location.reload();
});

els.designImage.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) {
    appendChat("assistant", "⚠️ Imagen grande (>4 MB). Puede tardar más.");
  }
  const reader = new FileReader();
  reader.onload = () => {
    // Convert to JPEG via canvas — fixes HEIC/HEIF/BMP/TIFF and limits size
    const tmpImg = new Image();
    tmpImg.onload = () => {
      const MAX = 1200;
      const scale = tmpImg.width > MAX ? MAX / tmpImg.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(tmpImg.width  * scale);
      canvas.height = Math.round(tmpImg.height * scale);
      canvas.getContext("2d").drawImage(tmpImg, 0, 0, canvas.width, canvas.height);
      const jpeg = canvas.toDataURL("image/jpeg", 0.88);
      state.currentImageData = jpeg;

      const thumb = document.getElementById("imgThumb");
      if (thumb) {
        thumb.style.display = "";
        let thumbImg = thumb.querySelector("img.thumb-img");
        if (!thumbImg) {
          thumbImg = document.createElement("img");
          thumbImg.className = "thumb-img";
          thumbImg.alt = "foto";
          thumbImg.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:6px";
          thumb.insertBefore(thumbImg, thumb.firstChild);
        }
        thumbImg.src = jpeg;
      }
    };
    tmpImg.onerror = () => appendChat("assistant", "⚠️ No se pudo leer la imagen. Prueba con un archivo .jpg o .png.");
    tmpImg.src = reader.result;
  };
  reader.readAsDataURL(file);
});

document.getElementById("clearImageBtn")?.addEventListener("click", clearImageState);

els.sendChatBtn.addEventListener("click", sendToAI);
els.chatInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) sendToAI();
});
// sendDesignToQuoteBtn removed — now inline "📋 Enviar a cotización" button in chat
// furnitureBrief / interpretFurnitureBtn / aiAddFurnitureBtn / aiAddAndCutsBtn removed v22

// ── Materiales en cotización (ebanista) — reemplaza la creación de módulos ──
// Llaves del catálogo estándar que NO son materiales que se agreguen como línea
// (son ajustes de cálculo o ya tienen su propio campo en la cotización).
const NON_MATERIAL_PRICE_KEYS = ["kerf_mm", "install_hour", "transport_base", "transport_km"];

const MATERIAL_CATEGORIES = {
  madera:       "🪵 Madera / Melamina",
  canto:        "🔄 Canto PVC",
  bisagras:     "🔩 Bisagras y correderas",
  jaladores:    "🪝 Jaladores",
  mano:         "🚚 Mano de obra",
  adhesivos:    "🧴 Pegamentos y solventes",
  cerraduras:   "🔐 Cerraduras y herrajes",
  herramientas: "🛠️ Herramientas y equipo",
  organizacion: "🗄️ Cocina y organización"
};
const STANDARD_KEY_CATEGORY = {
  melamina_std: "madera", melamina_lg: "madera", backing_m2: "madera",
  canto_pvc: "canto", canto_grueso: "canto",
  canto_045mm_metro: "canto", canto_100mm_metro: "canto", canto_200mm_metro: "canto",
  bisagra_std: "bisagras", bisagra_sc: "bisagras", corredera_std: "bisagras", corredera_sc: "bisagras",
  jalador_chico: "jaladores", jalador_grande: "jaladores", jalador_premium: "jaladores"
};

// Lista de precios IMECA (ferretería para muebles y carpintería) — se agrega una sola vez
// a state.globalPrices.customItems (seedImecaPrices, llamado al final del archivo).
const IMECA_PRICE_LIST = [
  ["Adhesivo Aerosol 3M", 22.00, "adhesivos"],
  ["Afix Montaje PU 310 ml", 10.99, "adhesivos"],
  ["Arteplack 990 375 ml", 6.00, "adhesivos"],
  ["Arteplack 750 ml", 15.00, "adhesivos"],
  ["Arteplack 990 3 L", 24.99, "adhesivos"],
  ["Carpincol MR-60 500 gr", 4.50, "adhesivos"],
  ["Carpincol MR-60 1 Kg", 6.75, "adhesivos"],
  ["Carpincol MR-60 1 Galón", 24.01, "adhesivos"],
  ["Carpicol MR-60 1 Galón", 24.90, "adhesivos"],
  ["Carpiflex Spray 1 Galón", 28.03, "adhesivos"],
  ["Cemento 285 HV 120 ml", 2.25, "adhesivos"],
  ["Cemento 321 HV 375 ml", 5.25, "adhesivos"],
  ["Cemento 321 750 ml", 9.57, "adhesivos"],
  ["Cemento 321 HV 1 Galón", 28.03, "adhesivos"],
  ["Cemento 321 4.5 Galones", 102.70, "adhesivos"],
  ["Cemento de Contacto Lanco 4 oz", 4.49, "adhesivos"],
  ["Cemento de Contacto Lanco 8 oz", 5.60, "adhesivos"],
  ["Cemento de Contacto Lanco 16 oz", 8.62, "adhesivos"],
  ["Cemento de Contacto Lanco 1/4 Galón", 10.71, "adhesivos"],
  ["Cemento de Contacto Lanco 1 Galón", 30.16, "adhesivos"],
  ["Cemento PL285 Blíster", 3.50, "adhesivos"],
  ["Cemento PL285 375 ml", 6.00, "adhesivos"],
  ["Cemento PL285 Madera 750 ml", 9.90, "adhesivos"],
  ["Cemento PL285 750 ml", 10.50, "adhesivos"],
  ["Cemento PL285 1 Galón", 30.00, "adhesivos"],
  ["Aguarrás 16 oz", 3.23, "adhesivos"],
  ["Aguarrás 32 oz", 4.49, "adhesivos"],
  ["Aguarrás 1/2 Galón", 7.64, "adhesivos"],
  ["Aguarrás 1 Galón", 13.77, "adhesivos"],
  ["Bisagra Cierre Lento 35 mm Recta IMEX", 1.30, "bisagras"],
  ["Bisagra Cierre Lento 35 mm Semi Curva IMEX", 1.85, "bisagras"],
  ["Bisagra Cierre Lento Curva", 1.08, "bisagras"],
  ["Bisagra Cocina 35 mm Recta IMEX", 0.65, "bisagras"],
  ["Bisagra Cocina 35 mm Recta IMEX S/P", 0.66, "bisagras"],
  ["Bisagra Cocina 35 mm Semi Curva IMEX", 1.20, "bisagras"],
  ["Bisagra Cocina 35 mm Curva IMEX", 1.20, "bisagras"],
  ["Bisagra Recta C/L", 1.10, "bisagras"],
  ["Bisagra Recta C-L (MD)", 1.50, "bisagras"],
  ["Corredera 10” (25 cm) IMEX", 2.65, "bisagras"],
  ["Corredera 12” (30 cm) IMEX", 2.95, "bisagras"],
  ["Cerradura para Gaveta Metal", 1.72, "cerraduras"],
  ["Cerradura para Gaveta de Metal", 2.11, "cerraduras"],
  ["Cerradura Tipo Cocada", 2.15, "cerraduras"],
  ["Cerradura Gaveta Plateada", 2.31, "cerraduras"],
  ["Anclaje de Gola Universal Volpato", 4.35, "cerraduras"],
  ["Ángulo Dorado 1”x1” (10 unidades)", 1.50, "cerraduras"],
  ["Ángulo Interno 1”", 1.26, "cerraduras"],
  ["Ángulo Interno 1½”", 1.46, "cerraduras"],
  ["Ángulo Interno 2”", 1.68, "cerraduras"],
  ["Ángulo Interno 2½”", 2.03, "cerraduras"],
  ["Clavo Deslizante 5/8” (250 und.)", 9.75, "cerraduras"],
  ["Clavo Deslizante 3/4” (250 und.)", 8.92, "cerraduras"],
  ["Broca Bisagra 35 mm TOTAL", 7.48, "herramientas"],
  ["Broca Sierra Bimetálica 14-30 mm IMEX", 11.90, "herramientas"],
  ["Concealed Hinge Bit 35 mm", 22.52, "herramientas"],
  ["Concealed Hinge Jig", 46.90, "herramientas"],
  ["Caladora 20V IMEX", 83.90, "herramientas"],
  ["Cinta Métrica 3 m IMEX", 4.95, "herramientas"],
  ["Cinta Métrica 5 m IMEX", 5.50, "herramientas"],
  ["Cinta Métrica 5 m TOTAL", 2.82, "herramientas"],
  ["Batería Litio 12V IMEX", 28.90, "herramientas"],
  ["Batería Litio 20V 2Ah IMEX", 45.38, "herramientas"],
  ["Batería Litio 20V 2Ah TOTAL", 17.00, "herramientas"],
  ["Batería Litio 20V 4Ah IMEX", 51.90, "herramientas"],
  ["Batería Litio 20V 4Ah TOTAL", 25.00, "herramientas"],
  ["Batería Litio 20V 5Ah TOTAL", 51.44, "herramientas"],
  ["Compresor 110V 2HP 24L", 180.10, "herramientas"],
  ["Compresor Aire 10L Hoteche", 133.00, "herramientas"],
  ["Compresor Aire 24L", 213.78, "herramientas"],
  ["Compresor Aire 24L Silencioso", 158.65, "herramientas"],
  ["Compresor Aire Hoteche", 110.36, "herramientas"],
  ["Compresor Aire 20V sin batería", 67.91, "herramientas"],
  ["Basurero Doble Gris IMEX", 110.00, "organizacion"],
  ["Basurero Sencillo Gris IMEX", 85.00, "organizacion"],
  ["Cesta Extraíble para Platos 900 mm", 114.18, "organizacion"],
  ["Barra Desayuno 60x710 Níquel", 15.25, "organizacion"],
  ["Barra Desayuno 60x870 Níquel", 20.77, "organizacion"],
  ["Barra Desayuno 60x870 Cromado", 15.85, "organizacion"],
  ["Barra Desayuno 60x710 Negro Mate", 16.15, "organizacion"],
  ["Barra Desayuno 60x870 Negro Mate", 14.77, "organizacion"]
];

// Lista IMECA completa (PDF de secciones) — tableros/MDF/laminas = madera, por pedido del usuario.
const IMECA_PRICE_LIST_2 = [
  ["Lam. 0380 Zapelly Caoba T L30P", 35.67, "madera"],
  ["Lam. 0385 Abedul T L30P", 27.66, "madera"],
  ["Lam. 0470 Fresno T L30P", 41.57, "madera"],
  ["Lam. 0506 Tamarindo T L30P", 25.08, "madera"],
  ["Lam. 0670 Granito Kombi", 40.90, "madera"],
  ["Lam. 0791 Hard Rock Maple T L30P", 44.91, "madera"],
  ["Lam. 0888 Lapislazuli T L30P", 33.53, "madera"],
  ["Lam. 1320 Perillo T L30P", 42.40, "madera"],
  ["Lam. 1322 Maple Claro T L30P", 44.92, "madera"],
  ["Lam. 1323 Maple Fusion T L30P", 34.87, "madera"],
  ["Lam. 1336 White Oak T L30P", 44.90, "madera"],
  ["Lam. 1460 Mahogany T L30P", 38.27, "madera"],
  ["Lam. 1461 Larice 3D DL L30P", 29.80, "madera"],
  ["Lam. 1461 Larice 3D T L30P", 29.84, "madera"],
  ["Lam. 1465 Grey Cedar DL L30P", 36.81, "madera"],
  ["Lam. 1467 Roble Lineal T L30P", 36.81, "madera"],
  ["Lam. 1468 Segato Miele DL L30P", 42.74, "madera"],
  ["Lam. 1470 Cerezo Silvestre T L30P", 25.08, "madera"],
  ["Lam. 1473 Cerezo Agreste T L30P", 43.41, "madera"],
  ["Lam. 1474 Cerezo Clasico T L30P", 36.81, "madera"],
  ["Lam. 1485 Cognac Maple T L30P", 31.39, "madera"],
  ["Lam. 1490 Cypress Cinnamon DL L30P", 36.81, "madera"],
  ["Lam. 1499 Natural Elm L30P", 36.81, "madera"],
  ["Lam. 1502 Up Sea White L30P", 36.81, "madera"],
  ["Lam. 1503 Olive Elm DL L30P", 44.91, "madera"],
  ["Lam. 1516 Vintage Teak", 43.40, "madera"],
  ["Lam. 1540 IT Ontario Oak L30P", 36.81, "madera"],
  ["Lam. 1566 Up Toscana L30P", 36.81, "madera"],
  ["Lam. 1740 Granadillo T L30P", 27.06, "madera"],
  ["Lam. 1750 Haya T L30P", 39.61, "madera"],
  ["Lam. 1780 Beech T L30P", 27.66, "madera"],
  ["Lam. 1800 Teca Villamayor DL L30P", 44.90, "madera"],
  ["Lam. 1802 Roble Natural T L30P", 28.41, "madera"],
  ["Lam. 1803 Haya Natural", 35.00, "madera"],
  ["Lam. 1807 Wengue T L30P", 33.50, "madera"],
  ["Lam. 1808 Chocolate Oak Liso L30P", 38.27, "madera"],
  ["Lam. 1808 Chocolate Oak Tex L30P", 38.27, "madera"],
  ["Lam. 1829 Grey Oak DL L30P", 37.02, "madera"],
  ["Lam. 1830 Cafe Oak Liso L30P", 38.31, "madera"],
  ["Lam. 1832 Noce Caffe Latte T L30P", 45.21, "madera"],
  ["Lam. 1834 Wengue Tabaco DL L30P", 36.99, "madera"],
  ["Lam. 1836 Brown Oak T03 P", 38.63, "madera"],
  ["Lam. 1839 Palisander T L30P", 36.81, "madera"],
  ["Lam. 1841 Noce DL L30P", 39.63, "madera"],
  ["Lam. 1841 Noce T L30P", 35.00, "madera"],
  ["Lam. 2030 Aluminum Brushed F T L30", 88.38, "madera"],
  ["Lam. 2047 Metalized Brush F CP L30", 38.27, "madera"],
  ["Lam. 2047 Metalized Brush T L30P", 43.41, "madera"],
  ["Lam. 2102 Blanco Nieve Brillo T L30S", 31.63, "madera"],
  ["Lam. 2102 Blanco Nieve T G30S Mate", 28.85, "madera"],
  ["Lam. 2102 Nieve T L30P Mate", 31.25, "madera"],
  ["Lam. 2103 Alumina T L30P", 33.53, "madera"],
  ["Lam. 21057 Marigold VNR", 25.83, "madera"],
  ["Lam. 2108 Humo T L30P", 31.01, "madera"],
  ["Lam. 2109 Vainilla T L30P", 31.04, "madera"],
  ["Lam. 2110 Ebano Brillo G30S", 31.04, "madera"],
  ["Lam. 2110 Ebano Mate T L30P", 29.00, "madera"],
  ["Lam. 2111 Blanco Polar T L30P", 26.47, "madera"],
  ["Lam. 2112 Blanco", 31.07, "madera"],
  ["Lam. 2119 T Silice L30P", 36.81, "madera"],
  ["Lam. 2135 Ruby B L30P", 24.74, "madera"],
  ["Lam. 2135 Ruby T L30P", 22.17, "madera"],
  ["Lam. 2137 Rojo Brillo", 33.31, "madera"],
  ["Lam. 2137 Rojo Mate", 33.31, "madera"],
  ["Lam. 21422 Neo Royal Blue Mate", 22.27, "madera"],
  ["Lam. 21444 Magenta MT", 22.29, "madera"],
  ["Lam. 21467 Neo Turmeric Glossy", 22.29, "madera"],
  ["Lam. 2152 Amarillo Oro T L30P", 31.72, "madera"],
  ["Lam. 2163 Amarillo T L30P", 31.72, "madera"],
  ["Lam. 2165 Taupe T L30P", 33.97, "madera"],
  ["Lam. 2170 Azul Pacifico T L30P", 31.72, "madera"],
  ["Lam. 2176 Turquesa T L30P", 33.32, "madera"],
  ["Lam. 2180 Mediterraneo T L30P", 31.72, "madera"],
  ["Lam. 2186 CH Neon PVC", 101.19, "madera"],
  ["Lam. 2186 Verde Neon T L30P", 45.20, "madera"],
  ["Lam. 2191 Niebla T L30P", 33.32, "madera"],
  ["Lam. 2192 Carbon T L30P", 32.20, "madera"],
  ["Lam. 2193 Mouse T L30P", 33.32, "madera"],
  ["Lam. 2232 Fragola", 24.60, "madera"],
  ["Lam. 2233 French Grey PW 4X10 L30P", 39.14, "madera"],
  ["Lam. 2239 Sunset", 33.32, "madera"],
  ["Lam. 2243 Berenjena", 32.48, "madera"],
  ["Lam. 2272 Carmin B L30P", 39.63, "madera"],
  ["Lam. 2290 Tangelo T L30P", 27.06, "madera"],
  ["Lam. 2295 Orangine B L-30P", 39.99, "madera"],
  ["Lam. 2324 Ivory L30P", 31.04, "madera"],
  ["Lam. 3014 Granito Negro", 37.91, "madera"],
  ["Lam. 3124 Urban Concrete T L30P", 43.09, "madera"],
  ["Lam. 3127 Industrial Concret CA P", 41.00, "madera"],
  ["Lam. 4103 Blanco Pizarron (Cuadros)", 32.00, "madera"],
  ["Lam. 49931 Alumina Pearl MT", 28.45, "madera"],
  ["Lam PVC 2.40x1.20x3mm", 10.00, "madera"],
  ["Lam PVC 2.44x1.22x12mm", 35.00, "madera"],
  ["Lam PVC 2.44x1.22x15mm", 50.00, "madera"],
  ["Lam PVC 2.44x1.22x18mm", 55.00, "madera"],
  ["Lam PVC 2.44x1.22x6mm", 18.00, "madera"],
  ["Lam PVC 2.44x1.22x9mm", 25.00, "madera"],
  ["Lamina Acanalada Clear Wood 12x120x2900", 9.20, "madera"],
  ["Lamina Acanalada DE001 Decorativa Madera 24x160x2900", 8.82, "madera"],
  ["Lamina Acanalada DE002 Decorativa Varnish Wood 24x160x2900", 10.50, "madera"],
  ["Lamina Acanalada Decorativa Pared Light Wood", 7.95, "madera"],
  ["Lamina Acanalada Decorativa PS Pared Matt Black", 9.92, "madera"],
  ["Lamina Acanalada Decorativa PS Paredes Dark Old", 9.92, "madera"],
  ["Lamina Acanalada Decorativa Textured Grey", 10.65, "madera"],
  ["Lamina Acanalada Grey Wood 12x120x2900", 9.20, "madera"],
  ["Lamina Acanalada Small Varnich", 9.20, "madera"],
  ["Lamina Acanalada Teak 3771 18x140x2800", 13.12, "madera"],
  ["Lamina Acanalada Teak2050 18x140x2800 (AGT)", 12.80, "madera"],
  ["Lamina Acanalada Wengue246 18x140x2800", 12.80, "madera"],
  ["Lamina Decorativa de Pared Black", 15.72, "madera"],
  ["Lamina Decorativa DE003 para Paredes Dark Wood", 10.50, "madera"],
  ["MDF 183x2.44x3mm Haya", 24.15, "madera"],
  ["MDF Plus RH 2440x1830 3mm", 17.99, "madera"],
  ["MDF Plus RH 2750x1850 12mm", 48.22, "madera"],
  ["MDF Plus RH 2750x1850 15mm", 55.28, "madera"],
  ["MDF Plus RH 2750x1850 18mm", 66.33, "madera"],
  ["MDF Plus RH 2750x1850 25mm", 90.00, "madera"],
  ["MDF Plus RH 2750x1850 9mm", 37.05, "madera"],
  ["MDF Plus RH 2750x1850 6mm", 28.58, "madera"],
  ["MDF Ranurado 1.22x2.44x18mm Blanco", 55.22, "madera"],
  ["MDF Ranurado 1.22x2.44x18mm Chocolate", 55.22, "madera"],
  ["MDF Ranurado 1.22x2.44x18mm Negro", 55.22, "madera"],
  ["MDF RH 1830x2440x12mm Fibra", 47.45, "madera"],
  ["MDF RH 1830x2440x15mm Fibra", 55.00, "madera"],
  ["MDF RH 1830x2440x18mm Fibra", 66.00, "madera"],
  ["MDF RH 2440x1850x9mm Fibra", 39.49, "madera"],
  ["MDF RH 5.5mm Fibra 1830x2440", 29.90, "madera"],
  ["MDF RH Almendro A/B 122x244x18mm", 80.00, "madera"],
  ["MDF RH Ash 1220x2440x15mm", 52.40, "madera"],
  ["MDF RH Ash 1220x2440x18mm", 84.31, "madera"],
  ["MDF RH Beech 1220x2440x15mm", 55.00, "madera"],
  ["MDF RH Beech 1220x2440x18mm", 85.57, "madera"],
  ["MDF RH Blanco Entramado A/B 122x244x18", 80.00, "madera"],
  ["MDF RH Cherry 1220x2440x15mm", 75.24, "madera"],
  ["MDF RH Cherry 1220x2440x18mm", 80.63, "madera"],
  ["MDF RH Maple 1220x2440x15mm", 65.65, "madera"],
  ["MDF RH Maple 1220x2440x18mm", 87.48, "madera"],
  ["MDF RH Naranja A/B 122x244x18mm", 80.00, "madera"],
  ["MDF RH Negro A/B 2440x1220x18mm", 70.00, "madera"],
  ["MDF RH Palizandro A/B 122x244x18mm", 70.00, "madera"],
  ["MDF RH Sandalwood 1220x2440x18mm", 87.48, "madera"],
  ["MDF RH Walnut 1220x2440x15mm", 57.04, "madera"],
  ["MDF RH Walnut 1220x2440x18mm", 68.73, "madera"],
  ["MDF Std Azul Pasific Matt 122x280x18mm (AGT)", 170.00, "madera"],
  ["MDF Std Blanco A/B 122x280x18mm (AGT)", 130.00, "madera"],
  ["MDF Std Blanco S/Mat 122x280x18mm (AGT)", 130.00, "madera"],
  ["MDF Std Cool Grey A/B 122x280x18mm (AGT)", 130.00, "madera"],
  ["MDF Std Crome Grey A/B 122x280x18mm (AGT)", 140.00, "madera"],
  ["MDF Std Forest Green S/Mat 1220x2800 (AGT)", 140.00, "madera"],
  ["MDF Std Forest Green S/Mat 122x280x189mm (AGT)", 119.45, "madera"],
  ["MDF Std Glamorous Pasific S/Mat 122x280x18mm (AGT)", 140.00, "madera"],
  ["MDF Std Negro A/B 122x280x18mm (AGT)", 130.00, "madera"],
  ["MDF Std Negro S/Mat 122x280x18mm (AGT)", 140.00, "madera"],
  ["MDF Std New Grey Matt 122x280x18mm (AGT)", 130.00, "madera"],
  ["MDF Std Onyx Grey A/B 122x280x18mm (AGT)", 140.00, "madera"],
  ["MDF Std Rustic Red S/Mat 122x280x189mm (AGT)", 140.00, "madera"],
  ["MDF Std Storm Grey S/Mat 122x280x18mm (AGT)", 130.00, "madera"],
  ["MDF Std Trend Grey A/B 122x280x18mm (AGT)", 140.00, "madera"],
  ["MDF Std Vision A/B 122x280x18mm (AGT)", 120.00, "madera"],
  ["MDP Blanco 18mm 2750x1850 (Berneck)", 64.99, "madera"],
  ["MDP Blanco 2750x1850x15mm (Berneck)", 55.00, "madera"],
  ["MDP Blanco 2750x1850x25mm", 90.00, "madera"],
  ["MDP Calcare 18mm x185x275", 110.00, "madera"],
  ["MDP Carvalho 2750x1850x15mm", 95.00, "madera"],
  ["MDP Carvalho 2750x1850x18mm", 110.00, "madera"],
  ["MDP Cinza Cobalto 2750x1850x15mm", 95.00, "madera"],
  ["MDP Cinza Cobalto 2750x1850x18mm", 110.00, "madera"],
  ["MDP Cinza Cobalto 2750x1850x25mm", 160.00, "madera"],
  ["MDP Dust 2750x1850x15mm", 95.00, "madera"],
  ["MDP Dust 2750x1850x18mm", 110.00, "madera"],
  ["MDP Frassino Almendra 2750x1850x15mm", 95.00, "madera"],
  ["MDP Frassino Almendra 2750x1850x18mm", 110.00, "madera"],
  ["MDP Gold 2750x1850x15mm", 95.00, "madera"],
  ["MDP Gold 2750x1850x18mm", 110.00, "madera"],
  ["MDP Italian Nocce 2750x1850x25mm", 160.00, "madera"],
  ["MDP Italian Noce 2750x1850x15mm", 95.00, "madera"],
  ["MDP Italian Noce 2750x1850x18mm", 110.00, "madera"],
  ["MDP Italian Noce 275x185x25mm", 160.00, "madera"],
  ["MDP Maple 275x185x25mm", 146.65, "madera"],
  ["MDP Negro 2750x1850x15mm (BK)", 95.00, "madera"],
  ["MDP Negro 2750x1850x18mm (Berneck)", 110.00, "madera"],
  ["MDP Nude 2750x1850x15mm", 95.00, "madera"],
  ["MDP Nude 2750x1850x18mm", 110.00, "madera"],
  ["MDP Plomo 2750x1850x15mm", 95.00, "madera"],
  ["MDP Plomo 2750x1850x18mm", 110.00, "madera"],
  ["MDP RH Amantea 275x185x15mm", 95.00, "madera"],
  ["MDP RH Amantea 275x185x18mm", 110.00, "madera"],
  ["MDP RH Baumkuchen 275x185x15mm", 95.00, "madera"],
  ["MDP RH Baumkuchen 275x185x18mm", 110.00, "madera"],
  ["MDP RH Calcare 15mm 185x275", 90.00, "madera"],
  ["MDP RH Castaine 275x185x15mm", 95.00, "madera"],
  ["MDP RH Castaine 275x185x18mm", 110.00, "madera"],
  ["MDP RH Chumbo 15mm x185x275", 95.00, "madera"],
  ["MDP RH Chumbo 18mm x1850x2750", 110.00, "madera"],
  ["MDP RH Metallic Suede 15mm x275x185", 95.00, "madera"],
  ["MDP RH Metallic Suede 18mm x275x185", 110.00, "madera"],
  ["MDP RH Nogal Malaga 275x185x15mm", 95.00, "madera"],
  ["MDP RH Nogal Malaga 275x185x18mm", 110.00, "madera"],
  ["MDP RH Provence 15mm x1850x2750", 95.00, "madera"],
  ["MDP RH Provence 18mm x1850x2750", 110.00, "madera"],
  ["MDP RH Verti 275x185x15mm", 95.00, "madera"],
  ["MDP RH Verti 275x185x18mm", 110.00, "madera"],
  ["MDP Super Blanco 2750x1850x15mm", 65.00, "madera"],
  ["MDP Super Blanco 2750x1850x18mm", 75.00, "madera"],
  ["MDP Wengue Valencia 2750x1850x15mm", 95.00, "madera"],
  ["MDP Wengue Valencia 2750x1850x18mm", 110.00, "madera"],
  ["MDP Wengue Valencia 2750x1850x25mm", 144.90, "madera"],
  ["MDP Wengue Valencia 275x185x25mm", 130.00, "madera"]
];

const IMECA_PRICE_LIST_3 = [
  ["PB RH Alaska Mad 15mm x214x244", 95.00, "madera"],
  ["PB RH Alaska Mad 18mm x214x244", 110.00, "madera"],
  ["PB RH Alba Lineal Rustico 214x244x18mm", 110.00, "madera"],
  ["PB RH Alba Lineal Rustico 214x244x15mm", 95.00, "madera"],
  ["PB RH Almendra Cera 214x244x15mm", 95.00, "madera"],
  ["PB RH Almendra Cera 214x244x18mm", 110.00, "madera"],
  ["PB RH Aluminio Platino Coral 210x244x15mm", 89.53, "madera"],
  ["PB RH Aluminio Platino Coral 210x244x18mm", 110.00, "madera"],
  ["PB RH Amarillo Cera 214x244x15mm", 95.00, "madera"],
  ["PB RH Amarillo Cera 214x244x18mm", 110.00, "madera"],
  ["PB RH Azul Medit Cera 15mm x244x214", 95.00, "madera"],
  ["PB RH Azul Medit Cera 18mm x244x214", 110.00, "madera"],
  ["PB RH Bavaria Mad 15mm x214x244", 95.00, "madera"],
  ["PB RH Bavaria Mad 18mm x214x244", 110.00, "madera"],
  ["PB RH Blanco Coral 214x244x12mm", 45.00, "madera"],
  ["PB RH Blanco Coral 214x244x15mm", 55.00, "madera"],
  ["PB RH Blanco Coral 214x244x18mm", 65.00, "madera"],
  ["PB RH Blanco Coral 214x244x6mm", 30.99, "madera"],
  ["PB RH Blanco Coral 244x214x25mm", 90.00, "madera"],
  ["PB RH Blanco Coral 244x214x35mm", 140.00, "madera"],
  ["PB RH Blanco Madera 15mm x214x244", 95.00, "madera"],
  ["PB RH Blanco Madera 18mm x214x244", 110.00, "madera"],
  ["PB RH Canyon Madera 18mm x2440x2140", 110.00, "madera"],
  ["PB RH Canyon Madera 214x244x15mm", 95.00, "madera"],
  ["PB RH Capuchino Rust 15mm x214x244", 85.00, "madera"],
  ["PB RH Castaño Lineal Rustico 214x244x15mm", 95.00, "madera"],
  ["PB RH Castaño Lineal Rustico 214x244x18mm", 110.00, "madera"],
  ["PB RH Casual Natura 210x244x15mm", 95.00, "madera"],
  ["PB RH Casual Natura 210x244x18mm", 110.00, "madera"],
  ["PB RH Catania Madera 214x244x15mm", 95.00, "madera"],
  ["PB RH Catania Madera 214x244x18mm", 91.48, "madera"],
  ["PB RH Cedro Madera 214x244x15mm", 95.00, "madera"],
  ["PB RH Cedro Madera 214x244x18mm", 110.00, "madera"],
  ["PB RH Cenizo Madera 214x244x15mm", 95.00, "madera"],
  ["PB RH Cenizo Madera 214x244x18mm", 110.00, "madera"],
  ["PB RH Century Natura 210x244x15mm", 95.00, "madera"],
  ["PB RH Century Natura 210x244x18mm", 110.00, "madera"],
  ["PB RH Chiavena Nogal 214x244x15mm", 95.00, "madera"],
  ["PB RH Chiavena Nogal 214x244x18mm", 110.00, "madera"],
  ["PB RH Chocolate Coral 15mm x214x244", 95.00, "madera"],
  ["PB RH Chocolate Coral 214x244x18mm", 110.00, "madera"],
  ["PB RH Croma Madera 214x244x15mm", 95.00, "madera"],
  ["PB RH Croma Madera 214x244x18mm", 110.00, "madera"],
  ["PB RH Dolcetto Madera 214x244x15mm", 95.00, "madera"],
  ["PB RH Dolcetto Madera 214x244x18mm", 110.00, "madera"],
  ["PB RH Duquesa Nat 15mm x214x244", 95.00, "madera"],
  ["PB RH Duquesa Natura 18mm x214x244", 110.00, "madera"],
  ["PB RH Galerna Nat 18mm x2100x2440", 110.00, "madera"],
  ["PB RH Garden Oak 214x244x15mm", 95.00, "madera"],
  ["PB RH Garden Oak 214x244x18mm", 110.00, "madera"],
  ["PB RH Garden Oak 214x244x35mm", 160.00, "madera"],
  ["PB RH Glacial Coral 214x244x15mm", 95.00, "madera"],
  ["PB RH Glacial Coral 214x244x18mm", 110.00, "madera"],
  ["PB RH Gris Grafito 214x244x15mm", 95.00, "madera"],
  ["PB RH Gris Grafito Premium 214x244x18mm", 110.00, "madera"],
  ["PB RH Gris Suave Cera 214x244x15mm", 95.00, "madera"],
  ["PB RH Gris Suave Cera 214x244x18mm", 110.00, "madera"],
  ["PB RH Gris Suave Cera 214x244x25mm", 140.00, "madera"],
  ["PB RH Gris Suave Cera 35mm x244x214", 160.00, "madera"],
  ["PB RH Habana Madera 214x244x15mm", 95.00, "madera"],
  ["PB RH Habana Madera 214x244x18mm", 110.00, "madera"],
  ["PB RH Haya Cabriel Mad 2440x2100x15mm", 95.00, "madera"],
  ["PB RH Haya Cabriel Mad 2440x2100x18mm", 110.00, "madera"],
  ["PB RH Hercules Madera 210x244x15mm", 95.00, "madera"],
  ["PB RH Hercules Madera 210x244x18mm", 110.00, "madera"],
  ["PB RH Laminas Melamina Segunda Colores Varios (15mm/18mm)", 46.73, "madera"],
  ["PB RH Liberty Madera 244x122x18mm", 65.00, "madera"],
  ["PB RH Liberty Madera 244x122x25mm", 80.00, "madera"],
  ["PB RH Liberty Madera 244x214x15mm", 95.00, "madera"],
  ["PB RH Liberty Madera 244x214x18mm", 110.00, "madera"],
  ["PB RH Liberty Madera 244x214x25mm", 140.00, "madera"],
  ["PB RH Liberty Madera 244x214x35mm", 160.00, "madera"],
  ["PB RH Liberty Madera 244x214x6mm", 40.00, "madera"],
  ["PB RH Lienzo Lino 210x244x15mm", 112.02, "madera"],
  ["PB RH Lienzo Lino 210x244x18mm", 110.00, "madera"],
  ["PB RH Machiato Madera 15mm 2440x2100", 95.00, "madera"],
  ["PB RH Machiato Madera 18mm x2440x2140", 110.00, "madera"],
  ["PB RH Mallorca Mad 15mm x214x244", 95.00, "madera"],
  ["PB RH Mallorca Mad 18mm x214x244", 110.00, "madera"],
  ["PB RH Marmol Nevada Pre 15mm 2440x2100", 95.00, "madera"],
  ["PB RH Marmol Nevada Pre 18mm 2440x2100", 110.00, "madera"],
  ["PB RH Marquina Cera 18mm 2440x2140", 110.00, "madera"],
  ["PB RH Marquina Premium 15mm 2440x2100", 95.00, "madera"],
  ["PB RH Monaco Mad 15mm x214x244", 95.00, "madera"],
  ["PB RH Monaco Mad 18mm x244x210", 110.00, "madera"],
  ["PB RH Negro Coral 214x244x15mm", 95.00, "madera"],
  ["PB RH Negro Coral 214x244x18mm", 100.00, "madera"],
  ["PB RH Negro Fut 18mm x214x244", 110.01, "madera"],
  ["PB RH Negro Futura 18mm x210x244", 109.99, "madera"],
  ["PB RH Negro Futura 214x244x15mm", 95.00, "madera"],
  ["PB RH Negro Madera 18mm x214x244", 95.00, "madera"],
  ["PB RH Negro Madera 2140x2440x15mm", 95.00, "madera"],
  ["PB RH Ninfa Coral 15mm x210x244", 95.00, "madera"],
  ["PB RH Ninfa Coral 18mm 210x244", 106.68, "madera"],
  ["PB RH Odisea Madera 210x244x15mm", 95.00, "madera"],
  ["PB RH Odisea Madera 210x244x18mm", 110.00, "madera"],
  ["PB RH Olmo Gris Madera 214x244x15mm", 95.00, "madera"],
  ["PB RH Olmo Gris Madera 214x244x18mm", 110.00, "madera"],
  ["PB RH Oro Carm Prem 15mm x210x244", 95.00, "madera"],
  ["PB RH Oro Carm Prem 18mm x210x244", 110.00, "madera"],
  ["PB RH Palmeira Mad 214x244x15mm", 95.00, "madera"],
  ["PB RH Palmeira Mad 214x244x18mm", 110.00, "madera"],
  ["PB RH Pegaso Natura 210x244x15mm", 95.00, "madera"],
  ["PB RH Pegaso Natura 210x244x18mm", 110.00, "madera"],
  ["PB RH Perillo Rustico 214x244x15mm", 95.00, "madera"],
  ["PB RH Perillo Rustico 214x244x18mm", 110.00, "madera"],
  ["PB RH Pietra Caspio Cera 214x244x15mm", 95.00, "madera"],
  ["PB RH Pietra Caspio Cera 214x244x18mm", 110.00, "madera"],
  ["PB RH Polar Mad 15mm x214x244", 95.00, "madera"],
  ["PB RH Polar Mad 18mm x214x244", 110.00, "madera"],
  ["PB RH Quinera 18mm x214x244", 101.63, "madera"],
  ["PB RH Quinera Coral 2100x2400x15mm", 85.00, "madera"],
  ["PB RH Roble Buralo Madera 210x244x15mm", 95.00, "madera"],
  ["PB RH Roble Buralo Madera 214x244x18mm", 110.00, "madera"],
  ["PB RH Roble Cafe Madera 214x244x18mm", 110.00, "madera"],
  ["PB RH Roble Cafe Madera 214x244x15mm", 95.00, "madera"],
  ["PB RH Roble Canela Coral 214x244x15mm", 90.00, "madera"],
  ["PB RH Roble Canela Coral 214x244x18mm", 100.00, "madera"],
  ["PB RH Rojo Clavel Cera 214x244x15mm", 95.00, "madera"],
  ["PB RH Rojo Clavel Cera 214x244x18mm", 110.00, "madera"],
  ["PB RH Rosa Bebe Cera 214x244x15mm", 95.00, "madera"],
  ["PB RH Rosa Bebe Cera 214x244x18mm", 110.00, "madera"],
  ["PB RH Siberia Mad 15mm x214x244", 95.00, "madera"],
  ["PB RH Siberia Mad 18mm x214x244", 110.00, "madera"],
  ["PB RH Sonoma Mad 18mm x214x244", 110.00, "madera"],
  ["PB RH Sonoma Rustico 214x244x15mm", 95.00, "madera"],
  ["PB RH Taupe Cera 15mm x244x214", 95.00, "madera"],
  ["PB RH Taupe Cera 18mm x244x214", 110.00, "madera"],
  ["PB RH Taupe Cera 25mm x244x214", 120.00, "madera"],
  ["PB RH Taupe Cera 35mm x244x214", 160.00, "madera"],
  ["PB RH Terracota Cera 15mm x244x214", 95.00, "madera"],
  ["PB RH Terracota Cera 18mm x244x214", 110.00, "madera"],
  ["PB RH Texas Cera 15mm x244x214", 95.00, "madera"],
  ["PB RH Texas Cera 18mm x244x214", 110.00, "madera"],
  ["PB RH Texas Cera 244x214x35mm", 160.00, "madera"],
  ["PB RH Texas Cera 25mm x244x214", 120.00, "madera"],
  ["PB RH Textil Atlantico 214x244x15mm", 95.00, "madera"],
  ["PB RH Textil Atlantico 214x244x18mm", 110.00, "madera"],
  ["PB RH Textil Celta 210x244x15mm", 95.00, "madera"],
  ["PB RH Textil Celta 214x244x18mm", 110.00, "madera"],
  ["PB RH Textil Godo Lino 214x244x18mm", 110.00, "madera"],
  ["PB RH Textil Iberico Lino 210x244x15mm", 95.00, "madera"],
  ["PB RH Textil Iberico Lino 210x244x18mm", 110.00, "madera"],
  ["PB RH Textil Luso Lino 210x244x15mm", 95.00, "madera"],
  ["PB RH Textil Luso Lino 210x244x18mm", 110.00, "madera"],
  ["PB RH Verde Senda Cera 214x244x15mm", 95.00, "madera"],
  ["PB RH Verde Senda Cera 214x244x18mm", 110.00, "madera"],
  ["PB RH Vicenza Oak Mad 214x244x15mm", 95.00, "madera"],
  ["PB RH Vicenza Oak Mad 214x244x18mm", 105.00, "madera"],
  ["PB RH Vulcano Mad 214x244x15mm", 95.00, "madera"],
  ["PB RH Vulcano Mad 214x244x18mm", 105.00, "madera"],
  ["PB RH Wengue Prem 214x244x15mm", 93.81, "madera"],
  ["PB RH Wengue Prem 214x244x18mm", 110.00, "madera"],
  ["PB RH Whisky Mad 15mm x214x244", 95.00, "madera"],
  ["PB RH Whisky Mad 18mm x214x244", 110.00, "madera"],
  ["PB RH Whisky Mad 244x214x15mm (Loiba)", 95.00, "madera"],
  ["Plywood Cedrillo 122x244x12mm", 31.40, "madera"],
  ["Plywood Cedrillo 122x244x15mm", 37.98, "madera"],
  ["Plywood Cedrillo 122x244x18mm", 43.70, "madera"],
  ["Plywood Cedrillo 122x244x3.6mm", 12.68, "madera"],
  ["Plywood Cedrillo 122x244x5.2mm (1/4)", 15.38, "madera"],
  ["Plywood Cedrillo 122x244x9mm", 25.43, "madera"],
  ["Plywood de Segunda Variado", 20.00, "madera"],
  ["Plywood Fenolico 122x244x09mm C/C", 24.00, "madera"],
  ["Plywood Fenolico 122x244x12mm B/C", 36.00, "madera"],
  ["Plywood Fenolico 122x244x12mm C/C", 34.00, "madera"],
  ["Plywood Fenolico 122x244x15mm B/C", 55.56, "madera"],
  ["Plywood Fenolico 122x244x15mm C/C", 45.39, "madera"],
  ["Plywood Fenolico 122x244x18mm B/C", 46.04, "madera"],
  ["Plywood Fenolico 122x244x18mm C/C", 40.00, "madera"],
  ["Plywood Fenolico 122x244x9mm B/C", 28.00, "madera"],
  ["Pta. Okoume 610x2130 Plywood/BS", 33.75, "madera"],
  ["Puerta Camden 2 Tablero 3x7", 39.00, "madera"],
  ["Puerta Colonial 6 Tablero 2x7", 36.40, "madera"],
  ["Puerta Colonial 6 Tablero 3x7", 43.95, "madera"],
  ["Puerta Plywood Virola 2x7", 32.20, "madera"],
  ["Puerta Plywood Virola 3x7", 32.20, "madera"],
  ["Puerta 6TB 910x2135 Metal", 54.85, "madera"],
  ["Puerta HR007 Acanalada 2x7 Blanca", 48.01, "madera"],
  ["Tablero Perforado Blanco 244x122x3mm", 9.90, "madera"],
  ["Tablero Perforado Crudo 244x122x3mm", 9.90, "madera"]
];

const IMECA_PRICE_LIST_4 = [
  ["Tapacanto Blanco #2 0.45x16mm (Madex) Lamina de 12mm", 1.00, "canto"],
  ["Tapacanto Glamorous Pasific Mat 22x1mm (AGT)", 2.10, "canto"],
  ["Avento Dos Puertas 193x102mm", 58.50, "bisagras"],
  ["Bisagra P/Puerta 2-1/2\" Negro Abolu", 1.48, "bisagras"],
  ["Bisagra P/Puerta 2\" Negro Abolu", 1.05, "bisagras"],
  ["Bisagra P/Puerta 3\" Negro Abolu", 1.72, "bisagras"],
  ["Bisagra Puerta Plateada 2\"x2\"", 1.22, "bisagras"],
  ["Bisagra Puerta Plateada 21/2 x 2/12", 1.29, "bisagras"],
  ["Bisagra Puerta Plateada 3\"x3\"", 1.73, "bisagras"],
  ["Bota Agua para Puerta", 5.35, "cerraduras"],
  ["Broche de Presion para Puerta", 0.63, "cerraduras"],
  ["Cierrapuerta de Brazo Mediano (Hoteche)", 15.95, "cerraduras"],
  ["Cierrapuertas para 75 y 90 cm 65kg", 22.11, "cerraduras"],
  ["Freno para Puerta de Caucho", 1.19, "cerraduras"],
  ["Iman para Puerta Total", 1.49, "cerraduras"],
  ["Kit Apertura Hueco Cerradura Puertas", 12.00, "cerraduras"],
  ["Manillon para Puerta 450 PS", 19.04, "jaladores"],
  ["Manillon para Puerta 450mm", 23.76, "jaladores"],
  ["Manillon para Puerta Satinado 450mm 801-300", 19.41, "jaladores"],
  ["Manillon para Puerta Satinado 450mm 842-300", 26.10, "jaladores"],
  ["Manillon para Puerta Satinado 800mm 843-600", 24.91, "jaladores"],
  ["Manillon para Puerta Satinado 847-800", 41.04, "jaladores"],
  ["Manillon para Puerta Satinado 883-300", 26.51, "jaladores"],
  ["Manillon para Puerta Satinado 904-300", 23.61, "jaladores"],
  ["Rieles para Puerta SL-T409", 34.31, "bisagras"],
  ["Rieles para Puerta T316B IMEX", 51.68, "bisagras"],
  ["Rieles para Puerta T409 3MT IMEX", 53.96, "bisagras"],
  ["Rieles para Puerta T901A 3M Supe IMEX", 8.61, "bisagras"],
  ["Rieles para Puertas T306 3MT IMEX", 34.94, "bisagras"],
  ["Rieles para Puertas T312 IMEX", 35.24, "bisagras"],
  ["Rieles para Puertas T901A 3M Superior", 9.29, "bisagras"],
  ["Rieles para Puertas T902 Plegable", 49.47, "bisagras"],
  ["Set Tip-On para Puerta Grande", 9.93, "cerraduras"],
  ["Tirador de Puerta en Forma C Brillante", 28.53, "jaladores"],
  ["Tope para Puerta", 1.41, "cerraduras"],
  ["Tope para Puerta 20x20x70mm SS", 10.75, "cerraduras"],
  ["Tope para Puerta 45x75mm SS", 9.21, "cerraduras"],
  ["Tope para Puerta 46x28mm SS", 6.27, "cerraduras"],
  ["Tope para Puerta 53x19x95mm SS", 7.42, "cerraduras"]
];

const IMECA_PRICE_LIST_5 = [
  ["Pocket-Hole Cutter (Tapatornillo)", 74.11, "herramientas"],
  ["Saca Tapa Tornillo", 14.99, "herramientas"],
  ["Tapacanto Taupe 22x0.45mm (Madex)", 0.80, "canto"],
  ["Tapacanto Roble Mallado 1x22mm (Madex)", 55.00, "canto"],
  ["Tapa Tornillos American Maple", 1.73, "canto"],
  ["Tapa Tornillos Cherry", 1.75, "canto"],
  ["Tapa Tornillos Clear Maple", 1.76, "canto"],
  ["Tapa Tornillos Golden Cherry", 1.75, "canto"],
  ["Tapa Tornillos Golden Oak", 1.56, "canto"],
  ["Tapa Tornillos Gris", 1.47, "canto"],
  ["Tapa Tornillos Hardrock Maple", 1.77, "canto"],
  ["Tapa Tornillos Imperial Walnut (PVC)", 2.13, "canto"],
  ["Tapa Tornillos Ligth Maple", 1.76, "canto"],
  ["Tapa Tornillos Mahogany", 2.25, "canto"],
  ["Tapa Tornillos Maple", 2.09, "canto"],
  ["Tapa Tornillos Medium Oak", 1.76, "canto"],
  ["Tapa Tornillos Natural Cherry", 1.70, "canto"],
  ["Tapa Tornillos Natural Oak", 1.52, "canto"],
  ["Tapa Tornillos Polished Chrome", 2.59, "canto"],
  ["Tapa Tornillos Presidential Walnut", 1.90, "canto"],
  ["Tapa Tornillos Select Cherry", 2.14, "canto"],
  ["Tapacanto 22mmx0.45mm Soder (Musa Hercules)", 0.80, "canto"],
  ["Tapacanto 22x0.45mm Cala (Castaño)", 0.80, "canto"],
  ["Tapacanto 22x0.45mm Lino Beige", 0.80, "canto"],
  ["Tapacanto 22x0.45mm Lino Novopan (Lienzo)", 0.80, "canto"],
  ["Tapacanto 22x0.45mm Nilo (Rovere)", 0.80, "canto"],
  ["Tapacanto 22x1mm Glacial (Merino)", 1.40, "canto"],
  ["Tapacanto 22x1mm Nogal Siena (Odisea)", 1.40, "canto"],
  ["Tapacanto 22x1mm Rovere", 1.40, "canto"],
  ["Tapacanto 22x2mm Blanco N1 (Madex)", 1.60, "canto"],
  ["Tapacanto 22x2mm Incienso", 1.80, "canto"],
  ["Tapacanto 22x2mm Lino Fantasia", 1.80, "canto"],
  ["Tapacanto 22x2mm Nogal Siena (Odisea)", 1.80, "canto"],
  ["Tapacanto 29x2mm Maple (MB)", 2.40, "canto"],
  ["Tapacanto Acacia Suave 1x22 (Madex)", 1.20, "canto"],
  ["Tapacanto Alaska 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Alaska 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Alaska 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Alba Lineal 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Alba Lineal 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Almendra 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Almendra 22x1mm (Merino)", 1.20, "canto"],
  ["Tapacanto Almendra 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Almendra 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Aluminio 22x0.8mm (Madex)", 2.00, "canto"],
  ["Tapacanto Aluminio Plata 1mmx23", 1.80, "canto"],
  ["Tapacanto Amaretto 22x0.45mm (Madex)", 0.80, "canto"],
  ["Tapacanto Amaretto 22x2mm (Madex)", 1.80, "canto"],
  ["Tapacanto Amarillo 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Amarillo 22x1mm (Merino)", 1.20, "canto"],
  ["Tapacanto Amarillo 22x2mm (Merino)", 1.70, "canto"],
  ["Tapacanto Ambar 22x2mm (Madex)", 1.78, "canto"],
  ["Tapacanto Arena 45x45", 1.80, "canto"],
  ["Tapacanto Atlantico 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Atlantico 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Avellana 22x1mm", 1.45, "canto"],
  ["Tapacanto Avellana 22mm x 0.45mm", 0.80, "canto"],
  ["Tapacanto Azul Mediterraneo 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Azul Mediterraneo 22x1mm (Merino)", 1.20, "canto"],
  ["Tapacanto Azul Mediterraneo 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Azul Pasific 22x1mm (AGT)", 2.20, "canto"],
  ["Tapacanto Baco 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Baco 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Bavaria 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Bavaria 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Beige 22x1mm (Almendra)", 0.93, "canto"],
  ["Tapacanto Beige Linen 22x0.45mm (Luso)", 0.80, "canto"],
  ["Tapacanto Bellota 0.45x22mm", 0.80, "canto"],
  ["Tapacanto Bellota 1.80x22mm", 1.80, "canto"],
  ["Tapacanto Birch Madera 22x1mm", 2.00, "canto"],
  ["Tapacanto Blanco#1 22x0.45mm (Madex)", 0.60, "canto"],
  ["Tapacanto Blanco 16x0.45mm (Madex)", 1.40, "canto"],
  ["Tapacanto Blanco 1x45mm", 1.50, "canto"],
  ["Tapacanto Blanco 22x0.45mm", 0.60, "canto"],
  ["Tapacanto Blanco 22x0.45mm N1 (MD)", 0.60, "canto"],
  ["Tapacanto Blanco 22x0.8mm (Merino)", 1.00, "canto"],
  ["Tapacanto Blanco 22x1mm (Merino)", 1.26, "canto"],
  ["Tapacanto Blanco 22x2mm (Madex)", 1.60, "canto"],
  ["Tapacanto Blanco 29x0.45mm (Merino)", 1.80, "canto"],
  ["Tapacanto Blanco 29x2mm (Madex)", 2.50, "canto"],
  ["Tapacanto Blanco 40x0.45mm", 1.20, "canto"],
  ["Tapacanto Blanco 40x2mm (Merino)", 1.20, "canto"],
  ["Tapacanto Blanco 44x2mm", 2.50, "canto"],
  ["Tapacanto Blanco 45x0.45 Madex", 1.10, "canto"],
  ["Tapacanto Blanco 45x0.45mm", 1.60, "canto"],
  ["Tapacanto Blanco 50x0.45 Madex", 1.12, "canto"],
  ["Tapacanto Blanco A/B 22x1mm (Merino)", 2.55, "canto"],
  ["Tapacanto Blanco A/B 40x1mm (Merino)", 2.50, "canto"],
  ["Tapacanto Blanco A/Brillo 22x1mm (Madex)", 2.10, "canto"],
  ["Tapacanto Blanco Brillo 22x1mm (AGT)", 2.27, "canto"],
  ["Tapacanto Blanco Mate 22x1mm (AGT)", 2.50, "canto"],
  ["Tapacanto Blanco N1 2x22mm Madex", 1.60, "canto"],
  ["Tapacanto Brixton 0.45x45mm", 1.40, "canto"],
  ["Tapacanto Brixton 19x0.45mm (Madex)", 0.80, "canto"],
  ["Tapacanto Brixton 22x0.45mm (Madex)", 0.80, "canto"],
  ["Tapacanto Brixton 22x2mm (Madex)", 1.80, "canto"],
  ["Tapacanto Bronce 22x0.45mm", 0.80, "canto"],
  ["Tapacanto Cala 22x2mm (Castaño)", 1.80, "canto"],
  ["Tapacanto Caledonia 42x2mm MB", 2.34, "canto"],
  ["Tapacanto Canyon 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Canyon 22x1mm (Merino)", 1.80, "canto"],
  ["Tapacanto Canyon 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Canyon 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Capuccino 1x22", 1.25, "canto"],
  ["Tapacanto Capuccino 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Capuccino 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Carbon 22x0.45mm (Galerna) Madex", 0.80, "canto"],
  ["Tapacanto Carvalho 22x0.45mm", 0.80, "canto"],
  ["Tapacanto Carvalho 22x1.8mm", 1.80, "canto"],
  ["Tapacanto Carvalho 2x22mm", 1.68, "canto"],
  ["Tapacanto Carvalo 40x1mm", 1.66, "canto"],
  ["Tapacanto Castaño Lineal 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Castaño Lineal 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Castaño Lineal 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Casual 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Casual 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Casual 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Catania 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Catania 22x1mm (Merino)", 1.20, "canto"],
  ["Tapacanto Catania 22x2mm (Merino)", 1.70, "canto"],
  ["Tapacanto Cedro 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Cedro 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Cedro 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Ceniza 22x1mm (Siberia)", 2.00, "canto"],
  ["Tapacanto Cenizo 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Cenizo 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Cenizo 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Century 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Century 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Chantilli 0.45x22mm Madex", 0.80, "canto"],
  ["Tapacanto Chantilli 2x22mm", 1.80, "canto"],
  ["Tapacanto Chantilli 2x44mm", 1.80, "canto"],
  ["Tapacanto Chantilli 45x0.45mm (Madex)", 1.12, "canto"],
  ["Tapacanto Chantilly 0.45x22", 0.80, "canto"],
  ["Tapacanto Chantilly 1x22mm", 1.40, "canto"],
  ["Tapacanto Chiavena 22x0.45mm (Merino)", 0.79, "canto"],
  ["Tapacanto Chiavena 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Chiavena 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Choco Habano 22x0.45mm (FD)", 0.80, "canto"],
  ["Tapacanto Choco Habano 23x2mm (FD)", 1.80, "canto"],
  ["Tapacanto Choco Habano 31x2mm (FD)", 2.06, "canto"],
  ["Tapacanto Chocolate 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Chocolate 22x2mm (Merino)", 1.78, "canto"],
  ["Tapacanto Chocolate 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Cool Grey HG 22x1mm (AGT)", 2.50, "canto"]
];

const IMECA_PRICE_LIST_6 = [
  ["Tapacanto Croma 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Croma 22x1mm (Merino)", 1.80, "canto"],
  ["Tapacanto Croma 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Croma 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Crome Grey HG 22x1mm (AGT)", 2.31, "canto"],
  ["Tapacanto Dolcetto 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Dolcetto 22x1mm (Merino)", 1.20, "canto"],
  ["Tapacanto Dolcetto 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Dolcetto 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Dorado 22x0.8mm (Madex)", 2.06, "canto"],
  ["Tapacanto Dorado 22x1mm", 1.68, "canto"],
  ["Tapacanto Duna 22x0.45mm (Century) Madex", 0.80, "canto"],
  ["Tapacanto Duna 22x1mm", 1.40, "canto"],
  ["Tapacanto Duna 22x2mm (Madex)", 1.80, "canto"],
  ["Tapacanto Duquesa 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Duquesa 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Duquesa 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Dust Alumi 22x1mm", 0.80, "canto"],
  ["Tapacanto Dust Alumi 45x1mm", 1.40, "canto"],
  ["Tapacanto Ebano 22x1mm (FD)", 1.80, "canto"],
  ["Tapacanto Expresso 1x22mm", 1.20, "canto"],
  ["Tapacanto Forest Green Mat 22x1mm", 2.25, "canto"],
  ["Tapacanto Fresno Estepa 1x22", 1.25, "canto"],
  ["Tapacanto Fresno Glacial 22x0.45mm (Madex)", 0.80, "canto"],
  ["Tapacanto Fresno Glacial 22x1mm (Madex)", 1.23, "canto"],
  ["Tapacanto Fresno Glacial 22x2mm (Madex)", 2.33, "canto"],
  ["Tapacanto Fresno Glacial 40x0.45mm", 1.40, "canto"],
  ["Tapacanto Fume 1x22 (New Brixton-Monaco)", 1.20, "canto"],
  ["Tapacanto Galerna 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Galerna 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Gales 1x45mm", 1.87, "canto"],
  ["Tapacanto Gales 22x0.45 (Malaga) Madex", 0.82, "canto"],
  ["Tapacanto Gales 22x1 (Madex)", 1.20, "canto"],
  ["Tapacanto Gales 22x2mm (Malaga)", 1.80, "canto"],
  ["Tapacanto Gengibre 1x22mm (Madex)", 1.00, "canto"],
  ["Tapacanto Gengibre 1x45mm (Madex)", 1.00, "canto"],
  ["Tapacanto Glacial 22x0.45mm (Madex)", 0.80, "canto"],
  ["Tapacanto Glacial 22x2mm (Madex)", 1.80, "canto"],
  ["Tapacanto Gold Alumi 22x1mm", 0.80, "canto"],
  ["Tapacanto Gold Alumi 45x1mm", 1.40, "canto"],
  ["Tapacanto Granizo 22x2mm (Cenizo)", 1.80, "canto"],
  ["Tapacanto Granizo (Cenizo) 22x0.45mm", 0.80, "canto"],
  ["Tapacanto Gris Claro 0.45x29mm (Madex)", 1.25, "canto"],
  ["Tapacanto Gris Claro 22x0.45mm (Madex)", 0.80, "canto"],
  ["Tapacanto Gris Claro 22x1mm", 1.00, "canto"],
  ["Tapacanto Gris Grafito 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Gris Grafito 22x1mm (Merino)", 1.70, "canto"],
  ["Tapacanto Gris Grafito 22x2mm (Merino)", 1.70, "canto"],
  ["Tapacanto Gris Grafito 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Gris Humo 22x0.45mm (Madex)", 0.80, "canto"],
  ["Tapacanto Gris Humo 22x1mm (Madex)", 1.40, "canto"],
  ["Tapacanto Gris Humo 22x2mm (Madex)", 1.80, "canto"],
  ["Tapacanto Gris Madera 19x1mm (Galerna)", 1.20, "canto"],
  ["Tapacanto Gris Nube 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Gris Nube 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Gris Nube 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Gris Piedra 22x0.45mm (Gris)", 0.80, "canto"],
  ["Tapacanto Gris Piedra 22x1mm", 1.60, "canto"],
  ["Tapacanto Gris Piedra 22x2mm (Gris)", 1.68, "canto"],
  ["Tapacanto Gris Piedra 42x1mm (Gris)", 2.06, "canto"],
  ["Tapacanto Gris Piedra 45x2mm", 2.00, "canto"],
  ["Tapacanto Gris Piedra 30x1mm", 0.50, "canto"],
  ["Tapacanto Gris Plomo 22x0.45mm", 0.80, "canto"],
  ["Tapacanto Gris Plomo 22x1mm", 1.20, "canto"],
  ["Tapacanto Gris Plomo 22x2mm", 1.80, "canto"],
  ["Tapacanto Gris Plomo 40x1mm (Madex)", 2.06, "canto"],
  ["Tapacanto Gris Suave 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Gris Suave 22x1mm Merino", 1.00, "canto"],
  ["Tapacanto Gris Suave 22x2mm Merino", 1.80, "canto"],
  ["Tapacanto Gris Suave 29x2mm Merino", 1.80, "canto"],
  ["Tapacanto Gris Suave 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Gris Suave 40x2mm (Merino)", 1.60, "canto"],
  ["Tapacanto Habano 22x1mm", 1.40, "canto"],
  ["Tapacanto Haya 2x22mm (Olmo6)", 1.80, "canto"],
  ["Tapacanto Haya 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Haya Catedral 22x2mm", 1.80, "canto"],
  ["Tapacanto Haya Catedral 22x2mm (FD)", 1.68, "canto"],
  ["Tapacanto Haya Gabriel 22x0.45mm (Merino)", 1.11, "canto"],
  ["Tapacanto Haya Gabriel 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Hercules 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Hercules 22x2mm (Merino)", 2.51, "canto"],
  ["Tapacanto Humo 22x0.45mm (Olmo)", 1.24, "canto"],
  ["Tapacanto Humo 22x2mm", 1.80, "canto"],
  ["Tapacanto Italian Nocce 22x0.45mm", 0.80, "canto"],
  ["Tapacanto Italian Nocce 22x1.8mm", 1.68, "canto"],
  ["Tapacanto Italian Nocce 40x2mm (MB)", 2.06, "canto"],
  ["Tapacanto Italian Noce 0.45x22mm", 0.75, "canto"],
  ["Tapacanto Italian Noce 2x22mm", 1.50, "canto"],
  ["Tapacanto Larice Express 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Larice Express 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Laricina (Provence) 1x22 (Madex)", 1.10, "canto"],
  ["Tapacanto Liberty 0.45x22mm (Merino)", 1.15, "canto"],
  ["Tapacanto Liberty 1x22mm (Merino)", 1.00, "canto"],
  ["Tapacanto Liberty 2x29mm (Merino)", 1.40, "canto"],
  ["Tapacanto Liberty 40x2mm (Merino)", 2.40, "canto"],
  ["Tapacanto Lino Atlantico (Pluton Madex) 1x22mm", 1.20, "canto"],
  ["Tapacanto Lino Esterio 1x22", 1.10, "canto"],
  ["Tapacanto Lino Esterio 1x45 MD", 1.80, "canto"],
  ["Tapacanto Lino Fantasia 1x22", 1.25, "canto"],
  ["Tapacanto Lino Fantasia 1x40mm (Madex)", 1.68, "canto"],
  ["Tapacanto Lino Godo 0.45x22 (Madex)", 0.80, "canto"],
  ["Tapacanto Lino Godo 2x22 (Madex)", 1.80, "canto"],
  ["Tapacanto Lino Habana 22x2mm", 1.80, "canto"],
  ["Tapacanto Lino Iberico 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Lino Iberico 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Lino Iberico 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Lino Lienzo 22x0.45mm (Merino)", 0.90, "canto"],
  ["Tapacanto Lino Lienzo 22x2mm (Merino)", 2.05, "canto"],
  ["Tapacanto Lino Lienzo 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Lino Luso 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Lino Luso 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Lino Luso 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Lino Masisa 22x0.45mm Luso", 0.80, "canto"],
  ["Tapacanto Lino Masisa 22x2mm Luso", 1.80, "canto"],
  ["Tapacanto Lino Masisa (Godo) 1x22mm", 1.12, "canto"],
  ["Tapacanto Lino Masisa (Godo) 2x22mm", 1.68, "canto"],
  ["Tapacanto Lino Pelikano 22x1mm", 1.40, "canto"],
  ["Tapacanto Louro Preto Gran (Valencia) 42x2mm", 3.24, "canto"],
  ["Tapacanto Louro Wengue 22x0.45mm (MB)", 0.80, "canto"],
  ["Tapacanto Louro Wengue 42x2mm (MB)", 2.20, "canto"],
  ["Tapacanto Machiato 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Machiato 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Machiato 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Mali 22x0.45mm (Queen)", 0.80, "canto"],
  ["Tapacanto Mali 22x2mm (Queen)", 2.17, "canto"],
  ["Tapacanto Mallorca 22x0.45mm (Merino)", 0.81, "canto"],
  ["Tapacanto Mallorca 22x1mm (Merino)", 1.70, "canto"],
  ["Tapacanto Mallorca 22x2mm (Merino)", 1.70, "canto"],
  ["Tapacanto Mallorca 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Manhathan Nogal 1x22mm", 1.20, "canto"],
  ["Tapacanto Manhathan Nogal 2x22mm", 1.68, "canto"],
  ["Tapacanto Maple Madera 22x1mm", 2.00, "canto"],
  ["Tapacanto Marmol Nevado 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Marmol Nevado 22x1mm", 1.20, "canto"],
  ["Tapacanto Marmol Nevado 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Marmol Nevado 40x1mm (Merino)", 1.60, "canto"],
  ["Tapacanto Marquina 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Marquina 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Marquina 40x1mm (Merino)", 1.60, "canto"],
  ["Tapacanto Miel 0.45x22 (Vulcano)", 0.80, "canto"],
  ["Tapacanto Miel 22x0.45mm (Habana)", 0.80, "canto"],
  ["Tapacanto Monaco 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Monaco 22x1mm (Merino)", 1.20, "canto"],
  ["Tapacanto Monaco 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Monaco 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Musa 22x0.45mm (Merino)", 1.03, "canto"],
  ["Tapacanto Musa 22x2mm (Merino)", 2.35, "canto"],
  ["Tapacanto Nacar 22x0.45mm", 0.80, "canto"],
  ["Tapacanto Nacar 22x1mm", 1.00, "canto"],
  ["Tapacanto Nacar 45x1mm", 2.00, "canto"],
  ["Tapacanto Nebbia 22x0.45mm (Grafito)", 0.80, "canto"],
  ["Tapacanto Negro 22x0.45mm (Madex)", 0.80, "canto"],
  ["Tapacanto Negro 22x0.45mm (Merino)", 0.77, "canto"]
];

const IMECA_PRICE_LIST_7 = [
  ["Tapacanto Negro 22x1mm (Madex)", 2.69, "canto"],
  ["Tapacanto Negro 22x1mm (Merino)", 1.20, "canto"],
  ["Tapacanto Negro 22x2mm", 1.80, "canto"],
  ["Tapacanto Negro 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Negro 29x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Negro 40x0.45mm Merino", 1.60, "canto"],
  ["Tapacanto Negro 40x2mm Merino", 2.00, "canto"],
  ["Tapacanto Negro 45x1mm (Madex)", 1.68, "canto"],
  ["Tapacanto Negro A/B 22x1mm (Merino)", 2.43, "canto"],
  ["Tapacanto Negro A/B 22x2mm Merino", 2.54, "canto"],
  ["Tapacanto Negro Brillo 22x1mm (AGT)", 2.51, "canto"],
  ["Tapacanto Negro Madera 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Negro Madera 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Negro Mate 22x1mm (AGT)", 2.50, "canto"],
  ["Tapacanto Nepal 22x0.45mm", 0.80, "canto"],
  ["Tapacanto Nepal 22x2mm (Glacial)", 2.17, "canto"],
  ["Tapacanto New Grey 22x1mm (AGT)", 2.20, "canto"],
  ["Tapacanto Niebla (Palmeira) 1x22mm", 1.20, "canto"],
  ["Tapacanto Ninfa 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Ninfa 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Ninfa 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Nogal Manhathan 22x2mm", 1.68, "canto"],
  ["Tapacanto Nogal Manhathan 45x45mm (Madex)", 1.68, "canto"],
  ["Tapacanto Nogal Manhattan 1x45mm", 1.00, "canto"],
  ["Tapacanto Nogal Manhattan 22x0.45mm", 1.50, "canto"],
  ["Tapacanto Nuez 22x0.45mm", 0.80, "canto"],
  ["Tapacanto Nuez 22x2mm", 2.17, "canto"],
  ["Tapacanto Nuez 44x2mm (Madex)", 2.06, "canto"],
  ["Tapacanto Ocaso 22x0.45mm (Madex)", 0.75, "canto"],
  ["Tapacanto Ocaso 22x2mm (Madex)", 1.68, "canto"],
  ["Tapacanto Odisea 22x0.45mm (Merino)", 0.90, "canto"],
  ["Tapacanto Odisea 22x2mm (Merino)", 1.95, "canto"],
  ["Tapacanto Odisea 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Olivo 22x0.45mm", 0.80, "canto"],
  ["Tapacanto Olivo 22x2mm (Olmo Gris)", 2.17, "canto"],
  ["Tapacanto Olmo Gris 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Olmo Gris 22x1mm (Merino)", 1.00, "canto"],
  ["Tapacanto Olmo Gris 22x2mm (Merino)", 1.70, "canto"],
  ["Tapacanto Olmo Gris 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Olmo Gris 42x2mm", 2.34, "canto"],
  ["Tapacanto Olmo Oscuro 19x2mm (Buralo)", 2.17, "canto"],
  ["Tapacanto Olmo Volga 0.45x22", 0.82, "canto"],
  ["Tapacanto Olmo Volga 1x22mm (Madex)", 1.68, "canto"],
  ["Tapacanto Olmo Volga 22x2mm", 1.69, "canto"],
  ["Tapacanto Olmo Volga 22x2mm (Rovere)", 1.99, "canto"],
  ["Tapacanto Onyx Grey HG 22x1mm (AGT)", 2.31, "canto"],
  ["Tapacanto Oregon 19x2mm (Cenizo)", 2.17, "canto"],
  ["Tapacanto Oro Carm 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Oro Carm 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Oyster 22x1mm (Avellana)", 1.31, "canto"],
  ["Tapacanto Palmeira 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Palmeira 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Pandora 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Pandora 22x2mm (Merino)", 1.89, "canto"],
  ["Tapacanto Panela 22x0.45mm (Garden)", 0.80, "canto"],
  ["Tapacanto Panela 22x1mm (Garden)", 1.20, "canto"],
  ["Tapacanto Panela 22x2mm", 1.00, "canto"],
  ["Tapacanto Panela 45x0.45mm (Garden)", 1.00, "canto"],
  ["Tapacanto Panela 45x1mm (Garden)", 1.20, "canto"],
  ["Tapacanto Pegaso 22x0.45mm (Merino)", 0.90, "canto"],
  ["Tapacanto Pegaso 22x2mm (Merino)", 2.05, "canto"],
  ["Tapacanto Pegaso 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Perillo 22x0.45mm (Merino)", 1.18, "canto"],
  ["Tapacanto Perillo 22x2mm (Merino)", 2.64, "canto"],
  ["Tapacanto Pietra 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Pietra 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Pigmeto 22x2mm (Chiavena)", 2.17, "canto"],
  ["Tapacanto Pino Blanco 22x0.45mm (Alba)", 0.90, "canto"],
  ["Tapacanto Plateado 22x1mm", 1.68, "canto"],
  ["Tapacanto Platino 22x0.45mm (Merino)", 1.17, "canto"],
  ["Tapacanto Platino 22x1mm (Merino)", 1.40, "canto"],
  ["Tapacanto Platino 22x2mm (Merino)", 2.50, "canto"],
  ["Tapacanto Platino 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Plomo 0.45x45", 1.00, "canto"],
  ["Tapacanto Plomo Alumi 22x1mm", 0.80, "canto"],
  ["Tapacanto Plomo Alumi 45x1mm", 1.40, "canto"],
  ["Tapacanto Provence 1x22 (Ibiza)", 1.26, "canto"],
  ["Tapacanto Provence 22x0.45mm", 1.01, "canto"],
  ["Tapacanto Provence 22x2mm", 2.23, "canto"],
  ["Tapacanto Queen 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Queen 22x2mm (Merino)", 1.91, "canto"],
  ["Tapacanto Queen 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Quinera 22x0.45mm (Merino)", 0.90, "canto"],
  ["Tapacanto Quinera 22x2mm (Merino)", 1.79, "canto"],
  ["Tapacanto Quinera 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Raukantex 33/2 (Avellana)", 2.10, "canto"],
  ["Tapacanto Roble Aurora 0.80mm x40mm", 1.66, "canto"],
  ["Tapacanto Roble Buralo 22x0.45mm (Merino)", 0.84, "canto"],
  ["Tapacanto Roble Buralo 22x1mm (Merino)", 1.20, "canto"],
  ["Tapacanto Roble Buralo 22x2mm (Merino)", 1.88, "canto"],
  ["Tapacanto Roble Buralo 28x2mm (Moby)", 2.17, "canto"],
  ["Tapacanto Roble Cafe 22x0.45mm (Merino)", 0.92, "canto"],
  ["Tapacanto Roble Cafe 22x2mm (Merino)", 2.10, "canto"],
  ["Tapacanto Roble Cafe 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Roble Canela 1x20mm (Madex)", 1.12, "canto"],
  ["Tapacanto Roble Canela 20x1mm", 1.20, "canto"],
  ["Tapacanto Roble Canela 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Roble Canela 22x2mm (Merino)", 2.29, "canto"],
  ["Tapacanto Roble Mallado 0.45x22mm", 0.75, "canto"],
  ["Tapacanto Roble Mallado 1x22mm", 1.20, "canto"],
  ["Tapacanto Roble Mallado 2x22mm", 2.03, "canto"],
  ["Tapacanto Roble Mallado 45x0.45mm", 1.40, "canto"],
  ["Tapacanto Roble Mallado 45x1mm", 2.00, "canto"],
  ["Tapacanto Rojo 0.45x22mm (Merino)", 0.80, "canto"],
  ["Tapacanto Rojo 0.8x22mm (MDX)", 1.20, "canto"],
  ["Tapacanto Rojo 2x22mm (Merino)", 1.60, "canto"],
  ["Tapacanto Rosa Bebe 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Rosa Bebe 22x1mm (Merino)", 1.20, "canto"],
  ["Tapacanto Rovere 22x0.45mm (Merino)", 1.03, "canto"],
  ["Tapacanto Rovere 22x2mm (Merino)", 1.87, "canto"],
  ["Tapacanto Rovere 45x45 (Madex)", 1.49, "canto"],
  ["Tapacanto Rustic Red Mate 22x1mm (AGT)", 2.50, "canto"],
  ["Tapacanto Sahara 22x0.45mm (Madex)", 0.62, "canto"],
  ["Tapacanto Sahara 22x2mm (Madex)", 1.94, "canto"],
  ["Tapacanto Salvaje 22x0.45mm (Galerna)", 0.80, "canto"],
  ["Tapacanto Salvaje 22x2mm (Galerna)", 2.17, "canto"],
  ["Tapacanto Sapelly 22x0.45mm (Merino)", 0.64, "canto"],
  ["Tapacanto Sapelly 22x2mm (Merino)", 1.20, "canto"],
  ["Tapacanto Sapelly 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Siber Liberti 1x36mm (Siberia Madex)", 1.80, "canto"],
  ["Tapacanto Siberia 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Siberia 22x1mm (Merino)", 1.20, "canto"],
  ["Tapacanto Siberia 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Siberia 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Silver Liberty 1x22 (Siberia Madex)", 1.23, "canto"],
  ["Tapacanto Soder 22x2mm", 2.17, "canto"],
  ["Tapacanto Sonoma 22x0.45mm (Merino)", 0.81, "canto"],
  ["Tapacanto Sonoma 22x1mm (Madex)", 1.12, "canto"],
  ["Tapacanto Sonoma 22x2mm (Merino)", 1.74, "canto"],
  ["Tapacanto Sonoma 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Storm Grey Mat 22x1mm (AGT)", 2.50, "canto"],
  ["Tapacanto Super Blanco 0.45x22mm", 0.60, "canto"],
  ["Tapacanto Taupe 22x0.45mm (Madex)", 0.80, "canto"],
  ["Tapacanto Taupe 22x1mm (Madex)", 1.12, "canto"],
  ["Tapacanto Taupe 22x1mm (Merino)", 1.12, "canto"],
  ["Tapacanto Taupe 22x2mm (Merino)", 2.16, "canto"],
  ["Tapacanto Taupe 40x1mm (Merino)", 1.20, "canto"],
  ["Tapacanto Taupe 40x2mm (Merino)", 1.60, "canto"],
  ["Tapacanto Taupe 41x2mm (FD)", 2.43, "canto"],
  ["Tapacanto Taupe 45x0.45mm (Madex)", 1.20, "canto"],
  ["Tapacanto Taupe 45x1mm (Madex)", 1.20, "canto"],
  ["Tapacanto Terracota 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Terracota 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Tessuto 20x0.8mm (Madex)", 0.75, "canto"],
  ["Tapacanto Tessuto 40x0.8mm", 1.45, "canto"],
  ["Tapacanto Texas 0.45x22mm (Madex)", 0.80, "canto"],
  ["Tapacanto Texas 0.45x22mm (Merino)", 0.80, "canto"],
  ["Tapacanto Texas 0.45x45mm (Madex)", 1.80, "canto"],
  ["Tapacanto Texas 1x22mm (Madex)", 1.20, "canto"],
  ["Tapacanto Texas 1x22mm (Merino)", 1.20, "canto"],
  ["Tapacanto Texas 1x45mm (Madex)", 1.60, "canto"],
  ["Tapacanto Texas 2x22mm (Madex)", 1.80, "canto"],
  ["Tapacanto Texas 2x40mm (Merino)", 2.40, "canto"]
];

const IMECA_PRICE_LIST_8 = [
  ["Tapacanto Textil Celta 22x0.45mm (Merino)", 1.16, "canto"],
  ["Tapacanto Textil Celta 22x1mm Merino", 1.20, "canto"],
  ["Tapacanto Textil Celta 22x2mm Merino", 1.80, "canto"],
  ["Tapacanto Toscano 22x2mm (Cafe)", 2.17, "canto"],
  ["Tapacanto Trend Grey HG 22x1mm (AGT)", 2.31, "canto"],
  ["Tapacanto Verde Glacial 1x22mm (Madex)", 1.80, "canto"],
  ["Tapacanto Verde Glacial 22x0.45mm (Madex)", 0.80, "canto"],
  ["Tapacanto Vicenza 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Vicenza 22x1mm (Merino)", 1.20, "canto"],
  ["Tapacanto Vicenza 22x2mm (Merino)", 1.70, "canto"],
  ["Tapacanto Vision Brillo 22x1mm (AGT)", 2.94, "canto"],
  ["Tapacanto Vulcano 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Vulcano 22x1mm (Merino)", 1.20, "canto"],
  ["Tapacanto Vulcano 22x2mm (Merino)", 1.70, "canto"],
  ["Tapacanto Wengue 1x22mm Madex", 1.00, "canto"],
  ["Tapacanto Wengue 22x0.45mm (Merino)", 1.15, "canto"],
  ["Tapacanto Wengue 22x2mm (Merino)", 1.80, "canto"],
  ["Tapacanto Wengue 29x0.45mm (Merino)", 1.31, "canto"],
  ["Tapacanto Wengue 29x2mm (Merino)", 2.10, "canto"],
  ["Tapacanto Wengue 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto Wengue 44x2mm", 2.40, "canto"],
  ["Tapacanto Wengue 45x0.45mm", 1.45, "canto"],
  ["Tapacanto Wengue #5 1x45mm", 1.80, "canto"],
  ["Tapacanto Wengue N5 22x0.45mm", 0.80, "canto"],
  ["Tapacanto Wengue N5 22x1mm", 2.20, "canto"],
  ["Tapacanto Wengue N5 22x2mm", 1.80, "canto"],
  ["Tapacanto Wengue Tabaco 1x22mm (Madex)", 1.20, "canto"],
  ["Tapacanto Wengue Tabaco 1x34mm (Madex)", 1.12, "canto"],
  ["Tapacanto Wengue Valencia 0.45x22mm", 0.75, "canto"],
  ["Tapacanto Wengue Valencia 0.45x45mm", 1.60, "canto"],
  ["Tapacanto Wengue Valencia 22x0.45mm", 0.62, "canto"],
  ["Tapacanto Wengue Valencia 22x1.8mm", 1.75, "canto"],
  ["Tapacanto Wengue Valencia 29x1.8mm", 2.25, "canto"],
  ["Tapacanto Wengue Valencia 2x22mm", 1.68, "canto"],
  ["Tapacanto Wengue Valencia 45x1.8mm", 2.06, "canto"],
  ["Tapacanto Whisky 22x0.45mm (Merino)", 0.80, "canto"],
  ["Tapacanto Whisky 22x1mm (Merino)", 1.75, "canto"],
  ["Tapacanto Whisky 22x2mm (Merino)", 1.74, "canto"],
  ["Tapacanto Whisky 40x0.45mm (Merino)", 1.60, "canto"],
  ["Tapacanto White Oak 22x0.45mm (Sonoma)", 0.97, "canto"],
  ["Tapacanto White Oak 22x2mm", 1.80, "canto"],
  ["Tapacanto White Oak 34x2mm (Madex)", 2.34, "canto"],
  ["Tapacanto Woodline 22x2mm (Alba)", 2.17, "canto"],
  ["Tapatornillo Alaska Z807", 1.00, "canto"],
  ["Tapatornillo Alba Lineal Z547", 0.92, "canto"],
  ["Tapatornillo Almendra 3375", 1.00, "canto"],
  ["Tapatornillo Blanco 1019", 1.00, "canto"],
  ["Tapatornillo Canyon-Odisea-Machiato-Capuchino-Canela", 1.00, "canto"],
  ["Tapatornillo Capuchino", 1.00, "canto"],
  ["Tapatornillo Castaño Z612", 0.92, "canto"],
  ["Tapatornillo Casual Z636", 1.00, "canto"],
  ["Tapatornillo Cedro", 1.00, "canto"],
  ["Tapatornillo Cenizo-Olmo Gris", 0.92, "canto"],
  ["Tapatornillo Century Z651", 1.00, "canto"],
  ["Tapatornillo Chiavena Z625", 0.92, "canto"],
  ["Tapatornillo Chocolate Z548", 1.00, "canto"],
  ["Tapatornillo Croma Z554", 0.99, "canto"],
  ["Tapatornillo Dolcetto-Bavaria", 0.99, "canto"],
  ["Tapatornillo Duquesa Z755", 1.00, "canto"],
  ["Tapatornillo Frasino", 0.92, "canto"],
  ["Tapatornillo Galerna-Queen", 1.00, "canto"],
  ["Tapatornillo Grafito 7634", 1.22, "canto"],
  ["Tapatornillo Gris Nube 7203", 1.00, "canto"],
  ["Tapatornillo Gris Suave S595", 0.92, "canto"],
  ["Tapatornillo Haya Cabriel-Roble Buralo", 1.00, "canto"],
  ["Tapatornillo Hercules Z644", 1.00, "canto"],
  ["Tapatornillo Jenjibre (Garden)", 1.00, "canto"],
  ["Tapatornillo Larice Z613", 1.00, "canto"],
  ["Tapatornillo Liberty-Wengue", 1.00, "canto"],
  ["Tapatornillo Machiato", 1.00, "canto"],
  ["Tapatornillo Mallorca Z811", 1.00, "canto"],
  ["Tapatornillo Marquina Z870", 0.92, "canto"],
  ["Tapatornillo Monaco Z814", 0.92, "canto"],
  ["Tapatornillo Musa Z665", 1.00, "canto"],
  ["Tapatornillo Negro-Marquina", 0.99, "canto"],
  ["Tapatornillo Ninfa Z809", 1.00, "canto"],
  ["Tapatornillo Odisea Z730", 1.00, "canto"],
  ["Tapatornillo Olmogris Z505", 0.92, "canto"],
  ["Tapatornillo Palmeira-Whisky-Alaska", 0.92, "canto"],
  ["Tapatornillo Panela", 1.90, "canto"],
  ["Tapatornillo Pegaso Z653", 1.00, "canto"],
  ["Tapatornillo Perillo Z568", 0.92, "canto"],
  ["Tapatornillo Pietra Caspio Z961", 0.92, "canto"],
  ["Tapatornillo Plasticos Blanco", 2.21, "canto"],
  ["Tapatornillo Plasticos Negro", 2.45, "canto"],
  ["Tapatornillo Platino Z642", 1.00, "canto"],
  ["Tapatornillo Queens Z716", 1.00, "canto"],
  ["Tapatornillo Quinera Z759", 1.00, "canto"],
  ["Tapatornillo Roble Buralo Z566", 0.92, "canto"],
  ["Tapatornillo Roble Cafe Z611", 1.00, "canto"],
  ["Tapatornillo Roble Canela Z549", 1.00, "canto"],
  ["Tapatornillo Rojo 0195", 0.92, "canto"],
  ["Tapatornillo Rovere Z614", 0.99, "canto"],
  ["Tapatornillo Sapelly Z608", 1.00, "canto"],
  ["Tapatornillo Siberia Z810", 0.92, "canto"],
  ["Tapatornillo Sonoma-Perillo", 0.92, "canto"],
  ["Tapatornillo Taupe", 1.00, "canto"],
  ["Tapatornillo Texas", 1.50, "canto"],
  ["Tapatornillo Textil Atlantico Z959", 0.92, "canto"],
  ["Tapatornillo Textil Celta Z640", 1.00, "canto"],
  ["Tapatornillo Textil Iberico Z609", 1.00, "canto"],
  ["Tapatornillo Textil Lienzo Z758", 1.00, "canto"],
  ["Tapatornillo Textil Luso Z610", 1.00, "canto"],
  ["Tapatornillo Verde Glacial", 1.20, "canto"],
  ["Tapatornillo Whisky Z808", 0.92, "canto"],
  ["Tapatornillos Blanco PVC", 1.90, "canto"],
  ["Tapatornillos Bourbon Cherry", 1.76, "canto"],
  ["Tapatornillos Manitoba Maple", 1.86, "canto"],
  ["Tapatornillos Negro 25103", 1.95, "canto"],
  ["Tapatornillos Polished Chrome", 2.60, "canto"]
];

const IMECA_PRICE_LIST_9 = [
  ["Esquina Externa Gola 90° Gris", 1.50, "cerraduras"],
  ["Esquina Interna Gola 90° Gris", 1.50, "cerraduras"],
  ["Esquina Interna Gola \"L\"", 3.36, "cerraduras"],
  ["Esquinero \"C\" Interno Gola", 3.02, "cerraduras"],
  ["Esquinero Gola \"L\"", 3.06, "cerraduras"],
  ["Esquinero Interno Gola L Negro", 3.32, "cerraduras"],
  ["Gola en C Negro IMEX", 43.92, "cerraduras"],
  ["Gola en C Silver", 33.42, "cerraduras"],
  ["Gola en \"L\" BN 3.95mts", 26.19, "cerraduras"],
  ["Gola en U 2mts", 42.26, "cerraduras"],
  ["Gola en Vertical \"L\" 2.35mts", 41.45, "cerraduras"],
  ["Gola \"L\" Horiz Negro", 34.71, "cerraduras"],
  ["Gola Negra 4M Volpato", 33.42, "cerraduras"],
  ["Gola Vertical \"C\" 2.35mts", 61.54, "cerraduras"],
  ["Perfil Aluminio Gola C", 27.50, "cerraduras"],
  ["Perfil Aluminio Gola C Negro Mate MD", 26.50, "cerraduras"],
  ["Perfil Aluminio Gola L", 26.50, "cerraduras"],
  ["Perfil Aluminio Gola L Negro Mate", 26.50, "cerraduras"],
  ["Perfil Gola Plateada 4M Volpato", 33.42, "cerraduras"],
  ["Soporte Gola", 1.80, "cerraduras"],
  ["Tapa Gola \"L\"", 1.18, "cerraduras"],
  ["Terminal Gola \"L\" Nickel", 1.63, "cerraduras"],
  ["Esquinero para Rodapie 10cm Negro", 0.95, "cerraduras"],
  ["Esquinero para Rodapie 10cm Plateado", 0.95, "cerraduras"],
  ["Esquinero para Rodapie 3M", 17.77, "cerraduras"],
  ["Esquinero para Rodapie Negro 15cm", 1.15, "cerraduras"],
  ["Esquinero para Rodapie Negro 3M", 16.00, "cerraduras"],
  ["Esquinero para Rodapie Plateado 15cm", 1.15, "cerraduras"],
  ["Esquinero para Rodapie Plateado 15cm Volvato", 2.90, "cerraduras"],
  ["Mecha para Router Moldura con Balero 1-1/2x3/4\" Surtek", 9.24, "herramientas"],
  ["Moldura Plastica 20x10mmx3m (3/4)", 1.72, "cerraduras"],
  ["Moldura Plastica 30x10mmx3m (1)", 3.19, "cerraduras"],
  ["Perfil P/Luz LED con Pantalla", 8.66, "herramientas"],
  ["Perfilador de Canto Virutex", 48.27, "herramientas"],
  ["Perfilador de Cantos Doble Virutex", 26.90, "herramientas"],
  ["Rodapie 100mm Negro 3M", 17.00, "cerraduras"],
  ["Rodapie 100mm Negro 3M Volpato", 18.20, "cerraduras"],
  ["Rodapie 100mm Plateado 3M Volpato", 15.00, "cerraduras"],
  ["Rodapie 150mm Negro 3M", 25.00, "cerraduras"],
  ["Rodapie 150mm Negro 3M Volpato", 29.31, "cerraduras"],
  ["Rodapie 150mm Plateado 3M Volpato", 29.31, "cerraduras"],
  ["Rodapie Dorado 100mm", 18.90, "cerraduras"],
  ["Rodapie Plano 100mm 3M", 15.00, "cerraduras"],
  ["Rodapie Plano 150mm 3M", 20.00, "cerraduras"],
  ["Union Rodapie 15cm", 2.00, "cerraduras"],
  ["Union Rodapie 3M", 13.68, "cerraduras"]
];

const IMECA_PRICE_LIST_10 = [
  ["Tirador 96mm BN Serie 448717", 2.44, "jaladores"],
  ["Bisagra Curva Blum Clip 100° Full-Crakerd S/Pasador", 1.40, "bisagras"],
  ["Bisagra Semi-Curva Blum Clip 100° Half-Crakerd S/Pasador", 1.59, "bisagras"],
  ["Cerradura de Pomo 5 Llaves", 9.94, "cerraduras"],
  ["Cerradura de Pomo S/Llave Baño", 8.15, "cerraduras"],
  ["Cerradura Pomo S/Llave SS", 7.35, "cerraduras"],
  ["Grifo D/Baño Manija Individual CR", 92.56, "organizacion"],
  ["Grifo D/Baño U/Sola Manija Acabado NK", 102.96, "organizacion"],
  ["Manija Brown Modelos Varios", 0.93, "jaladores"],
  ["Manilla Catania Satinada", 38.28, "jaladores"],
  ["Manilla Florence Satinada", 36.18, "jaladores"],
  ["Manilla Livorno Cromo", 40.48, "jaladores"],
  ["Manilla Livorno Satinada", 39.80, "jaladores"],
  ["Manilla Milano Satinada", 39.86, "jaladores"],
  ["Manilla Modica Satinada", 38.28, "jaladores"],
  ["Manilla Sienna Satinada", 38.28, "jaladores"],
  ["Pasador/Portacandado Varios Brown", 0.93, "cerraduras"],
  ["Potasa Granulada 8onz", 1.42, "herramientas"],
  ["Potasa Liquida 32onz", 3.15, "herramientas"],
  ["Soporte P/Tubo Oval S/Pasadores", 0.51, "organizacion"],
  ["Soporte P/Tubo Oval S/Pasadores Negro", 0.51, "organizacion"],
  ["Tirador 128mm BN Serie 44871", 2.92, "jaladores"],
  ["Tirador 128mm Dorado Anonizado", 3.55, "jaladores"],
  ["Tirador 128mm MBK Serie 44871", 2.72, "jaladores"],
  ["Tirador 128mm MBK Serie 45676", 4.22, "jaladores"],
  ["Tirador 128mm Negro Serie 45557", 3.25, "jaladores"],
  ["Tirador 128mm Negro Serie 45675", 4.69, "jaladores"],
  ["Tirador 1439 Serie C/C 5\"", 3.22, "jaladores"],
  ["Tirador 160mm BN Serie 1439", 3.18, "jaladores"],
  ["Tirador 160mm BN Serie 45557", 4.31, "jaladores"],
  ["Tirador 160mm Dorado Anonizado", 3.97, "jaladores"],
  ["Tirador 160mm MBK Serie 45676", 5.17, "jaladores"],
  ["Tirador 160mm Negro Serie 44871", 3.06, "jaladores"],
  ["Tirador 160mm Negro Serie 45557", 4.73, "jaladores"],
  ["Tirador 192 Dorado Anonizado", 4.41, "jaladores"],
  ["Tirador 192mm Negro Serie 44871", 4.01, "jaladores"],
  ["Tirador 192mm Negro Serie 45675", 5.96, "jaladores"],
  ["Tirador 224mm BN Serie 45557", 5.98, "jaladores"],
  ["Tirador 224mm Negro", 6.43, "jaladores"],
  ["Tirador 320mm BN Serie 45557", 8.67, "jaladores"],
  ["Tirador 320mm Negro", 8.76, "jaladores"],
  ["Tirador 44407 Series C/C 5\"", 3.20, "jaladores"],
  ["Tirador 45260 Serie C/C224 O/A 249", 5.42, "jaladores"],
  ["Tirador 45260 Serie C/C96 O/A156", 3.04, "jaladores"],
  ["Tirador 8525 Serie C/C 3 3/4\"", 2.65, "jaladores"],
  ["Tirador 8525 Serie C/C 5\"", 2.98, "jaladores"],
  ["Tirador 8525 Serie C/C 6 1/4\"", 3.72, "jaladores"],
  ["Tirador 8536 Serie C/C 3 3/4\"", 2.44, "jaladores"],
  ["Tirador 8536 Serie C/C 5\"", 2.72, "jaladores"],
  ["Tirador 8536 Serie C/C 6 1/4\"", 3.30, "jaladores"],
  ["Tirador 855 Serie C/C 3 3/4\"", 2.50, "jaladores"],
  ["Tirador 855 Serie C/C 5\"", 2.90, "jaladores"],
  ["Tirador 855 Serie C/C 6 1/4\"", 3.98, "jaladores"],
  ["Tirador 8655 Serie C/C 5\" O/A 5 3/8\"", 2.42, "jaladores"],
  ["Tirador 8655 Serie C/C 6 1/4\" O/A 7 5/8\"", 3.20, "jaladores"],
  ["Tirador 8655 Serie C/C 7 1/2\" O/A 9\"", 4.02, "jaladores"],
  ["Tirador 8655 Serie C/C 8 3/4\" O/A10 5/8\"", 5.85, "jaladores"],
  ["Tirador 8687 Serie C/C 3 3/4\"", 2.40, "jaladores"],
  ["Tirador 8687 Serie C/C 5\"", 3.27, "jaladores"],
  ["Tirador 8687 Serie C/C 6 1/4\"", 3.58, "jaladores"],
  ["Tirador 96mm BN Serie 44871", 2.44, "jaladores"],
  ["Tirador 96mm BN Serie 45557", 2.90, "jaladores"],
  ["Tirador 96mm BN Serie 45675", 3.12, "jaladores"],
  ["Tirador 96mm Dorado Anonizado", 3.16, "jaladores"],
  ["Tirador 96mm MBK Serie 44871", 2.43, "jaladores"],
  ["Tirador 96mm Negro Serie 45675", 3.74, "jaladores"],
  ["Tirador 96mm Negro Serie 45676", 3.60, "jaladores"],
  ["Tirador Acero en T 35mm Largo", 1.19, "jaladores"],
  ["Tirador Aluminio 128mm Ref 51041", 2.86, "jaladores"],
  ["Tirador Aluminio 150mm", 3.15, "jaladores"],
  ["Tirador Aluminio 160mm Ref 51041", 3.16, "jaladores"],
  ["Tirador Aluminio 192mm", 3.54, "jaladores"],
  ["Tirador Aluminio 224mm", 4.00, "jaladores"],
  ["Tirador Aluminio 90mm", 2.52, "jaladores"],
  ["Tirador Aluminio 96mm Ref 51041", 2.52, "jaladores"],
  ["Tirador Aluminio Negro 128mm Ref 51041", 2.66, "jaladores"],
  ["Tirador Aluminio Negro 160mm Ref 51041", 2.93, "jaladores"],
  ["Tirador Arco Serie 5000 128mm C/C 5\"", 1.70, "jaladores"],
  ["Tirador Arco Serie 5000 160mm C/C 6 1/4\"", 2.43, "jaladores"],
  ["Tirador Arco Serie 5000 192mm C/C 7 1/2\"", 2.73, "jaladores"],
  ["Tirador Arco Serie 5000 224mm C/C 8 3/4\"", 3.04, "jaladores"],
  ["Tirador Arco Serie 5000 96mm C/C 3 3/4\"", 1.57, "jaladores"],
  ["Tirador Bar 9523 C/C 3\" O/A 5 3/4\"", 1.30, "jaladores"],
  ["Tirador Bar 9523 C/C 3\" O/A 5 3/4\" Negro", 1.70, "jaladores"],
  ["Tirador Bar 9524 C/C 3 3/4\" O/A 7\"", 3.09, "jaladores"],
  ["Tirador Bar 9524 C/C 3 3/4\" O/A 7\" Negro", 1.88, "jaladores"],
  ["Tirador Bar 9525 C/C 7\" O/A 10\"", 3.50, "jaladores"]
];

const IMECA_PRICE_LIST_11 = [
  ["Tirador Bar 9525 C/C 7\" O/A 10\" Negro", 2.40, "jaladores"],
  ["Tirador Bar 9526 C/C 9 3/4\" O/A13\"", 3.11, "jaladores"],
  ["Tirador Bar 9526 C/C9 3/4\" O/A 13\" Negro", 3.56, "jaladores"],
  ["Tirador Bar 9527 C/C12 3/4\" O/A16\"", 3.88, "jaladores"],
  ["Tirador Bar 9528 480mm 19\"", 3.77, "jaladores"],
  ["Tirador Bar 9529 C/C18 3/4\" O/A22\"", 4.52, "jaladores"],
  ["Tirador Bar 9530 C/C21 3/4\" O/A25\"", 5.14, "jaladores"],
  ["Tirador Bar 9531 C/C24 3/4\" O/A28\"", 5.28, "jaladores"],
  ["Tirador Bar 9532 C/C30 3/4\" O/A34\"", 7.86, "jaladores"],
  ["Tirador C/C 128mm O/A 156mm Niquel", 6.16, "jaladores"],
  ["Tirador CC128mm A/C150mm", 5.50, "jaladores"],
  ["Tirador Closet Aluminio 260mm", 26.62, "jaladores"],
  ["Tirador Cuadrada C/C 160mm O/A 189mm Niq", 10.16, "jaladores"],
  ["Tirador Cuadrada C/C 256mm O/A 285mm Cro", 8.70, "jaladores"],
  ["Tirador Cuadrada C/C 384mm O/A 409mm Cr", 10.80, "jaladores"],
  ["Tirador Cuadrada C/C 384mm O/A 409mm Niq", 10.18, "jaladores"],
  ["Tirador Cuadrado de 19x152mm Brillante", 33.47, "jaladores"],
  ["Tirador Cuadrado de 19x152mm Satinado", 43.51, "jaladores"],
  ["Tirador Cuadrado de 19x305mm Satinado", 37.67, "jaladores"],
  ["Tirador Cuadrado de 19x305mm Brillante", 38.51, "jaladores"],
  ["Tirador de Acero C/C 3 3/4\" O/A5 1/4\"", 1.53, "jaladores"],
  ["Tirador Dorado 128mm Ref 44686", 3.47, "jaladores"],
  ["Tirador Dorado 96mm Ref44686", 2.21, "jaladores"],
  ["Tirador Embutido 85x38mm", 1.72, "jaladores"],
  ["Tirador Embutido C/C128mm A/C 141mm", 6.35, "jaladores"],
  ["Tirador Embutido C/C160mm A/C 173mm", 9.27, "jaladores"],
  ["Tirador Embutido Media Luna 60mm", 2.38, "jaladores"],
  ["Tirador Embutido Media Luna 70mm", 2.45, "jaladores"],
  ["Tirador Empotrado 128mm Negro Serie 80669", 5.85, "jaladores"],
  ["Tirador Empotrado 160mm Negro", 9.10, "jaladores"],
  ["Tirador en Forma C Satinado", 27.75, "jaladores"],
  ["Tirador en T Negro Serie 51608", 0.71, "jaladores"],
  ["Tirador en T Plano 1 3/4\"", 1.84, "jaladores"],
  ["Tirador K1 Negro", 0.90, "jaladores"],
  ["Tirador Negro Serie 1439 160mm", 3.76, "jaladores"],
  ["Tirador O/A 75mm MBK Serie 51193", 2.00, "jaladores"],
  ["Tirador Perilla 64mm Dorado Anonizado", 2.35, "jaladores"],
  ["Tirador Perilla 64mm Negro", 2.35, "jaladores"],
  ["Tirador Perilla Aluminio 18mm", 1.19, "jaladores"],
  ["Tirador Recto 128mm", 1.49, "jaladores"],
  ["Tirador Recto 160mm", 1.77, "jaladores"],
  ["Tirador Recto 256mm", 2.35, "jaladores"],
  ["Tirador Recto 96mm", 1.14, "jaladores"],
  ["Tirador Satinado de 120mm", 71.95, "jaladores"],
  ["Tirador Semicircular para Vidrio o Aluminio Dist. Ejes 305mm", 50.39, "jaladores"],
  ["Tirador SS Cuadrado 176mm/253mm", 11.94, "jaladores"],
  ["Tirador SS Cuadrado 76mm/146mm", 7.54, "jaladores"],
  ["Tirador SS Cuadrado 96mm/178mm", 7.94, "jaladores"],
  ["Tirador Tipo Dedo O/A 150mm Cromado", 3.00, "jaladores"],
  ["Tirador Tipo Dedo O/A 150mm Niquelado", 3.10, "jaladores"],
  ["Tirador Tipo Dedo O/A 230mm Cromado", 3.70, "jaladores"],
  ["Tirador Tipo Dedo O/A 230mm Niquelado", 4.05, "jaladores"],
  ["Tirador Tipo Dedo O/A 45mm Cromado", 1.80, "jaladores"],
  ["Tirador Tipo Dedo O/A 45mm Niquelado", 1.75, "jaladores"],
  ["Tirador Tipo Dedo O/A 75mm Cromado", 2.22, "jaladores"],
  ["Tirador Tipo Dedo O/A 75mm Niquelado", 2.53, "jaladores"],
  ["Tirador Zinc C/C 128mm O/A 156mm Cromad", 4.46, "jaladores"],
  ["Tirador Zinc C/C 128mm O/A 160mm Cromad", 3.10, "jaladores"],
  ["Tirador Zinc C/C 128mm O/A 160mm Niquel", 3.86, "jaladores"],
  ["Tirador Zinc C/C 192mm O/A 210mm Cromad", 4.83, "jaladores"],
  ["Tirador Zinc C/C 192mm O/A 210mm Niquel", 6.94, "jaladores"],
  ["Tirador Zinc C/C 192mm O/A 220mm Cromad", 6.38, "jaladores"],
  ["Tirador Zinc C/C 192mm O/A 220mm Niquel", 6.71, "jaladores"],
  ["Tirador Zinc C/C 192mm O/A 225mm Niquel", 4.22, "jaladores"],
  ["Tirador Zinc C/C 192mm O/A 255mm Cromad", 3.98, "jaladores"],
  ["Tirador Zinc C/C 256mm O/A 274mm Cromad", 6.50, "jaladores"],
  ["Tirador Zinc C/C 256mm O/A 274mm Niquel", 7.75, "jaladores"],
  ["Tirador Zinc C/C224mm O/A 249mm Cromado", 4.80, "jaladores"],
  ["Tirador Zinc C/C256mm O/A 285mm", 9.93, "jaladores"],
  ["Tirador Cuadrado de 13x19x610mm Brillante", 62.46, "jaladores"],
  ["Tornillo Multi Tamaño P/Tirador", 7.48, "jaladores"]
];

const IMECA_PRICE_LIST_12 = [
  ["Bisagra 3\"x2\" Galvanizado", 2.23, "bisagras"],
  ["Bisagra 35mm Curva Corta", 0.68, "bisagras"],
  ["Bisagra Articulada", 4.91, "bisagras"],
  ["Bisagra Cangrejo Gde", 2.38, "bisagras"],
  ["Bisagra Cangrejo Pequeña", 2.20, "bisagras"],
  ["Bisagra Cierre Lento 35mm Curva IMEX", 1.75, "bisagras"],
  ["Bisagra Cierre Lento Recta (MD)", 1.50, "bisagras"],
  ["Bisagra de Piano 1\"x1M Total", 2.66, "bisagras"],
  ["Bisagra de Piso Vaiven", 17.62, "bisagras"],
  ["Bisagra de Presion Blanca", 1.46, "bisagras"],
  ["Bisagra de Presion Cromada", 1.43, "bisagras"],
  ["Bisagra Doble Accion 3\"", 5.07, "bisagras"],
  ["Bisagra Doble Accion 4\"", 11.59, "bisagras"],
  ["Bisagra IMEX Curva S/P", 0.66, "bisagras"],
  ["Bisagra IMEX Semi-Curva S/P", 0.66, "bisagras"],
  ["Bisagra Invisible 100mm W/O Tornillo B-N", 12.71, "bisagras"],
  ["Bisagra Invisible 118mm W/O Tornillo B-N", 18.24, "bisagras"],
  ["Bisagra Invisible 45mm Negra", 3.03, "bisagras"],
  ["Bisagra Invisible 45mm W/O Tornillo B-NK", 3.86, "bisagras"],
  ["Bisagra Invisible 60mm", 4.97, "bisagras"],
  ["Bisagra Invisible 60mm Negra", 3.87, "bisagras"],
  ["Bisagra Invisible 70mm Negra", 5.74, "bisagras"],
  ["Bisagra Invisible 70mm W/O Tornillo B-NK", 7.15, "bisagras"],
  ["Bisagra Mariposa 4\"x3\" Total", 3.25, "bisagras"],
  ["Bisagra Plana 55x35x7mm (Por Unidad)", 1.85, "bisagras"],
  ["Bisagra Plana 65.5x40x12 (Por Unidad)", 2.87, "bisagras"],
  ["Bisagra Plana 78.5x30x2.2mm", 1.75, "bisagras"],
  ["Bisagra Recta 165°", 3.37, "bisagras"],
  ["Bisagra Recta 165° Cierre Lento", 4.91, "bisagras"],
  ["Bisagra Recta Cierre Lento (MD)", 1.35, "bisagras"],
  ["Bisagra Servodrive Ajuste 3D", 31.00, "bisagras"],
  ["Bisagra Sujetador 135°", 2.68, "bisagras"],
  ["Bisagra Sujetador 45°", 1.12, "bisagras"],
  ["Bisagra Sujetador Revestimiento/C C=0 C/P", 0.66, "bisagras"],
  ["Broca Bisagra 25mm Total", 4.67, "herramientas"],
  ["Broca Bisagra 35mm Hoteche", 8.94, "herramientas"],
  ["LED para Bisagra", 0.95, "bisagras"],
  ["Maquina Perforadora de Bisagra", 310.00, "herramientas"],
  ["Barndoorkit Flat Riel 6.5 BL", 133.00, "bisagras"],
  ["Barndoorkit Riel 6.5 Soft", 332.51, "bisagras"],
  ["Barndoorkit Riel Top 6.5 Soft", 259.00, "bisagras"],
  ["Barndoorkit Riel Top 6.55 SS", 215.00, "bisagras"],
  ["Corredera 10\" Push Open", 5.55, "bisagras"],
  ["Corredera 12\" Push Open", 6.25, "bisagras"],
  ["Corredera 14\"- 35cm (IMEX)", 4.35, "bisagras"],
  ["Corredera 14\" Push Open", 7.25, "bisagras"],
  ["Corredera 16\"- 40cm (IMEX)", 4.65, "bisagras"],
  ["Corredera 16\" Push Open", 8.25, "bisagras"],
  ["Corredera 18\"- 45cm (IMEX)", 4.95, "bisagras"],
  ["Corredera 18\" Push Open", 8.95, "bisagras"],
  ["Corredera 20\"- 50cm (IMEX)", 5.50, "bisagras"],
  ["Corredera 20\" Push Open", 9.25, "bisagras"],
  ["Corredera 22\"- 55cm (IMEX)", 5.95, "bisagras"],
  ["Corredera 22\" Push Open", 9.50, "bisagras"],
  ["Corredera 350mm Negras", 4.50, "bisagras"],
  ["Corredera Caja Blanco 204x500mm", 41.21, "bisagras"],
  ["Corredera Caja Blanco 86x500mm", 34.71, "bisagras"],
  ["Corredera Cierre Suave 18\" 45cm", 7.50, "bisagras"],
  ["Corredera Lento 10\"-25cm", 6.00, "bisagras"],
  ["Corredera Lento 12\"-30cm", 6.25, "bisagras"],
  ["Corredera Lento 14\"-35cm", 7.50, "bisagras"],
  ["Corredera Lento 16\"-40cm", 8.25, "bisagras"],
  ["Corredera Lento 18\"-45cm", 8.75, "bisagras"],
  ["Corredera Lento 20\"-50cm", 9.25, "bisagras"],
  ["Corredera Lento 22\"-55cm", 9.50, "bisagras"],
  ["Corredera Lento 24\"-60cm", 10.90, "bisagras"],
  ["Corredera Metalica para Gaveta 149mm 6\"x16\"", 8.30, "bisagras"],
  ["Corredera Metalica para Gaveta 149mm 6\"x18\"", 8.65, "bisagras"],
  ["Corredera Metalica para Gaveta 85mm 4\"x18\"", 5.66, "bisagras"],
  ["Corredera Metalica para Gaveta 864mm x16\"", 5.61, "bisagras"],
  ["Corredera P/Teclado 300mm", 4.04, "bisagras"],
  ["Corredera Tandenbox 4\" 350x150mm", 25.91, "bisagras"],
  ["Corredera Tandenbox 4\" 500x100mm", 31.45, "bisagras"],
  ["Corredera Tandenbox 500x150mm", 37.06, "bisagras"],
  ["Corredera Tandenbox 6\" 350x150mm", 34.95, "bisagras"],
  ["Corredera UM 18\" Blum", 21.91, "bisagras"],
  ["Corredera Under 12\"-30", 17.13, "bisagras"],
  ["Corredera Under 15\"-38", 18.81, "bisagras"],
  ["Corredera Under 18\"-45", 20.61, "bisagras"],
  ["Corredera Under 21\"-53", 21.91, "bisagras"],
  ["Corredera Under 9\"-23", 16.01, "bisagras"],
  ["Correderas Blanca 12\"-30cm IMEX", 1.18, "bisagras"],
  ["Correderas Blanca 14\"-35cm IMEX", 1.40, "bisagras"],
  ["Correderas Blanca 16\"-40cm IMEX", 1.55, "bisagras"],
  ["Correderas Blancas 18\"-45cm IMEX", 2.82, "bisagras"],
  ["Correderas Blancas 20\"-50cm IMEX", 1.74, "bisagras"],
  ["Correderas Blancas 22\"-55cm IMEX", 1.79, "bisagras"],
  ["Kit Closet con Riel 3mts Todo U28-35", 78.00, "bisagras"],
  ["Riel Inferior T901A IMEX", 4.62, "bisagras"],
  ["Riel Inferior T901A IMEX 1 Pta", 2.15, "bisagras"],
  ["Riel PL25 2M PL2550 Ducase", 29.34, "bisagras"],
  ["Riel PL25 para PL2550 3M Perforado", 69.49, "bisagras"],
  ["Riel U21 3mts para DN 80", 94.24, "bisagras"],
  ["Sistema Tip-On P/Corredera Blum", 21.91, "bisagras"],
  ["Tip-On Blumotion P/Corredera Blum", 21.91, "bisagras"]
];

const IMECA_PRICE_LIST_13 = [
  ["Candado Antisisalla Rectangular Total", 12.19, "cerraduras"],
  ["Candado de Laton 40mm Brown", 0.93, "cerraduras"],
  ["Candado Tipo Disco 60mm Brown", 0.93, "cerraduras"],
  ["Cerradura Brown Modelo Varios", 2.80, "cerraduras"],
  ["Cerradura Cuadrada Cromo", 42.63, "cerraduras"],
  ["Cerradura Cuadrada Satinada", 39.80, "cerraduras"],
  ["Cerradura Cuadrada Satinado", 40.66, "cerraduras"],
  ["Cerradura Garra de Tigre Beige", 26.49, "cerraduras"],
  ["Cerradura Jinox Modelos Varios", 9.35, "cerraduras"],
  ["Cerradura Para Mueble", 2.20, "cerraduras"],
  ["Cerradura Para Mueble Economica por Unidad", 2.96, "cerraduras"],
  ["Cerradura Redonda Cromo", 39.80, "cerraduras"],
  ["Cerradura Redonda Satinada", 37.66, "cerraduras"],
  ["Cinta 1M Tipo Llavero", 1.00, "cerraduras"],
  ["Juego de Brocas para Instalar Cerradura 4 Pcs", 6.30, "herramientas"],
  ["Juego de Llaves Hexagonales Tipo T 8 Pzas", 10.22, "herramientas"],
  ["Juego Llaves Exagonales 9 Piezas", 4.20, "herramientas"],
  ["Kit Juego Llave Allen 9 Pzas Total", 5.00, "herramientas"],
  ["Llave Agua Fria", 22.00, "organizacion"],
  ["Reemplazo de Mandril sin Llave 3/8", 4.99, "cerraduras"],
  ["Piston 100N", 3.98, "cerraduras"],
  ["Piston 120N", 4.25, "cerraduras"],
  ["Piston 60N", 3.50, "cerraduras"],
  ["Piston Elevador P/Muebles 100 Newton", 3.90, "cerraduras"],
  ["Piston Elevador P/Muebles 120 Newton", 4.15, "cerraduras"],
  ["Piston Elevador P/Muebles 80 Newton", 3.21, "cerraduras"],
  ["Tornillo Elevador 1/4-20 x 1-1/2", 0.20, "cerraduras"],
  ["Base Organizador Ajustable Shel 6.5\"", 76.16, "organizacion"],
  ["Canasta de Metal para Fregadero", 3.36, "organizacion"],
  ["Canastilla Lavaplatos", 9.00, "organizacion"],
  ["Cesta Extraible en U para Mueble Lavaplato 30\"", 152.00, "organizacion"],
  ["Cesta Extraible Multiuso 600mm", 79.33, "organizacion"],
  ["Cesta Extraible Multiuso 900mm", 94.08, "organizacion"],
  ["Despensa de Madera 5 Piezas", 295.00, "organizacion"],
  ["Despensa de Madera 5 Piezas 11 13/16\"", 285.00, "organizacion"],
  ["Despensa de Madera 5 Piezas 15 3/4", 295.00, "organizacion"],
  ["Despensa de Metal 5 Piezas 11 13/16", 285.00, "organizacion"],
  ["Despensa de Metal 5 Piezas 15 3/4\"", 285.00, "organizacion"],
  ["Despensa Extraible 400mm 6 Pzas", 340.00, "organizacion"],
  ["Despensa Extraible 600mm 6 Pzas", 350.00, "organizacion"],
  ["Escurridor de Platos 800mm", 32.60, "organizacion"],
  ["Escurridor de Platos 900mm", 37.85, "organizacion"],
  ["Especiero 440x130x450 (Botellero)", 46.95, "organizacion"],
  ["Esquinero M/G 900mm Der Mat", 250.00, "organizacion"],
  ["Esquinero M/G 900mm Izq Mat", 250.00, "organizacion"],
  ["Lavaplatos 84x56 Blanco", 139.00, "organizacion"],
  ["Lavaplatos Koa 63x51", 125.46, "organizacion"],
  ["Magic Corner Esquinero Derecho", 245.00, "organizacion"],
  ["Magic Corner Esquinero Izquierdo", 298.81, "organizacion"],
  ["Organizador 13 3/4 D/Base", 49.92, "organizacion"],
  ["Organizador D/Base Der. Montado 11 7/8\"", 125.00, "organizacion"],
  ["Organizador D/Base Der. Montado 5 15/16\"", 82.86, "organizacion"],
  ["Organizador D/Base Der. Montado 7 7/8\"", 95.00, "organizacion"],
  ["Organizador D/Base Izq. Montado 11 7/8\"", 125.00, "organizacion"],
  ["Organizador D/Base Izq. Montado 5 15/16\"", 83.20, "organizacion"],
  ["Organizador D/Base Izq. Montado 7 7/8\"", 95.00, "organizacion"],
  ["Organizador de Cubiertos 500mm", 10.00, "organizacion"],
  ["Organizador de Cubiertos 600mm", 12.00, "organizacion"],
  ["Organizador de Cubiertos 900mm", 15.00, "organizacion"],
  ["Salpicadero P/Lavaplatos de Aluminio 876mm x591mm", 16.99, "organizacion"],
  ["Basurero Doble Blanco IMEX", 110.00, "organizacion"],
  ["Basurero Doble Negro IMEX", 110.00, "organizacion"],
  ["Basurero Redondo 15L Polis", 38.00, "organizacion"],
  ["Basurero Sencillo Blanco IMEX", 85.00, "organizacion"],
  ["Basurero Sencillo Negro IMEX", 85.00, "organizacion"],
  ["Basurero Soft-C Sencillo Silver/Chrome 35QT", 147.22, "organizacion"],
  ["Basurero Soft-C Sencillo Silver/Chrome 50QT", 157.00, "organizacion"],
  ["Basurero Soft-C Sencillo White/Chrome 35QT", 85.00, "organizacion"],
  ["Basurero Soft-C Sencillo White/Chrome 50QT", 154.00, "organizacion"],
  ["Corbatero 14\"", 58.06, "organizacion"],
  ["Kit Closet T306 60kg IMEX", 41.45, "organizacion"],
  ["Kit Closet T312C 50kg", 32.51, "organizacion"],
  ["Kit Closet T316B IMEX", 31.02, "organizacion"],
  ["Kit Closet T409B IMEX 50kg", 52.89, "organizacion"],
  ["Kit Closet T901A IMEX", 20.36, "organizacion"],
  ["Kit Closet T902 20kg", 64.53, "organizacion"],
  ["Kit Zapatero Negro 200x260mm", 4.90, "organizacion"],
  ["Kit Zapatero Negro 260x255mm 3Capas", 3.50, "organizacion"],
  ["Soporte P/Tubo Oval Central Cromado", 1.09, "organizacion"],
  ["Soporte P/Tubo Oval Central Negro", 0.97, "organizacion"],
  ["Soporte P/Tubo Oval Central Satinado", 0.97, "organizacion"],
  ["Soporte P/Tubo Oval Esquinero Cromado", 2.64, "organizacion"],
  ["Soporte P/Tubo Oval Esquinero Satinado", 2.63, "organizacion"],
  ["Soporte P/Tubos Redondo Completo", 1.49, "organizacion"],
  ["Soporte P/Tubos Redondo Media Luna", 1.39, "organizacion"],
  ["Tubo Oval Aluminio Liso Closet 30x15x8mm", 11.49, "organizacion"],
  ["Tubo Oval Closet 30x15x0.7mm Negro", 7.07, "organizacion"],
  ["Tubo Oval Closet Cromado 30x15x0.7mm", 7.07, "organizacion"],
  ["Tubo Oval Madex 3mts", 16.00, "organizacion"],
  ["Tubo Redondo Closet 30x15x8mm", 9.90, "organizacion"]
];

const IMECA_PRICE_LIST_14 = [
  ["Angulo 1\"x1\" Dorado 10Unid", 1.50, "cerraduras"],
  ["Angulo para Fijar 1\"x1\"", 0.15, "cerraduras"],
  ["Angulo Plano 1 1/2\" 4Pcs", 1.21, "cerraduras"],
  ["Angulo Plano 2\" 4Pcs", 1.53, "cerraduras"],
  ["Bota Seguridad 39 Soporte Tobillo", 35.55, "herramientas"],
  ["Bota Seguridad 40 Soporte Tobillo", 38.03, "herramientas"],
  ["Bota Seguridad 41 Soporte Tobillo", 38.03, "herramientas"],
  ["Bota Seguridad 42 Soporte Tobillo", 36.84, "herramientas"],
  ["Bota Seguridad 44 Soporte Tobillo", 38.31, "herramientas"],
  ["Bota Seguridad 45 Soporte Tobillo", 35.87, "herramientas"],
  ["Conector para Cinta LED en L", 1.43, "herramientas"],
  ["Escuadra 2x2 4 Unid", 0.63, "cerraduras"],
  ["Escuadra 7\" de Aluminio", 3.49, "cerraduras"],
  ["Escuadra Angular de ABS", 3.88, "cerraduras"],
  ["Escuadra Angular de Acero 300mm", 6.85, "cerraduras"],
  ["Escuadra con Nivel", 4.12, "herramientas"],
  ["Escuadra de Aluminio 14\" 350mm", 6.24, "herramientas"],
  ["Escuadra de Combinacion Profesional", 7.90, "herramientas"],
  ["Escuadra de Esquina 90° 50x50mm", 1.10, "cerraduras"],
  ["Falsa Escuadra", 2.72, "herramientas"],
  ["Juego de Coples y Conectores", 8.75, "herramientas"],
  ["Mesa Escuadradora 5 en 1", 1677.00, "herramientas"],
  ["Set de 6 Escuadras Soldadura", 7.98, "herramientas"],
  ["Set Escuadra 50x50mm", 0.66, "cerraduras"],
  ["Soporte Aereo de Tablilla 10x100mm", 0.77, "cerraduras"],
  ["Soporte Aereo de Tablilla 12x120mm", 1.00, "cerraduras"],
  ["Soporte Aereo de Tablilla 10x145mm", 1.25, "cerraduras"],
  ["Soporte Cuchara 1/4 Niquelado 100 Und", 7.50, "cerraduras"],
  ["Soporte Cuchara 5mm Niquelado 100 Und", 4.34, "cerraduras"],
  ["Soporte D/Estante 5mm Blanco", 12.26, "cerraduras"],
  ["Soporte D/Estante 5mm Claro 100 Und", 11.90, "cerraduras"],
  ["Soporte D/Pared Reforzado 25cm", 3.80, "cerraduras"],
  ["Soporte D/Pared Reforzado 30cm", 4.48, "cerraduras"],
  ["Soporte D/Pared Reforzado 50cm", 7.16, "cerraduras"],
  ["Soporte de Pared 20cm Blanco", 2.17, "cerraduras"],
  ["Soporte de Pared 25cm Blanco", 2.37, "cerraduras"],
  ["Soporte de Pared 30cm Blanco", 2.72, "cerraduras"],
  ["Soporte de Taladro de 90°", 15.98, "herramientas"],
  ["Soporte de Vidrio Chrome", 3.71, "cerraduras"],
  ["Soporte de Vidrio Chrome 128", 2.22, "cerraduras"],
  ["Soporte de Vidrio Chrome 163", 5.61, "cerraduras"],
  ["Soporte de Vidrio Chrome 827", 3.24, "cerraduras"],
  ["Soporte de Vidrio Chromo", 4.44, "cerraduras"],
  ["Soporte de Vidrio Cromo", 1.57, "cerraduras"],
  ["Soporte de Vidrio Nickel", 2.99, "cerraduras"],
  ["Soporte de Vidrio Nickel 163", 5.21, "cerraduras"],
  ["Soporte de Vidrio Nickel 163-1", 5.97, "cerraduras"],
  ["Soporte de Vidrio Niquelado 127", 1.98, "cerraduras"],
  ["Soporte de Vidrio Niquelado 157", 3.23, "cerraduras"],
  ["Soporte para Botellas", 19.19, "organizacion"],
  ["Soporte para Guia", 24.39, "bisagras"],
  ["Soporte Trasero Under", 0.93, "bisagras"]
];

const IMECA_PRICE_LIST_15 = [
  ["Alcayata P/Cama T/Tornillo", 7.98, "cerraduras"],
  ["Anclaje de Pared Plastico Azul", 0.02, "cerraduras"],
  ["Anclaje de Pared Plastico Naranja", 0.06, "cerraduras"],
  ["Anclaje de Pared Plastico Verde", 0.80, "cerraduras"],
  ["Anclaje Expansible 1/2x90m", 2.06, "cerraduras"],
  ["Anclaje Expansible 1/4x50mm (A)", 0.73, "cerraduras"],
  ["Anclaje Expansible 3/16x50", 0.56, "cerraduras"],
  ["Anclaje Expansible 3/8x70mm", 1.44, "cerraduras"],
  ["Anclaje Expansible 5/16x60mm (A)", 0.96, "cerraduras"],
  ["Anclaje para Pared Hueca 1/4", 0.18, "cerraduras"],
  ["Anclaje para Pared Hueca M4x36 1/4", 0.24, "cerraduras"],
  ["Anclaje para Pared Hueca M5x52 5/16", 0.33, "cerraduras"],
  ["Anclaje para Pared Hueca M6x37 3/8", 0.30, "cerraduras"],
  ["Clavo 3\" 1Kg", 3.00, "cerraduras"],
  ["Clavo Acero 2 1/2\" 1Kg", 3.00, "cerraduras"],
  ["Clavo Azulado 2mm 1\"", 1.56, "cerraduras"],
  ["Clavo Azulado 2mm x 3/4\"", 1.28, "cerraduras"],
  ["Clavo Azulado 2mm x 5/8\"", 1.17, "cerraduras"],
  ["Clavo D/Des/Plastico 3/4 C/Plana 250 Und", 8.92, "cerraduras"],
  ["Clavo D/Des/Plastico 5/8 C/Plana 250 Und", 9.75, "cerraduras"],
  ["Clavo para CLNE-18 25mm", 4.25, "cerraduras"],
  ["Clavo para CLNE-18 32mm", 5.90, "cerraduras"],
  ["Clavo para CLNE-18 40mm", 6.49, "cerraduras"],
  ["Clavo para CLNE-18 50mm", 9.25, "cerraduras"],
  ["Clavo Serie F 15mm (171815)", 3.20, "cerraduras"],
  ["Clavo Serie F 20mm (171820)", 4.82, "cerraduras"],
  ["Clavo Serie F 25mm (171825)", 5.99, "cerraduras"],
  ["Clavo Serie F 40mm (171840)", 7.99, "cerraduras"],
  ["Clavo Serie F 50mm", 9.99, "cerraduras"],
  ["Clavos P/Pistola Neumatica 15mm Total", 2.70, "cerraduras"],
  ["Clavos P/Pistola Neumatica 20mm Total", 3.75, "cerraduras"],
  ["Clavos P/Pistola Neumatica 25mm Total", 5.09, "cerraduras"],
  ["Clavos P/Pistola Neumatica 30mm Total", 5.81, "cerraduras"],
  ["Clavos P/Pistola Neumatica 32mm Total", 6.35, "cerraduras"],
  ["Clavos P/Pistola Neumatica 40mm Total", 5.75, "cerraduras"],
  ["Clavos P/Pistola Neumatica 50mm Total", 8.14, "cerraduras"],
  ["Clavos para CLNE-16 25mm", 3.90, "cerraduras"],
  ["Engrapadora Neumatica Profesional", 26.97, "herramientas"],
  ["Gancho con Rosca y Anclaje Total", 2.08, "cerraduras"],
  ["Grapa para Clavadora de Aire 35mmx5.7mm (2500pcs)", 6.89, "cerraduras"],
  ["Grapa para Clavadora de Aire 40mmx5.7mm (2500pcs)", 7.25, "cerraduras"],
  ["Grapa para ENNE-70 10mm", 2.75, "cerraduras"],
  ["Grapa para ENNE-70 13mm", 2.90, "cerraduras"],
  ["Grapa para ENNE-70 16mm", 3.52, "cerraduras"],
  ["Grapa para ENNE-70 6mm", 2.10, "cerraduras"],
  ["Grapa para ENNE-70 8mm", 2.25, "cerraduras"],
  ["Grapa Re/Clavo 5mm", 0.35, "cerraduras"],
  ["Grapa Re/Clavo 6mm", 0.45, "cerraduras"],
  ["Grapa Re/Clavo 7mm", 0.52, "cerraduras"],
  ["Grapa Seria 12mm (Hoteche)", 1.99, "cerraduras"],
  ["Grapa Serie 10mm (Hoteche)", 1.99, "cerraduras"],
  ["Grapadora 3 en 1 Total", 12.00, "herramientas"],
  ["Grapadora Electrica 45W", 29.00, "herramientas"],
  ["Grapadora Industrial", 6.50, "herramientas"],
  ["Grapas 10mm x 1.2mm Total", 0.92, "cerraduras"],
  ["Grapas 12mm Total", 0.99, "cerraduras"],
  ["Grapas 25mm para Pistola Neumatica", 5.34, "cerraduras"],
  ["Grapas 8mm x 1.2mm Total", 0.77, "cerraduras"],
  ["Kit para Minifix y Tarugo", 63.05, "cerraduras"],
  ["Kit Tornillo Kreg 260 Pzas", 25.71, "cerraduras"],
  ["Kit Tornillo Kreg 675 Pzas", 38.58, "cerraduras"],
  ["Pin Hidraulico para Gavetas y Gavinetes con Tornillo", 2.14, "bisagras"],
  ["Pin Hidraulico para Gavetas y Gavinetes de Empotrar sin Tornillos", 1.66, "bisagras"],
  ["Pistola P/Clavo/Grapa Neumatica Total", 33.88, "herramientas"],
  ["Plantilla para Huecos Tarugo", 10.25, "herramientas"],
  ["Plantilla Tarugo Total", 9.35, "herramientas"],
  ["Pulsera Magnetica para Tornillo", 7.57, "herramientas"],
  ["Punta para Tornillo Kreg", 6.81, "herramientas"],
  ["Remache 3/16\" x 1/2\"", 1.01, "cerraduras"],
  ["Sistema Minifix", 4.50, "cerraduras"],
  ["Tarugo de Madera Total", 0.04, "cerraduras"],
  ["Tarugo Total 6x40mm", 1.40, "cerraduras"],
  ["Tornillo con Anclaje Blanco", 0.12, "cerraduras"],
  ["Tornillo Concreto Plana PHS 3/16x21/4", 7.82, "cerraduras"],
  ["Tornillo Gypsum R. Gruesa 6-9x1\"", 1.04, "cerraduras"],
  ["Tornillo Gypsum R. Gruesa 6-9x1-1/2\"", 1.73, "cerraduras"],
  ["Tornillo Gypsum R. Gruesa 6-9x1-1/4\"", 1.24, "cerraduras"],
  ["Tornillo Gypsum R. Gruesa 6-9x2\"", 2.16, "cerraduras"],
  ["Tornillo Gypsum R. Gruesa 6x15/8\"", 1.82, "cerraduras"],
  ["Tornillo Gypsum R. Gruesa 6x3/4\"", 1.07, "cerraduras"],
  ["Tornillo Gypsum R. Gruesa 6x1-1/8\"", 1.75, "cerraduras"],
  ["Tornillo Gypsum R. Gruesa 6x1/2\"", 1.18, "cerraduras"],
  ["Tornillo Gypsum R. Gruesa 6x13/4\"", 2.04, "cerraduras"],
  ["Tornillo Gypsum R. Gruesa 6x5/8\"", 1.33, "cerraduras"],
  ["Tornillo Gypsum R. Gruesa 8-9x2-1/2\"", 2.73, "cerraduras"],
  ["Tornillo Gypsum R. Gruesa 8-9x3\"", 3.29, "cerraduras"],
  ["Tornillo Kreg 1\" 100Und", 5.50, "cerraduras"],
  ["Tornillo Kreg 1\" 1200Und", 43.31, "cerraduras"],
  ["Tornillo Kreg 1.25\" 32mm 100Und", 6.12, "cerraduras"],
  ["Tornillo Kreg 1.25\" 32mm 250Und", 21.25, "cerraduras"],
  ["Tornillo Kreg 1.25\" 32mm 500Und", 27.94, "cerraduras"],
  ["Tornillo Kreg 1.5\" 38mm 100Und", 11.90, "cerraduras"],
  ["Tornillo Kreg 1.5\" 38mm 250Und", 23.33, "cerraduras"],
  ["Tornillo Kreg 1.5\" 38mm 500Und", 27.01, "cerraduras"],
  ["Tornillo Kreg 2 1/2\"", 27.01, "cerraduras"],
  ["Tornillo Kreg 2\" 51mm 250Und", 18.89, "cerraduras"],
  ["Tornillo Kreg 2\" 51mm 50Und", 7.10, "cerraduras"],
  ["Tornillo Lenteja Punta Fina 8x3/4", 1.42, "cerraduras"],
  ["Tornillo Punta Fina 10x3/4", 1.55, "cerraduras"],
  ["Tornillo Punta Fina 10x5/8", 2.33, "cerraduras"],
  ["Tuerca para Nivelador 9x12mm", 0.10, "cerraduras"]
];

const IMECA_PRICE_LIST_16 = [
  ["Barra Desayuno Patas/60mmx710mm 28\" Cromo", 13.45, "organizacion"],
  ["Nivelador 38mm Negro", 0.60, "organizacion"],
  ["Nivelador 58mm Negro", 1.17, "organizacion"],
  ["Pata 4\" Cromada", 3.98, "organizacion"],
  ["Pata 4\" Nickel", 3.98, "organizacion"],
  ["Pata de Mueble 6\" Brushed Nickel", 8.80, "organizacion"],
  ["Pata de Mueble 6\" Chrome", 9.15, "organizacion"],
  ["Pata de Mueble Ajustable 3 7/8\"-4 3/8\"", 4.66, "organizacion"],
  ["Pata de Mueble Ajustable 4 7/8\" (B)", 8.03, "organizacion"],
  ["Pata de Mueble Ajustable 4 7/8\"", 6.94, "organizacion"],
  ["Pata de Mueble Ajustable 5\"", 6.57, "organizacion"],
  ["Pata de Mueble Ajustable 5 3/4\"-6 3/8\"", 6.14, "organizacion"],
  ["Pata de Mueble Ajustable 5\" (SL-104)", 8.00, "organizacion"],
  ["Pata Mueble Cuadrada 38mm 4\" Satinado", 4.71, "organizacion"],
  ["Pata Mueble Cuadrada 4\" Aluminio", 4.14, "organizacion"],
  ["Pata Mueble Cuadrada 6\" Aluminio", 5.48, "organizacion"],
  ["Pata Mueble Cuadrada 8\" Aluminio", 5.92, "organizacion"],
  ["Pata Mueble Cuadrado 38mm 6\" Satinado", 6.60, "organizacion"],
  ["Pata Mueble Cuadrado 38mm 8\" Satinado", 5.92, "organizacion"],
  ["Pata Mueble Cuadrado 50mm 4\" Satinado", 4.24, "organizacion"],
  ["Pata Mueble Cuadrado 50mm 6\" Satinado", 4.92, "organizacion"],
  ["Pata Mueble Cuadrado 50mm 8\" Satinado", 5.92, "organizacion"],
  ["Pata Negra 30cm P/Mueble", 4.66, "organizacion"],
  ["Pata Plastica Ajustable 100-130mm", 0.69, "organizacion"],
  ["Pata Plastica Ajustable 120-150mm", 0.76, "organizacion"],
  ["Pata Plastica Ajustable 150-190mm", 0.91, "organizacion"],
  ["Pata Plastica Ajustable H100 Volpato", 2.10, "organizacion"],
  ["Pata Plastica Ajustable H150 Volpato", 3.50, "organizacion"],
  ["Patas de Mueble Ajustables 3 1/4\"", 3.25, "organizacion"],
  ["Patas de Mueble Ajustables 4 1/2\"-5 1/4\"", 5.45, "organizacion"],
  ["Protector de Pata 1\"", 1.18, "organizacion"],
  ["Protector de Pata 6/8", 1.01, "organizacion"],
  ["Kit de Ruedas CD 50-S", 46.19, "cerraduras"],
  ["Rodillo Guia Canteadora MY07Pro", 3.00, "herramientas"],
  ["Rodillo Rojo Canteadora MY07Pro", 6.00, "herramientas"],
  ["Rueda Bola 50mm Negra S/Freno", 2.02, "cerraduras"],
  ["Rueda Latera 40mm Negro", 1.09, "cerraduras"],
  ["Ruedas 100mm Azul Emma", 6.30, "cerraduras"],
  ["Ruedas 100mm Cristal Emma", 6.47, "cerraduras"],
  ["Ruedas 100mm Negras Emily C/Freno", 12.85, "cerraduras"],
  ["Ruedas 100mm Negras Emma", 7.45, "cerraduras"],
  ["Ruedas 100mm Rosadas Emma", 5.85, "cerraduras"],
  ["Ruedas 50mm Negras C/Freno", 1.20, "cerraduras"],
  ["Ruedas 50mm Negras Lisa C/Freno", 6.10, "cerraduras"],
  ["Ruedas 60mm Azul C/Freno", 2.44, "cerraduras"],
  ["Ruedas 60mm Azul Emma", 5.37, "cerraduras"],
  ["Ruedas 60mm Azul Olym II", 4.21, "cerraduras"],
  ["Ruedas 60mm Cristal Emma", 5.36, "cerraduras"],
  ["Ruedas 60mm Gris Olym II", 4.21, "cerraduras"],
  ["Ruedas 60mm Negras Emma", 4.34, "cerraduras"],
  ["Ruedas 60mm Negras Olym I", 9.71, "cerraduras"],
  ["Ruedas 60mm Negras Olym II", 5.01, "cerraduras"],
  ["Ruedas 60mm Rojas Olym I", 8.78, "cerraduras"],
  ["Ruedas 60mm Rojas Olym II", 4.21, "cerraduras"],
  ["Ruedas 60mm Rosadas Emma", 5.37, "cerraduras"],
  ["Ruedas 75mm Blancas Koo", 13.36, "cerraduras"],
  ["Ruedas 75mm Negra Lisa C/Freno", 16.68, "cerraduras"],
  ["Ruedas 75mm Negras Emily C/Freno", 4.33, "cerraduras"],
  ["Ruedas 75mm Negras Koo", 13.36, "cerraduras"]
];

const IMECA_PRICE_LIST_17 = [
  ["Afilador Multifuncional Electrico", 36.89, "herramientas"],
  ["Cable 4\" Switch Macho Hembra", 3.53, "herramientas"],
  ["Cable 6\" con Conexion Macho", 3.65, "herramientas"],
  ["Cable 6\" con Switch y Macho", 5.17, "herramientas"],
  ["Cable Macho/Hembra 12\"", 0.83, "herramientas"],
  ["Cable Macho/Hembra para LED", 3.62, "herramientas"],
  ["Cepillo Electrico 82x2mm 710W", 76.25, "herramientas"],
  ["Cepillo Electrico de Madera 1050W Total", 111.07, "herramientas"],
  ["Cinta LED Blanco Calido 3000KW", 17.01, "herramientas"],
  ["Cinta LED Blanco Calido WW 5M", 34.27, "herramientas"],
  ["Cinta LED Blanco CW 5M", 34.52, "herramientas"],
  ["Cinta LED Plastica", 3.74, "herramientas"],
  ["Conexion para Cinta LED Plastica", 3.74, "herramientas"],
  ["Cuchilla para Cepillo Electrico Total", 3.18, "herramientas"],
  ["Grifo Extraible Toledo", 60.00, "organizacion"],
  ["Luz 12\" LED Clear White", 13.10, "herramientas"],
  ["Luz 12\" LED Warm White", 13.76, "herramientas"],
  ["Luz LED 16\" Clear White 2.5W", 14.40, "herramientas"],
  ["Luz LED Cuadrada Acero Clear White", 15.55, "herramientas"],
  ["Luz LED Cuadrada Gris CW", 11.19, "herramientas"],
  ["Luz LED Cuadrada Gris WW", 10.19, "herramientas"],
  ["Luz LED Cuadrada Negra WW", 13.31, "herramientas"],
  ["Luz LED Cuadrado Blanco CW", 13.88, "herramientas"],
  ["Luz LED Cuadrado Blanco WW", 10.91, "herramientas"],
  ["Luz LED Redonda Acero Clear White", 15.42, "herramientas"],
  ["Luz LED Redonda Acero WW", 13.90, "herramientas"],
  ["Luz LED Redonda Blanca Clear White", 13.49, "herramientas"],
  ["Luz LED Redonda Blanca WW", 12.07, "herramientas"],
  ["Luz LED Redonda Gris WW", 12.07, "herramientas"],
  ["Luz LED Redonda Negra Clear White", 12.27, "herramientas"],
  ["Luz LED Redonda Negra WW", 9.68, "herramientas"],
  ["Luz LED Redonda Plateada Clear White", 12.03, "herramientas"],
  ["Mazo Goma Fibra de Vidrio 8mm", 2.66, "cerraduras"],
  ["Repisa de Vidrio 08x15x40", 8.63, "cerraduras"],
  ["Repisa de Vidrio 08x15x60", 11.63, "cerraduras"],
  ["Repisa de Vidrio 08x20x40", 13.15, "cerraduras"],
  ["Clavadora Neumatica", 35.00, "herramientas"],
  ["Desague Bronce", 14.20, "organizacion"],
  ["Fregadero P/Montar D/Acero Inox 15x15", 48.30, "organizacion"],
  ["Fregadero Pro 340x300", 188.09, "organizacion"],
  ["Fregadero Pro 450x40 NVF", 188.09, "organizacion"],
  ["Fregadero Pro 500x45 NFV", 296.99, "organizacion"],
  ["Fregadero Pro 600x45 NVF", 222.74, "organizacion"],
  ["Fregadero Pro 60x40 830x450", 321.74, "organizacion"],
  ["Fregadero Pro 810x45 NFV", 282.13, "organizacion"],
  ["Fregador/Grifo Extraible Nova Negro", 193.50, "organizacion"],
  ["Fregador/Grifo Extraible Turano", 193.50, "organizacion"],
  ["Fregador/Grifo Monomando Bari", 387.00, "organizacion"],
  ["Fregador/Grifo Niagara", 250.00, "organizacion"],
  ["Grifo Basin Cepillado Acabado", 102.96, "organizacion"],
  ["Grifo Basin Cepillado Acabado 8510-B BN", 136.75, "organizacion"],
  ["Grifo Basin Cromo Acabado", 92.56, "organizacion"],
  ["Grifo Brush D/Baño U/Control NK", 89.00, "organizacion"],
  ["Grifo D/Baño Solo Control Cromo 1082 CR", 102.96, "organizacion"],
  ["Grifo D/Baño Solo Control Cromo 1095 CR", 92.56, "organizacion"],
  ["Grifo D/Baño Solo Control Cromo 1295 CR", 113.36, "organizacion"],
  ["Grifo D/Cocina Handle Pull-Down", 156.98, "organizacion"],
  ["Grifo D/Cocina Pull-Out Acabado Cpllo NK", 169.05, "organizacion"],
  ["Grifo D/Cocina Pull-Out Acero Inox", 235.46, "organizacion"],
  ["Grifo D/Cocina Pull-Out Acero Inox (B)", 155.40, "organizacion"],
  ["Grifo D/Cocina Satain Finish Acero Inox", 167.16, "organizacion"],
  ["Grifo Extraible Genova", 147.00, "organizacion"],
  ["Grifo Extraible Girona Negro", 95.00, "organizacion"],
  ["Grifo Extraible Riva", 60.00, "organizacion"],
  ["Grifo Monomando D/Lavado CR-CUPC-NSF9825B", 165.10, "organizacion"],
  ["Grifo Monomando Lavado Cromado", 113.36, "organizacion"],
  ["Grifo Monomando Lavado Cromado 8220B CR", 174.06, "organizacion"],
  ["Grifo Monomando Verona", 112.50, "organizacion"],
  ["Grifo Satin D/Cocina Fino D/Acero Inox", 140.40, "organizacion"],
  ["Grifo Sink Pull-Out Acero Inox", 249.96, "organizacion"],
  ["Lavado D/Baño Basin-Blanco", 31.40, "organizacion"],
  ["Lavado D/Ceramica Cuadrado Mount-Blanco", 48.20, "organizacion"],
  ["Lavado D/Ceramica Cuadrado Over-Mount", 55.20, "organizacion"],
  ["Lavado D/Ceramica Cuadrado Over-Mount233", 60.72, "organizacion"],
  ["Manguera Aire 15M", 12.35, "herramientas"],
  ["Manguera de Aire 10mt Hoteche", 16.84, "herramientas"],
  ["Manguera de Aire para Compresor 10mts", 10.37, "herramientas"],
  ["Manguera para Compresor 10mmx3/8\"", 9.50, "herramientas"]
];

const IMECA_PRICE_LIST_18 = [
  ["Alicate de Presion Tipo C Total", 8.43, "herramientas"],
  ["Alicate Presion Automatico 3\"", 55.34, "herramientas"],
  ["Alicate Presion Automatico 8\"", 46.19, "herramientas"],
  ["Broca Roto Martillo 4mm (3/16)", 1.22, "herramientas"],
  ["Cinta Metrica 10M Total", 5.45, "herramientas"],
  ["Cinta Metrica 2 en 1", 19.60, "herramientas"],
  ["Cinta Metrica 3M Total", 2.35, "herramientas"],
  ["Cinta Metrica 3x1", 35.10, "herramientas"],
  ["Cinta Metrica 8M Total", 4.70, "herramientas"],
  ["Destornillador 2en1 Total", 1.65, "herramientas"],
  ["Destornillador Flexible 12Pza Total", 4.62, "herramientas"],
  ["Espatula de 100mm Acero Total", 2.81, "herramientas"],
  ["Espatula de 60mm Acero Total", 2.00, "herramientas"],
  ["Espatula de 80mm Acero Total", 1.86, "herramientas"],
  ["Juego de Espatula Plasticas 3Pza", 2.20, "herramientas"],
  ["Juego de Punta Destornillador 29Pzas", 5.59, "herramientas"],
  ["Juego Destornillador 2 Pza", 2.00, "herramientas"],
  ["Juego Destornillador 2Pzas Total", 2.01, "herramientas"],
  ["Juego Destornillador/Ratchet 18Pza Total", 6.67, "herramientas"],
  ["Juego Destornillador/Ratchet 47Pza Total", 12.95, "herramientas"],
  ["Juego Lima 3Pza Total", 10.85, "herramientas"],
  ["Kit Formon", 17.54, "herramientas"],
  ["Kit Juego Destornillador Rachet 24 Pzas Total", 16.49, "herramientas"],
  ["Laser Linea Autonivelante", 51.71, "herramientas"],
  ["Lima Plana 12\"", 9.09, "herramientas"],
  ["Lima Plana 14\"", 15.92, "herramientas"],
  ["Lima Plana Acero 200mm", 2.88, "herramientas"],
  ["Martillo 12oz Hoteche", 4.91, "herramientas"],
  ["Martillo 16oz Abolu", 4.28, "herramientas"],
  ["Martillo 8oz Hoteche", 5.04, "herramientas"],
  ["Martillo Multifuncional 12 Funciones", 15.79, "herramientas"],
  ["Nivel Burbuja 100cm", 6.42, "herramientas"],
  ["Nivel de Burbuja 40cm Total", 2.63, "herramientas"],
  ["Nivel de Burbuja 60cm Total", 3.56, "herramientas"],
  ["Nivel Laser Autonivelante", 120.71, "herramientas"],
  ["Nivel Lazer Rojo 10M de Pilas", 35.08, "herramientas"],
  ["Prensa Abrazadera 6\" Total", 10.26, "herramientas"],
  ["Prensa de Esquina (65x70mm)", 25.56, "herramientas"],
  ["Prensa Esquina Hoteche", 17.21, "herramientas"],
  ["Prensa Sargento Barra 12\" Total", 5.00, "herramientas"],
  ["Prensa Sargento Barra 18\" Total", 5.96, "herramientas"],
  ["Prensa Sargento Barra 6\" Total", 3.44, "herramientas"],
  ["Punta Destornillador #2", 0.41, "herramientas"],
  ["Sargento Pinza Tipo F 50x150mm", 4.00, "herramientas"],
  ["Sargento Tipo F 120x300mm", 11.69, "herramientas"],
  ["Sargento Tipo F 120x800mm", 17.47, "herramientas"],
  ["Sargento Tipo F 140x1200mm", 38.45, "herramientas"],
  ["Sargento Tipo F 50x250mm", 4.70, "herramientas"],
  ["Set de 2pc Porta Puntas de Destornillador 60mm Total", 2.92, "herramientas"],
  ["Taladro Rotomartillo 20V Total", 80.07, "herramientas"]
];

const IMECA_PRICE_LIST_19 = [
  ["Aspiradora Sopladora 20V Total", 41.85, "herramientas"],
  ["Base de Esmeril 115/125mm", 30.95, "herramientas"],
  ["Base para Taladro 16\"", 25.48, "herramientas"],
  ["Bateria 20V 2.0 y Cargador", 36.99, "herramientas"],
  ["Bateria 23A 12V", 1.17, "herramientas"],
  ["Bateria Alk AA Blister2", 1.74, "herramientas"],
  ["Bateria Alk AAA Blister2", 1.22, "herramientas"],
  ["Bateria CR2032 3V", 0.93, "herramientas"],
  ["Bateria Litio 20V 7.5Amp", 86.50, "herramientas"],
  ["Broca Fresadora para Router 1/4", 5.25, "herramientas"],
  ["Broca Fresadora para Router 3/8", 5.50, "herramientas"],
  ["Broca Fresadora para Router 5/16", 4.95, "herramientas"],
  ["Broca para Router con Balero", 4.95, "herramientas"],
  ["Broca Router Cola de Pato", 1.00, "herramientas"],
  ["Broca Router Cola Pato 1/2\"", 4.25, "herramientas"],
  ["Broca Router Recta 21 1/2", 3.75, "herramientas"],
  ["Broca Router Recta 21 1/4x1", 3.30, "herramientas"],
  ["Broca Router Recta 2F 1/4\"", 2.59, "herramientas"],
  ["Broca Router Recta 2F 3/4", 3.89, "herramientas"],
  ["Broca Router Redondo C/Mod 1-1/2", 7.80, "herramientas"],
  ["Brocas Router 1/2\" 24 Piezas", 49.50, "herramientas"],
  ["Brocas Router 1/4\" 24 Piezas", 49.90, "herramientas"],
  ["Brocasierra Bimetalica 32-210mm IMEX", 10.00, "herramientas"],
  ["Caladora 20V Total", 68.49, "herramientas"],
  ["Caladora 570W Total", 40.70, "herramientas"],
  ["Caladora 800W Total", 74.69, "herramientas"],
  ["Canteadora MY07Pro", 1400.00, "herramientas"],
  ["Canteadora Portatil", 500.00, "herramientas"],
  ["Cargador P/Bateria 20V IMEX", 24.90, "herramientas"],
  ["Cargador para Bateria 20V Total", 13.55, "herramientas"],
  ["Cepillo Copa Circular 75mm", 1.65, "herramientas"],
  ["Cepillo de Madera 235mm Total", 7.84, "herramientas"],
  ["Cepillo para Madera (Hoteche)", 12.99, "herramientas"],
  ["Compresor de Aire 10L Sin Aceite (Silencioso)", 123.46, "herramientas"],
  ["Compresor de Aire 24L (Sin Aceite)", 172.45, "herramientas"],
  ["Compresor de Aire Libre de Aceite 9L 800W", 146.16, "herramientas"],
  ["Compresor Lubricado 50L 31/2HP", 172.00, "herramientas"],
  ["Covertor de Lana para Pulidora", 4.11, "herramientas"],
  ["Cuchilla para Cepillo de Madera Total", 1.82, "herramientas"],
  ["Disco de Sierra para Aluminio 100T (Hoteche)", 28.15, "herramientas"],
  ["Disco Sierra 60T x 185mm", 6.69, "herramientas"],
  ["Disco Sierra 7-1/4\" P/Madera 60D Centro 5/8", 9.00, "herramientas"],
  ["Disco Sierra Diablo 4-1/2\" 36D", 20.45, "herramientas"],
  ["Disco Sierra Diablo 7 1/4 36Dientes", 22.00, "herramientas"],
  ["Disco Sierra Diablo 7 1/4 40Dientes", 20.45, "herramientas"],
  ["Esmeril Flexible Bat 18V 4 1/2", 110.43, "herramientas"],
  ["Hoja Caladora Juego Total", 3.78, "herramientas"],
  ["Hoja Sierra Banda", 6.36, "herramientas"],
  ["Hoja Sierra Calador Jgo Total", 1.44, "herramientas"],
  ["Hoja Sierra Caladora Juego 5Pzas", 2.55, "herramientas"],
  ["Hoja Sierra Caladora Juego Total", 2.48, "herramientas"],
  ["Hoja Sierra de Banda 1575", 7.56, "herramientas"],
  ["Hoja Sierra Sable P/Madera Total", 1.11, "herramientas"],
  ["Juego 15Pza P/Compresor de Aire Truper", 28.75, "herramientas"],
  ["Juego 3 Cepillos para Taladro", 5.50, "herramientas"],
  ["Juego Cuchilla Caladora 5Pieza IMEX", 9.95, "herramientas"],
  ["Juego de 2 Broca para Router", 10.67, "herramientas"],
  ["Juego de 2 Brocas para Router 7/8", 11.71, "herramientas"],
  ["Juego de Puntas para Router 1/4 (Hoteche)", 21.99, "herramientas"],
  ["Kit Disco Sierra de Mesa", 42.06, "herramientas"],
  ["Kit Puntas Router Total", 17.63, "herramientas"],
  ["Kit Sierra Hueca 3pcs", 4.14, "herramientas"],
  ["Kit Sierra Hueca 6pcs", 3.50, "herramientas"],
  ["Kit Sierra MJ09B", 45.00, "herramientas"],
  ["Lijadora 320W Total", 39.20, "herramientas"],
  ["Lijadora de Banda 810W", 81.82, "herramientas"],
  ["Lijadora de Palma 240W Total", 37.13, "herramientas"],
  ["Lijadora Orbital 5\" 20V IMEX 1Bat-1Carg", 73.90, "herramientas"],
  ["Lijadora Orbital 5\" 20V Total", 52.42, "herramientas"],
  ["Lijadora Orbital 5\" 320W Total", 45.40, "herramientas"]
];

const IMECA_PRICE_LIST_20 = [
  ["Maletin Mixto Brocas Router 1/2\" 12 Piezas", 19.50, "herramientas"],
  ["Maletin Mixto Brocas Router 1/4\" 12 Piezas", 19.90, "herramientas"],
  ["Mandril Sierra Bimetalica 7/16", 4.60, "herramientas"],
  ["Mandril Zanco 7/16\" P/Brocasierra Bimetalica", 7.00, "herramientas"],
  ["Mecha para Router Recta 1/4x1\" Surtek", 3.36, "herramientas"],
  ["Mecha para Router Recta 1/4x3/4\" Surtek", 2.93, "herramientas"],
  ["Mini Compresor 20V Total", 39.29, "herramientas"],
  ["Mopa Pulidora MY07Pro", 18.00, "herramientas"],
  ["Pegamento Canteadora Baja Temp", 22.70, "adhesivos"],
  ["Pistola de Aire 400cc Total", 15.36, "herramientas"],
  ["Pistola de Aire 600cc Total", 19.04, "herramientas"],
  ["Pistola de Calor 2000W Total", 23.41, "herramientas"],
  ["Pistola de Pintura Electrica 450W", 42.21, "herramientas"],
  ["Pistola de Silicone 9\" Total", 2.73, "herramientas"],
  ["Pistola P/Silicon 9\"", 2.49, "herramientas"],
  ["Pistola para Pintar 20V Total", 28.13, "herramientas"],
  ["Pistola para Pintar 350W Total", 41.84, "herramientas"],
  ["Pistola para Pintar Gravedad", 22.49, "herramientas"],
  ["Pistola Porta Electrodo 300A Total", 5.37, "herramientas"],
  ["Pistola Porta Electrodo 500A Total", 5.54, "herramientas"],
  ["Pistola Silicon 9\" Hoteche", 3.90, "herramientas"],
  ["Pistola Silicone Caliente", 7.74, "herramientas"],
  ["Pistola Spray 400cc", 14.90, "herramientas"],
  ["Pistola Spray 600cc", 80.18, "herramientas"],
  ["Punta Router 1 1/8 Balinera", 8.58, "herramientas"],
  ["Punta Router 1/4 x1", 3.07, "herramientas"],
  ["Punta Router 81/2 x 76", 5.20, "herramientas"],
  ["Punta Router CH1-1/4x", 7.16, "herramientas"],
  ["Punta Router LC MY07Pro", 16.00, "herramientas"],
  ["Punta Router R1 MY07Pro", 16.65, "herramientas"],
  ["Punta Router R2 MY07Pro", 16.65, "herramientas"],
  ["Router 1/4\"- 1/2\" 1600W Total", 86.61, "herramientas"],
  ["Router 1/4\"- 1/2\" 2200W Total", 114.62, "herramientas"],
  ["Router 1/4\" 500W Total", 45.45, "herramientas"],
  ["Router 20V IMEX 1Bat/1Carg", 142.50, "herramientas"],
  ["Router Electrica (Hoteche) 400W", 50.09, "herramientas"],
  ["Set 3 Cepillos Pulir", 4.54, "herramientas"],
  ["Sierra Banda", 264.90, "herramientas"],
  ["Sierra Bimetalica 57mm 2-14\" 12pcs", 7.15, "herramientas"],
  ["Sierra Circular 1400W Total", 55.57, "herramientas"],
  ["Sierra Circular 20V 51/2\" Total", 59.37, "herramientas"],
  ["Sierra Circular 20V 71/4", 72.90, "herramientas"],
  ["Sierra Circular 20V Total", 85.42, "herramientas"],
  ["Sierra Circular 7 1/4 1600W", 92.03, "herramientas"],
  ["Sierra Circular de 7 1/4 1300W", 69.02, "herramientas"],
  ["Sierra Concreto Ranuradora 1500W", 152.87, "herramientas"],
  ["Sierra Copa 2 1/4\"", 10.60, "herramientas"],
  ["Sierra Copa Bi-Metal 22mm IMEX", 13.95, "herramientas"],
  ["Sierra Copa Bi-Metal 29mm IMEX", 20.45, "herramientas"],
  ["Sierra Copa Bi-Metal 38mm IMEX", 20.45, "herramientas"],
  ["Sierra Copa Bi-Metal 44mm IMEX", 20.45, "herramientas"],
  ["Sierra Copa Bi-Metal 51mm IMEX", 20.45, "herramientas"],
  ["Sierra Copa Bi-Metal 57mm IMEX", 20.45, "herramientas"],
  ["Sierra Copa Bi-Metal 64mm IMEX", 20.45, "herramientas"],
  ["Sierra de Cinta 190mm Hoteche", 213.67, "herramientas"],
  ["Sierra de Mesa 10\" 1800W", 231.90, "herramientas"],
  ["Sierra de Mesa 10\" 2600W 4800RPM", 312.90, "herramientas"],
  ["Sierra de Mesa 1500W Hoja 10x5/8", 204.90, "herramientas"],
  ["Sierra Doble Portatil MJ09B", 450.00, "herramientas"],
  ["Sierra Ingletadora 10\" 1800W", 197.63, "herramientas"],
  ["Sierra Mesa 10\"/255mm 1500W", 274.73, "herramientas"],
  ["Sierra Sable Reciproca 20V Total", 82.59, "herramientas"],
  ["Sierra Vertical 1.8KW", 1350.00, "herramientas"],
  ["Taladro 1/2\" 110V 810W", 34.70, "herramientas"],
  ["Taladro 1/2\" 20V con Percutor 2Bat/1Carg Total", 88.31, "herramientas"],
  ["Taladro 1/2\" 680W con Impacto 2 Velocidades Total", 31.43, "herramientas"],
  ["Taladro 1/2\" 750W con Impacto Total", 35.25, "herramientas"],
  ["Taladro 12V IMEX 1Bat/1Carg", 57.50, "herramientas"],
  ["Taladro 18Bat 1250RPM Max Total", 83.11, "herramientas"],
  ["Taladro 20V IMEX 1Bat-1Carg", 72.90, "herramientas"],
  ["Taladro 20V Impacto 1/2\" Kit de Broca", 35.23, "herramientas"],
  ["Taladro 20V Impacto S/Bat/Car", 34.88, "herramientas"],
  ["Taladro 3/8\" 12V 1Bat/1Carg Total", 40.34, "herramientas"],
  ["Taladro 3/8\" 20V sin Percutor 1Bat/1Carg Total", 47.59, "herramientas"],
  ["Taladro 4V IMEX 1Bat/1Carg", 32.90, "herramientas"],
  ["Taladro 4V Total", 16.04, "herramientas"],
  ["Taladro 8V Total", 35.47, "herramientas"],
  ["Taladro Impacto 20V IMEX 1Bat-1Carg", 135.90, "herramientas"]
];

const IMECA_PRICE_LIST_21 = [
  ["Afilador de Brocas de Metal", 6.77, "herramientas"],
  ["Base de Disco Velcro 4.5\"", 2.99, "herramientas"],
  ["Broca 6.5mm M35", 1.58, "herramientas"],
  ["Broca Albañileria 6.0x100mm", 0.90, "herramientas"],
  ["Broca Avellanador para Madera 1/2", 2.49, "herramientas"],
  ["Broca Avellanador para Madera 5/8", 2.79, "herramientas"],
  ["Broca Avellanadora #6 para Madera", 4.50, "herramientas"],
  ["Broca Avellanadora para Madera #8", 3.90, "herramientas"],
  ["Broca Browm Medidas Varias", 0.93, "herramientas"],
  ["Broca Concreto 1/4\"", 0.69, "herramientas"],
  ["Broca Concreto 3/16\"", 1.90, "herramientas"],
  ["Broca de 6x200mm (1/4)", 0.93, "herramientas"],
  ["Broca de Alta Vel 1/8", 1.00, "herramientas"],
  ["Broca de Alta Vel 11/64", 1.20, "herramientas"],
  ["Broca de Alta Vel 3/16", 1.25, "herramientas"],
  ["Broca de Alta Vel 5/32", 1.10, "herramientas"],
  ["Broca de Alta Vel de 3/32", 1.00, "herramientas"],
  ["Broca de Alta Velocidad de 1/4", 3.00, "herramientas"],
  ["Broca de Concreto 1/4x4", 1.00, "herramientas"],
  ["Broca de Concreto 3/16\" x 33/8\" Total", 0.84, "herramientas"],
  ["Broca de Concreto 3/8x5", 1.00, "herramientas"],
  ["Broca de Placa de Acero de 4-20mm 9Pasos", 6.54, "herramientas"],
  ["Broca M2 HSS 1/4\"", 1.76, "herramientas"],
  ["Broca M2 HSS 5/16\"", 2.13, "herramientas"],
  ["Broca Metal 6mm", 0.56, "herramientas"],
  ["Broca Metal Carburo", 1.03, "herramientas"],
  ["Broca Multimaterial 1/2x6\"", 5.00, "herramientas"],
  ["Broca Multimaterial 5/32 x 6", 1.50, "herramientas"],
  ["Broca P/Mamposteria 4x75mm", 0.99, "herramientas"],
  ["Broca para Concreto 1/4x6\"", 1.85, "herramientas"],
  ["Broca para Concreto 3/16\" (B)", 0.65, "herramientas"],
  ["Broca para Concreto 3/16x6", 0.99, "herramientas"],
  ["Broca para Disco de Velcro 5\"", 7.59, "herramientas"],
  ["Broca para Madera 3/16", 0.89, "herramientas"],
  ["Broca para Madera 35mm", 9.50, "herramientas"],
  ["Broca Tungsteno 1/4x6", 2.00, "herramientas"],
  ["Brocas Avellanado 3pcs 1/4\"", 18.03, "herramientas"],
  ["Brocas HSS 1/16\" Total", 0.71, "herramientas"],
  ["Brocas M2 HSS 3/16\" 10pcs", 9.07, "herramientas"],
  ["Disco 7/14 80Dientes (Hoteche)", 19.29, "herramientas"],
  ["Disco Aluminio 10\" 100T Total", 23.34, "herramientas"],
  ["Disco Aluminio 12\" 120T Total", 31.87, "herramientas"],
  ["Disco Aluminio 81/4\" 60T Total", 11.93, "herramientas"],
  ["Disco Corte 10\" 100D Diablo", 87.84, "herramientas"],
  ["Disco Corte 10\" 80T", 24.00, "herramientas"],
  ["Disco Corte 10\" 90T IMEX", 52.90, "herramientas"],
  ["Disco Corte 10x60 Fine Finish", 60.00, "herramientas"],
  ["Disco Corte 10x80 Ultra Finish", 70.00, "herramientas"],
  ["Disco Corte 10x90 Diablo", 75.00, "herramientas"],
  ["Disco Corte 12x100 Diablo", 84.00, "herramientas"],
  ["Disco Corte 12x84 Diablo", 74.02, "herramientas"],
  ["Disco Corte 7 1/4\" 60T IMEX", 27.34, "herramientas"],
  ["Disco Corte 7 1/4\" 80T Hoteche", 17.90, "herramientas"],
  ["Disco Corte 7 1/4 x 60 Diablo", 29.00, "herramientas"],
  ["Disco Corte 8-1/4\" x60T Diablo", 51.90, "herramientas"],
  ["Disco Corte Clave 420 4.5x3 Abracol", 0.89, "herramientas"],
  ["Disco Corte Cono Clave 024 4.5x3 Abracol", 0.89, "herramientas"],
  ["Disco Corte Madera 5 1/2\" Set 2 Piezas", 7.02, "herramientas"],
  ["Disco Corte Madera 8 1/4 40T", 10.00, "herramientas"],
  ["Disco Diamantados P/Concreto 9\" Total", 8.67, "herramientas"],
  ["Disco Diamante 41/2\" Liso Total", 2.54, "herramientas"],
  ["Disco Diamante 41/2\" Ranurado Total", 2.23, "herramientas"],
  ["Disco Diamante 41/2\" Segmentado Total", 2.42, "herramientas"],
  ["Disco Diamante 41/2\" Segmentado Ultrafino Total", 6.20, "herramientas"],
  ["Disco DT42 41/2 Corte Metal 946", 1.35, "herramientas"],
  ["Disco Flap #120", 4.59, "herramientas"],
  ["Disco Flap Pulir 41/2\" #100", 3.64, "herramientas"],
  ["Disco Flap Pulir 41/2 #36", 1.00, "herramientas"],
  ["Disco Flap Pulir 41/2 #40", 3.45, "herramientas"],
  ["Disco Flap Pulir 41/2 #60", 3.30, "herramientas"],
  ["Disco Flap Pulir 41/2\" #80", 3.64, "herramientas"],
  ["Disco Lija 41/2\" 24", 0.90, "herramientas"],
  ["Disco Lija 41/2 60", 0.72, "herramientas"]
];

const IMECA_PRICE_LIST_22 = [
  ["Disco Lija 41/2 80", 0.72, "herramientas"],
  ["Disco Madera 10\" 40T Total", 11.00, "herramientas"],
  ["Disco Madera 10\" 60T Total", 13.53, "herramientas"],
  ["Disco Madera 12\" 60T Total", 23.02, "herramientas"],
  ["Disco Madera 41/2\" 40T Total", 4.29, "herramientas"],
  ["Disco Madera 51/2\" 24T Total", 5.05, "herramientas"],
  ["Disco Madera 71/4\" 60T Total", 7.90, "herramientas"],
  ["Disco Madera 81/4\" 24T Total", 7.17, "herramientas"],
  ["Disco Metal 41/2\" Concavo Total", 0.90, "herramientas"],
  ["Disco Metal 41/2\" Plano Total", 0.92, "herramientas"],
  ["Disco Truper 10\" 100D", 24.00, "herramientas"],
  ["Disco Truper 10\" 80D", 16.90, "herramientas"],
  ["Disco Truper 7 1/4 60D", 9.90, "herramientas"],
  ["Disco Truper Carburo 10\" 80D", 15.50, "herramientas"],
  ["Disco Velcro 6x6 80", 4.04, "herramientas"],
  ["Exacto-Cuchilla", 1.00, "herramientas"],
  ["Juego 3 Brocas Avellanadora Truper", 12.00, "herramientas"],
  ["Juego 5 Brocas HSS Avellanadora", 16.96, "herramientas"],
  ["Juego 8 Brocas para Madera", 4.50, "herramientas"],
  ["Juego Broca Concreto 5 Pcs", 2.57, "herramientas"],
  ["Juego Brocas Helicoidales 6 Pzs", 2.95, "herramientas"],
  ["Juego de Broca 13 Pieza IMEX", 8.90, "herramientas"],
  ["Juego de Broca 19 Pieza IMEX", 19.90, "herramientas"],
  ["Juego de Broca para Concreto", 4.44, "herramientas"],
  ["Juego de Brocas Planas Manitas 6 Piezas", 9.45, "herramientas"],
  ["Juegos de Brocas de 16 Piezas", 7.74, "herramientas"],
  ["Kit Broca 13 Pcs", 3.63, "herramientas"],
  ["Kit Broca 6 Pcs Metal", 1.80, "herramientas"],
  ["Kit Broca Madera 5 Pcs", 2.44, "herramientas"],
  ["Kit Broca para Casoleta", 12.00, "herramientas"],
  ["Kit Broca Plana para Madera 6Pcs", 11.26, "herramientas"],
  ["Kit de 3 Brocas Avellanador", 7.01, "herramientas"],
  ["Kit de Punta de 152mm/6\"", 6.72, "herramientas"],
  ["Kit de Puntas 3\" & 6\"", 6.29, "herramientas"],
  ["Lija Disco Velcro 100", 0.65, "herramientas"],
  ["Lija Disco Velcro 5\" 120", 0.61, "herramientas"],
  ["Lija Disco Velcro 5\" 150", 0.61, "herramientas"],
  ["Lija Disco Velcro 5\" 180", 0.48, "herramientas"],
  ["Lija Disco Velcro 5\" 240", 0.55, "herramientas"],
  ["Lija Disco Velcro 5\" 400", 0.73, "herramientas"],
  ["Lija Disco Velcro 5\" 80", 0.48, "herramientas"],
  ["Mandril para Broca Hexagonal 3/8", 2.74, "herramientas"],
  ["Porta Punta Magnetico", 3.27, "herramientas"],
  ["Punta Estrella Funcion Impacto Total", 4.06, "herramientas"],
  ["Punta Estrella IMEX", 1.00, "herramientas"],
  ["Punta Estrella Total", 4.10, "herramientas"],
  ["Punta Estrella Total Pequeño", 0.75, "herramientas"],
  ["Punta Philips IMEX", 1.00, "herramientas"],
  ["Repuesto Broca Microbit", 21.26, "herramientas"],
  ["Repuesto Broca para Jig HD", 25.01, "herramientas"],
  ["Set de Brocas 13 Pcs 1/16-1/4\"", 3.17, "herramientas"],
  ["Set de Brocas de 16Pcs", 10.62, "herramientas"],
  ["Step Drill Bit KJD (Broca Kreg)", 21.90, "herramientas"]
];

const IMECA_PRICE_LIST_23 = [
  ["Piso Vinil Amati 1.830mt2", 26.16, "madera"],
  ["Piso Vinil Italian Walnut 1.830mt2", 26.16, "madera"],
  ["Piso Vinyl 1009-5 12pcs", 37.00, "madera"],
  ["Piso Vinyl 1029-7 12pcs", 37.00, "madera"],
  ["Piso Vinyl 1058-1 12pcs", 37.00, "madera"],
  ["Piso Vinyl 83012-9 12pcs", 37.00, "madera"],
  ["Vinil Dover White 3DL #123/LM", 11.69, "madera"],
  ["Vinil Grey Pear 3DL #627/LM", 11.66, "madera"],
  ["Vinil High Gloss White 3DL #302/LM", 11.67, "madera"],
  ["Vinil Memento 3DL #837/LM", 11.66, "madera"],
  ["Vinil Natural Maple 3DL #2666/LM", 11.66, "madera"],
  ["Vinil Wild Apple 3DL #351/LM", 11.66, "madera"],
  ["Afix Instantaneo 100gr", 6.25, "adhesivos"],
  ["Arteplack 990 4.5gl", 109.20, "adhesivos"],
  ["Barra Silicon Caliente 6pza", 2.41, "adhesivos"],
  ["Carpincol MR-62 20kg", 129.38, "adhesivos"],
  ["Carpincol MR60 x 20kg", 105.00, "adhesivos"],
  ["Carpincol Plus 100 1gl", 20.25, "adhesivos"],
  ["Carpincol Plus 100 20kl", 112.50, "adhesivos"],
  ["Extencion Electrica 12\" (Chocolate)", 5.25, "herramientas"],
  ["Gancho Adhesivo para Taza", 1.11, "adhesivos"],
  ["Kit Aplicador Silicone", 9.45, "adhesivos"],
  ["Masilla", 2.82, "adhesivos"],
  ["Masilla Acrilica Cedar 5oz (Acrylic)", 3.87, "adhesivos"],
  ["Masilla Acrilica Mahogany 5oz (Acrylic)", 3.87, "adhesivos"],
  ["Masilla Acrilica Oak 5oz (Acrylic)", 3.87, "adhesivos"],
  ["Masilla Acrilica Pino 5oz (Acrylic)", 5.01, "adhesivos"],
  ["Masilla Acrilica Walnut 5oz (Acrylic)", 5.01, "adhesivos"],
  ["Masilla Blanca 16oz", 6.54, "adhesivos"],
  ["Masilla Blanca 8oz", 5.58, "adhesivos"],
  ["Masilla Cedar Lanco", 2.92, "adhesivos"],
  ["Masilla Mahogany Lanco", 3.31, "adhesivos"],
  ["Masilla Oak Lanco", 3.31, "adhesivos"],
  ["Masilla Pino Lanco", 3.94, "adhesivos"],
  ["Masilla Walnut Lanco", 3.48, "adhesivos"],
  ["MS Turbo Blanco 425gr (Hightack Wurth)", 7.47, "adhesivos"],
  ["Pegamento PL 285 4.5gl", 123.00, "adhesivos"],
  ["Pegamento PL 285 400ml Spray", 17.00, "adhesivos"],
  ["Sellador 1/4gl Lanco", 11.66, "adhesivos"],
  ["Sellador 1gl Lanco", 35.83, "adhesivos"],
  ["Sellador Acrilico Blanco Wurth (Pintable)", 2.98, "adhesivos"],
  ["Sellador Acrilico Cerezo", 3.48, "adhesivos"],
  ["Sellador Acrilico Gris Claro", 3.48, "adhesivos"],
  ["Sellador Acrilico Gris Oscuro", 3.48, "adhesivos"],
  ["Sellador Acrilico Nogal", 3.48, "adhesivos"],
  ["Sellador Acrilico Oak Claro 300ml", 7.00, "adhesivos"],
  ["Sellador Acrilico Roble Medio-Carvalho Soudal 300ml", 4.80, "adhesivos"],
  ["Sellador Negro Bituminoso 500ml", 6.84, "adhesivos"],
  ["Sellador para Gotera Blanco", 18.38, "adhesivos"],
  ["Sellador para Gotera Negro", 18.38, "adhesivos"],
  ["Sellador para Gotera Trans", 18.38, "adhesivos"],
  ["Silicon Acrilico Transparente 200ml", 3.25, "adhesivos"],
  ["Silicon Bronce Neutro", 5.21, "adhesivos"],
  ["Silicon Gris Neutro", 5.35, "adhesivos"],
  ["Silicone Acetica Transparente Wurth 280ml", 5.36, "adhesivos"],
  ["Silicone Acrilico Pintable Blanco 310ml Paracrilyc", 2.90, "adhesivos"],
  ["Silicone Blanco 280ml Acetico", 3.19, "adhesivos"],
  ["Silicone Blanco 300ml", 5.99, "adhesivos"],
  ["Silicone Negro 300ml", 3.87, "adhesivos"],
  ["Silicone Neutra Blanca Wurth 280ml", 5.36, "adhesivos"],
  ["Silicone Pintable Blanco (Soudal)", 4.00, "adhesivos"],
  ["Silicone Transparente 300ml", 5.21, "adhesivos"],
  ["Silicone Transparente Silirub", 4.00, "adhesivos"],
  ["Tape Doble Contacto 3M", 4.95, "adhesivos"]
];

const IMECA_PRICE_LIST_24 = [
  ["Barniz Marino 1/4gl", 15.01, "adhesivos"],
  ["Barniz Marino 1gl", 45.34, "adhesivos"],
  ["Barniz Trans Brillante 15min 1/4gl Lanco", 17.60, "adhesivos"],
  ["Barniz Trans Brillante 15min 1gl Lanco", 62.84, "adhesivos"],
  ["Barniz Trans Mate 1/4gl", 17.60, "adhesivos"],
  ["Barniz Trans Mate 1gl", 62.84, "adhesivos"],
  ["Ducha Presura Car/D/Ceramic Val/D/Bal BN", 154.96, "organizacion"],
  ["Ducha Presura Car/D/Ceramic Val/D/Bal CR", 144.56, "organizacion"],
  ["Pintura Spray Aluminio", 2.62, "adhesivos"],
  ["Pintura Spray Amarillo Wurtk", 2.70, "adhesivos"],
  ["Pintura Spray Blanco Brillo Wurtk", 2.70, "adhesivos"],
  ["Pintura Spray Blanco Mate", 2.41, "adhesivos"],
  ["Pintura Spray Blanco Mate Wurtk", 2.70, "adhesivos"],
  ["Pintura Spray Gris", 2.58, "adhesivos"],
  ["Pintura Spray Negro Brillo Wurtk", 2.70, "adhesivos"],
  ["Pintura Spray Negro Mate", 2.41, "adhesivos"],
  ["Pintura Spray Negro Mate Wurtk", 2.70, "adhesivos"],
  ["Pintura Spray Rojo", 2.63, "adhesivos"],
  ["Pintura Spray Rojo Wurtk", 2.70, "adhesivos"],
  ["PL285 Aerosol x400ml Spray", 15.50, "adhesivos"],
  ["Placa de Montaje Ajustable 0mm", 0.35, "bisagras"],
  ["Placa de Montaje de Acero Ordinario 0mm", 0.22, "bisagras"],
  ["Placa Montaje Blum", 0.39, "bisagras"],
  ["Thinner Laca 1/2gl", 7.99, "adhesivos"],
  ["Thinner Laca 1gl", 12.69, "adhesivos"],
  ["Thinner Laca 16onz", 2.40, "adhesivos"],
  ["Thinner Laca 32onz", 4.81, "adhesivos"],
  ["WD-40 Aceite Multiuso 5.5onz", 3.63, "herramientas"],
  ["WD-40 Aceite Multiuso 8oz", 5.25, "herramientas"],
  ["Brillo", 2.51, "herramientas"],
  ["Guantes de Algodon con Puntos de PVC Truper", 1.54, "herramientas"],
  ["Guantes de Nitrilo Blanco-Verde Total", 2.08, "herramientas"],
  ["Paño Microfibra 50pcs Rollo", 7.90, "herramientas"],
  ["Adaptador Hexagonal Magnetico 1/4 Brown", 1.00, "cerraduras"],
  ["Adaptador Hexagonal Magnetico 5/16 Brown", 1.00, "cerraduras"],
  ["Adaptador Largo Tip On", 0.88, "bisagras"],
  ["Bolsa de Herramienta Cinturon", 4.34, "herramientas"],
  ["Bolsa de Herramienta Cinturon 130mm", 2.05, "herramientas"],
  ["Bolso Caja Porta Herramienta Total", 21.49, "herramientas"],
  ["Cinta Adhesiva Aislante Negro", 0.36, "cerraduras"],
  ["Cinta Adhesiva Protectora Azul", 2.99, "cerraduras"],
  ["Cinta Antiderrape Ama/Negr", 8.13, "cerraduras"],
  ["Cinta Ducto Gris 3M", 7.19, "cerraduras"],
  ["Cinta Transparente de Embalar Pretul", 2.50, "cerraduras"],
  ["Cubrebulto", 10.00, "cerraduras"],
  ["Gancho Adhesibo Oval 1 3/8", 1.20, "cerraduras"],
  ["Gancho Cerrado Dorado", 0.90, "cerraduras"],
  ["Gancho Doble P/Colgar", 2.43, "cerraduras"],
  ["Gancho Doble P/Colgar 2 1/2", 2.45, "cerraduras"],
  ["Gancho Dorado Abierto 1\"", 1.21, "cerraduras"],
  ["Gancho Sencillo P/Colgar", 1.80, "cerraduras"],
  ["Juego Caja Corte con Serrucho Total", 8.79, "herramientas"],
  ["Juego de Chuchillas 10Pcs 18x1000mm", 1.20, "herramientas"],
  ["Juego de Cuchullas 10Pcs (Exacto Metal)", 2.73, "herramientas"],
  ["Juego de Herramientas 9 Pzas", 20.38, "herramientas"],
  ["Juego de Machimbrado 5/8", 10.89, "herramientas"],
  ["Juego de Repuesto para Cortador Multifuncional", 13.90, "herramientas"],
  ["Juego para Colgar Cuadro", 0.85, "cerraduras"],
  ["Kit P/Gaveta en \"U\" P/Lavaplato", 5.00, "organizacion"],
  ["Kit Zapatera Blanco", 2.50, "organizacion"],
  ["Lona Protectora Azul 6x8\"", 5.21, "herramientas"],
  ["Pegadit Express Kit", 14.26, "adhesivos"],
  ["Protectores Felpa 3/8\"", 0.82, "cerraduras"],
  ["Rollo Papel Protector 36\"", 19.42, "herramientas"],
  ["Set 2 Pzas Sujetador 675kg 3M", 8.70, "herramientas"],
  ["Set Sacabocado 12 Pcs", 10.40, "herramientas"],
  ["Set Sacabocado 9 Pza", 5.76, "herramientas"],
  ["Tapa Canto Amaretto 45x0.45", 1.80, "canto"],
  ["Tapa Canto Carvalo 0.45x22mm por Metro", 0.75, "canto"],
  ["Tapa Canto Fume 0.45x22 (New Brixton)", 0.80, "canto"],
  ["Tapa Canto Lino Alma 22x2mm", 2.17, "canto"],
  ["Tapa Canto Lino Fantasia 0.45x22", 0.93, "canto"],
  ["Tapa Canto Olmo Volga 45x1", 2.24, "canto"],
  ["Tapacanco Roble Cafe 20x1mm", 1.20, "canto"],
  ["Tapon para Fregador", 0.85, "organizacion"],
  ["Terminal Acanalado Teak248 22x30x2800", 5.79, "madera"],
  ["Terminal Acanalado Teak248 25x35x2800 1045", 7.28, "madera"],
  ["Terminal Acanalado Wengue246 22x30x2800 1041", 5.59, "madera"],
  ["Terminal Acanalado Wengue246 25x35x2800 1045", 5.59, "madera"]
];

const IMECA_PRICE_LIST_25 = [
  ["Abrazaderas de Esquina 90°", 12.41, "cerraduras"],
  ["Acanalado Crudo 1015 50x50x2800 (AGT)", 10.06, "madera"],
  ["Acanalado Crudo 2050 18x144x2800 (AGT)", 8.10, "madera"],
  ["Acanalado Crudo 2200 18x101x2800 (AGT)", 8.10, "madera"],
  ["Acanalado Crudo 3783 12x158x2800 (AGT)", 7.63, "madera"],
  ["Acanalado Crudo 3786 12x195x2800", 10.45, "madera"],
  ["Acanalado Crudo 3821 18x128x2800 (AGT)", 8.70, "madera"],
  ["Acanalado LWalnut 2200 101x2800 (AGT)", 8.83, "madera"],
  ["Accu-Cut", 123.48, "herramientas"],
  ["Accu-Cut XL 100\"", 260.31, "herramientas"],
  ["Acoplador Rapido 5 Piezas", 3.38, "herramientas"],
  ["Aglo Blanco Krono 2070x2800x15mm", 60.00, "madera"],
  ["Aglo Blanco Krono 2070x2800x18mm", 70.00, "madera"],
  ["Alcayata para Cama", 3.61, "cerraduras"],
  ["Alcohol 16onz", 2.91, "herramientas"],
  ["Alcohol Industrial 32onz", 5.52, "herramientas"],
  ["Almohadilla Corcho Redonda", 0.58, "cerraduras"],
  ["Amarra 250x3.6 Negro", 1.05, "cerraduras"],
  ["Amarra 250x3.6mm Blanco", 1.05, "cerraduras"],
  ["Amarra 300x3.6mm Natural", 1.26, "cerraduras"],
  ["Amarra Nylon 150x3.6 Blanco", 0.70, "cerraduras"],
  ["Amarra Nylon 150x3.6mm Negro", 0.70, "cerraduras"],
  ["Amarra Nylon 200x3.6mm Blanco", 0.87, "cerraduras"],
  ["Amarra Nylon 200x3.6mm Negro", 0.87, "cerraduras"],
  ["Amarra Nylon 300x3.6mm Negro", 1.26, "cerraduras"],
  ["Amolador Industrial 41/2\" 115mm 950W (Hoteche)", 49.59, "herramientas"],
  ["Aquavar Caoba/Mahogany", 12.74, "adhesivos"],
  ["Aquavar Early American", 12.74, "adhesivos"],
  ["Aquavar Jacobean Lanco", 13.65, "adhesivos"],
  ["Aquavar Marron Oscuro", 13.65, "adhesivos"],
  ["Aquavar Nuez", 13.65, "adhesivos"],
  ["Aquavar Nuez Oscuro", 13.65, "adhesivos"],
  ["Aquavar Transparente", 14.70, "adhesivos"],
  ["Aquavar Wengue", 13.65, "adhesivos"],
  ["Banco Mesa Portatil 60.5x12x1.8", 51.20, "herramientas"],
  ["Bandeja D/Esquina Der 35 7/16\"", 412.90, "organizacion"],
  ["Bandeja D/Esquina Izq 35 7/16\"", 322.31, "organizacion"],
  ["Bandeja Salpicadero 27/30\"", 35.00, "organizacion"],
  ["Bandeja Salpicadero 27/30\" Plateada", 35.00, "organizacion"],
  ["Bandeja Salpicadero 39/42\" Almendra", 35.00, "organizacion"],
  ["Base 180° P/TV LCD", 72.17, "herramientas"],
  ["Base 5\" para Velcro", 3.73, "herramientas"],
  ["Base Articulada P/TV LCD", 18.00, "herramientas"],
  ["Base Fija P/TV LCD", 26.51, "herramientas"],
  ["Base Giratoria P/TV LCD", 14.50, "herramientas"],
  ["Base Inclinacion Plana P/TV LCD", 27.81, "herramientas"],
  ["Base Inclinacion Plana P/TV LCD Hasta 75\"", 23.33, "herramientas"],
  ["Base Movimiento P/TV LCD", 78.73, "herramientas"],
  ["Base para Techo P/TV LCD", 34.38, "herramientas"],
  ["Base Portatil", 21.16, "herramientas"],
  ["Base Ultra Slim P/TV LCD", 29.89, "herramientas"],
  ["Blanco Polar 2800x2070x15mm", 60.99, "madera"],
  ["Bota de Seguridad Total Talla 40", 29.33, "herramientas"],
  ["Bota de Seguridad Total Talla 41", 36.81, "herramientas"],
  ["Bota de Seguridad Total Talla 42", 30.76, "herramientas"],
  ["Bota de Seguridad Total Talla 43", 31.47, "herramientas"],
  ["Bota de Seguridad Total Talla 44", 32.91, "herramientas"],
  ["Bota de Seguridad Total Talla 45", 27.30, "herramientas"],
  ["Bota Seguridad 39 (Negro)", 30.02, "herramientas"],
  ["Bota Seguridad 40 (Negro)", 30.39, "herramientas"],
  ["Bota Seguridad 41 (Negro)", 30.03, "herramientas"],
  ["Bota Seguridad 42 (Negro)", 30.03, "herramientas"],
  ["Bota Seguridad 43 (Negro)", 28.55, "herramientas"],
  ["Bota Seguridad 44 (Negro)", 30.03, "herramientas"],
  ["Bota Seguridad 45 (Negro)", 31.14, "herramientas"],
  ["Bota Seguridad Total Talla 39", 27.60, "herramientas"],
  ["Brocha 3\" Mango de Plastico", 1.44, "herramientas"],
  ["Brocha de 1 1/2\" Mango Madera Total", 0.85, "herramientas"],
  ["Brocha de 1\" Mango Madera Total", 0.45, "herramientas"],
  ["Brocha de 2 1/2\" Mango Madera Total", 1.24, "herramientas"],
  ["Brocha de 2\" Mango Madera Total", 1.42, "herramientas"],
  ["Brocha de 3\" Mango Madera Total", 2.41, "herramientas"],
  ["Brocha de 4\" Mango Madera Total", 3.54, "herramientas"],
  ["Brocha para Pintar 63mm", 1.00, "herramientas"]
];

const IMECA_PRICE_LIST_26 = [
  ["Broche de Presion Total (2 Pieza)", 0.55, "cerraduras"],
  ["Broche Magnetico", 0.66, "cerraduras"],
  ["Broche para Ventana", 2.40, "cerraduras"],
  ["Cabinet Hardware Jig", 33.67, "herramientas"],
  ["Canastilla Lavarropas Acero", 9.03, "organizacion"],
  ["Cartucho para Respirador Total", 7.02, "herramientas"],
  ["Casco de Seguridad Verdoso Total", 8.06, "herramientas"],
  ["Chapilla Madera Wengue 4x8", 80.73, "madera"],
  ["Clavito Acero 2.5x40mm", 0.70, "cerraduras"],
  ["Clavito Acero 2x25mm", 0.47, "cerraduras"],
  ["Clavito Acero 2x30mm", 0.47, "cerraduras"],
  ["Clip Ajuste Under", 2.05, "bisagras"],
  ["Clip UM Blum Der", 21.91, "bisagras"],
  ["Clip UM Blum Izq", 21.91, "bisagras"],
  ["Correa Tensora 1.5T 6M Total", 8.67, "herramientas"],
  ["Correa Tensora 2T 10M Total", 13.38, "herramientas"],
  ["Correa Tensora 3T 10M Total", 16.66, "herramientas"],
  ["Corta Circulo 3/4", 4.00, "herramientas"],
  ["Cortador Multifuncional 500W Hoteche", 57.90, "herramientas"],
  ["Crosscut", 32.65, "herramientas"],
  ["Cuerda Amarilla Bestvalue", 5.21, "herramientas"],
  ["Cuerda Gamma PP N4", 0.14, "herramientas"],
  ["Cuerda Superior Nautica N10 Roj-Neg", 0.70, "herramientas"],
  ["Cuerda Superior Nautica N8 Amar-Azul", 0.55, "herramientas"],
  ["Cuerda Torcido N6 Amarillo", 1.49, "herramientas"],
  ["Deslizadores 3/4\"", 1.11, "bisagras"],
  ["Deslizadores 5/8\"", 0.95, "bisagras"],
  ["Drawer Slide Jig", 33.67, "herramientas"],
  ["Ducha Cuad C/Tub Rell/Valv D/Presion-BR", 182.00, "organizacion"],
  ["Ducha Cuad/Llenado Tub/Val/D/Presion CR", 207.20, "organizacion"],
  ["Especiero 150mm 515x130x465mm (Doble)", 49.43, "organizacion"],
  ["Esperil Angular de 5\" 110V 900W", 34.90, "herramientas"],
  ["Espiral Amarre 12mmx10mts Negro", 8.25, "herramientas"],
  ["Espiral Amarre 12mmx10mts Transp", 8.25, "herramientas"],
  ["Espiral Amarre 6mmx10mts Negro", 3.31, "herramientas"],
  ["Espiral Amarre 6mmx10mts Transp", 3.31, "herramientas"],
  ["Espiral Amarre 9mmx10mts Negro", 5.70, "herramientas"],
  ["Espiral Amarre 9mmx10mts Transp", 5.70, "herramientas"],
  ["Espuma Expansiva 300ml Soudal", 3.25, "adhesivos"],
  ["Espuma Expansiva 600ml", 6.06, "adhesivos"],
  ["Espuma Poliuretano 500ml", 9.57, "adhesivos"],
  ["Espuma Poliuretano (Espuma Expansiva) 500ml", 7.20, "adhesivos"],
  ["Esquinero Doble Accion (Cuerpo Ciego) 15\"", 245.00, "bisagras"],
  ["Esquinero Flexible Negro 100mm", 1.80, "cerraduras"],
  ["Estante Conformado Wire Susan 28\"", 240.00, "organizacion"],
  ["Estante Conformado Wire Susan 32\"", 284.97, "organizacion"],
  ["Exacto 18mmx100mm", 2.00, "herramientas"],
  ["Exacto Aliminio Total", 3.93, "herramientas"],
  ["Exacto de Plastico Hoja Negra", 1.68, "herramientas"],
  ["Exacto Plastico Total", 1.46, "herramientas"],
  ["Extension Magnetica 75M", 2.80, "herramientas"],
  ["Extension Magnetica 90M", 5.25, "herramientas"],
  ["Film Envoltura 15\"", 6.97, "herramientas"]
];

const IMECA_PRICE_LIST_27 = [
  ["Film Envoltura 3\"", 3.88, "herramientas"],
  ["Film Envoltura 6\"", 6.12, "herramientas"],
  ["Film Strech", 8.68, "herramientas"],
  ["Flexible 20V 41/2\" Total", 70.73, "herramientas"],
  ["Flexible 20V Multifuncional Total", 38.23, "herramientas"],
  ["Flexible 7\" 2350W Total", 99.73, "herramientas"],
  ["Flexible de 41/2\" 750W 1200RPM Total", 34.04, "herramientas"],
  ["Flexible de 41/2\" 950W 1100RPM Total", 38.28, "herramientas"],
  ["Flexible Multifuncional 20V IMEX 1Bat-1Carg", 83.90, "herramientas"],
  ["Fregador Acero Inox Ontario", 387.00, "organizacion"],
  ["Galleta de Union 100Unid", 8.13, "herramientas"],
  ["Griferia D/Bañera U/Control Cepillado NK", 102.96, "organizacion"],
  ["Grip Bond 16oz", 8.89, "adhesivos"],
  ["Grip Bond 1gl Lanco", 42.53, "adhesivos"],
  ["Grip Bond 32oz", 15.39, "adhesivos"],
  ["Grip Bond 4oz", 4.11, "adhesivos"],
  ["Grip Bond 8oz", 5.90, "adhesivos"],
  ["Grommet 1/4 Niquel 100", 3.21, "cerraduras"],
  ["Grommet 5mm Niquel 100", 3.21, "cerraduras"],
  ["Grrr-Rip Block", 32.00, "herramientas"],
  ["Guia Autocentrante para Perforacion", 24.27, "herramientas"],
  ["Guia de Corte Kreg", 168.43, "herramientas"],
  ["Guia G030 Doble P/CD 50 CXR-S 3mtr Ducasse", 91.83, "bisagras"],
  ["Guias de Repuesto Accu-Cut", 14.14, "herramientas"],
  ["HD Pocket-Hole System", 80.84, "herramientas"],
  ["HDF 1.83x2.44x3mm Blanco (Fondo)", 26.00, "madera"],
  ["HDF 1.83x2.44x3mm Mogno Leon/Haya (Fondo)", 22.56, "madera"],
  ["HDF 1.83x2.44x3mm Tabaco Brasil (Fondo)", 26.00, "madera"],
  ["Herramienta Multifuncional 15 en 1 Total", 13.68, "herramientas"],
  ["High Tack Blanco 290ml", 5.96, "adhesivos"],
  ["High Tack Still", 6.95, "adhesivos"],
  ["High Tack Transparente 290ml", 7.22, "adhesivos"],
  ["High Tack (Ultra)", 7.62, "adhesivos"],
  ["Hoja de Lijado de Oxido 93x230mm", 1.25, "herramientas"],
  ["Hoja de Repuesto Exacto 61x19mm Total", 1.14, "herramientas"],
  ["Hoja de Segueta 300mm", 1.90, "herramientas"],
  ["Hoja para Segueta para Metales", 1.09, "herramientas"],
  ["Hoja Segueta 300mm", 0.76, "herramientas"],
  ["Hole Jig 310", 29.63, "herramientas"],
  ["Hole Jig 320", 53.89, "herramientas"],
  ["Ingletadora 10\" 20V Total", 197.39, "herramientas"],
  ["Ingleteadora 10\" 2000W Hoteche", 270.00, "herramientas"],
  ["Ingleteadora 10\" IMEX", 259.90, "herramientas"],
  ["Ingleteadora de Madera 2400W 12\"", 405.90, "herramientas"],
  ["K4 Pocket-Hole Jig", 126.86, "herramientas"],
  ["K5 Pocket-Hole Jig", 159.24, "herramientas"],
  ["Kerosene 16onz", 1.50, "herramientas"],
  ["Kerosene 32onz", 2.63, "herramientas"],
  ["Lapiz Carpintero", 0.17, "herramientas"]
];

const IMECA_PRICE_LIST_28 = [
  ["Lavamanos Modelos Varios (Dax)", 26.00, "organizacion"],
  ["Lavamanos Oslo 48x43 Blanco", 78.77, "organizacion"],
  ["Lavamanos Oslo 63x48 Blanco", 93.12, "organizacion"],
  ["Lavamanos Siena 48x43 Blanco", 83.09, "organizacion"],
  ["Lavamanos Trentino 63x48 Blanco", 81.22, "organizacion"],
  ["Lavarropa 50x50 Blanco", 140.76, "organizacion"],
  ["Lavarropas Aqua 90x60 Blanco", 160.00, "organizacion"],
  ["Lavatraperos Aqua 40x35 Blanco", 88.00, "organizacion"],
  ["Lentes Seguridad", 1.61, "herramientas"],
  ["Lija Amarilla 36\" #100", 6.00, "herramientas"],
  ["Lija de Agua 100", 0.58, "herramientas"],
  ["Lija de Agua 1000", 0.62, "herramientas"],
  ["Lija de Agua 120", 0.49, "herramientas"],
  ["Lija de Agua 150", 0.56, "herramientas"],
  ["Lija de Agua 1500", 0.33, "herramientas"],
  ["Lija de Agua 180", 0.56, "herramientas"],
  ["Lija de Agua 220", 0.56, "herramientas"],
  ["Lija de Agua 240", 0.56, "herramientas"],
  ["Lija de Agua 2500", 0.33, "herramientas"],
  ["Lija de Agua 280", 0.56, "herramientas"],
  ["Lija de Agua 320", 0.56, "herramientas"],
  ["Lija de Agua 360", 0.42, "herramientas"],
  ["Lija de Agua 400", 0.56, "herramientas"],
  ["Lija de Agua 60", 0.59, "herramientas"],
  ["Lija de Agua 600", 0.37, "herramientas"],
  ["Lija de Agua 80", 0.65, "herramientas"],
  ["Lija de Banda 3x21 100", 2.88, "herramientas"],
  ["Lija de Banda 3x21 36", 2.08, "herramientas"],
  ["Lija de Banda 3x21 40", 2.08, "herramientas"],
  ["Lija de Banda 3x21 60", 2.08, "herramientas"],
  ["Lija de Banda 3x21 80", 1.73, "herramientas"],
  ["Lija de Banda 3x21 Grano100", 1.50, "herramientas"],
  ["Lija de Banda 3x21 Grano120", 1.50, "herramientas"],
  ["Lija de Banda 3x21 Grano36", 1.50, "herramientas"],
  ["Lija de Banda 3x21 Grano40", 1.50, "herramientas"],
  ["Lija de Banda 3x21 Grano50", 1.50, "herramientas"],
  ["Lija de Banda 3x21 Grano60", 1.50, "herramientas"],
  ["Lija de Banda 3x21 Grano80", 1.50, "herramientas"],
  ["Lija de Banda 3x24 60", 2.10, "herramientas"],
  ["Lija de Banda 4x24x100", 2.25, "herramientas"],
  ["Lija de Madera 120", 0.80, "herramientas"],
  ["Lija de Madera 150", 0.33, "herramientas"],
  ["Lija de Madera 80", 0.40, "herramientas"],
  ["Lija para Pulir Granito #100", 2.03, "herramientas"],
  ["Lija para Pulir Granito #1500", 2.03, "herramientas"],
  ["Lija para Pulir Granito #200", 2.03, "herramientas"],
  ["Lija para Pulir Granito #3000", 2.03, "herramientas"],
  ["Lija para Pulir Granito #400", 2.03, "herramientas"],
  ["Lija para Pulir Granito #50", 2.03, "herramientas"],
  ["Lija para Pulir Granito #800", 2.03, "herramientas"],
  ["Lija Rollo Amarillo 12\" #100", 5.00, "herramientas"]
];

const IMECA_PRICE_LIST_29 = [
  ["Lona 2mx3m", 5.49, "herramientas"],
  ["Lona 3m x 3m x 0.25mm", 8.24, "herramientas"],
  ["Lona 3mx4m", 11.00, "herramientas"],
  ["Lona Azul 2x3m", 5.90, "herramientas"],
  ["Lona de Pliprolileno 3x3 Azul", 5.85, "herramientas"],
  ["Lona de Pliprolileno 4x5mtr Azul", 11.95, "herramientas"],
  ["Lona Multiuso 4m x 5m", 25.00, "herramientas"],
  ["Mandril 13mm Total", 4.34, "herramientas"],
  ["Mandril 3/8 para Cortar Circulos", 3.40, "herramientas"],
  ["Manillon de Entrada Laton Pulido Brown", 9.35, "jaladores"],
  ["Masking Tape 3M 1\"", 1.45, "cerraduras"],
  ["Masking Tape 3M 1\"x25M", 1.38, "cerraduras"],
  ["Master Switch Kreg", 45.97, "herramientas"],
  ["Mazo de Hule 16oz Blanco Abolu", 4.65, "herramientas"],
  ["Mazo Goma Fibra 16onz", 4.77, "herramientas"],
  ["Mazo Goma Fibra 16mm", 3.58, "herramientas"],
  ["Medidor Abrazadera AC/DC", 51.71, "herramientas"],
  ["Medidor de Abrazadera Pinza (Amperimetro)", 20.82, "herramientas"],
  ["Medidor Laser IP54", 58.19, "herramientas"],
  ["Mini Mototool 130W 32000RPM C/Accesorios Total", 31.33, "herramientas"],
  ["Mini Pocket-Hole Jig System", 21.95, "herramientas"],
  ["Mini Segueta Industrial 150mm/6", 3.84, "herramientas"],
  ["Mochila Bolso Espalda Total", 25.17, "herramientas"],
  ["Modelo Advansado GRR-Ripper", 79.01, "herramientas"],
  ["Modelo Basico GRR-Ripper", 59.23, "herramientas"],
  ["Multi-Mark", 23.00, "herramientas"],
  ["Multimetro Digital", 15.68, "herramientas"],
  ["Numero \"0\" Dorado", 1.08, "cerraduras"],
  ["Numero \"1\" Dorado", 1.08, "cerraduras"],
  ["Numero \"2\" Dorado", 1.08, "cerraduras"],
  ["Numero \"3\" Dorado", 1.08, "cerraduras"],
  ["Numero \"4\" Dorado", 1.08, "cerraduras"],
  ["Numero \"5\" Dorado", 1.08, "cerraduras"],
  ["Numero \"6\" Dorado", 1.08, "cerraduras"],
  ["Numero \"7\" Dorado", 1.08, "cerraduras"],
  ["Numero \"8\" Dorado", 1.08, "cerraduras"],
  ["Pack Expansion Accu-Cut", 112.61, "herramientas"],
  ["PB Std Blanco Coral 244x214x35mm", 120.00, "madera"],
  ["PB Std Wengue Coral 214x244x25mm", 120.00, "madera"],
  ["Pegadit Express", 14.26, "adhesivos"],
  ["Pegadit Turbomax 165g", 6.10, "adhesivos"]
];

const IMECA_PRICE_LIST_30 = [
  ["Pentadril Oscuro 32oz", 3.50, "adhesivos"],
  ["Pentadrin Claro 16onz", 2.20, "adhesivos"],
  ["Pentadrin Claro 32onz", 4.84, "adhesivos"],
  ["Perilla 32\" Brush Nickel", 6.39, "jaladores"],
  ["Perilla 32mm BN Serie 45219", 3.35, "jaladores"],
  ["Perilla 32mm Negro Serie 45214", 5.06, "jaladores"],
  ["Perilla 32mm Negro Serie 45219", 3.37, "jaladores"],
  ["Perilla 38mm Negro Serie 45353", 2.70, "jaladores"],
  ["Perilla 44610-72", 3.30, "jaladores"],
  ["Perilla 64mm Brush Nikel", 6.04, "jaladores"],
  ["Perilla 64mm Negro Serie 45289", 5.47, "jaladores"],
  ["Perilla Cuadrada Plana 1\"x1\"x3/4\"", 2.53, "jaladores"],
  ["Perilla Diamante 1 1/2\"x1 1/4\"x1\"", 2.00, "jaladores"],
  ["Perilla Niquelada Plateada 33mm", 2.86, "jaladores"],
  ["Perilla Solida Cuadrada 1\"x1\"x1\"", 3.22, "jaladores"],
  ["Perilla Solida Redonda K1", 0.98, "jaladores"],
  ["Picaporte Aluminio 1 1/2\"", 1.80, "cerraduras"],
  ["Picaporte Aluminio 2\"", 2.19, "cerraduras"],
  ["Picaporte Aluminio 4\"", 2.34, "cerraduras"],
  ["Picaporte Aluminio 6\"", 2.80, "cerraduras"],
  ["Pie de Amigo 5\"x6\" Gris", 0.54, "cerraduras"],
  ["Pie de Amigo 6\"x8\" Gris", 0.71, "cerraduras"],
  ["Pie de Amigo 8\"x10\" Gris", 0.99, "cerraduras"],
  ["Pino 366cm x 140mm x 19mm", 7.06, "madera"],
  ["Pino 366cm x 140mm x 32mm", 11.54, "madera"],
  ["Pino 366cm x 140mm x 38mm", 13.71, "madera"],
  ["Pino 366cm x 184mm x 19mm", 9.60, "madera"],
  ["Pino 366cm x 184mm x 32mm", 16.23, "madera"],
  ["Pino 366cm x 184mm x 38mm", 15.79, "madera"],
  ["Pino 366cm x 230mm x 19mm", 12.02, "madera"],
  ["Pino 366cm x 230mm x 25mm", 18.48, "madera"],
  ["Pino 366cm x 230mm x 32mm", 25.55, "madera"],
  ["Pino 366cm x 230mm x 38mm", 28.10, "madera"],
  ["Pino 366cm x 280mm x 38mm", 38.38, "madera"],
  ["Pino 366cm x 285mm x 32mm", 25.55, "madera"],
  ["Pino 366cm x 38mm x 19mm", 1.98, "madera"],
  ["Pino 366cm x 38mm x 25mm", 2.48, "madera"],
  ["Pino 366cm x 38mm x 32mm", 3.35, "madera"],
  ["Pino 366cm x 38mm x 38mm", 3.97, "madera"],
  ["Pino 366cm x 89mm x 19mm", 6.82, "madera"],
  ["Pino 366cm x 89mm x 25mm", 5.81, "madera"],
  ["Pino 366cm x 89mm x 32mm", 7.44, "madera"],
  ["Pino 366cm x 90mm x 19mm", 4.69, "madera"],
  ["Pino 366cm x 90mm x 25mm", 6.56, "madera"],
  ["Pino 366cm x 90mm x 32mm", 7.90, "madera"],
  ["Pino 366cm x 90mm x 38mm", 9.39, "madera"],
  ["Pino 366cm x 184mm x 25mm", 11.84, "madera"],
  ["Pinza de Resorte 4\" Total", 0.88, "herramientas"],
  ["Pinza de Resorte 6\" Total", 1.34, "herramientas"],
  ["Pistillo Doble Blanco", 1.45, "cerraduras"],
  ["Pistillo Doble Negro", 1.27, "cerraduras"]
];

const IMECA_PRICE_LIST_31 = [
  ["Pistillo Individual Blanco", 0.91, "cerraduras"],
  ["Pistillo Individual Negro", 0.90, "cerraduras"],
  ["Plantilla Ajustable para Albañil", 13.90, "herramientas"],
  ["Plantilla para Perfofaracion Madera", 38.45, "herramientas"],
  ["Plantilla para Perforaciones 90°", 29.52, "herramientas"],
  ["Plantilla Pines 1/4\"", 48.52, "herramientas"],
  ["Plantilla Pines 5mm", 55.98, "herramientas"],
  ["Platico Crommet Cromado", 1.98, "cerraduras"],
  ["Platico Grommet Beige Dia 60mm Hig 22mm", 1.07, "cerraduras"],
  ["Platico Grommet Blanco Dia 60mm Hig 22mm", 1.17, "cerraduras"],
  ["Platico Grommet Gris Dia 60mm Hig 22mm", 1.19, "cerraduras"],
  ["Platico Grommet Negro Dia 60mm Hig 22mm", 1.00, "cerraduras"],
  ["Plato Giratorio 391mm", 18.14, "organizacion"],
  ["Plato Giratorio Negro 150mm", 7.04, "organizacion"],
  ["Plato Giratorio Negro 250mm", 13.89, "organizacion"],
  ["Plato Giratorio Aluminio 350mm", 17.82, "organizacion"],
  ["Pocket Hole 520 Pro", 122.49, "herramientas"],
  ["Pocket-Hole Jig 720", 170.61, "herramientas"],
  ["Pocket-Hole Jig 720 Pro", 170.61, "herramientas"],
  ["Porta Cinturon Negro 14\"", 38.97, "herramientas"],
  ["Porta Corbata Metalico Satinado", 21.34, "organizacion"],
  ["R3 Pocket Hole Jig System", 40.41, "herramientas"],
  ["Regleta 6 Plug 2 USB", 14.37, "herramientas"],
  ["Remachadora 10\"", 5.52, "herramientas"],
  ["Repisa Doble P/DVD", 45.24, "organizacion"],
  ["Repisa Extraible 27 1/2\"", 401.60, "organizacion"],
  ["Repisa Extraible 32 1/2\"", 393.51, "organizacion"],
  ["Repisa P/DVD", 44.21, "organizacion"],
  ["Repuesto Hoja de Exacto 10Unid Total", 1.07, "herramientas"],
  ["Respirador Media Mascara 2Filtros Total", 29.14, "herramientas"],
  ["Retazos Varios", 8.00, "madera"],
  ["Rip-Cut", 56.58, "herramientas"],
  ["Segueta 12\" Total", 5.55, "herramientas"],
  ["Serrucho 16\" Total", 6.72, "herramientas"],
  ["Servicio Corte de Pinotea", 0.35, "herramientas"],
  ["Servicio Corte y Enchapado", 1.00, "herramientas"],
  ["Servicio de Regrosado", 1.00, "herramientas"],
  ["Servicio por Almacenaje", 5.00, "herramientas"],
  ["Shelf Pin Drilling Jig 1/4", 47.15, "herramientas"],
  ["Shelf Pin Jig 5mm", 52.25, "herramientas"]
];

const IMECA_PRICE_LIST_32 = [
  ["Soldadora Inverter de Electrodos Total", 205.49, "herramientas"],
  ["Square-Cut", 16.16, "herramientas"],
  ["Sujetador 1000kgs con Matraca", 16.95, "herramientas"],
  ["Sujetador 2250kg con Matr", 14.00, "herramientas"],
  ["Sujetador 5000kgs con Matraca", 24.50, "herramientas"],
  ["Sujetador de Carga con Matraca", 19.49, "herramientas"],
  ["Taco P/Gypsum 7/16x1 11/16\"", 1.34, "cerraduras"],
  ["Taco P/Gypsum 7/16x1 5/16\"", 1.18, "cerraduras"],
  ["Taco P/Gypsum 7/16x1 5/16\" 10Pc", 1.45, "cerraduras"],
  ["Tacos Verde Pack 100Unid", 2.75, "cerraduras"],
  ["Tape Azul para Pintar 3M", 4.77, "cerraduras"],
  ["Tape de Embalaje", 2.04, "cerraduras"],
  ["Tape para Empapelar 1.2x25cm", 6.00, "cerraduras"],
  ["Tape para Empapelar 2.5x25cm", 7.50, "cerraduras"],
  ["Tomacorriente Retractil", 191.00, "herramientas"],
  ["Trenzado Diamante N10 5mtrs (Cuerda)", 3.54, "herramientas"],
  ["Trenzado Gamma N3 20mtrs Azul (Cuerda)", 2.19, "herramientas"],
  ["Trenzado Gamma N3 20mtrs Rojo (Cuerda)", 2.19, "herramientas"],
  ["Trenzado Gamma N4 20mtrs (Cuerda)", 2.99, "herramientas"],
  ["Trenzado Gamma N6 10mtrs Blanco-Negro (Cuerda)", 2.34, "herramientas"],
  ["Tripode Aluminio 1/2M", 34.87, "herramientas"],
  ["Tronzadora 14\" 2350W", 84.00, "herramientas"],
  ["Turbo Max 446g", 9.10, "adhesivos"],
  ["Vernier Calibrador Digital", 7.46, "herramientas"],
  ["Vernier Digital TMT Total", 28.66, "herramientas"],
  ["Wood Zin 1/4gl", 15.63, "adhesivos"],
  ["Zapato de Seguridad Talla 39 (6)", 30.56, "herramientas"],
  ["Zapato de Seguridad Talla 40 (6 1/2)", 30.95, "herramientas"],
  ["Zapato de Seguridad Talla 41 (7)", 30.95, "herramientas"],
  ["Zapato de Seguridad Talla 42 Total", 26.97, "herramientas"],
  ["Zapato de Seguridad Talla 43 (9)", 30.95, "herramientas"],
  ["Zapato de Seguridad Talla 44 (10)", 29.73, "herramientas"],
  ["Zapato de Seguridad Talla 45", 26.97, "herramientas"],
  ["Zeroplay Sistema de Guia", 50.04, "bisagras"],
  ["Zuncho 4\" Negro", 1.13, "herramientas"],
  ["Zuncho 6\" Negro", 1.95, "herramientas"],
  ["Zuncho 8\" Negro", 2.63, "herramientas"]
];

// se puede llamar en cada carga sin duplicar lo que ya esté.
function seedImecaPrices() {
  if (!state.globalPrices.customItems) state.globalPrices.customItems = [];
  const existingNames = new Set(state.globalPrices.customItems.map(c => c.name));
  let added = 0;
  const allBatches = [
    IMECA_PRICE_LIST, IMECA_PRICE_LIST_2, IMECA_PRICE_LIST_3, IMECA_PRICE_LIST_4, IMECA_PRICE_LIST_5,
    IMECA_PRICE_LIST_6, IMECA_PRICE_LIST_7, IMECA_PRICE_LIST_8, IMECA_PRICE_LIST_9, IMECA_PRICE_LIST_10,
    IMECA_PRICE_LIST_11, IMECA_PRICE_LIST_12, IMECA_PRICE_LIST_13, IMECA_PRICE_LIST_14, IMECA_PRICE_LIST_15,
    IMECA_PRICE_LIST_16, IMECA_PRICE_LIST_17, IMECA_PRICE_LIST_18, IMECA_PRICE_LIST_19, IMECA_PRICE_LIST_20,
    IMECA_PRICE_LIST_21, IMECA_PRICE_LIST_22, IMECA_PRICE_LIST_23, IMECA_PRICE_LIST_24, IMECA_PRICE_LIST_25,
    IMECA_PRICE_LIST_26, IMECA_PRICE_LIST_27, IMECA_PRICE_LIST_28, IMECA_PRICE_LIST_29, IMECA_PRICE_LIST_30,
    IMECA_PRICE_LIST_31, IMECA_PRICE_LIST_32
  ];
  allBatches.forEach(batch => {
    batch.forEach(([name, price, category]) => {
      if (existingNames.has(name)) return;
      state.globalPrices.customItems.push({ name, price, category });
      existingNames.add(name);
      added++;
    });
  });
  if (added > 0) { saveGlobalPrices(); }
  return added;
}

// ── Catálogo de empresa seleccionado para la cotización ───────────────────────
let _quoteCatalogCompanyId = null;
let _quoteCatalogCache = null; // { categories:[], products:[] }

async function populateQuoteCatalogCompanySelect() {
  const sel = document.getElementById("quoteCatalogCompanySelect");
  if (!sel) return;
  try {
    const r = await fetch("/api/companies");
    const companies = r.ok ? await r.json() : [];
    const approved = companies.filter(c => c.status === "approved");
    const current = sel.value;
    sel.innerHTML = `<option value="">— Precios generales del mercado —</option>` +
      approved.map(c => `<option value="${c.id}">${escapeHtml(c.name)}${c.category ? " · " + escapeHtml(c.category) : ""}</option>`).join("");
    if (current && approved.find(c => c.id === current)) sel.value = current;
  } catch {}
}

async function selectQuoteCatalogCompany(companyId) {
  _quoteCatalogCompanyId = companyId || null;
  _quoteCatalogCache = null;
  const infoEl = document.getElementById("quoteCatalogCompanyInfo");
  const labelEl = document.getElementById("materialComboLabel");
  if (!companyId) {
    if (infoEl) infoEl.textContent = "";
    if (labelEl) labelEl.firstChild.textContent = "Material ";
    resetMaterialCombo();
    return;
  }
  if (infoEl) infoEl.textContent = "Cargando catálogo…";
  try {
    const r = await fetch(`/api/companies/${companyId}/catalog`);
    if (!r.ok) throw new Error("no catalog");
    _quoteCatalogCache = await r.json();
    const count = _quoteCatalogCache.products?.length || 0;
    if (infoEl) infoEl.textContent = `${count} producto${count !== 1 ? "s" : ""} disponible${count !== 1 ? "s" : ""}`;
    if (labelEl) {
      const sel = document.getElementById("quoteCatalogCompanySelect");
      const compName = sel?.options[sel.selectedIndex]?.text?.split(" · ")[0] || "";
      labelEl.firstChild.textContent = `Material de ${compName} `;
    }
  } catch {
    if (infoEl) infoEl.textContent = "No se pudo cargar el catálogo de esta empresa.";
    _quoteCatalogCache = null;
  }
  resetMaterialCombo();
}

document.getElementById("quoteCatalogCompanySelect")?.addEventListener("change", (e) => {
  selectQuoteCatalogCompany(e.target.value);
});

function getMaterialCatalogEntries() {
  // Si hay empresa seleccionada en cotización → usar su catálogo
  if (_quoteCatalogCompanyId && _quoteCatalogCache) {
    const { categories = [], products = [] } = _quoteCatalogCache;
    return products.map(pr => ({
      value: `catalog:${pr.id}`,
      category: pr.categoryPath || pr.categoryId || "otros",
      description: [pr.name, pr.brand, pr.thickness, pr.color, pr.presentation].filter(Boolean).join(" · "),
      unitPrice: Number(pr.price) || 0
    }));
  }
  // Fallback: precios generales del mercado (prices.json)
  const prices = tenantPrices();
  const names = prices._names || {};
  const standardKeys = Object.keys(defaultGlobalPrices).filter(k => !NON_MATERIAL_PRICE_KEYS.includes(k));
  const entries = standardKeys
    .filter(k => typeof prices[k] === "number")
    .map(k => ({
      value: `std:${k}`,
      category: STANDARD_KEY_CATEGORY[k] || "madera",
      description: names[k] || defaultPriceNames[k] || k,
      unitPrice: Number(prices[k]) || 0
    }));
  (prices.customItems || []).forEach((c, i) => {
    entries.push({
      value: `custom:${i}`,
      category: MATERIAL_CATEGORIES[c.category] ? c.category : "madera",
      description: c.name,
      unitPrice: Number(c.price) || 0
    });
  });
  return entries;
}

let _selectedMaterialEntry = null;
let _materialComboCategory = null; // null = lista de categorías; key = ya entró a una categoría

function materialComboItemRow(entry, query, matchIdx) {
  const desc = entry.description;
  let nameHtml = escapeHtml(desc);
  if (query && matchIdx !== -1) {
    nameHtml = escapeHtml(desc.slice(0, matchIdx)) + "<mark>" + escapeHtml(desc.slice(matchIdx, matchIdx + query.length)) + "</mark>" + escapeHtml(desc.slice(matchIdx + query.length));
  }
  return `<div class="material-combo-item" data-combo-value="${entry.value}"><span class="name">${nameHtml}</span><span class="price">$${entry.unitPrice.toFixed(2)}</span></div>`;
}

function renderMaterialCombo(query) {
  const panel = document.getElementById("materialSearchResults");
  if (!panel) return;
  const entries = getMaterialCatalogEntries();
  const q = (query || "").trim().toLowerCase();

  if (q) {
    const matches = entries
      .map(e => ({ e, idx: e.description.toLowerCase().indexOf(q) }))
      .filter(x => x.idx !== -1)
      .sort((a, b) => a.idx - b.idx || a.e.description.length - b.e.description.length);
    panel.innerHTML = matches.length
      ? matches.map(({ e, idx }) => materialComboItemRow(e, q, idx)).join("")
      : `<p class="material-combo-empty">Sin resultados — agrégalo primero en Precios del mercado.</p>`;
    return;
  }

  if (_materialComboCategory) {
    const items = entries.filter(e => e.category === _materialComboCategory);
    panel.innerHTML = `<div class="material-combo-back" data-combo-back="1">← Categorías</div>` +
      (items.length
        ? items.map(e => materialComboItemRow(e, "", -1)).join("")
        : `<p class="material-combo-empty">Sin materiales en esta categoría todavía.</p>`);
    return;
  }

  panel.innerHTML = Object.entries(MATERIAL_CATEGORIES).map(([key, label]) => {
    const count = entries.filter(e => e.category === key).length;
    return `<div class="material-combo-cat-row" data-combo-cat="${key}"><span>${label}</span><span class="count">${count}</span></div>`;
  }).join("");
}

function resetMaterialCombo() {
  _selectedMaterialEntry = null;
  _materialComboCategory = null;
  const input = document.getElementById("materialSearchInput");
  if (input) input.value = "";
  const display = document.getElementById("materialPriceDisplay");
  if (display) display.textContent = "—";
  document.getElementById("materialSearchResults")?.classList.add("hidden");
}

document.getElementById("materialSearchInput")?.addEventListener("focus", (e) => {
  _materialComboCategory = null;
  document.getElementById("materialSearchResults").classList.remove("hidden");
  renderMaterialCombo(e.target.value);
});

document.getElementById("materialSearchInput")?.addEventListener("input", (e) => {
  _selectedMaterialEntry = null;
  document.getElementById("materialPriceDisplay").textContent = "—";
  _materialComboCategory = null;
  document.getElementById("materialSearchResults").classList.remove("hidden");
  renderMaterialCombo(e.target.value);
});

document.getElementById("materialSearchInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { document.getElementById("materialSearchResults").classList.add("hidden"); e.target.blur(); }
});

document.getElementById("materialSearchInput")?.addEventListener("blur", () => {
  setTimeout(() => document.getElementById("materialSearchResults")?.classList.add("hidden"), 120);
});

document.getElementById("materialSearchResults")?.addEventListener("mousedown", (e) => {
  e.preventDefault(); // evita que el input pierda foco antes de procesar el click
  const catEl = e.target.closest("[data-combo-cat]");
  if (catEl) { _materialComboCategory = catEl.dataset.comboCat; renderMaterialCombo(""); return; }
  const backEl = e.target.closest("[data-combo-back]");
  if (backEl) { _materialComboCategory = null; renderMaterialCombo(""); return; }
  const itemEl = e.target.closest("[data-combo-value]");
  if (itemEl) {
    const entry = getMaterialCatalogEntries().find(en => en.value === itemEl.dataset.comboValue);
    if (entry) {
      _selectedMaterialEntry = entry;
      document.getElementById("materialSearchInput").value = entry.description;
      document.getElementById("materialPriceDisplay").textContent = `$${entry.unitPrice.toFixed(2)}`;
    }
    document.getElementById("materialSearchResults").classList.add("hidden");
  }
});

document.getElementById("addMaterialBtn")?.addEventListener("click", () => {
  if (!_selectedMaterialEntry) { toast("Elige un material de la lista de precios del mercado.", "error"); return; }
  state.materialCartItems.push({
    id: crypto.randomUUID(),
    description: _selectedMaterialEntry.description,
    qty: Number(document.getElementById("materialQty").value) || 1,
    unit: document.getElementById("materialUnit").value,
    unitPrice: _selectedMaterialEntry.unitPrice
  });
  resetMaterialCombo();
  document.getElementById("materialQty").value = "1";
  renderDraftItems();
  toast("Material agregado ✓");
});

els.quoteItemsList.addEventListener("click", (event) => {
  const removeId = event.target.dataset.removeItem;
  if (!removeId) return;
  state.materialCartItems = state.materialCartItems.filter((item) => item.id !== removeId);
  renderDraftItems();
});

// Precio editable por línea — actualiza solo los totales en pantalla, sin re-render
// completo, para no perder el foco del input mientras se escribe.
els.quoteItemsList.addEventListener("input", (event) => {
  const editId = event.target.dataset.editPrice;
  if (!editId) return;
  const item = state.materialCartItems.find((it) => it.id === editId);
  if (!item) return;
  item.unitPrice = Number(event.target.value) || 0;
  const card = event.target.closest(".quote-item-card");
  if (card) card.querySelector(".item-price").textContent = `$${(item.qty * item.unitPrice).toFixed(2)}`;
  const subtotal = state.materialCartItems.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const subtotalEl = els.quoteItemsList.querySelector(".draft-subtotal strong");
  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
});

els.assistantOutput?.addEventListener("click", (event) => {
  const action = event.target.dataset.aiAction;
  const item = state.lastDesignItems[0];
  if (!action || !item) return;

  if (action === "fill") {
    state.editingItemId = null;
    fillFormFromItem(item);
    showView("quoteView");
  }

  if (action === "quote") {
    addItemsToQuote([item]);
    showView("quoteView");
  }

  if (action === "cuts") {
    addItemsToQuote([item]);
    showView("cutsView");
    renderCuts();
  }
});

// ── Agregar pieza a Cortes: largo/ancho + canto por lado largo/corto + veta ──
// Mapeo geométrico: largo = height (los lados "largo" corren vertical = left/right),
//                    ancho = width  (los lados "corto" corren horizontal = top/bottom).
function buildManualPieces({ furniture, name, largo, ancho, qty, thickness, cantoSides, cantoThickness, grain, grainDir }) {
  const edgeSides = {
    left:   cantoSides.l1 ? cantoThickness : null,
    right:  cantoSides.l2 ? cantoThickness : null,
    top:    cantoSides.c1 ? cantoThickness : null,
    bottom: cantoSides.c2 ? cantoThickness : null
  };
  // La medida que da el ebanista es la medida de corte exacta — el canto no se resta de nada.
  const baseName = name || "Pieza";
  return Array.from({ length: Math.max(1, qty) }, (_, i) => ({
    id: crypto.randomUUID(),
    furniture: furniture || "",
    name: qty > 1 ? `${baseName} ${i + 1}` : baseName,
    width: roundMm(ancho),
    height: roundMm(largo),
    thickness,
    edgeSides,
    edge: describeEdgeSides(edgeSides),
    grain: Boolean(grain),
    grainDirection: grain ? (grainDir || "largo") : null,
    area: roundMm(ancho * largo)
  }));
}

function addPiecesToCuts(pieces) {
  state.manualPieces = [...state.manualPieces, ...pieces];
  state.editablePieces = [...state.editablePieces, ...pieces];
  renderCutsPiecesTable();
  recalcCutsLayout();
}

document.getElementById("addManualPieceBtn")?.addEventListener("click", () => {
  const largo = Number(document.getElementById("mp_largo").value);
  const ancho = Number(document.getElementById("mp_ancho").value);
  if (!largo || !ancho) { toast("Ingresa largo y ancho.", "error"); return; }
  const qty = Math.max(1, Number(document.getElementById("mp_qty").value) || 1);
  const pieces = buildManualPieces({
    furniture: document.getElementById("mp_furniture").value.trim(),
    name: document.getElementById("mp_name").value.trim(),
    largo, ancho, qty,
    thickness: document.getElementById("mp_thickness").value,
    cantoSides: {
      l1: document.getElementById("mp_cantoL1").checked,
      l2: document.getElementById("mp_cantoL2").checked,
      c1: document.getElementById("mp_cantoC1").checked,
      c2: document.getElementById("mp_cantoC2").checked
    },
    cantoThickness: document.getElementById("mp_cantoThickness").value,
    grain: document.getElementById("mp_grain").checked,
    grainDir: document.getElementById("mp_grainDir").value
  });
  addPiecesToCuts(pieces);
  toast(`${pieces.length} pieza(s) agregada(s) ✓`);
  document.getElementById("mp_name").value = "";
  document.getElementById("mp_qty").value = "1";
});

// Texto libre (escrito o dictado por voz): "4 piezas con 40mm de largo, 30 de ancho, canto en los anchos".
// Numero sin unidad = mm por defecto (asi suelen anotar las medidas); "cm" explicito se respeta.
// El dictado por voz no siempre transcribe en dígitos -- "ochenta centímetros" llega tal cual,
// no "80 centímetros" -- así que TODAS las medidas (no solo la cantidad de piezas) necesitan
// poder leerse como número en palabras, hasta los miles (un sheet de "dos mil cuatrocientos
// cuarenta" mm es un caso real).
const SPANISH_UNITS = {
  cero: 0, un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29
};
const SPANISH_TENS = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const SPANISH_HUNDREDS = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900
};
const ALL_NUMBER_WORDS = [...Object.keys(SPANISH_UNITS), ...Object.keys(SPANISH_TENS), ...Object.keys(SPANISH_HUNDREDS), "mil"];
// Fragmento de regex: dígitos normales O una secuencia de palabras numéricas en español
// ("ochenta y cinco", "doscientos cuarenta", "dos mil cuatrocientos cuarenta").
const NUM = `(?:\\d+(?:[.,]\\d+)?|(?:(?:${ALL_NUMBER_WORDS.join("|")})\\s*(?:y\\s*)?)+)`;

// Convierte una secuencia YA AISLADA de palabras numéricas ("ochenta", "y", "cinco") al entero
// que representan. "mil" multiplica lo acumulado hasta ahí (o vale 1000 si no hay nada antes).
function parseSpanishNumberWords(words) {
  let total = 0, current = 0;
  for (const w of words) {
    if (!w || w === "y") continue;
    if (w === "mil") { total += (current || 1) * 1000; current = 0; continue; }
    if (w in SPANISH_HUNDREDS) { current += SPANISH_HUNDREDS[w]; continue; }
    if (w in SPANISH_TENS) { current += SPANISH_TENS[w]; continue; }
    if (w in SPANISH_UNITS) { current += SPANISH_UNITS[w]; continue; }
    return null; // palabra no reconocida -- secuencia inválida, no es un número real
  }
  return total + current;
}

// Convierte el texto capturado por NUM (dígitos o palabras) a un número real.
// "." y "," son ambiguos en español hablado/transcrito: "1.000" normalmente es mil (separador
// de miles), pero "0.45"/"1,5" es un decimal real (grosor de canto, p.ej.). Un separador seguido
// de EXACTAMENTE 3 dígitos casi siempre es agrupación de miles en este dominio -- las medidas en
// mm rara vez llevan más de 1-2 decimales -- así que se distingue por la cantidad de dígitos
// después del separador, no por asumir siempre que es decimal (eso convertía "1.000mm" en 1mm).
function parseDigitToken(raw) {
  const m = raw.match(/^(\d+)[.,](\d+)$/);
  if (!m) return Number(raw);
  const [, intPart, fracPart] = m;
  return fracPart.length === 3 ? Number(intPart + fracPart) : Number(intPart + "." + fracPart);
}

function parseNumberToken(token) {
  const t = String(token || "").trim();
  if (!t) return null;
  if (/^\d/.test(t)) return parseDigitToken(t);
  return parseSpanishNumberWords(t.toLowerCase().split(/\s+/));
}

function extractQuantity(t) {
  const m = t.match(new RegExp(`(${NUM})\\s*,?\\s*piezas?`, "i"));
  if (!m) return 1;
  const value = parseNumberToken(m[1]);
  return value != null && value > 0 ? value : 1;
}

// Cuenta cuántos lados "largo" o "ancho/corto" lleva canto, aceptando varias formas naturales
// de decirlo: número explícito ("2 anchos"), "un/una X", "ambos/los/las X" (plural = los dos),
// o el plural suelto ("anchos") que en este contexto siempre significa los dos lados de ese tipo.
// "ancho" como palabra de canto nunca choca con la medida ("30 de ancho") porque esa es singular
// y sin esos cuantificadores alrededor.
function sideCount(t, words) {
  const alt = words.join("|");
  const explicitNum = t.match(new RegExp(`(\\d+)\\s*(?:lados?\\s*)?(?:${alt})s?\\b`, "i"));
  if (explicitNum) return Math.min(2, Number(explicitNum[1]));
  if (new RegExp(`\\bun[ao]?\\s*(?:lado\\s*)?(?:${alt})\\b`, "i").test(t)) return 1;
  if (new RegExp(`\\b(ambo[sa]s|los|las|dos)\\s*(?:lados?\\s*)?(?:${alt})s\\b`, "i").test(t)) return 2;
  if (new RegExp(`\\b(?:${alt})s\\b`, "i").test(t)) return 2; // plural suelto = ambos lados
  return 0;
}

// Cortes trabaja todo en mm. Unidad hablada/escrita: sin unidad o "mm"/"milimetros" = ya
// está en mm; "cm"/"centimetros" se pasa a mm (×10). Acepta abreviado o palabra completa
// porque el dictado por voz casi siempre transcribe la palabra completa, no "cm"/"mm".
const UNIT_WORD = "(mm|mil[ií]metros?|cm|cent[ií]metros?)";
function toMm(val, unitWord) {
  const u = String(unitWord || "").toLowerCase();
  return (u.startsWith("cm") || u.startsWith("cent")) ? val * 10 : val;
}

function extractThickness(t) {
  const THICKNESS_OPTS = [15, 18, 25, 36];
  let m = t.match(new RegExp(`grosor\\s*(?:de\\s*)?(${NUM})\\s*${UNIT_WORD}?`, "i"))
    || t.match(new RegExp(`(${NUM})\\s*${UNIT_WORD}?\\s*(?:de\\s*)?grosor`, "i"));
  const numVal = m && parseNumberToken(m[1]);
  if (numVal == null) return "18 mm";
  const val = toMm(numVal, m[2]);
  const nearest = THICKNESS_OPTS.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a);
  return nearest === 36 ? "36 mm doble laminado" : `${nearest} mm`;
}

function extractCantoThickness(t) {
  const CANTO_OPTS = [0.45, 1.00, 2.00];
  let m = t.match(new RegExp(`canto\\s*(?:de\\s*)?(${NUM})\\s*${UNIT_WORD}?`, "i"))
    || t.match(new RegExp(`(${NUM})\\s*${UNIT_WORD}?\\s*(?:de\\s*)?canto`, "i"));
  const numVal = m && parseNumberToken(m[1]);
  if (numVal == null) return "1.00mm";
  const val = toMm(numVal, m[2]);
  const nearest = CANTO_OPTS.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a);
  return nearest.toFixed(2) + "mm";
}

// Busca la medida de "word" (largo/ancho) aceptando los dos órdenes naturales:
// "900 de largo" (número primero) y "largo de 900" / "largo: 900" / "largo es 900" (palabra
// primero). searchFrom limita la búsqueda a partir de un índice, para no volver a agarrar
// un número que ya se le asignó a la otra dimensión.
function findDimensionMatch(t, word, searchFrom = 0) {
  const sub = t.slice(searchFrom);
  let m = sub.match(new RegExp(`(${NUM})\\s*${UNIT_WORD}?\\s*(?:de\\s*)?${word}`, "i"));
  if (!m) m = sub.match(new RegExp(`${word}\\s*(?:es\\s*|:\\s*|de\\s*)?(${NUM})\\s*${UNIT_WORD}?`, "i"));
  if (!m) return null;
  const value = parseNumberToken(m[1]);
  if (value == null) return null;
  return { value: toMm(value, m[2]), start: searchFrom + m.index, end: searchFrom + m.index + m[0].length };
}

// Un solo dictado/texto puede describir VARIOS modelos distintos de pieza ("4 piezas de 80x80...
// 4 piezas más de 5x5...") -- en vez de pedirle al usuario que pare la grabación y dicte cada
// modelo por separado, se corta el texto en un segmento por cada vez que aparece "<N> piezas"
// (la misma marca que ya usa extractQuantity) y cada segmento se interpreta de forma
// independiente. Si solo hay una marca (o ninguna), se devuelve el texto completo como un único
// segmento -- mismo comportamiento de antes para una descripción de un solo modelo.
function splitIntoPieceSegments(text) {
  const t = String(text || "");
  const marker = new RegExp(`(?:\\d+|\\b(?:${ALL_NUMBER_WORDS.join("|")})\\b)\\s*,?\\s*piezas?\\b`, "gi");
  const starts = [];
  let m;
  while ((m = marker.exec(t)) !== null) starts.push(m.index);
  if (starts.length <= 1) return [t];
  return starts.map((start, i) => t.slice(i === 0 ? 0 : start, i + 1 < starts.length ? starts[i + 1] : t.length));
}

function parsePieceFromText(text) {
  const t = String(text || "").toLowerCase();

  const largoMatch = findDimensionMatch(t, "largo");
  let anchoMatch = largoMatch ? findDimensionMatch(t, "ancho") : null;
  // Si "ancho" agarró el mismo texto que ya es de "largo" (se traslapan de verdad), reintenta
  // buscando solo después de donde terminó el match de largo. Un solapamiento REAL es que los
  // rangos de caracteres se crucen -- no solo que "ancho" aparezca antes en el texto, que es un
  // orden de dictado perfectamente válido ("cinco de ancho, cinco de largo" también es correcto).
  if (largoMatch && anchoMatch && anchoMatch.start < largoMatch.end && anchoMatch.end > largoMatch.start) {
    anchoMatch = findDimensionMatch(t, "ancho", largoMatch.end);
  }
  if (!largoMatch || !anchoMatch) return null;
  const largo = largoMatch.value;
  const ancho = anchoMatch.value;

  const qty = extractQuantity(t);
  const thickness = extractThickness(t);
  const cantoThickness = extractCantoThickness(t);

  const allSides = /todos los (cantos|lados)|4 cantos|canto en todo|canto por todos lados/.test(t);
  const largoCount = allSides ? 2 : sideCount(t, ["largo"]);
  // "ancho" es el nombre nuevo del lado corto — se acepta "corto" tambien por si lo dicen asi.
  const anchoSideCount = allSides ? 2 : sideCount(t, ["ancho", "corto"]);
  const cantoSides = { l1: largoCount >= 1, l2: largoCount >= 2, c1: anchoSideCount >= 1, c2: anchoSideCount >= 2 };

  const grain = /veta/.test(t);
  const grainDir = /veta.*ancho|ancho.*veta/.test(t) ? "ancho" : "largo";

  return { furniture: "", name: "Pieza", largo, ancho, qty, thickness, cantoSides, cantoThickness, grain, grainDir };
}

document.getElementById("parseManualPieceBtn")?.addEventListener("click", () => {
  const input = document.getElementById("mp_naturalInput");
  // Un mismo texto/dictado puede describir varios modelos ("4 piezas de 80x80... 4 piezas más
  // de 5x5...") -- se separa en segmentos (uno por cada "<N> piezas" mencionado) y cada uno se
  // interpreta por su cuenta, en vez de quedarse solo con el primer modelo y descartar el resto.
  const segments = splitIntoPieceSegments(input.value);
  const thickness = document.getElementById("mp_voiceThickness").value;
  const cantoThickness = document.getElementById("mp_voiceCantoThickness").value;
  const allPieces = [];
  let modelsOk = 0, modelsFailed = 0;
  for (const segment of segments) {
    const parsed = parsePieceFromText(segment);
    if (!parsed) { modelsFailed++; continue; }
    // Grosor de lámina y de canto vienen de los selectores, no del texto — más confiable que
    // detectarlos de lo que se dijo/escribió.
    parsed.thickness = thickness;
    parsed.cantoThickness = cantoThickness;
    allPieces.push(...buildManualPieces(parsed));
    modelsOk++;
  }
  if (!modelsOk) { toast('No entendí las medidas — usa algo como "40 de largo, 30 de ancho".', "error"); return; }
  addPiecesToCuts(allPieces);
  const modelsNote = modelsOk > 1 ? ` en ${modelsOk} modelos` : "";
  const failedNote = modelsFailed ? ` (${modelsFailed} parte(s) del texto no se entendió)` : "";
  toast(`${allPieces.length} pieza(s) creada(s)${modelsNote} desde el texto ✓${failedNote}`);
  input.value = "";
});
document.getElementById("mp_naturalInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("parseManualPieceBtn").click();
});

// ── Dictado por voz para la descripción en una sola línea ───────────────────
// Modo "press to toggle": queda escuchando (incluso a través de pausas/silencios)
// hasta que el usuario vuelve a presionar el botón — no se detiene solo.
const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
let _mpVoiceRecognition = null;
let _mpVoiceListening = false;

document.getElementById("mp_voiceBtn")?.addEventListener("click", () => {
  if (!SpeechRecognitionImpl) { toast("Tu navegador no soporta dictado por voz — usa Chrome o Edge.", "error"); return; }
  const btn = document.getElementById("mp_voiceBtn");

  if (_mpVoiceListening) {
    _mpVoiceListening = false; // el onend que dispare este stop() ya no debe reiniciar solo
    _mpVoiceRecognition?.stop();
    return;
  }

  const input = document.getElementById("mp_naturalInput");
  const recognition = new SpeechRecognitionImpl();
  _mpVoiceRecognition = recognition;
  recognition.lang = "es";
  recognition.continuous = true;
  recognition.interimResults = true;

  let finalText = "";
  recognition.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += transcript + " ";
      else interim += transcript;
    }
    input.value = (finalText + interim).trim();
  };
  recognition.onerror = (event) => {
    if (event.error === "not-allowed") {
      _mpVoiceListening = false;
      toast("Permiso de micrófono denegado — actívalo en el navegador.", "error");
    } else if (event.error !== "no-speech" && event.error !== "aborted") {
      toast("Error de micrófono: " + event.error, "error");
    }
    // "no-speech"/"aborted" no apagan el modo escucha — onend decide si reinicia solo.
  };
  recognition.onend = () => {
    if (_mpVoiceListening) { try { recognition.start(); } catch { _mpVoiceListening = false; } }
    if (!_mpVoiceListening) { btn.textContent = "🎤"; btn.classList.remove("recording"); btn.title = "Dictar por voz"; }
  };

  recognition.start();
  _mpVoiceListening = true;
  btn.textContent = "⏹";
  btn.classList.add("recording");
  btn.title = "Detener dictado";
});

// ── Editable cuts table — inline editing ──────────────────────────────────
els.cutsOutput.addEventListener("input", (e) => {
  const field = e.target.dataset.field;
  if (!field) return;
  const row = e.target.closest("[data-piece-id]");
  if (!row) return;
  const piece = state.editablePieces.find(p => p.id === row.dataset.pieceId);
  if (!piece) return;
  piece[field] = e.target.type === "number" ? Number(e.target.value) : e.target.value;
  if (field === "width" || field === "height") {
    piece.area = (Number(piece.width)||1) * (Number(piece.height)||1);
    recalcCutsLayout();
  }
});

els.cutsOutput.addEventListener("change", (e) => {
  const row = e.target.closest("[data-piece-id]");
  if (!row) return;
  const piece = state.editablePieces.find(p => p.id === row.dataset.pieceId);
  if (!piece) return;

  const field = e.target.dataset.field;
  if (field === "thickness") { piece.thickness = e.target.value; recalcCutsLayout(); return; }
  if (field === "grain") { piece.grain = e.target.checked; renderCutsPiecesTable(); recalcCutsLayout(); return; }
  if (field === "grainDirection") { piece.grainDirection = e.target.value; recalcCutsLayout(); return; }

  const side = e.target.dataset.edgeSide;
  if (side) {
    piece.edgeSides = piece.edgeSides || { top: null, bottom: null, left: null, right: null };
    piece.edgeSides[side] = e.target.value || null;
    piece.edge = describeEdgeSides(piece.edgeSides);
    recalcCutsLayout();
  }
});

els.cutsOutput.addEventListener("click", (e) => {
  if (e.target.dataset.rmCut) {
    state.editablePieces = state.editablePieces.filter(p => p.id !== e.target.dataset.rmCut);
    renderCutsPiecesTable();
    recalcCutsLayout();
    return;
  }
  if (e.target.id === "addCutPieceBtn") {
    state.editablePieces.push({
      id: crypto.randomUUID(), furniture: "", name: "Pieza nueva",
      width: 600, height: 600, thickness: "18 mm",
      edgeSides: { top: null, bottom: null, left: null, right: null }, edge: "Sin canto",
      grain: false, area: 360000
    });
    renderCutsPiecesTable();
    recalcCutsLayout();
    return;
  }
  if (e.target.id === "regenCutPiecesBtn") {
    state.editablePieces = [];
    renderCuts();
  }
});

// ── Quote history: delete or click-to-view ────────────────────────────────
els.quoteHistory.addEventListener("click", (e) => {
  // ── Delete button ✕ ──
  const delId = e.target.dataset.deleteQuote;
  if (delId) {
    if (!confirm("¿Borrar esta cotización? Esta acción no se puede deshacer.")) return;
    state.quotes = state.quotes.filter(q => q.id !== delId);
    save();
    renderClient();
    renderAdmin();
    toast("Cotización borrada");
    return;
  }
  // ── Click on card → navigate to quote view and display it ──
  const card = e.target.closest("article[data-view-quote]");
  if (!card) return;
  const quote = state.quotes.find(q => q.id === card.dataset.viewQuote);
  if (!quote) return;
  showView("quoteView");
  renderQuotePaper(quote);
});

els.quoteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const tenant = currentTenant();
  if (!isTenantActive(tenant) || !state.materialCartItems.length) {
    if (!state.materialCartItems.length) toast("Agrega al menos un material antes de generar.", "error");
    return;
  }
  const validityDays = Number(document.getElementById("quoteValidity")?.value) || 15;
  const quote = {
    number: "C" + Date.now().toString().slice(-7),
    date: new Date().toISOString().slice(0, 10),
    dueDate: (() => { const d = new Date(); d.setDate(d.getDate() + validityDays); return d.toISOString().slice(0, 10); })(),
    clientName: document.getElementById("finalClient")?.value.trim() || "",
    location: document.getElementById("projectLocation")?.value.trim() || "",
    notes: document.getElementById("clientNotes")?.value.trim() || "",
    manoObra: Number(document.getElementById("manoObraField")?.value) || 0,
    transport: Number(document.getElementById("transportField")?.value) || 0,
    manualTotal: Number(document.getElementById("manualTotal")?.value) || 0,
    taxPercent: Number(document.getElementById("taxPercent")?.value) || 0,
    deliveryTime: document.getElementById("deliveryTime")?.value.trim() || "",
    paymentTerms: document.getElementById("paymentTerms")?.value.trim() || "",
    warranty: document.getElementById("warranty")?.value.trim() || "",
    benefits: document.getElementById("quoteBenefits")?.value.trim() || "",
    items: state.materialCartItems,
    createdAt: new Date().toISOString()
  };
  state.quotes.unshift(quote);
  save();
  renderEbanistaMaterialQuotePaper(quote, tenant);
  renderClient();
  renderAdmin();
  toast("Cotización generada ✓");
});

// Genera el PDF en el servidor y lo descarga directamente — no depende de que el
// usuario encuentre "Guardar como PDF" en el diálogo de impresión del sistema.
els.printQuoteBtn.addEventListener("click", async () => {
  const ctx = state.currentQuoteForPdf;
  if (!ctx?.quote) { toast("Genera la cotización primero.", "error"); return; }

  const originalText = els.printQuoteBtn.textContent;
  els.printQuoteBtn.disabled = true;
  els.printQuoteBtn.textContent = "Generando PDF…";
  try {
    const res = await fetch("/api/quote-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ctx)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cotizacion-${ctx.quote.number || "sin-numero"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast(`No se pudo generar el PDF: ${e.message}`, "error");
  } finally {
    els.printQuoteBtn.disabled = false;
    els.printQuoteBtn.textContent = originalText;
  }
});

// Color picker event delegation
document.getElementById("colorPicker")?.addEventListener("click", (e) => {
  const swatch = e.target.closest(".color-swatch");
  if (!swatch) return;
  document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
  swatch.classList.add("selected");
  document.getElementById("selectedColor").value = swatch.dataset.colorCode;
});

// ── Toggle module form ────────────────────────────────────────────────────
document.getElementById("toggleModuleFormBtn")?.addEventListener("click", () => {
  const panel = document.getElementById("moduleFormPanel");
  const btn   = document.getElementById("toggleModuleFormBtn");
  if (!panel) return;
  const opening = panel.classList.contains("hidden");
  panel.classList.toggle("hidden");
  btn.textContent = opening ? "▲ Cerrar formulario" : "＋ Agregar módulo";
  if (opening) {
    if (!state.editingItemId) resetModuleForm(); // fresh open → blank form
    document.getElementById("itemName")?.focus();
  }
});

// ── Clear all draft modules ───────────────────────────────────────────────
document.getElementById("clearDraftBtn")?.addEventListener("click", () => {
  if (!state.materialCartItems.length) return;
  if (!confirm("¿Limpiar todos los materiales de esta cotización?")) return;
  state.materialCartItems = [];
  renderDraftItems();
});

// CSV export
document.getElementById("exportCutsBtn")?.addEventListener("click", exportCutsCSV);

// ── Lámina: catálogo de precios del mercado (estándar + items "madera" del ebanista) ──
const STANDARD_SHEET_DIMENSIONS_MM = { melamina_std: [2440, 1220], melamina_lg: [2750, 1830] };

// Unos pocos items quedaron mal categorizados como "madera" al cargar el catálogo IMECA
// (pisos vinílicos, vinil decorativo por metro lineal, retazos) — no son láminas para
// cortar, así que se excluyen del selector aunque tengan esa categoría.
const SHEET_EXCLUDE_NAME_RE = /^piso\b|\/lm\b|retazos?\s+varios/i;
function getSheetCatalogEntries() {
  const prices = tenantPrices();
  const names = prices._names || {};
  const entries = Object.keys(STANDARD_SHEET_DIMENSIONS_MM)
    .filter(k => typeof prices[k] === "number")
    .map(k => ({ value: `std:${k}`, description: names[k] || defaultPriceNames[k] || k, unitPrice: Number(prices[k]) || 0 }));
  (prices.customItems || []).forEach((c, i) => {
    if ((c.category || "madera") !== "madera") return;
    if (SHEET_EXCLUDE_NAME_RE.test(String(c.name || ""))) return;
    entries.push({ value: `custom:${i}`, description: c.name, unitPrice: Number(c.price) || 0 });
  });
  return entries;
}

function sheetComboItemRow(entry, query, matchIdx) {
  const desc = entry.description;
  let nameHtml = escapeHtml(desc);
  if (query && matchIdx !== -1) {
    nameHtml = escapeHtml(desc.slice(0, matchIdx)) + "<mark>" + escapeHtml(desc.slice(matchIdx, matchIdx + query.length)) + "</mark>" + escapeHtml(desc.slice(matchIdx + query.length));
  }
  return `<div class="material-combo-item" data-sheet-combo-value="${entry.value}"><span class="name">${nameHtml}</span><span class="price">$${entry.unitPrice.toFixed(2)}</span></div>`;
}

function renderSheetCombo(query) {
  const panel = document.getElementById("sheetSearchResults");
  if (!panel) return;
  const entries = getSheetCatalogEntries();
  const q = (query || "").trim().toLowerCase();
  const matches = q
    ? entries.map(e => ({ e, idx: e.description.toLowerCase().indexOf(q) })).filter(x => x.idx !== -1).sort((a, b) => a.idx - b.idx || a.e.description.length - b.e.description.length)
    : entries.map(e => ({ e, idx: -1 }));
  panel.innerHTML = matches.length
    ? matches.map(({ e, idx }) => sheetComboItemRow(e, q, idx)).join("")
    : `<p class="material-combo-empty">Sin resultados — agrégala primero en Precios del mercado.</p>`;
}

function selectSheetCatalogEntry(value) {
  const display = document.getElementById("sheetPriceDisplay");
  if (!value) {
    state.cutsSheetPrice = null;
    state.cutsSheetLabel = "";
    if (display) display.textContent = "—";
    return;
  }
  const prices = tenantPrices();
  const names = prices._names || {};
  if (value.startsWith("std:")) {
    const key = value.slice(4);
    const dims = STANDARD_SHEET_DIMENSIONS_MM[key];
    if (dims) { els.sheetWidth.value = dims[0]; els.sheetHeight.value = dims[1]; }
    state.cutsSheetPrice = Number(prices[key]) || 0;
    state.cutsSheetLabel = names[key] || defaultPriceNames[key] || key;
  } else if (value.startsWith("custom:")) {
    const c = (prices.customItems || [])[Number(value.slice(7))];
    if (c) {
      state.cutsSheetPrice = Number(c.price) || 0;
      state.cutsSheetLabel = c.name;
      const m = String(c.name).match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
      if (m) { els.sheetWidth.value = Number(m[1].replace(",", ".")); els.sheetHeight.value = Number(m[2].replace(",", ".")); }
    }
  }
  if (display) display.textContent = state.cutsSheetPrice != null ? `$${state.cutsSheetPrice.toFixed(2)}` : "—";
  if (state.editablePieces.length) recalcCutsLayout();
}

document.getElementById("sheetSearchInput")?.addEventListener("focus", (e) => {
  document.getElementById("sheetSearchResults").classList.remove("hidden");
  renderSheetCombo(e.target.value);
});

document.getElementById("sheetSearchInput")?.addEventListener("input", (e) => {
  state.cutsSheetPrice = null;
  state.cutsSheetLabel = "";
  document.getElementById("sheetPriceDisplay").textContent = "—";
  document.getElementById("sheetSearchResults").classList.remove("hidden");
  renderSheetCombo(e.target.value);
});

document.getElementById("sheetSearchInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { document.getElementById("sheetSearchResults").classList.add("hidden"); e.target.blur(); }
});

document.getElementById("sheetSearchInput")?.addEventListener("blur", () => {
  setTimeout(() => document.getElementById("sheetSearchResults")?.classList.add("hidden"), 120);
});

document.getElementById("sheetSearchResults")?.addEventListener("mousedown", (e) => {
  e.preventDefault(); // evita que el input pierda foco antes de procesar el click
  const itemEl = e.target.closest("[data-sheet-combo-value]");
  if (itemEl) {
    const entry = getSheetCatalogEntries().find(en => en.value === itemEl.dataset.sheetComboValue);
    if (entry) {
      document.getElementById("sheetSearchInput").value = entry.description;
      selectSheetCatalogEntry(entry.value);
    }
    document.getElementById("sheetSearchResults").classList.add("hidden");
  }
});

els.applySheetPresetBtn.addEventListener("click", () => {
  if (state.editablePieces.length) recalcCutsLayout();
});

els.generateCutsBtn.addEventListener("click", renderCuts);

// ─────────────────────────────────────────────────────────────────────────────
// AUTH & SESSION — login screen, admin session, code-based ebanista access
// ─────────────────────────────────────────────────────────────────────────────

const AUTH = {
  mode: null,        // "admin" | "ebanista"
  token: null,       // admin JWT token
  tenantId: null,    // active tenant ID (ebanista mode)
  accessCode: null,  // ebanista access code
  linkModalTenantId: null
};

function showApp() {
  document.getElementById("appLoading")?.remove();
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("publicShell").style.display = "none";
  document.getElementById("appShell").style.display = "";
  document.getElementById("logoutBtn").classList.toggle("hidden", AUTH.mode !== "admin");
  render();
  checkAiBackend();
}

function showLogin() {
  document.getElementById("appLoading")?.remove();
  document.getElementById("loginScreen").style.display = "";
  document.getElementById("appShell").style.display = "none";
  document.getElementById("publicShell").style.display = "none";
}

// ── Directorio Profesional (público, sin login) ─────────────────────────────
// Mismas categorías que routes/professionals.js (CATEGORIES) -- duplicado a propósito
// porque este archivo corre en el navegador y no puede require() un módulo del
// servidor; mismo patrón que ya usa esta app para furnitureType/thickness, etc.
const PROFESSIONAL_CATEGORIES = [
  { value: "ebanista", label: "Ebanista" },
  { value: "carpintero", label: "Carpintero" },
  { value: "plomero", label: "Plomero" },
  { value: "electricista", label: "Electricista" },
  { value: "gypsum", label: "Gypsum" },
  { value: "remodelador", label: "Remodelador" },
  { value: "pintor", label: "Pintor" },
  { value: "soldador", label: "Soldador" },
  { value: "marmolista", label: "Marmolista" },
  { value: "instalador_cocinas", label: "Instalador de cocinas" },
  { value: "instalador_muebles", label: "Instalador de muebles" },
  { value: "vidriero", label: "Vidriero" },
  { value: "tecnico_ac", label: "Técnico de aire acondicionado" },
  { value: "disenador_interiores", label: "Diseñador de interiores" },
  { value: "otra", label: "Otra especialidad" }
];

function showPublicDirectorio() {
  document.getElementById("appLoading")?.remove();
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appShell").style.display = "none";
  document.getElementById("publicShell").style.display = "";
  const catSel = document.getElementById("pf_filterCategory");
  if (catSel && catSel.options.length <= 1) {
    catSel.innerHTML = '<option value="">Todas</option>' + PROFESSIONAL_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join("");
  }
  const regCatSel = document.getElementById("pf_regCategory");
  if (regCatSel && !regCatSel.options.length) {
    regCatSel.innerHTML = PROFESSIONAL_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join("");
  }
  loadPublicDirectory();
  loadPublicBanner();
}

// Banner principal del directorio público -- solo se ve si el admin creó y activó
// uno (ver Fase 6 / adm_createAdBtn). Cuenta impresión una vez por carga y clic al
// hacer clic, fire-and-forget -- no bloquea nada si falla.
async function loadPublicBanner() {
  const slot = document.getElementById("publicBannerSlot");
  if (!slot) return;
  try {
    const res = await fetch("/api/ads?type=banner_principal");
    const list = res.ok ? await res.json() : [];
    if (!list.length) { slot.innerHTML = ""; return; }
    const ad = list[0];
    slot.innerHTML = `
      <a href="${escapeHtml(ad.linkUrl || "#")}" target="_blank" rel="noopener" id="publicBannerLink" data-ad-id="${ad.id}" class="public-banner-link">
        ${ad.imageUrl ? `<img src="${escapeHtml(ad.imageUrl)}" alt="${escapeHtml(ad.title)}">` : `<div class="public-banner-fallback">${escapeHtml(ad.title)}</div>`}
      </a>`;
    fetch(`/api/ads/${ad.id}/impression`, { method: "POST" }).catch(() => {});
  } catch { slot.innerHTML = ""; }
}
document.getElementById("publicBannerSlot")?.addEventListener("click", (e) => {
  const link = e.target.closest("[data-ad-id]");
  if (!link) return;
  fetch(`/api/ads/${link.dataset.adId}/click`, { method: "POST" }).catch(() => {});
});

function professionalCategoryLabel(value) {
  return PROFESSIONAL_CATEGORIES.find(c => c.value === value)?.label || value;
}

function starHtml(avg, count) {
  const full = Math.round(avg || 0);
  const stars = [1,2,3,4,5].map(i => `<span class="star${i <= full ? " star-filled" : ""}">${i <= full ? "★" : "☆"}</span>`).join("");
  return `<span class="star-row">${stars}</span><span class="star-count">${count || 0} reseña${count !== 1 ? "s" : ""}</span>`;
}

function currentBestAuthToken() {
  return AUTH.token || AUTH.ebToken || AUTH.sellerToken
    || (typeof _publicPostAuth !== "undefined" && _publicPostAuth?.token) || null;
}

async function loadPublicDirectory() {
  const grid = document.getElementById("publicDirectoryGrid");
  if (!grid) return;
  grid.innerHTML = '<p class="login-hint">Cargando…</p>';
  const params = new URLSearchParams();
  const category = document.getElementById("pf_filterCategory")?.value;
  const province = document.getElementById("pf_filterProvince")?.value.trim();
  const city = document.getElementById("pf_filterCity")?.value.trim();
  const specialty = document.getElementById("pf_filterSpecialty")?.value.trim();
  const sort = document.getElementById("pf_sortSelect")?.value || "recent";
  if (category) params.set("category", category);
  if (province) params.set("province", province);
  if (city) params.set("city", city);
  if (specialty) params.set("specialty", specialty);
  params.set("sort", sort);
  try {
    const res = await fetch(`/api/professionals?${params.toString()}`);
    const list = res.ok ? await res.json() : [];
    if (!list.length) { grid.innerHTML = '<p class="login-hint">No hay profesionales que coincidan todavía — sé el primero en registrarte.</p>'; return; }
    grid.innerHTML = list.map(p => `
      <div class="public-pro-card">
        ${p.photoUrl ? `<img src="${escapeHtml(p.photoUrl)}" alt="" class="public-pro-photo">` : `<div class="public-pro-photo public-pro-photo-placeholder">${escapeHtml((p.name||"?")[0])}</div>`}
        <div class="public-pro-body">
          <strong>${escapeHtml(p.name)}</strong>
          ${p.company ? `<span class="public-pro-company">${escapeHtml(p.company)}</span>` : ""}
          <span class="public-pro-category">${escapeHtml(professionalCategoryLabel(p.category))}${p.specialty ? " · " + escapeHtml(p.specialty) : ""}</span>
          ${p.location?.city ? `<span class="public-pro-location">📍 ${escapeHtml(p.location.city)}${p.location.province ? ", " + escapeHtml(p.location.province) : ""}</span>` : ""}
          ${p.ratings?.count ? `<div class="star-display">${starHtml(p.ratings.avg, p.ratings.count)}</div>` : ""}
          ${p.description ? `<p class="public-pro-desc">${escapeHtml(p.description)}</p>` : ""}
          <div style="display:flex;gap:6px;margin-top:8px">
            <button class="primary-btn public-pro-contact" type="button" data-contact-id="${p.id}" data-contact-phone="${escapeHtml(p.whatsapp || p.phone || "")}">📞 Contactar</button>
            <button class="secondary-btn" type="button" data-view-profile="${p.id}">Ver perfil</button>
          </div>
        </div>
      </div>`).join("");
  } catch {
    grid.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>';
  }
}

document.getElementById("publicLoginBtn")?.addEventListener("click", showLogin);
document.getElementById("publicShowRegisterBtn")?.addEventListener("click", () => {
  document.getElementById("publicDirectoryView").classList.add("hidden");
  document.getElementById("publicRegisterView").classList.remove("hidden");
});
document.getElementById("publicBackToDirectoryBtn")?.addEventListener("click", () => {
  document.getElementById("publicRegisterView").classList.add("hidden");
  document.getElementById("publicDirectoryView").classList.remove("hidden");
});
document.getElementById("pf_applyFiltersBtn")?.addEventListener("click", loadPublicDirectory);
document.getElementById("pf_sortSelect")?.addEventListener("change", loadPublicDirectory);
document.getElementById("publicDirectoryGrid")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-contact-id]");
  if (!btn) return;
  fetch(`/api/professionals/${btn.dataset.contactId}/contact-click`, { method: "POST" }).catch(() => {});
  const phone = btn.dataset.contactPhone;
  if (phone) window.open(`https://wa.me/${phone.replace(/[^0-9]/g, "")}`, "_blank");
});
document.getElementById("publicDirectoryGrid")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-view-profile]");
  if (btn) openProProfileModal(btn.dataset.viewProfile);
});

document.getElementById("pf_submitRegisterBtn")?.addEventListener("click", async () => {
  const errEl = document.getElementById("pf_registerError");
  errEl.classList.add("hidden");
  const name = document.getElementById("pf_regName").value.trim();
  const password = document.getElementById("pf_regPassword").value;
  if (!name) { errEl.textContent = "Falta tu nombre."; errEl.classList.remove("hidden"); return; }
  if (!password || password.length < 4) { errEl.textContent = "La contraseña necesita al menos 4 caracteres."; errEl.classList.remove("hidden"); return; }
  const payload = {
    name, password,
    category: document.getElementById("pf_regCategory").value,
    company: document.getElementById("pf_regCompany").value.trim(),
    specialty: document.getElementById("pf_regSpecialty").value.trim(),
    experienceYears: Number(document.getElementById("pf_regExperience").value) || 0,
    phone: document.getElementById("pf_regPhone").value.trim(),
    whatsapp: document.getElementById("pf_regWhatsapp").value.trim(),
    email: document.getElementById("pf_regEmail").value.trim(),
    location: { province: document.getElementById("pf_regProvince").value.trim(), city: document.getElementById("pf_regCity").value.trim() },
    description: document.getElementById("pf_regDescription").value.trim(),
    schedule: document.getElementById("pf_regSchedule").value.trim()
  };
  try {
    const res = await fetch("/api/professionals/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || "No se pudo registrar."; errEl.classList.remove("hidden"); return; }
    toast(`¡Listo! Tu código de acceso es ${data.accessCode} — guárdalo para entrar a tu panel.`);
    document.getElementById("publicRegisterView").classList.add("hidden");
    document.getElementById("publicDirectoryView").classList.remove("hidden");
  } catch {
    errEl.textContent = "Sin conexión al servidor.";
    errEl.classList.remove("hidden");
  }
});

// ── Tabs del directorio público: Profesionales / Empresas ───────────────────
const PUBLIC_SUBVIEW_IDS = [
  "publicDirectoryView", "publicRegisterView", "publicCompaniesView", "publicCompanyRegisterView",
  "publicRetazosView", "rz_loginGateView", "rz_publishView"
];
function hideAllPublicSubviews() {
  PUBLIC_SUBVIEW_IDS.forEach(id => document.getElementById(id)?.classList.add("hidden"));
}
document.querySelectorAll("[data-public-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-public-tab]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.publicTab;
    hideAllPublicSubviews();
    if (tab === "profesionales") document.getElementById("publicDirectoryView").classList.remove("hidden");
    if (tab === "empresas") { document.getElementById("publicCompaniesView").classList.remove("hidden"); loadPublicCompanies(); }
    if (tab === "retazos") { document.getElementById("publicRetazosView").classList.remove("hidden"); loadPublicRetazos(); loadPublicInspiration(); }
  });
});

// ── Directorio de Empresas (mismo patrón que el de profesionales) ───────────
const COMPANY_CATEGORIES = [
  { value: "ferreteria", label: "Ferretería" },
  { value: "melamina", label: "Melamina" },
  { value: "herrajes", label: "Herrajes" },
  { value: "mdf", label: "MDF" },
  { value: "madera", label: "Madera" },
  { value: "pinturas", label: "Pinturas" },
  { value: "adhesivos", label: "Adhesivos" },
  { value: "maquinaria", label: "Maquinaria" },
  { value: "cnc", label: "CNC" },
  { value: "herramientas", label: "Herramientas" },
  { value: "transporte", label: "Transporte" },
  { value: "marmol", label: "Mármol" },
  { value: "vidrio", label: "Vidrio" },
  { value: "otra", label: "Otra" }
];

function companyCategoryLabel(value) {
  return COMPANY_CATEGORIES.find(c => c.value === value)?.label || value;
}

function ensureCompanyCategoryOptions() {
  const filterSel = document.getElementById("co_filterCategory");
  if (filterSel && filterSel.options.length <= 1) {
    filterSel.innerHTML = '<option value="">Todas</option>' + COMPANY_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join("");
  }
  const regSel = document.getElementById("co_regCategory");
  if (regSel && !regSel.options.length) {
    regSel.innerHTML = COMPANY_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join("");
  }
}

async function loadPublicCompanies() {
  ensureCompanyCategoryOptions();
  const grid = document.getElementById("publicCompaniesGrid");
  if (!grid) return;
  grid.innerHTML = '<p class="login-hint">Cargando…</p>';
  const params = new URLSearchParams();
  const category = document.getElementById("co_filterCategory")?.value;
  const province = document.getElementById("co_filterProvince")?.value.trim();
  const city = document.getElementById("co_filterCity")?.value.trim();
  if (category) params.set("category", category);
  if (province) params.set("province", province);
  if (city) params.set("city", city);
  try {
    const res = await fetch(`/api/companies?${params.toString()}`);
    const list = res.ok ? await res.json() : [];
    if (!list.length) { grid.innerHTML = '<p class="login-hint">No hay empresas que coincidan todavía — sé la primera en registrarte.</p>'; return; }
    grid.innerHTML = list.map(c => `
      <div class="public-pro-card">
        ${c.logoUrl ? `<img src="${escapeHtml(c.logoUrl)}" alt="" class="public-pro-photo">` : `<div class="public-pro-photo public-pro-photo-placeholder">${escapeHtml((c.name||"?")[0])}</div>`}
        <div class="public-pro-body">
          <strong>${escapeHtml(c.name)}</strong>
          <span class="public-pro-category">${escapeHtml(companyCategoryLabel(c.category))}</span>
          ${c.location?.city ? `<span class="public-pro-location">📍 ${escapeHtml(c.location.city)}${c.location.province ? ", " + escapeHtml(c.location.province) : ""}</span>` : ""}
          ${c.description ? `<p class="public-pro-desc">${escapeHtml(c.description)}</p>` : ""}
          ${c.products?.length ? `<p class="public-pro-desc"><strong>${c.products.length}</strong> producto(s) publicado(s)</p>` : ""}
          <button class="primary-btn public-pro-contact" type="button" data-company-contact-id="${c.id}" data-contact-phone="${escapeHtml(c.whatsapp || c.phone || "")}">📞 Contactar</button>
        </div>
      </div>`).join("");
  } catch {
    grid.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>';
  }
}

document.getElementById("co_applyFiltersBtn")?.addEventListener("click", loadPublicCompanies);
document.getElementById("publicCompaniesGrid")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-company-contact-id]");
  if (!btn) return;
  fetch(`/api/companies/${btn.dataset.companyContactId}/contact-click`, { method: "POST" }).catch(() => {});
  const phone = btn.dataset.contactPhone;
  if (phone) window.open(`https://wa.me/${phone.replace(/[^0-9]/g, "")}`, "_blank");
});

document.getElementById("publicShowCompanyRegisterBtn")?.addEventListener("click", () => {
  ensureCompanyCategoryOptions();
  document.getElementById("publicCompaniesView").classList.add("hidden");
  document.getElementById("publicCompanyRegisterView").classList.remove("hidden");
});
document.getElementById("publicBackToCompaniesBtn")?.addEventListener("click", () => {
  document.getElementById("publicCompanyRegisterView").classList.add("hidden");
  document.getElementById("publicCompaniesView").classList.remove("hidden");
});

document.getElementById("co_submitRegisterBtn")?.addEventListener("click", async () => {
  const errEl = document.getElementById("co_registerError");
  errEl.classList.add("hidden");
  const name = document.getElementById("co_regName").value.trim();
  const password = document.getElementById("co_regPassword").value;
  if (!name) { errEl.textContent = "Falta el nombre de la empresa."; errEl.classList.remove("hidden"); return; }
  if (!password || password.length < 4) { errEl.textContent = "La contraseña necesita al menos 4 caracteres."; errEl.classList.remove("hidden"); return; }
  const payload = {
    name, password,
    category: document.getElementById("co_regCategory").value,
    phone: document.getElementById("co_regPhone").value.trim(),
    whatsapp: document.getElementById("co_regWhatsapp").value.trim(),
    email: document.getElementById("co_regEmail").value.trim(),
    location: { province: document.getElementById("co_regProvince").value.trim(), city: document.getElementById("co_regCity").value.trim() },
    description: document.getElementById("co_regDescription").value.trim(),
    schedule: document.getElementById("co_regSchedule").value.trim()
  };
  try {
    const res = await fetch("/api/companies/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || "No se pudo registrar."; errEl.classList.remove("hidden"); return; }
    toast(`¡Listo! Tu código de acceso es ${data.accessCode} — guárdalo para entrar a tu panel.`);
    document.getElementById("publicCompanyRegisterView").classList.add("hidden");
    document.getElementById("publicCompaniesView").classList.remove("hidden");
  } catch {
    errEl.textContent = "Sin conexión al servidor.";
    errEl.classList.remove("hidden");
  }
});

// ── Centro Sostenible de Retazos ─────────────────────────────────────────────
// Publicar requiere alguna sesión (ebanista/profesional/empresa/usuario gratuito).
// El estado de "con qué identidad estoy publicando" vive aparte del AUTH principal
// (que es para el panel logueado de toda la vida) -- mismo motivo que
// professionalSessions/companySessions están separados de adminSessions en el
// servidor: roles nuevos no deben mezclarse con los que ya funcionan.
let _publicPostAuth = JSON.parse(sessionStorage.getItem("publicPostAuth") || "null"); // {token, role}

function setPublicPostAuth(token, role) {
  _publicPostAuth = { token, role };
  sessionStorage.setItem("publicPostAuth", JSON.stringify(_publicPostAuth));
}

function materialLabel(m) {
  return { melamina: "Melamina", mdf: "MDF", madera: "Madera", triplay: "Triplay", otro: "Otro" }[m] || m;
}

function retazoCardHtml(r) {
  const dims = r.dimensions?.width && r.dimensions?.height ? `${r.dimensions.width}×${r.dimensions.height}mm` : "";
  const priceLabel = r.isFree ? "Gratis" : `$${Number(r.price || 0).toFixed(2)}`;
  return `
    <div class="public-pro-card">
      ${r.photos?.[0] ? `<img src="${escapeHtml(r.photos[0])}" alt="" class="public-pro-photo">` : `<div class="public-pro-photo public-pro-photo-placeholder">♻️</div>`}
      <div class="public-pro-body">
        <strong>${escapeHtml(materialLabel(r.material))}${r.color ? " · " + escapeHtml(r.color) : ""}</strong>
        <span class="public-pro-category">${[r.thickness ? r.thickness + "mm" : "", dims, `Cant: ${r.quantity || 1}`].filter(Boolean).join(" · ")}</span>
        ${r.location?.city ? `<span class="public-pro-location">📍 ${escapeHtml(r.location.city)}</span>` : ""}
        <strong style="color:var(--accent);margin-top:4px">${priceLabel}</strong>
        <button class="primary-btn public-pro-contact" type="button" data-retazo-contact-id="${r.id}" data-contact-phone="${escapeHtml(r.contact?.whatsapp || r.contact?.phone || "")}">📞 Contactar</button>
      </div>
    </div>`;
}

async function loadPublicRetazos() {
  const grid = document.getElementById("publicRetazosGrid");
  if (!grid) return;
  grid.innerHTML = '<p class="login-hint">Cargando…</p>';
  const params = new URLSearchParams();
  const material = document.getElementById("rz_filterMaterial")?.value;
  const thickness = document.getElementById("rz_filterThickness")?.value;
  const color = document.getElementById("rz_filterColor")?.value.trim();
  const city = document.getElementById("rz_filterCity")?.value.trim();
  const freeOnly = document.getElementById("rz_filterFreeOnly")?.checked;
  if (material) params.set("material", material);
  if (thickness) params.set("thickness", thickness);
  if (color) params.set("color", color);
  if (city) params.set("city", city);
  if (freeOnly) params.set("isFree", "true");
  try {
    const res = await fetch(`/api/retazos?${params.toString()}`);
    const list = res.ok ? await res.json() : [];
    grid.innerHTML = list.length ? list.map(retazoCardHtml).join("") : '<p class="login-hint">No hay retazos publicados todavía que coincidan.</p>';
  } catch {
    grid.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>';
  }
}

async function loadPublicInspiration() {
  const grid = document.getElementById("publicInspirationGrid");
  if (!grid) return;
  grid.innerHTML = '<p class="login-hint">Cargando…</p>';
  try {
    const res = await fetch("/api/retazos?isInspiration=true");
    const list = res.ok ? await res.json() : [];
    grid.innerHTML = list.length ? list.map(retazoCardHtml).join("") : '<p class="login-hint">Todavía no hay proyectos de inspiración publicados.</p>';
  } catch {
    grid.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>';
  }
}

document.getElementById("rz_applyFiltersBtn")?.addEventListener("click", loadPublicRetazos);
document.getElementById("publicRetazosGrid")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-retazo-contact-id]");
  if (!btn) return;
  const phone = btn.dataset.contactPhone;
  if (phone) window.open(`https://wa.me/${phone.replace(/[^0-9]/g, "")}`, "_blank");
});

document.getElementById("rz_showPublishBtn")?.addEventListener("click", () => {
  hideAllPublicSubviews();
  if (_publicPostAuth?.token) document.getElementById("rz_publishView").classList.remove("hidden");
  else document.getElementById("rz_loginGateView").classList.remove("hidden");
});
document.getElementById("rz_backFromGateBtn")?.addEventListener("click", () => {
  hideAllPublicSubviews();
  document.getElementById("publicRetazosView").classList.remove("hidden");
});
document.getElementById("rz_backFromPublishBtn")?.addEventListener("click", () => {
  hideAllPublicSubviews();
  document.getElementById("publicRetazosView").classList.remove("hidden");
});

document.querySelectorAll("[data-gate-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-gate-tab]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.gateTab;
    document.getElementById("rz_gateLoginPanel").classList.toggle("hidden", tab !== "login");
    document.getElementById("rz_gateRegisterPanel").classList.toggle("hidden", tab !== "register");
  });
});

// "Ya tengo cuenta": probamos los 4 tipos de login en secuencia con el mismo código
// y contraseña -- evita pedirle al usuario que recuerde "qué tipo" de cuenta es,
// que para el público de 30-65 años sin experiencia técnica es una pregunta rara.
document.getElementById("rz_gateLoginBtn")?.addEventListener("click", async () => {
  const errEl = document.getElementById("rz_gateError");
  errEl.classList.add("hidden");
  const code = document.getElementById("rz_gateLoginCode").value.trim();
  const password = document.getElementById("rz_gateLoginPassword").value;
  if (!code || !password) { errEl.textContent = "Completa código y contraseña."; errEl.classList.remove("hidden"); return; }
  const attempts = [
    { url: "/api/auth/professional", role: "professional" },
    { url: "/api/auth/company", role: "company" },
    { url: "/api/auth/free-user", role: "usuario_gratuito" },
    { url: "/api/auth/ebanista", role: "ebanista" },
    { url: "/api/auth/seller", role: "vendedor" }
  ];
  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, password }) });
      if (res.ok) {
        const data = await res.json();
        setPublicPostAuth(data.token, attempt.role);
        hideAllPublicSubviews();
        document.getElementById("rz_publishView").classList.remove("hidden");
        return;
      }
    } catch { errEl.textContent = "Sin conexión al servidor."; errEl.classList.remove("hidden"); return; }
  }
  errEl.textContent = "Código o contraseña incorrectos.";
  errEl.classList.remove("hidden");
});

document.getElementById("rz_gateRegisterBtn")?.addEventListener("click", async () => {
  const errEl = document.getElementById("rz_gateError");
  errEl.classList.add("hidden");
  const name = document.getElementById("rz_gateRegName").value.trim();
  const password = document.getElementById("rz_gateRegPassword").value;
  if (!name) { errEl.textContent = "Falta tu nombre."; errEl.classList.remove("hidden"); return; }
  if (!password || password.length < 4) { errEl.textContent = "La contraseña necesita al menos 4 caracteres."; errEl.classList.remove("hidden"); return; }
  try {
    const res = await fetch("/api/free-users/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, password }) });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || "No se pudo registrar."; errEl.classList.remove("hidden"); return; }
    const login = await (await fetch("/api/auth/free-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: data.accessCode, password }) })).json();
    setPublicPostAuth(login.token, "usuario_gratuito");
    toast(`Cuenta creada — tu código es ${data.accessCode}, guárdalo.`);
    hideAllPublicSubviews();
    document.getElementById("rz_publishView").classList.remove("hidden");
  } catch {
    errEl.textContent = "Sin conexión al servidor.";
    errEl.classList.remove("hidden");
  }
});

document.getElementById("rz_submitPublishBtn")?.addEventListener("click", async () => {
  const errEl = document.getElementById("rz_publishError");
  errEl.classList.add("hidden");
  if (!_publicPostAuth?.token) { errEl.textContent = "Tu sesión expiró, inicia sesión de nuevo."; errEl.classList.remove("hidden"); return; }
  const payload = {
    material: document.getElementById("rz_pubMaterial").value,
    color: document.getElementById("rz_pubColor").value.trim(),
    thickness: Number(document.getElementById("rz_pubThickness").value) || 0,
    quantity: Number(document.getElementById("rz_pubQuantity").value) || 1,
    dimensions: { width: Number(document.getElementById("rz_pubWidth").value) || 0, height: Number(document.getElementById("rz_pubHeight").value) || 0 },
    price: Number(document.getElementById("rz_pubPrice").value) || 0,
    isFree: (Number(document.getElementById("rz_pubPrice").value) || 0) === 0,
    location: { province: document.getElementById("rz_pubProvince").value.trim(), city: document.getElementById("rz_pubCity").value.trim() },
    contact: { whatsapp: document.getElementById("rz_pubWhatsapp").value.trim() },
    isInspiration: document.getElementById("rz_pubIsInspiration").checked
  };
  try {
    const res = await fetch("/api/retazos", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${_publicPostAuth.token}` }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || "No se pudo publicar."; errEl.classList.remove("hidden"); return; }
    toast("¡Publicado! ✓");
    hideAllPublicSubviews();
    document.getElementById("publicRetazosView").classList.remove("hidden");
    loadPublicRetazos();
    loadPublicInspiration();
  } catch {
    errEl.textContent = "Sin conexión al servidor.";
    errEl.classList.remove("hidden");
  }
});

function setLoginError(msg) {
  const el = document.getElementById("loginError");
  el.textContent = msg;
  el.classList.toggle("hidden", !msg);
}

// ── Auto-connecting loading overlay (shown instead of login form while URL-code fetch runs) ───
let _connectingEl = null;
function showConnectingScreen() {
  if (!document.getElementById("_spinKF")) {
    const s = document.createElement("style");
    s.id = "_spinKF";
    s.textContent = "@keyframes _spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(s);
  }
  if (_connectingEl) return; // already showing
  const el = document.createElement("div");
  el.id = "connectingOverlay";
  el.style.cssText = [
    "position:fixed", "inset:0", "z-index:10001",
    "background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#1e293b 100%)",
    "display:flex", "align-items:center", "justify-content:center"
  ].join(";");
  el.innerHTML = `
    <div style="text-align:center;color:#fff;padding:2rem;max-width:320px">
      <div style="font-size:2.8rem;margin-bottom:1.25rem">🪵</div>
      <p style="font-size:1.25rem;font-weight:800;margin:0 0 .4rem;letter-spacing:-.01em">Cargando tu espacio…</p>
      <p style="font-size:.875rem;opacity:.65;margin:0 0 2.25rem;line-height:1.5">Un momento, por favor</p>
      <div style="width:38px;height:38px;border:3px solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:_spin .75s linear infinite;margin:0 auto"></div>
    </div>`;
  document.body.appendChild(el);
  _connectingEl = el;
}
function hideConnectingScreen() {
  if (_connectingEl) { _connectingEl.remove(); _connectingEl = null; }
  document.getElementById("connectingOverlay")?.remove(); // safety
}
// Pre-fill ebanista code tab (used when auto-login fails and we fall back to the form)
function _prefillCodeTab(code) {
  document.querySelectorAll("[data-login-tab]").forEach(b => b.classList.remove("active"));
  document.querySelector('[data-login-tab="code"]')?.classList.add("active");
  document.getElementById("loginCodePanel")?.classList.remove("hidden");
  document.getElementById("loginAdminPanel")?.classList.add("hidden");
  _resetEbLoginStep();
  const inp = document.getElementById("loginCodeInput");
  if (inp) inp.value = code;
}

// ── Ebanista login step machine (code → password, only when the tenant has one) ──
let _ebLoginStep = "code"; // "code" | "password"

function _resetEbLoginStep() {
  _ebLoginStep = "code";
  document.getElementById("loginEbPasswordInput")?.classList.add("hidden");
  const pwInput = document.getElementById("loginEbPasswordInput");
  if (pwInput) pwInput.value = "";
  const hint = document.getElementById("loginCodeHint");
  if (hint) hint.textContent = "Ingresa el código que te dio el administrador, o usa el enlace directo que te enviaron.";
  const btn = document.getElementById("loginCodeBtn");
  if (btn) btn.textContent = "Ingresar →";
}

function _showEbPasswordStep(companyName) {
  _ebLoginStep = "password";
  document.getElementById("loginEbPasswordInput")?.classList.remove("hidden");
  const hint = document.getElementById("loginCodeHint");
  if (hint) hint.textContent = companyName ? `Bienvenido, ${companyName} — ingresa tu contraseña.` : "Ingresa tu contraseña.";
  const btn = document.getElementById("loginCodeBtn");
  if (btn) btn.textContent = "Entrar →";
  setTimeout(() => document.getElementById("loginEbPasswordInput")?.focus(), 50);
}

// ── Vendedor login step machine (mismo patrón que ebanista) ─────────────────
let _sellerLoginStep = "code"; // "code" | "password"

function _resetSellerLoginStep() {
  _sellerLoginStep = "code";
  const pwInput = document.getElementById("loginSellerPasswordInput");
  pwInput?.classList.add("hidden");
  if (pwInput) pwInput.value = "";
  const hint = document.getElementById("loginSellerHint");
  if (hint) hint.textContent = "Ingresa el código que te dio el administrador.";
  const btn = document.getElementById("loginSellerBtn");
  if (btn) btn.textContent = "Ingresar →";
}

function _prefillSellerTab(code) {
  document.querySelectorAll("[data-login-tab]").forEach(b => b.classList.remove("active"));
  document.querySelector('[data-login-tab="seller"]')?.classList.add("active");
  document.getElementById("loginCodePanel")?.classList.add("hidden");
  document.getElementById("loginSellerPanel")?.classList.remove("hidden");
  document.getElementById("loginAdminPanel")?.classList.add("hidden");
  _resetSellerLoginStep();
  const inp = document.getElementById("loginSellerCodeInput");
  if (inp) inp.value = code;
}

function _showSellerPasswordStep(name) {
  _sellerLoginStep = "password";
  document.getElementById("loginSellerPasswordInput")?.classList.remove("hidden");
  const hint = document.getElementById("loginSellerHint");
  if (hint) hint.textContent = name ? `Bienvenido, ${name} — ingresa tu contraseña.` : "Ingresa tu contraseña.";
  const btn = document.getElementById("loginSellerBtn");
  if (btn) btn.textContent = "Entrar →";
  setTimeout(() => document.getElementById("loginSellerPasswordInput")?.focus(), 50);
}

function _loginAsSeller(seller, sellerToken) {
  AUTH.mode = "vendedor";
  AUTH.sellerId = seller.id;
  AUTH.sellerToken = sellerToken;
  AUTH.sellerInfo = seller;
  sessionStorage.setItem("ebAuthMode", "vendedor");
  sessionStorage.setItem("sellerId", seller.id);
  sessionStorage.setItem("sellerToken", sellerToken);
  document.querySelector('[data-view="adminView"]')?.classList.add("hidden");
  document.querySelector('[data-view="clientView"]')?.classList.add("hidden");
  document.querySelector('[data-view="designerView"]')?.classList.add("hidden");
  document.querySelector('[data-view="quoteView"]')?.classList.add("hidden");
  document.querySelector('[data-view="cutsView"]')?.classList.add("hidden");
  showApp();
  showView("sellersView");
}

// ── Tab switch ────────────────────────────────────────────────────────────
document.querySelectorAll("[data-login-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-login-tab]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.loginTab;
    document.getElementById("loginCodePanel").classList.toggle("hidden", tab !== "code");
    document.getElementById("loginSellerPanel").classList.toggle("hidden", tab !== "seller");
    document.getElementById("loginAdminPanel").classList.toggle("hidden", tab !== "admin");
    if (tab === "code") _resetEbLoginStep();
    if (tab === "seller") _resetSellerLoginStep();
    setLoginError("");
  });
});

// ── Enter key in login inputs ──────────────────────────────────────────────
document.getElementById("loginCodeInput")?.addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("loginCodeBtn").click();
});
document.getElementById("loginEbPasswordInput")?.addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("loginCodeBtn").click();
});
document.getElementById("loginSellerCodeInput")?.addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("loginSellerBtn").click();
});
document.getElementById("loginSellerPasswordInput")?.addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("loginSellerBtn").click();
});
document.getElementById("loginPasswordInput")?.addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("loginAdminBtn").click();
});

// ── Ebanista login with code (+ password, only when the tenant has one) ────
document.getElementById("loginCodeBtn")?.addEventListener("click", async () => {
  const code = document.getElementById("loginCodeInput").value.trim();
  if (!code) { setLoginError("Ingresa tu código de acceso."); return; }

  // Step 2: password already requested — submit code+password to the server
  if (_ebLoginStep === "password") {
    const password = document.getElementById("loginEbPasswordInput").value;
    if (!password) { setLoginError("Ingresa tu contraseña."); return; }
    if (window.location.protocol === "file:") { setLoginError("Sin conexión al servidor."); return; }
    try {
      const res = await fetch("/api/auth/ebanista", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password })
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || "Contraseña incorrecta."); return; }
      setLoginError("");
      _loginAsEbanista(data.tenant, data.token);
    } catch { setLoginError("Sin conexión al servidor."); }
    return;
  }

  // Step 1: try server first; fall back to local state (for offline/demo)
  let tenant = null;
  if (window.location.protocol !== "file:") {
    try {
      const res = await fetch(`/api/tenant-by-code?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.requiresPassword) { setLoginError(""); _showEbPasswordStep(data.companyName); return; }
        // Merge server tenant into local state
        const existing = state.tenants.find(t => t.id === data.id);
        if (existing) Object.assign(existing, data);
        else state.tenants.push(data);
        save();
        tenant = data;
      }
    } catch {}
  }
  // Fallback: search local state
  if (!tenant) {
    tenant = state.tenants.find(t => t.accessCode === code);
  }

  if (!tenant) { setLoginError("Código no válido. Verifica con tu administrador."); return; }

  AUTH.mode = "ebanista";
  AUTH.tenantId = tenant.id;
  AUTH.accessCode = tenant.accessCode;
  state.selectedTenantId = tenant.id;
  sessionStorage.setItem("ebAuthMode", "ebanista");
  sessionStorage.setItem("ebTenantId", tenant.id);
  sessionStorage.setItem("ebAccessCode", tenant.accessCode);
  save();

  // Hide admin nav item from ebanistas
  document.querySelector('[data-view="adminView"]')?.classList.add("hidden");
  document.querySelector('[data-view="sellersView"]')?.classList.add("hidden");
  showApp();
  showView("clientView");
});

// ── Vendedor login with code + password ─────────────────────────────────────
document.getElementById("loginSellerBtn")?.addEventListener("click", async () => {
  const code = document.getElementById("loginSellerCodeInput").value.trim();
  if (!code) { setLoginError("Ingresa tu código de acceso."); return; }

  if (_sellerLoginStep === "password") {
    const password = document.getElementById("loginSellerPasswordInput").value;
    if (!password) { setLoginError("Ingresa tu contraseña."); return; }
    if (window.location.protocol === "file:") { setLoginError("Sin conexión al servidor."); return; }
    try {
      const res = await fetch("/api/auth/seller", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password })
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || "Contraseña incorrecta."); return; }
      setLoginError("");
      _loginAsSeller(data.seller, data.token);
    } catch { setLoginError("Sin conexión al servidor."); }
    return;
  }

  if (window.location.protocol === "file:") { setLoginError("Sin conexión al servidor."); return; }
  try {
    const res = await fetch(`/api/seller-by-code?code=${encodeURIComponent(code)}`);
    if (!res.ok) { setLoginError("Código no válido. Verifica con tu administrador."); return; }
    const data = await res.json();
    if (data.requiresPassword) { setLoginError(""); _showSellerPasswordStep(data.name); return; }
    _loginAsSeller(data, null);
  } catch { setLoginError("Sin conexión al servidor."); }
});

// ── Admin login with password ──────────────────────────────────────────────
document.getElementById("loginAdminBtn")?.addEventListener("click", async () => {
  const password = document.getElementById("loginPasswordInput").value;
  if (!password) { setLoginError("Ingresa la contraseña."); return; }

  // Try server auth
  if (window.location.protocol !== "file:") {
    try {
      const res = await fetch("/api/auth/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || "Contraseña incorrecta."); return; }
      AUTH.token = data.token;
      sessionStorage.setItem("ebAdminToken", data.token);
    } catch {
      // Offline: check hardcoded fallback for local dev
      if (password !== "admin1234") { setLoginError("Contraseña incorrecta."); return; }
    }
  } else {
    // file:// mode: accept any password for demo
  }

  AUTH.mode = "admin";
  sessionStorage.setItem("ebAuthMode", "admin");
  document.querySelector('[data-view="adminView"]')?.classList.remove("hidden");
  document.querySelector('[data-view="sellersView"]')?.classList.remove("hidden");
  document.querySelector('[data-view="handoffsView"]')?.classList.add("hidden");
  showApp();
  showView("adminView");

  // Sync tenants and prices from server
  syncTenantsFromServer();
  loadGlobalPrices();
});

// ── Logout ─────────────────────────────────────────────────────────────────
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  if (AUTH.token && window.location.protocol !== "file:") {
    try { await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${AUTH.token}` } }); } catch {}
  }
  AUTH.mode = null; AUTH.token = null; AUTH.tenantId = null; AUTH.accessCode = null;
  sessionStorage.removeItem("ebAuthMode");
  sessionStorage.removeItem("ebAdminToken");
  sessionStorage.removeItem("ebTenantId");
  sessionStorage.removeItem("ebAccessCode");
  showLogin();
});

// ── Sync tenants — pull prices first, then push local (admin sigue siendo dueño del resto) ──
async function syncTenantsFromServer() {
  if (window.location.protocol === "file:" || !AUTH.token) return;
  try {
    // 1. Pull server tenants first. "prices" lo edita el ebanista directo contra el
    //    servidor (PUT /api/ebanista-prices), sin pasar por el localStorage del admin —
    //    así que la versión del servidor de ESE campo siempre debe ganar antes de que
    //    el paso 2 empuje la copia local del admin, o se pierde lo que el ebanista guardó.
    const res = await fetch("/api/tenants", { headers: { Authorization: `Bearer ${AUTH.token}` } });
    if (res.ok) {
      const serverTenants = await res.json();
      let changed = false;
      serverTenants.forEach(st => {
        const local = state.tenants.find(t => t.id === st.id);
        if (!local) {
          state.tenants.push({ ...st, catalog: st.catalog || cloneCatalog() });
          changed = true;
        } else if (st.prices && JSON.stringify(local.prices || {}) !== JSON.stringify(st.prices)) {
          // st.prices ausente = el servidor no lo mandó (endpoint viejo/caído) — nunca
          // lo tratamos como "el ebanista lo vació", o se borraría lo que sí había local.
          local.prices = st.prices;
          changed = true;
        }
      });
      if (changed) { save(); render(); }
    }

    // 2. Push every local tenant to server (admin sigue siendo dueño del resto de los campos)
    await Promise.all(state.tenants.map(async t => {
      const r = await fetch(`/api/tenants/${t.id}`, {
        method: "PUT",
        headers: adminApiHeader(),
        body: JSON.stringify(t)
      }).catch(() => ({ status: 500 }));
      // If PUT returned 404 (shouldn't happen after upsert fix, but just in case), try POST
      if (r.status === 404) {
        await fetch("/api/tenants", {
          method: "POST",
          headers: adminApiHeader(),
          body: JSON.stringify(t)
        }).catch(() => {});
      }
    }));
  } catch {}
}

// ── Admin tenant actions with server sync ─────────────────────────────────
function adminApiHeader() {
  return AUTH.token ? { Authorization: `Bearer ${AUTH.token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}


// ── Link modal ─────────────────────────────────────────────────────────────
function openLinkModal(tenantId) {
  const tenant = state.tenants.find(t => t.id === tenantId);
  if (!tenant) return;
  AUTH.linkModalTenantId = tenantId;
  const url = getTenantLink(tenant);
  document.getElementById("linkModalDesc").textContent = `Link de acceso para ${tenant.companyName}:`;
  document.getElementById("linkModalUrl").value = url;
  // Si ya se generó una contraseña para este ebanista en esta misma sesión del navegador,
  // se vuelve a mostrar en vez de dejarla en blanco — el servidor no puede devolverla (solo
  // guarda el hash), así que esta es la única forma de no perderla si cerraste el modal sin copiarla.
  document.getElementById("linkModalPassword").value = _lastShownPasswords[tenantId] || "";
  document.getElementById("linkModal").classList.remove("hidden");
}

document.getElementById("linkModalClose")?.addEventListener("click", () => {
  document.getElementById("linkModal").classList.add("hidden");
});
document.getElementById("linkModal")?.addEventListener("click", (e) => {
  if (e.target === document.getElementById("linkModal")) document.getElementById("linkModal").classList.add("hidden");
});
document.getElementById("copyLinkBtn")?.addEventListener("click", () => {
  const input = document.getElementById("linkModalUrl");
  navigator.clipboard.writeText(input.value).then(() => {
    toast("Link copiado al portapapeles ✓");
    document.getElementById("copyLinkBtn").textContent = "¡Copiado!";
    setTimeout(() => { document.getElementById("copyLinkBtn").textContent = "Copiar"; }, 2000);
  }).catch(() => { input.select(); document.execCommand("copy"); toast("Link copiado ✓"); });
});
document.getElementById("copyPasswordBtn")?.addEventListener("click", () => {
  const input = document.getElementById("linkModalPassword");
  if (!input.value) { toast("Genera una contraseña primero"); return; }
  navigator.clipboard.writeText(input.value).then(() => {
    toast("Contraseña copiada al portapapeles ✓");
    document.getElementById("copyPasswordBtn").textContent = "¡Copiado!";
    setTimeout(() => { document.getElementById("copyPasswordBtn").textContent = "Copiar"; }, 2000);
  }).catch(() => { input.select(); document.execCommand("copy"); toast("Contraseña copiada ✓"); });
});
document.getElementById("generatePasswordBtn")?.addEventListener("click", async () => {
  const id = AUTH.linkModalTenantId;
  if (!id) return;
  if (window.location.protocol === "file:" || !AUTH.token) { toast("Necesitas conexión con el servidor para generar contraseña."); return; }
  try {
    const res = await fetch(`/api/tenants/${id}/set-password`, { method: "POST", headers: adminApiHeader(), body: JSON.stringify({}) });
    if (res.ok) {
      const data = await res.json();
      document.getElementById("linkModalPassword").value = data.passwordPlain;
      _lastShownPasswords[id] = data.passwordPlain;
      const tenant = state.tenants.find(t => t.id === id);
      if (tenant) { tenant.hasPassword = true; save(); }
      toast("Nueva contraseña generada — cópiala ahora ✓");
    } else {
      toast("No se pudo generar la contraseña.");
    }
  } catch { toast("Sin conexión al servidor."); }
});

document.getElementById("regenerateCodeBtn")?.addEventListener("click", async () => {
  const id = AUTH.linkModalTenantId;
  if (!id) return;
  const tenant = state.tenants.find(t => t.id === id);
  if (!tenant) return;

  if (window.location.protocol !== "file:" && AUTH.token) {
    try {
      const res = await fetch(`/api/tenants/${id}/regenerate-code`, { method: "POST", headers: adminApiHeader() });
      if (res.ok) {
        const data = await res.json();
        tenant.accessCode = data.accessCode;
        save();
      }
    } catch {}
  } else {
    // Local fallback: generate a random code
    const prefix = tenant.companyName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
    tenant.accessCode = `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
    save();
  }
  openLinkModal(id); // Refresh modal with new code
  toast("Código regenerado ✓");
});

// ── URL code auto-login ────────────────────────────────────────────────────
// ── Helper: log in as ebanista tenant ────────────────────────────────────────
function _loginAsEbanista(tenant, ebToken) {
  const existing = state.tenants.find(t => t.id === tenant.id);
  if (existing) Object.assign(existing, tenant);
  else { tenant.catalog = tenant.catalog || cloneCatalog(); state.tenants.push(tenant); }
  save();
  AUTH.mode = "ebanista";
  AUTH.tenantId = tenant.id;
  AUTH.accessCode = tenant.accessCode;
  state.selectedTenantId = tenant.id;
  sessionStorage.setItem("ebAuthMode", "ebanista");
  sessionStorage.setItem("ebTenantId", tenant.id);
  sessionStorage.setItem("ebAccessCode", tenant.accessCode);
  if (ebToken) { AUTH.ebToken = ebToken; sessionStorage.setItem("ebToken", ebToken); }
  document.querySelector('[data-view="adminView"]')?.classList.add("hidden");
  document.querySelector('[data-view="sellersView"]')?.classList.add("hidden");
  showApp();
  showView("clientView");
}

async function tryAutoLogin() {
  const params = new URLSearchParams(window.location.search);
  // Treat the literal string "undefined" as absent (avoids ?code=undefined bug)
  const rawCode = params.get("code");
  const urlCode = (rawCode && rawCode !== "undefined") ? rawCode : null;

  // ── 1. URL has ?code= or ?d= (ebanista link) ──────────────────────────────
  if (urlCode || params.get("d")) {
    // Path A: ?d= parameter — instant login, no server needed
    const urlData = params.get("d");
    if (urlData) {
      try {
        let decoded;
        try { decoded = JSON.parse(urlData); }
        catch {
          // Fallback for old base64 links
          const b64 = urlData.replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/");
          const mod4 = b64.length % 4;
          const padded = mod4 ? b64 + "=".repeat(4 - mod4) : b64;
          decoded = JSON.parse(decodeURIComponent(escape(atob(padded))));
        }
        // Accept if: code matches, OR code is absent, OR decoded has no accessCode (legacy URL)
        const codeOk = !urlCode || !decoded?.accessCode || decoded.accessCode === urlCode;
        if (decoded?.id && codeOk) {
          const today = new Date().toISOString().slice(0, 10);
          if (decoded.status !== "active" || decoded.expiresAt < today) {
            showLogin();
            setLoginError("Tu acceso está suspendido o venció. Contacta al administrador.");
            return;
          }
          _loginAsEbanista(decoded);  // instant — no server needed
          return;
        }
      } catch {}
    }

    if (!urlCode) { showLogin(); return; } // ?d= was present but invalid, no code either

    // Path B: no ?d= → fetch from server. Show clean spinner — NOT the login form.
    // The login form only appears if auth actually fails.
    showConnectingScreen();
    try {
      const res = await fetch(`/api/tenant-by-code?code=${encodeURIComponent(urlCode)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.requiresPassword) {
          hideConnectingScreen();
          showLogin();
          _prefillCodeTab(urlCode);
          _showEbPasswordStep(data.companyName);
          return;
        }
        if (data.active) {
          hideConnectingScreen();
          _loginAsEbanista(data);
          return;
        }
        // Tenant found but inactive
        hideConnectingScreen();
        showLogin();
        _prefillCodeTab(urlCode);
        setLoginError("Tu acceso está suspendido o venció. Contacta al administrador.");
      } else {
        // Server returned error — try local cache as last resort
        const local = state.tenants.find(t => t.accessCode === urlCode);
        if (local && isTenantActive(local)) {
          hideConnectingScreen();
          _loginAsEbanista(local);
          return;
        }
        hideConnectingScreen();
        showLogin();
        _prefillCodeTab(urlCode);
        setLoginError("Código no válido. Pide un link actualizado a tu administrador.");
      }
    } catch {
      // Network error — try local cache
      const local = state.tenants.find(t => t.accessCode === urlCode);
      if (local && isTenantActive(local)) {
        hideConnectingScreen();
        _loginAsEbanista(local);
        return;
      }
      hideConnectingScreen();
      showLogin();
      _prefillCodeTab(urlCode);
      setLoginError("Sin conexión al servidor. Contacta al administrador.");
    }
    return;
  }

  // ── 1.5. URL has ?scode= (vendedor link) ───────────────────────────────────
  const rawSCode = params.get("scode");
  const urlSCode = (rawSCode && rawSCode !== "undefined") ? rawSCode : null;
  if (urlSCode) {
    showConnectingScreen();
    try {
      const res = await fetch(`/api/seller-by-code?code=${encodeURIComponent(urlSCode)}`);
      if (res.ok) {
        const data = await res.json();
        hideConnectingScreen();
        if (data.requiresPassword) {
          showLogin();
          _prefillSellerTab(urlSCode);
          _showSellerPasswordStep(data.name);
          return;
        }
        _loginAsSeller(data, null);
        return;
      }
      hideConnectingScreen();
      showLogin();
      _prefillSellerTab(urlSCode);
      setLoginError("Código no válido. Pide un link actualizado a tu administrador.");
    } catch {
      hideConnectingScreen();
      showLogin();
      _prefillSellerTab(urlSCode);
      setLoginError("Sin conexión al servidor.");
    }
    return;
  }

  // ── 2. Restore session from sessionStorage ────────────────────────────────
  const savedMode = sessionStorage.getItem("ebAuthMode");
  const savedToken = sessionStorage.getItem("ebAdminToken");
  const savedTenantId = sessionStorage.getItem("ebTenantId");

  if (savedMode === "admin" && savedToken) {
    if (window.location.protocol !== "file:") {
      try {
        const res = await fetch("/api/auth/check", { headers: { Authorization: `Bearer ${savedToken}` } });
        const data = res.ok ? await res.json() : null;
        if (data?.valid) {
          AUTH.mode = "admin"; AUTH.token = savedToken;
          document.querySelector('[data-view="adminView"]')?.classList.remove("hidden");
          document.querySelector('[data-view="sellersView"]')?.classList.remove("hidden");
          document.querySelector('[data-view="handoffsView"]')?.classList.add("hidden");
          showApp();
          showView("adminView");
          syncTenantsFromServer();
          loadGlobalPrices();
          return;
        }
      } catch {}
    } else {
      AUTH.mode = "admin";
      document.querySelector('[data-view="sellersView"]')?.classList.remove("hidden");
      document.querySelector('[data-view="handoffsView"]')?.classList.add("hidden");
      showApp();
      showView("adminView");
      return;
    }
  }

  if (savedMode === "ebanista" && savedTenantId) {
    const tenant = state.tenants.find(t => t.id === savedTenantId);
    const savedEbToken = sessionStorage.getItem("ebToken");
    if (tenant && isTenantActive(tenant)) {
      if (tenant.hasPassword && window.location.protocol !== "file:") {
        // Password-protected tenant: the stored token must still be valid server-side
        try {
          const res = await fetch("/api/auth/ebanista/check", { headers: { Authorization: `Bearer ${savedEbToken || ""}` } });
          const data = res.ok ? await res.json() : null;
          if (data?.valid) {
            AUTH.accessCode = sessionStorage.getItem("ebAccessCode") || tenant.accessCode || null;
            _loginAsEbanista(tenant, savedEbToken);
            return;
          }
          // Token expired/invalid — fall through to login screen, ask for password again
        } catch {}
      } else if (!tenant.hasPassword) {
        AUTH.accessCode = sessionStorage.getItem("ebAccessCode") || tenant.accessCode || null;
        _loginAsEbanista(tenant);
        return;
      }
    }
  }

  if (savedMode === "vendedor") {
    const savedSellerToken = sessionStorage.getItem("sellerToken");
    if (savedSellerToken && window.location.protocol !== "file:") {
      try {
        const res = await fetch("/api/sellers/me", { headers: { Authorization: `Bearer ${savedSellerToken}` } });
        if (res.ok) { _loginAsSeller(await res.json(), savedSellerToken); return; }
      } catch {}
    }
  }

  // ── 3. Sin sesión válida ni link directo → directorio público por defecto
  // (antes caía directo a showLogin(); el login sigue a un clic de distancia desde
  // el botón "Iniciar sesión" del directorio, ver showPublicDirectorio()).
  showPublicDirectorio();
}

// ── Margin percent live update (quote form) ────────────────────────────────
els.marginPercent?.addEventListener("change", (e) => {
  const tenant = currentTenant();
  if (!tenant) return;
  const val = Number(e.target.value);
  if (val >= 0 && val <= 100) {
    tenant.margin = val;
    els.margin.value = val;
    save();
    toast(`Margen actualizado a ${val}% ✓`);
  }
});

// ── Voice input (Web Speech API) ──────────────────────────────────────────
(function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = els.voiceBtn;
  if (!btn) return;

  if (!SpeechRecognition) {
    btn.title = "Voz no disponible en este navegador (usa Chrome)";
    btn.style.opacity = "0.35";
    btn.disabled = true;
    return;
  }

  let recognition = null;
  let recording = false;

  btn.addEventListener("click", () => {
    if (recording) { recognition?.stop(); return; }

    recognition = new SpeechRecognition();
    recognition.lang = navigator.language?.startsWith("es") ? navigator.language : "es-ES";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      recording = true;
      btn.textContent = "⏹";
      btn.classList.add("recording");
      btn.title = "Detener grabación";
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript).join("");
      els.chatInput.value = transcript;
      els.chatInput.style.height = "auto";
      els.chatInput.style.height = Math.min(els.chatInput.scrollHeight, 140) + "px";
    };

    recognition.onend = () => {
      recording = false;
      btn.textContent = "🎤";
      btn.classList.remove("recording");
      btn.title = "Hablar con IA";
    };

    recognition.onerror = (event) => {
      recording = false;
      btn.textContent = "🎤";
      btn.classList.remove("recording");
      btn.title = "Hablar con IA";
      if (event.error === "not-allowed") {
        toast("Permiso de micrófono denegado — actívalo en el navegador.", "error");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        toast("Error de micrófono: " + event.error, "error");
      }
    };

    recognition.start();
  });
})();

// ── Price grid event delegation (names + prices + remove custom) ───────────

document.getElementById("pricesGrid")?.addEventListener("input", e => {
  const priceKey  = e.target.dataset.priceKey;
  const nameKey   = e.target.dataset.nameKey;
  const customIdx = e.target.dataset.customIdx;
  const customName= e.target.dataset.customName;

  if (priceKey) {
    // Standard item price changed
    state.globalPrices[priceKey] = parseFloat(e.target.value) || 0;
  } else if (nameKey) {
    // Standard item name changed — store in _names map
    if (!state.globalPrices._names) state.globalPrices._names = {};
    const defaultName = defaultPriceNames[nameKey] || "";
    const entered = e.target.value.trim();
    if (entered && entered !== defaultName) state.globalPrices._names[nameKey] = entered;
    else delete state.globalPrices._names[nameKey];
  } else if (customIdx !== undefined && state.globalPrices.customItems?.[Number(customIdx)] !== undefined) {
    // Custom item price changed
    state.globalPrices.customItems[Number(customIdx)].price = parseFloat(e.target.value) || 0;
  } else if (customName !== undefined && state.globalPrices.customItems?.[Number(customName)] !== undefined) {
    // Custom item name changed
    state.globalPrices.customItems[Number(customName)].name = e.target.value;
  }
});

document.getElementById("pricesGrid")?.addEventListener("click", e => {
  const idx = e.target.dataset.rmCustom;
  if (idx !== undefined) {
    state.globalPrices.customItems = (state.globalPrices.customItems || []).filter((_, i) => i !== Number(idx));
    renderPricesForm();
  }
});

document.getElementById("addCustomPriceBtn")?.addEventListener("click", () => {
  const name     = document.getElementById("newPriceName")?.value.trim();
  const price    = parseFloat(document.getElementById("newPriceValue")?.value) || 0;
  const category = document.getElementById("newPriceCategory")?.value || "madera";
  if (!name) { toast("Escribe el nombre del ítem.", "error"); return; }
  if (!state.globalPrices.customItems) state.globalPrices.customItems = [];
  state.globalPrices.customItems.push({ name, price, category });
  document.getElementById("newPriceName").value  = "";
  document.getElementById("newPriceValue").value = "";
  renderPricesForm();
  toast(`Ítem "${name}" agregado ✓`);
});

// ── Prices editor ─────────────────────────────────────────────────────────
document.getElementById("savePricesBtn")?.addEventListener("click", async () => {
  collectPricesFromForm();
  await saveGlobalPrices();
  toast("Precios guardados ✓");
});

document.getElementById("resetPricesBtn")?.addEventListener("click", () => {
  state.globalPrices = { ...defaultGlobalPrices };
  renderPricesForm();
  toast("Precios restablecidos a valores por defecto");
});

// ── saveTenantPrices: save per-tenant prices locally and to server ──────────
async function saveTenantPrices(prices) {
  const tenant = currentTenant();
  if (!tenant) return;
  tenant.prices = { ...prices };
  save();
  if (window.location.protocol !== "file:") {
    try {
      if (AUTH.token) {
        await fetch(`/api/tenants/${tenant.id}`, { method: "PUT", headers: adminApiHeader(), body: JSON.stringify(tenant) });
      } else {
        const accessCode = AUTH.accessCode || tenant.accessCode;
        if (accessCode) await fetch("/api/ebanista-prices", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: accessCode, prices })
        });
      }
      toast("Precios guardados ✓");
    } catch { toast("Guardado local ✓ (sin servidor)"); }
  } else {
    toast("Precios guardados ✓");
  }
}

// ── tenantPricesGrid event delegation (ebanista editing their own prices) ──
document.getElementById("tenantPricesGrid")?.addEventListener("input", e => {
  if (!_tenantPrices) return;
  const priceKey  = e.target.dataset.priceKey;
  const nameKey   = e.target.dataset.nameKey;
  const customIdx = e.target.dataset.customIdx;
  const customName= e.target.dataset.customName;
  if (priceKey) {
    _tenantPrices[priceKey] = parseFloat(e.target.value) || 0;
  } else if (nameKey) {
    if (!_tenantPrices._names) _tenantPrices._names = {};
    const defaultName = defaultPriceNames[nameKey] || "";
    const entered = e.target.value.trim();
    if (entered && entered !== defaultName) _tenantPrices._names[nameKey] = entered;
    else delete _tenantPrices._names[nameKey];
  } else if (customIdx !== undefined && _tenantPrices.customItems?.[Number(customIdx)] !== undefined) {
    _tenantPrices.customItems[Number(customIdx)].price = parseFloat(e.target.value) || 0;
  } else if (customName !== undefined && _tenantPrices.customItems?.[Number(customName)] !== undefined) {
    _tenantPrices.customItems[Number(customName)].name = e.target.value;
  }
});

document.getElementById("tenantPricesGrid")?.addEventListener("click", e => {
  if (!_tenantPrices) return;
  const idx = e.target.dataset.rmCustom;
  if (idx !== undefined) {
    _tenantPrices.customItems = (_tenantPrices.customItems || []).filter((_, i) => i !== Number(idx));
    renderPricesFormFor("tenantPricesGrid", _tenantPrices);
  }
});

document.getElementById("tenantAddPriceBtn")?.addEventListener("click", () => {
  if (!_tenantPrices) return;
  const name     = document.getElementById("tenantNewPriceName")?.value.trim();
  const price    = parseFloat(document.getElementById("tenantNewPriceValue")?.value) || 0;
  const category = document.getElementById("tenantNewPriceCategory")?.value || "madera";
  if (!name) { toast("Escribe el nombre del ítem.", "error"); return; }
  if (!_tenantPrices.customItems) _tenantPrices.customItems = [];
  _tenantPrices.customItems.push({ name, price, category });
  document.getElementById("tenantNewPriceName").value  = "";
  document.getElementById("tenantNewPriceValue").value = "";
  renderPricesFormFor("tenantPricesGrid", _tenantPrices);
  toast(`Ítem "${name}" agregado ✓`);
});

document.getElementById("saveTenantPricesBtn")?.addEventListener("click", async () => {
  if (!_tenantPrices) return;
  await saveTenantPrices(_tenantPrices);
});

document.getElementById("resetTenantPricesBtn")?.addEventListener("click", () => {
  const tenant = currentTenant();
  if (!tenant) return;
  _tenantPrices = { ...state.globalPrices, customItems: [...(state.globalPrices.customItems || [])] };
  renderPricesFormFor("tenantPricesGrid", _tenantPrices);
  toast("Precios restaurados a los valores globales");
});

// ── em_pricesGrid event delegation (admin setting per-tenant prices in modal) ──
document.getElementById("em_pricesGrid")?.addEventListener("input", e => {
  if (!_modalPrices) return;
  const priceKey  = e.target.dataset.priceKey;
  const nameKey   = e.target.dataset.nameKey;
  const customIdx = e.target.dataset.customIdx;
  const customName= e.target.dataset.customName;
  if (priceKey) {
    _modalPrices[priceKey] = parseFloat(e.target.value) || 0;
  } else if (nameKey) {
    if (!_modalPrices._names) _modalPrices._names = {};
    const defaultName = defaultPriceNames[nameKey] || "";
    const entered = e.target.value.trim();
    if (entered && entered !== defaultName) _modalPrices._names[nameKey] = entered;
    else delete _modalPrices._names[nameKey];
  } else if (customIdx !== undefined && _modalPrices.customItems?.[Number(customIdx)] !== undefined) {
    _modalPrices.customItems[Number(customIdx)].price = parseFloat(e.target.value) || 0;
  } else if (customName !== undefined && _modalPrices.customItems?.[Number(customName)] !== undefined) {
    _modalPrices.customItems[Number(customName)].name = e.target.value;
  }
});

document.getElementById("em_pricesGrid")?.addEventListener("click", e => {
  if (!_modalPrices) return;
  const idx = e.target.dataset.rmCustom;
  if (idx !== undefined) {
    _modalPrices.customItems = (_modalPrices.customItems || []).filter((_, i) => i !== Number(idx));
    renderPricesFormFor("em_pricesGrid", _modalPrices);
  }
});

// ── Logo upload handler in ebanista modal ────────────────────────────────
document.getElementById("em_logoFile")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 2_000_000) { toast("El logo debe ser menor a 2 MB.", "error"); e.target.value = ""; return; }
  const reader = new FileReader();
  reader.onload = (ev) => {
    const b64 = ev.target.result;
    // Store temporarily — saved to tenant on modal save
    document.getElementById("em_logoFile")._pendingB64 = b64;
    const img = document.getElementById("em_logoImg");
    const preview = document.getElementById("em_logoPreview");
    if (img) img.src = b64;
    if (preview) preview.style.display = "";
  };
  reader.readAsDataURL(file);
});
document.getElementById("em_removeLogoBtn")?.addEventListener("click", () => {
  document.getElementById("em_logoFile").value = "";
  document.getElementById("em_logoFile")._pendingB64 = null;
  const preview = document.getElementById("em_logoPreview");
  if (preview) preview.style.display = "none";
  // Clear from current tenant being edited
  const id = _ebModalEditId;
  if (id) {
    const t = state.tenants.find(x => x.id === id);
    if (t?.theme) t.theme.logoBase64 = "";
    save();
  }
});

document.getElementById("sm_logoFile")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 2_000_000) { toast("El logo debe ser menor a 2 MB.", "error"); e.target.value = ""; return; }
  const reader = new FileReader();
  reader.onload = (ev) => {
    const b64 = ev.target.result;
    document.getElementById("sm_logoFile")._pendingB64 = b64;
    const img = document.getElementById("sm_logoImg");
    const preview = document.getElementById("sm_logoPreview");
    if (img) img.src = b64;
    if (preview) preview.style.display = "";
  };
  reader.readAsDataURL(file);
});
document.getElementById("sm_removeLogoBtn")?.addEventListener("click", () => {
  document.getElementById("sm_logoFile").value = "";
  document.getElementById("sm_logoFile")._pendingB64 = "__clear__";
  const preview = document.getElementById("sm_logoPreview");
  if (preview) preview.style.display = "none";
});

// Also capture pending logo b64 when saving modal
const _origSaveEbanista = saveEbanistaFromModal;
// Patch logo into saved tenantData after the fact via event interception is complex;
// instead, the save function now handles _pendingB64 directly (see below)

// ── Render prices on load ──────────────────────────────────────────────────
renderPricesForm();

// ── Bootstrap ──────────────────────────────────────────────────────────────
seedImecaPrices();
tryAutoLogin();

// ══════════════════════════════════════════════════════════════════════════════
// EXPANSIÓN: Valoraciones · Catálogo de empresa · Perfil profesional
// ══════════════════════════════════════════════════════════════════════════════

// ── Modal de perfil profesional ───────────────────────────────────────────
document.getElementById("proProfileCloseBtn")?.addEventListener("click", () => {
  document.getElementById("proProfileModal")?.classList.add("hidden");
});
document.getElementById("proProfileModal")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});

async function openProProfileModal(professionalId) {
  const modal = document.getElementById("proProfileModal");
  const content = document.getElementById("proProfileContent");
  if (!modal || !content) return;
  content.innerHTML = '<p class="login-hint">Cargando perfil…</p>';
  modal.classList.remove("hidden");
  try {
    const [profRes, ratingsRes] = await Promise.all([
      fetch(`/api/professionals/${professionalId}`),
      fetch(`/api/professionals/${professionalId}/ratings`)
    ]);
    const p = profRes.ok ? await profRes.json() : null;
    const ratings = ratingsRes.ok ? await ratingsRes.json() : [];
    if (!p) { content.innerHTML = '<p class="login-hint">No se pudo cargar el perfil.</p>'; return; }
    const avgStars = p.ratings?.count ? starHtml(p.ratings.avg, p.ratings.count) : '<span class="star-count">Sin reseñas aún</span>';
    content.innerHTML = `
      <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:16px">
        ${p.photoUrl
          ? `<img src="${escapeHtml(p.photoUrl)}" alt="" style="width:80px;height:80px;border-radius:50%;object-fit:cover;flex-shrink:0">`
          : `<div style="width:80px;height:80px;border-radius:50%;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:800;color:var(--accent);flex-shrink:0">${escapeHtml((p.name||"?")[0])}</div>`}
        <div>
          <h3 style="margin:0 0 4px">${escapeHtml(p.name)}</h3>
          ${p.company ? `<p style="margin:0 0 2px;font-size:.88rem;color:var(--muted)">${escapeHtml(p.company)}</p>` : ""}
          <p style="margin:0 0 6px;font-size:.85rem">${escapeHtml(professionalCategoryLabel(p.category))}${p.specialty ? " · " + escapeHtml(p.specialty) : ""}</p>
          <div class="star-display">${avgStars}</div>
        </div>
      </div>
      ${p.description ? `<p style="font-size:.88rem;line-height:1.5;margin:0 0 12px">${escapeHtml(p.description)}</p>` : ""}
      <div class="form-grid" style="margin-bottom:12px">
        ${p.experienceYears ? `<div><strong style="font-size:.8rem;color:var(--muted)">EXPERIENCIA</strong><p style="margin:2px 0;font-size:.9rem">${p.experienceYears} año${p.experienceYears !== 1 ? "s" : ""}</p></div>` : ""}
        ${p.schedule ? `<div><strong style="font-size:.8rem;color:var(--muted)">HORARIO</strong><p style="margin:2px 0;font-size:.9rem">${escapeHtml(p.schedule)}</p></div>` : ""}
        ${p.location?.city ? `<div><strong style="font-size:.8rem;color:var(--muted)">UBICACIÓN</strong><p style="margin:2px 0;font-size:.9rem">📍 ${escapeHtml(p.location.city)}${p.location.province ? ", " + escapeHtml(p.location.province) : ""}</p></div>` : ""}
      </div>
      ${(p.whatsapp || p.phone) ? `<a class="primary-btn" href="https://wa.me/${(p.whatsapp||p.phone).replace(/[^0-9]/g,'')}" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;margin-bottom:16px">📞 Contactar por WhatsApp</a>` : ""}
      <hr style="margin:12px 0;border:none;border-top:1px solid var(--line)">
      <h4 style="margin:0 0 10px">Reseñas (${ratings.length})</h4>
      <div id="proRatingsList">
        ${ratings.length ? ratings.map(r => `
          <div style="padding:10px;border:1px solid var(--line);border-radius:8px;margin-bottom:8px;background:var(--surface-soft)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <strong style="font-size:.88rem">${escapeHtml(r.raterName || "Anónimo")}</strong>
              <span class="star-row">${[1,2,3,4,5].map(i=>`<span class="star${i<=r.stars?" star-filled":""}">${i<=r.stars?"★":"☆"}</span>`).join("")}</span>
            </div>
            ${r.comment ? `<p style="font-size:.85rem;margin:0;color:var(--muted)">${escapeHtml(r.comment)}</p>` : ""}
            <time style="font-size:.75rem;color:var(--muted)">${new Date(r.createdAt).toLocaleDateString()}</time>
          </div>`).join("") : '<p class="login-hint">Nadie ha dejado reseñas aún. ¡Sé el primero!</p>'}
      </div>
      <div id="proRatingForm" style="margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--surface-soft)">
        <h5 style="margin:0 0 10px">Dejar una valoración</h5>
        <div style="margin-bottom:8px">
          <span style="font-size:.85rem;color:var(--muted)">Tu nombre (opcional)</span>
          <input id="proRatingName" type="text" placeholder="Cómo quieres aparecer" style="width:100%;margin-top:4px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:.88rem;box-sizing:border-box">
        </div>
        <div style="margin-bottom:8px">
          <span style="font-size:.85rem;color:var(--muted)">Valoración*</span>
          <div class="star-input" id="proRatingStars" data-selected="0">
            ${[1,2,3,4,5].map(i=>`<button type="button" class="star-btn" data-star="${i}" aria-label="${i} estrella${i>1?"s":""}">☆</button>`).join("")}
          </div>
        </div>
        <div style="margin-bottom:10px">
          <span style="font-size:.85rem;color:var(--muted)">Comentario (opcional)</span>
          <textarea id="proRatingComment" rows="2" placeholder="Cuéntanos tu experiencia…" style="width:100%;margin-top:4px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:.88rem;box-sizing:border-box;resize:vertical"></textarea>
        </div>
        <button class="primary-btn" id="proRatingSubmitBtn" type="button" data-prof-id="${professionalId}">Enviar valoración</button>
        <p id="proRatingError" class="login-error hidden"></p>
        <p id="proRatingOk" class="login-hint hidden" style="color:var(--accent-dark)"></p>
      </div>`;
    _attachRatingFormListeners();
  } catch {
    content.innerHTML = '<p class="login-hint">Error al cargar el perfil.</p>';
  }
}

function _attachRatingFormListeners() {
  const starsEl = document.getElementById("proRatingStars");
  if (starsEl) {
    starsEl.querySelectorAll(".star-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = Number(btn.dataset.star);
        starsEl.dataset.selected = val;
        starsEl.querySelectorAll(".star-btn").forEach(b => {
          b.textContent = Number(b.dataset.star) <= val ? "★" : "☆";
          b.classList.toggle("star-btn-filled", Number(b.dataset.star) <= val);
        });
      });
      btn.addEventListener("mouseover", () => {
        const val = Number(btn.dataset.star);
        starsEl.querySelectorAll(".star-btn").forEach(b => {
          b.textContent = Number(b.dataset.star) <= val ? "★" : "☆";
        });
      });
      btn.addEventListener("mouseout", () => {
        const sel = Number(starsEl.dataset.selected || 0);
        starsEl.querySelectorAll(".star-btn").forEach(b => {
          b.textContent = Number(b.dataset.star) <= sel ? "★" : "☆";
        });
      });
    });
  }
  document.getElementById("proRatingSubmitBtn")?.addEventListener("click", async () => {
    const profId = document.getElementById("proRatingSubmitBtn").dataset.profId;
    const stars = Number(document.getElementById("proRatingStars")?.dataset.selected || 0);
    const errEl = document.getElementById("proRatingError");
    const okEl = document.getElementById("proRatingOk");
    errEl.classList.add("hidden");
    okEl.classList.add("hidden");
    if (!stars) { errEl.textContent = "Selecciona una valoración (1–5 estrellas)."; errEl.classList.remove("hidden"); return; }
    const token = currentBestAuthToken();
    if (!token) { errEl.textContent = "Debes iniciar sesión para dejar una reseña."; errEl.classList.remove("hidden"); return; }
    try {
      const res = await fetch(`/api/professionals/${profId}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          stars,
          raterName: document.getElementById("proRatingName")?.value.trim() || "",
          comment: document.getElementById("proRatingComment")?.value.trim() || ""
        })
      });
      const data = await res.json();
      if (!res.ok) { errEl.textContent = data.error || "No se pudo enviar."; errEl.classList.remove("hidden"); return; }
      okEl.textContent = "¡Gracias por tu valoración!";
      okEl.classList.remove("hidden");
      document.getElementById("proRatingSubmitBtn").disabled = true;
    } catch { errEl.textContent = "Sin conexión al servidor."; errEl.classList.remove("hidden"); }
  });
}

// ── Admin: Valoraciones ───────────────────────────────────────────────────
async function loadAdminRatingsTab() {
  const el = document.getElementById("adm_ratingsList");
  if (!el) return;
  el.innerHTML = '<p class="login-hint">Cargando…</p>';
  const hidden = document.getElementById("adm_ratingsFilter")?.value;
  const params = new URLSearchParams();
  if (hidden) params.set("hidden", hidden);
  try {
    const res = await fetch(`/api/admin/ratings?${params}`, { headers: adminAuthHeaderAdmin() });
    const list = res.ok ? await res.json() : [];
    if (!list.length) { el.innerHTML = '<p class="login-hint">No hay valoraciones.</p>'; return; }
    el.innerHTML = list.map(r => `
      <div class="admin-entity-row" id="rating-row-${r.id}">
        <div class="admin-entity-info">
          <strong>${[1,2,3,4,5].map(i=>i<=r.stars?"★":"☆").join("")} — ${escapeHtml(r.raterName || r.raterRole)}</strong>
          <span>Profesional: ${r.professionalId}</span>
          ${r.comment ? `<span>${escapeHtml(r.comment.slice(0,120))}${r.comment.length>120?"…":""}</span>` : ""}
          <span>${new Date(r.createdAt).toLocaleDateString()} ${r.hidden ? "· <em>Oculta</em>" : ""}</span>
        </div>
        <div class="admin-entity-actions">
          ${r.hidden
            ? `<button class="secondary-btn" type="button" onclick="adminToggleRating('${r.id}','show')">Mostrar</button>`
            : `<button class="secondary-btn" type="button" onclick="adminToggleRating('${r.id}','hide')">Ocultar</button>`}
        </div>
      </div>`).join("");
  } catch { el.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>'; }
}
document.getElementById("adm_refreshRatingsBtn")?.addEventListener("click", loadAdminRatingsTab);
document.getElementById("adm_ratingsFilter")?.addEventListener("change", loadAdminRatingsTab);
async function adminToggleRating(id, action) {
  await fetch(`/api/admin/ratings/${id}/${action}`, { method: "POST", headers: adminAuthHeaderAdmin() });
  loadAdminRatingsTab();
}

// ── Admin: Catálogo global ────────────────────────────────────────────────
let _catalogCategories = [];
let _selectedCatalogCompanyId = "";

async function loadAdminCatalogTab() {
  await Promise.all([_loadCatalogCategories(), _loadCatalogCompaniesSelect()]);
  _renderCategoryTree();
}

async function _loadCatalogCategories() {
  if (!_selectedCatalogCompanyId) { _catalogCategories = []; return; }
  try {
    const res = await fetch(`/api/companies/${_selectedCatalogCompanyId}/catalog/categories`);
    _catalogCategories = res.ok ? await res.json() : [];
  } catch { _catalogCategories = []; }
}

async function _loadCatalogCompaniesSelect() {
  const sel = document.getElementById("adm_catalogCompanySelect");
  if (!sel) return;
  try {
    const res = await fetch("/api/admin/companies", { headers: adminAuthHeaderAdmin() });
    const companies = res.ok ? await res.json() : [];
    sel.innerHTML = `<option value="">— Selecciona empresa —</option>` +
      companies.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    if (_selectedCatalogCompanyId) sel.value = _selectedCatalogCompanyId;
  } catch {}
}

function _renderCategoryTree() {
  const el = document.getElementById("adm_categoryTree");
  if (!el) return;
  if (!_catalogCategories.length) {
    el.innerHTML = '<p class="login-hint">Sin categorías aún. Agrega una raíz.</p>';
    return;
  }
  el.innerHTML = _buildCatTreeHtml(null, 0);
}

function _buildCatTreeHtml(parentId, depth) {
  const children = _catalogCategories.filter(c => (c.parentId || null) === (parentId || null))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));
  if (!children.length) return "";
  const indent = depth * 18;
  return children.map(c => `
    <div class="catalog-tree-node" style="margin-left:${indent}px">
      <div class="catalog-tree-row">
        <span class="catalog-tree-name">${escapeHtml(c.name)}</span>
        <div style="display:flex;gap:4px">
          <button class="tiny-btn" type="button" onclick="_addSubCategory('${c.id}','${escapeHtml(c.name)}')">+ Sub</button>
          <button class="tiny-btn" type="button" onclick="_renameCategory('${c.id}','${escapeHtml(c.name)}')">✏️</button>
          <button class="tiny-btn danger-btn" type="button" onclick="_deleteCategory('${c.id}')">🗑</button>
        </div>
      </div>
      ${_buildCatTreeHtml(c.id, depth + 1)}
    </div>`).join("");
}

document.getElementById("adm_addRootCatBtn")?.addEventListener("click", () => _addSubCategory(null, null));

async function _addSubCategory(parentId, parentName) {
  if (!_selectedCatalogCompanyId) { alert("Selecciona una empresa primero."); return; }
  const label = parentName ? `Nombre de subcategoría de "${parentName}":` : "Nombre de la categoría raíz:";
  const name = prompt(label);
  if (!name?.trim()) return;
  try {
    const res = await fetch(`/api/admin/companies/${_selectedCatalogCompanyId}/catalog/categories`, {
      method: "POST",
      headers: { ...adminAuthHeaderAdmin(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), parentId: parentId || null })
    });
    if (!res.ok) { alert((await res.json()).error || "Error al crear"); return; }
    await _loadCatalogCategories();
    _renderCategoryTree();
    _refreshProductCategorySelect();
  } catch { alert("Sin conexión."); }
}

async function _renameCategory(id, currentName) {
  if (!_selectedCatalogCompanyId) return;
  const name = prompt("Nuevo nombre:", currentName);
  if (!name?.trim() || name.trim() === currentName) return;
  try {
    const res = await fetch(`/api/admin/companies/${_selectedCatalogCompanyId}/catalog/categories/${id}`, {
      method: "PUT",
      headers: { ...adminAuthHeaderAdmin(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() })
    });
    if (!res.ok) { alert((await res.json()).error || "Error"); return; }
    await _loadCatalogCategories();
    _renderCategoryTree();
    _refreshProductCategorySelect();
  } catch { alert("Sin conexión."); }
}

async function _deleteCategory(id) {
  if (!_selectedCatalogCompanyId) return;
  if (!confirm("¿Eliminar esta categoría? Solo se puede si no tiene subcategorías ni productos.")) return;
  try {
    const res = await fetch(`/api/admin/companies/${_selectedCatalogCompanyId}/catalog/categories/${id}`, {
      method: "DELETE", headers: adminAuthHeaderAdmin()
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || "No se pudo eliminar."); return; }
    await _loadCatalogCategories();
    _renderCategoryTree();
    _refreshProductCategorySelect();
  } catch { alert("Sin conexión."); }
}

function _refreshProductCategorySelect() {
  const sel = document.getElementById("adm_prod_category");
  if (!sel) return;
  sel.innerHTML = `<option value="">— Sin categoría —</option>` +
    _catalogCategories.map(c => `<option value="${c.id}">${escapeHtml(_catPath(c.id))}</option>`).join("");
}

function _catPath(id) {
  const cat = _catalogCategories.find(c => c.id === id);
  if (!cat) return id;
  if (cat.parentId) return _catPath(cat.parentId) + " › " + cat.name;
  return cat.name;
}

// ── Productos por empresa (admin) ─────────────────────────────────────────
document.getElementById("adm_catalogCompanySelect")?.addEventListener("change", async (e) => {
  _selectedCatalogCompanyId = e.target.value;
  document.getElementById("adm_productForm")?.classList.add("hidden");
  if (_selectedCatalogCompanyId) {
    await _loadCatalogCategories();
    _renderCategoryTree();
    _refreshProductCategorySelect();
    await _loadCompanyProducts(_selectedCatalogCompanyId);
  } else {
    _catalogCategories = [];
    _renderCategoryTree();
    document.getElementById("adm_productsList").innerHTML = "";
  }
});

document.getElementById("adm_addProductBtn")?.addEventListener("click", () => {
  if (!_selectedCatalogCompanyId) { alert("Selecciona una empresa primero."); return; }
  _openProductForm(null);
});

document.getElementById("adm_cancelProductBtn")?.addEventListener("click", () => {
  document.getElementById("adm_productForm")?.classList.add("hidden");
});

document.getElementById("adm_saveProductBtn")?.addEventListener("click", async () => {
  const editId = document.getElementById("adm_prod_editId")?.value;
  const name = document.getElementById("adm_prod_name")?.value.trim();
  const errEl = document.getElementById("adm_prod_error");
  errEl.classList.add("hidden");
  if (!name) { errEl.textContent = "El nombre es obligatorio."; errEl.classList.remove("hidden"); return; }
  if (!_selectedCatalogCompanyId) { errEl.textContent = "Selecciona una empresa."; errEl.classList.remove("hidden"); return; }
  const payload = {
    name,
    categoryId: document.getElementById("adm_prod_category")?.value || null,
    brand: document.getElementById("adm_prod_brand")?.value.trim() || "",
    thickness: document.getElementById("adm_prod_thickness")?.value.trim() || "",
    color: document.getElementById("adm_prod_color")?.value.trim() || "",
    presentation: document.getElementById("adm_prod_presentation")?.value.trim() || "",
    unit: document.getElementById("adm_prod_unit")?.value.trim() || "unidad",
    price: Number(document.getElementById("adm_prod_price")?.value) || 0,
    available: document.getElementById("adm_prod_available")?.checked !== false,
    featured: document.getElementById("adm_prod_featured")?.checked || false,
    discontinued: document.getElementById("adm_prod_discontinued")?.checked || false
  };
  try {
    const url = editId
      ? `/api/admin/companies/${_selectedCatalogCompanyId}/products/${editId}`
      : `/api/admin/companies/${_selectedCatalogCompanyId}/products`;
    const res = await fetch(url, {
      method: editId ? "PUT" : "POST",
      headers: { ...adminAuthHeaderAdmin(), "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || "Error al guardar."; errEl.classList.remove("hidden"); return; }
    document.getElementById("adm_productForm")?.classList.add("hidden");
    await _loadCompanyProducts(_selectedCatalogCompanyId);
  } catch { errEl.textContent = "Sin conexión al servidor."; errEl.classList.remove("hidden"); }
});

document.getElementById("adm_importProductsBtn")?.addEventListener("click", async () => {
  if (!_selectedCatalogCompanyId) { alert("Selecciona una empresa primero."); return; }
  const json = prompt("Pega aquí un array JSON de productos:\n[{\"name\":\"...\",\"price\":0,...}, ...]");
  if (!json) return;
  try {
    const arr = JSON.parse(json);
    const res = await fetch(`/api/admin/companies/${_selectedCatalogCompanyId}/products/import`, {
      method: "POST",
      headers: { ...adminAuthHeaderAdmin(), "Content-Type": "application/json" },
      body: JSON.stringify(arr)
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || "Error"); return; }
    alert(`Importados: ${data.added} productos.`);
    await _loadCompanyProducts(_selectedCatalogCompanyId);
  } catch (e) { alert("JSON inválido o sin conexión."); }
});

document.getElementById("adm_loadPriceHistoryBtn")?.addEventListener("click", async () => {
  const el = document.getElementById("adm_priceHistoryList");
  if (!el) return;
  el.innerHTML = '<p class="login-hint">Cargando…</p>';
  try {
    const res = await fetch("/api/admin/price-history", { headers: adminAuthHeaderAdmin() });
    const list = res.ok ? await res.json() : [];
    if (!list.length) { el.innerHTML = '<p class="login-hint">Sin historial aún.</p>'; return; }
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.83rem">
      <thead><tr style="text-align:left;border-bottom:2px solid var(--line)">
        <th style="padding:6px 8px">Producto</th>
        <th style="padding:6px 8px">Precio anterior</th>
        <th style="padding:6px 8px">Precio nuevo</th>
        <th style="padding:6px 8px">Fecha</th>
      </tr></thead>
      <tbody>${list.map(h => `<tr style="border-bottom:1px solid var(--line)">
        <td style="padding:6px 8px">${escapeHtml(h.productName || h.productId)}</td>
        <td style="padding:6px 8px">${h.oldPrice != null ? "$" + Number(h.oldPrice).toFixed(2) : "—"}</td>
        <td style="padding:6px 8px">$${Number(h.newPrice).toFixed(2)}</td>
        <td style="padding:6px 8px;color:var(--muted)">${new Date(h.changedAt).toLocaleString()}</td>
      </tr>`).join("")}</tbody>
    </table>`;
  } catch { el.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>'; }
});

async function _loadCompanyProducts(companyId) {
  const el = document.getElementById("adm_productsList");
  if (!el) return;
  el.innerHTML = '<p class="login-hint">Cargando productos…</p>';
  try {
    const res = await fetch(`/api/admin/companies/${companyId}/products`, { headers: adminAuthHeaderAdmin() });
    const list = res.ok ? await res.json() : [];
    if (!list.length) { el.innerHTML = '<p class="login-hint">Esta empresa no tiene productos aún.</p>'; return; }
    el.innerHTML = list.map(pr => `
      <div class="admin-entity-row" id="prod-row-${pr.id}">
        <div class="admin-entity-info">
          <strong>${escapeHtml(pr.name)}${pr.brand ? ` <span style="font-size:.78rem;color:var(--muted);font-weight:400">· ${escapeHtml(pr.brand)}</span>` : ""}</strong>
          <span>${[pr.thickness, pr.color, pr.presentation].filter(Boolean).map(escapeHtml).join(" · ")}</span>
          <span>$${Number(pr.price).toFixed(2)} / ${escapeHtml(pr.unit)} ${pr.discontinued ? "· <em style='color:var(--danger)'>Descontinuado</em>" : ""} ${!pr.available ? "· <em style='color:var(--warn)'>No disponible</em>" : ""}</span>
          ${pr.categoryId ? `<span style="font-size:.75rem;color:var(--muted)">${escapeHtml(_catPath(pr.categoryId))}</span>` : ""}
        </div>
        <div class="admin-entity-actions">
          <button class="secondary-btn" type="button" onclick="_openProductForm('${pr.id}')">✏️ Editar</button>
          <button class="secondary-btn danger-btn" type="button" onclick="_deleteProduct('${pr.id}')">🗑</button>
        </div>
      </div>`).join("");
  } catch { el.innerHTML = '<p class="login-hint">Sin conexión al servidor.</p>'; }
}

function _openProductForm(productId) {
  const form = document.getElementById("adm_productForm");
  if (!form) return;
  _refreshProductCategorySelect();
  document.getElementById("adm_productFormTitle").textContent = productId ? "Editar producto" : "Nuevo producto";
  document.getElementById("adm_prod_editId").value = productId || "";
  if (!productId) {
    ["adm_prod_name","adm_prod_brand","adm_prod_thickness","adm_prod_color","adm_prod_presentation","adm_prod_unit","adm_prod_price"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = id === "adm_prod_unit" ? "plancha" : "";
    });
    document.getElementById("adm_prod_available").checked = true;
    document.getElementById("adm_prod_featured").checked = false;
    document.getElementById("adm_prod_discontinued").checked = false;
    document.getElementById("adm_prod_category").value = "";
  } else {
    const allProds = document.querySelectorAll(`#prod-row-${productId} .admin-entity-info`);
    // We need the actual product data — re-fetch to fill the form
    fetch(`/api/admin/companies/${_selectedCatalogCompanyId}/products`, { headers: adminAuthHeaderAdmin() })
      .then(r => r.json()).then(list => {
        const pr = list.find(p => p.id === productId);
        if (!pr) return;
        document.getElementById("adm_prod_name").value = pr.name || "";
        document.getElementById("adm_prod_brand").value = pr.brand || "";
        document.getElementById("adm_prod_category").value = pr.categoryId || "";
        document.getElementById("adm_prod_thickness").value = pr.thickness || "";
        document.getElementById("adm_prod_color").value = pr.color || "";
        document.getElementById("adm_prod_presentation").value = pr.presentation || "";
        document.getElementById("adm_prod_unit").value = pr.unit || "plancha";
        document.getElementById("adm_prod_price").value = pr.price || 0;
        document.getElementById("adm_prod_available").checked = pr.available !== false;
        document.getElementById("adm_prod_featured").checked = Boolean(pr.featured);
        document.getElementById("adm_prod_discontinued").checked = Boolean(pr.discontinued);
      }).catch(() => {});
  }
  document.getElementById("adm_prod_error")?.classList.add("hidden");
  form.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function _deleteProduct(productId) {
  if (!confirm("¿Eliminar este producto?")) return;
  try {
    const res = await fetch(`/api/admin/companies/${_selectedCatalogCompanyId}/products/${productId}`, {
      method: "DELETE", headers: adminAuthHeaderAdmin()
    });
    if (!res.ok) { alert((await res.json()).error || "Error"); return; }
    await _loadCompanyProducts(_selectedCatalogCompanyId);
  } catch { alert("Sin conexión."); }
}
