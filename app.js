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
  return {
    ...state.globalPrices,
    ...tenant.prices,
    customItems: tenant.prices.customItems ?? state.globalPrices.customItems ?? [],
    _names: { ...(state.globalPrices._names || {}), ...(tenant.prices._names || {}) }
  };
}

// Price groups — defines which keys belong to each group
const priceGroups = [
  { id: "madera",    icon: "🪵", title: "Madera / Melamina",        keys: ["melamina_std","melamina_lg","backing_m2"] },
  { id: "canto",     icon: "🔄", title: "Canto PVC",                keys: ["canto_pvc","canto_grueso","canto_045mm_metro","canto_100mm_metro","canto_200mm_metro"] },
  { id: "cortes",    icon: "✂️", title: "Cortes / nesting",          keys: ["kerf_mm"] },
  { id: "bisagras",  icon: "🔩", title: "Bisagras y correderas",    keys: ["bisagra_std","bisagra_sc","corredera_std","corredera_sc"] },
  { id: "jaladores", icon: "🪝", title: "Jaladores",                keys: ["jalador_chico","jalador_grande","jalador_premium"] },
  { id: "mano",      icon: "🚚", title: "Mano de obra y transporte",keys: ["install_hour","transport_base","transport_km"] }
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
  sellers: []                // vendedores — siempre desde servidor, no localStorage
};

if (!state.selectedTenantId || !state.tenants.some((tenant) => tenant.id === state.selectedTenantId)) {
  state.selectedTenantId = state.tenants[0]?.id || null;
}

let _tenantPrices = null; // working copy for ebanista editing their own prices
let _modalPrices  = null; // working copy for admin modal per-tenant prices

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
  sheetPreset: document.getElementById("sheetPreset"),
  sheetWidth: document.getElementById("sheetWidth"),
  sheetHeight: document.getElementById("sheetHeight"),
  wastePercent: document.getElementById("wastePercent"),
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
  if (viewId === "sellersView" && AUTH.mode === "admin") loadSellersFromServer();
  if (viewId === "handoffsView") {
    document.getElementById("handoffEbanistaActions")?.classList.toggle("hidden", AUTH.mode !== "ebanista");
    document.getElementById("handoffSellerTabs")?.classList.toggle("hidden", AUTH.mode !== "vendedor");
    if (AUTH.mode === "ebanista") loadHandoffSellerOptions();
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
  if (switcher) switcher.style.display = AUTH.mode === "ebanista" ? "none" : "";

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

  const isNew = !existing;
  if (existing) { Object.assign(existing, tenantData); }
  else { state.tenants.unshift(tenantData); state.selectedTenantId = id; }
  save(); render();

  // Server sync: new tenants must be awaited — the server is the one generating
  // and hashing the password, so we need its response to show it to the admin.
  let passwordPlain = "";
  if (window.location.protocol !== "file:" && AUTH.token) {
    if (isNew) {
      try {
        const res = await fetch(`/api/tenants/${id}`, { method: "PUT", headers: adminApiHeader(), body: JSON.stringify(tenantData) });
        if (res.ok) { const data = await res.json(); passwordPlain = data.passwordPlain || ""; }
      } catch {}
    } else {
      fetch(`/api/tenants/${id}`, { method: "PUT", headers: adminApiHeader(), body: JSON.stringify(tenantData) }).catch(() => {});
    }
  }

  const link = getTenantLink(tenantData);
  document.getElementById("em_link").value = link;
  const pwRow = document.getElementById("em_passwordRow");
  if (pwRow) {
    if (passwordPlain) { document.getElementById("em_passwordDisplay").value = passwordPlain; pwRow.classList.remove("hidden"); }
    else pwRow.classList.add("hidden");
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
  if (!state.draftItems.length) {
    els.quoteItemsList.innerHTML = `<p class="muted">Sin módulos. Usa el chat de IA o el formulario para agregar.</p>`;
    return;
  }

  const subtotal = state.draftItems.reduce((s, it) => s + it.finalPrice, 0);
  const cards = state.draftItems.map((item, index) => `
    <article class="quote-item-card ${state.editingItemId === item.id ? "editing" : ""}">
      <header>
        <div>
          <strong>${index + 1}. ${escapeHtml(item.name)}</strong>
          <p>${item.width} × ${item.height} × ${item.depth} cm · ${item.complexityLabel}</p>
        </div>
        <span class="item-price">${money(item.finalPrice)}</span>
      </header>
      <p class="item-spec">${item.melamineThickness || "—"}${item.melamineSheet ? ` · ${escapeHtml(getMelamineSheetLabel(item.melamineSheet))}` : ""}${item.doors ? ` · puertas ${placementLabel(item.doorPlacement)}` : ""}${item.drawers ? ` · gavetas ${placementLabel(item.drawerPlacement)}` : ""}${item.shelves ? ` · repisas ${placementLabel(item.shelfPlacement)}` : ""}${item.backPlacement ? ` · fondo ${placementLabel(item.backPlacement)}` : ""}${!noInc(item.edgeBanding) ? ` · ${item.edgeBanding}` : ""}</p>
      ${item.manualPrice > 0 ? `<p class="manual-note">Precio manual. Calculado: ${money(item.calculated)}</p>` : ""}
      <div class="item-btns">
        <button class="tiny-btn" type="button" data-edit-item="${item.id}">✏ Editar</button>
        <button class="tiny-btn" type="button" data-duplicate-item="${item.id}">⧉ Duplicar</button>
        <button class="tiny-btn danger" type="button" data-remove-item="${item.id}">× Quitar</button>
      </div>
    </article>
  `).join("");

  els.quoteItemsList.innerHTML = cards + `
    <div class="draft-subtotal">
      <span>${state.draftItems.length} módulo(s) · Subtotal estimado:</span>
      <strong>${money(subtotal)}</strong>
    </div>
  `;
  autoFillCostFields();
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

function piece(item, name, width, height, qty = 1) {
  const edgeSides = computeEdgeSides(name, item.edgeBanding);
  const substrate = applyEdgeThicknessToDimensions(width, height, edgeSides);
  return Array.from({ length: qty }, (_, index) => ({
    id: crypto.randomUUID(),
    furniture: item.name,
    name: qty > 1 ? `${name} ${index + 1}` : name,
    width: roundCm(substrate.width),
    height: roundCm(substrate.height),
    thickness: item.melamineThickness,
    edgeSides,
    edge: describeEdgeSides(edgeSides),
    grain: false,
    area: roundCm(substrate.width * substrate.height)
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

// Resta el grosor de canto (mm→cm) de los lados que lo llevan. width pierde left+right, height pierde top+bottom.
function applyEdgeThicknessToDimensions(width, height, edgeSides) {
  const mm = (label) => label ? Number(String(label).replace("mm", "")) : 0;
  const wReduction = (mm(edgeSides.left) + mm(edgeSides.right)) / 10;
  const hReduction = (mm(edgeSides.top) + mm(edgeSides.bottom)) / 10;
  return {
    width: safeDimension(width - wReduction),
    height: safeDimension(height - hReduction)
  };
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

function calculateCuts() {
  const sheetWidth = Number(els.sheetWidth.value || 244);
  const sheetHeight = Number(els.sheetHeight.value || 122);
  const wastePercent = Number(els.wastePercent.value || 0);
  const sheetArea = sheetWidth * sheetHeight;
  const pieces = [
    ...state.draftItems.flatMap(generatePiecesForItem),
    ...state.manualPieces
  ];
  const usableArea = sheetArea * (1 - (wastePercent / 100));
  const sheets = packPiecesByArea(pieces, usableArea);
  const totalArea = pieces.reduce((sum, item) => sum + item.area, 0);

  return {
    pieces,
    sheetWidth,
    sheetHeight,
    wastePercent,
    sheetArea,
    usableArea,
    sheets,
    totalArea
  };
}

function packPiecesByArea(pieces, usableArea) {
  const sorted = [...pieces].sort((a, b) => b.area - a.area);
  const sheets = [];

  sorted.forEach((pieceItem) => {
    let target = sheets.find((sheet) => sheet.used + pieceItem.area <= usableArea);
    if (!target) {
      target = { number: sheets.length + 1, used: 0, pieces: [] };
      sheets.push(target);
    }
    target.used += pieceItem.area;
    target.pieces.push(pieceItem);
  });

  return sheets;
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
    `<option value="${o}"${(val||"")===o?' selected':''}>${o || "Sin canto"}</option>`).join('');
  const rows = state.editablePieces.map(p => {
    const es = p.edgeSides || { top: null, bottom: null, left: null, right: null };
    return `
    <tr data-piece-id="${p.id}">
      <td><input class="cut-input" data-field="furniture" value="${escapeHtml(p.furniture||'')}" placeholder="Mueble"></td>
      <td><input class="cut-input" data-field="name" value="${escapeHtml(p.name||'')}" placeholder="Pieza"></td>
      <td><input class="cut-input cut-num" data-field="width" type="number" min="1" step="0.5" value="${p.width||''}"></td>
      <td><input class="cut-input cut-num" data-field="height" type="number" min="1" step="0.5" value="${p.height||''}"></td>
      <td><select class="cut-input" data-field="thickness">${thick.map(t=>`<option${p.thickness===t?' selected':''}>${t}</option>`).join('')}</select></td>
      <td><select class="cut-input" data-edge-side="top" title="Canto arriba">${edgeOpts(es.top)}</select></td>
      <td><select class="cut-input" data-edge-side="bottom" title="Canto abajo">${edgeOpts(es.bottom)}</select></td>
      <td><select class="cut-input" data-edge-side="left" title="Canto izquierda">${edgeOpts(es.left)}</select></td>
      <td><select class="cut-input" data-edge-side="right" title="Canto derecha">${edgeOpts(es.right)}</select></td>
      <td><label style="display:flex;align-items:center;gap:3px;font-size:.75rem;font-weight:400"><input type="checkbox" data-field="grain" ${p.grain ? "checked" : ""}> veta</label></td>
      <td><button class="tiny-btn danger" data-rm-cut="${p.id}" type="button">×</button></td>
    </tr>`;
  }).join('');

  els.cutsOutput.innerHTML = `
    <p style="font-size:.8rem;color:#6B7280;margin:0 0 8px">
      ✏️ Haz clic en cualquier celda para editar. Ancho/alto son tamaño de <strong>corte (sustrato)</strong>, ya con el canto restado — no el tamaño terminado. Los cambios se reflejan en el cálculo de láminas al instante.
    </p>
    <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      <button id="addCutPieceBtn" class="secondary-btn" type="button">＋ Agregar pieza</button>
      <button id="regenCutPiecesBtn" class="secondary-btn" type="button">↻ Regenerar desde módulos</button>
    </div>
    <div style="overflow-x:auto">
      <table class="quote-table cuts-editable">
        <thead><tr><th>Mueble</th><th>Pieza</th><th>Ancho cm</th><th>Alto cm</th><th>Grosor</th><th>Canto▲</th><th>Canto▼</th><th>Canto◄</th><th>Canto►</th><th>Veta</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── BFDH 2D bin packing (Best Fit Decreasing + rotation) ────────────────────
function packPiecesFFDH(pieces, sheetW, sheetH, wastePct, kerfCm = 0.5) {
  const kerf = kerfCm;
  const marginX = 2, marginY = 2;
  const usableW = sheetW - marginX * 2;
  const usableH = sheetH - marginY * 2;

  // Sort by longest side desc — better than height-only
  const sorted = [...pieces].sort((a, b) =>
    Math.max(Number(b.width)||1, Number(b.height)||1) -
    Math.max(Number(a.width)||1, Number(a.height)||1)
  );

  const sheets = [];

  // Best-fit shelf: choose shelf that wastes least remaining width
  const tryPlace = (sheet, pw, ph) => {
    let best = null, bestWaste = Infinity;
    for (const shelf of sheet.shelves) {
      const rem = usableW - shelf.usedW;
      if (rem >= pw + kerf && shelf.h >= ph) {
        const waste = rem - pw - kerf;
        if (waste < bestWaste) { bestWaste = waste; best = shelf; }
      }
    }
    if (best) {
      const x = marginX + best.usedW, y = marginY + best.y;
      best.usedW += pw + kerf;
      return { x, y };
    }
    // New shelf
    const nextY = sheet.shelves.reduce((s, sh) => s + sh.h + kerf, 0);
    if (nextY + ph <= usableH && pw <= usableW) {
      sheet.shelves.push({ y: nextY, h: ph, usedW: pw + kerf });
      return { x: marginX, y: marginY + nextY };
    }
    return null;
  };

  // Try both orientations; prefer the one that fits on existing sheets first.
  // Piezas con veta (grain=true) no se rotan — deben mantener su orientación original.
  const placePiece = (sheet, pw, ph, allowRotate) => {
    const p1 = tryPlace(sheet, pw, ph);
    if (p1) return { ...p1, w: pw, h: ph, rotated: false };
    if (allowRotate && pw !== ph) {
      const p2 = tryPlace(sheet, ph, pw);
      if (p2) return { ...p2, w: ph, h: pw, rotated: true };
    }
    return null;
  };

  sorted.forEach(piece => {
    const pw = Math.max(1, Number(piece.width)  || 1);
    const ph = Math.max(1, Number(piece.height) || 1);
    const allowRotate = !piece.grain;
    let placed = false;
    for (const sheet of sheets) {
      const r = placePiece(sheet, pw, ph, allowRotate);
      if (r) { sheet.placements.push({ piece, ...r }); placed = true; break; }
    }
    if (!placed) {
      const sheet = { number: sheets.length + 1, shelves: [], placements: [] };
      const r = placePiece(sheet, pw, ph, allowRotate);
      if (r) sheet.placements.push({ piece, ...r });
      sheets.push(sheet);
    }
  });
  return sheets;
}

function recalcCutsLayout() {
  if (!els.cutsLayoutOutput) return;
  if (!state.editablePieces.length) { els.cutsLayoutOutput.innerHTML = ""; return; }

  const sheetW   = Number(document.getElementById("sheetWidth")?.value  || 244);
  const sheetH   = Number(document.getElementById("sheetHeight")?.value || 122);
  const wastePct = Number(document.getElementById("wastePercent")?.value || 12) / 100;
  const totalArea = state.editablePieces.reduce((s, p) => s + (Number(p.width)||0)*(Number(p.height)||0), 0);

  // Group by thickness for separate sheet stacks
  const byThickness = {};
  state.editablePieces.forEach(p => {
    const t = p.thickness || "18 mm";
    if (!byThickness[t]) byThickness[t] = [];
    byThickness[t].push(p);
  });

  const kerfCm = (Number(tenantPrices()?.kerf_mm) || 5) / 10;
  const allSheetGroups = Object.entries(byThickness).map(([thickness, pieces]) => {
    // Piezas con manualPlacement no entran al auto-nesting — se reservan en su posición fija.
    const autoPieces = pieces.filter(p => !p.manualPlacement);
    const manualPieces = pieces.filter(p => p.manualPlacement);
    const sheets = packPiecesFFDH(autoPieces, sheetW, sheetH, wastePct, kerfCm);
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
      const pct = Math.min(100, Math.round(usedArea / (sheetW * sheetH * (1 - wastePct)) * 100));
      const cls = pct > 90 ? "full" : pct > 75 ? "warn" : "";
      return `<div class="sheet-card">
        <strong>Lámina ${sh.number} (${thickness})</strong>
        <div class="util-bar-wrap"><div class="util-bar ${cls}" style="width:${pct}%"></div></div>
        <span>${pct}% · ${sh.placements.length} piezas</span>
      </div>`;
    }).join('');

    const svgs = sheets.map((sh, si) => {
      const rects = sh.placements.map((pl, pi) => {
        const rx = 2 + scale(pl.x);
        const ry = 2 + scaleH(pl.y);
        const rw = Math.max(8, scale(pl.w));
        const rh = Math.max(5, scaleH(pl.h));
        const label = (pl.piece.name || '').slice(0, 12);
        const grainLines = pl.piece.grain ? Array.from({ length: Math.max(2, Math.floor(rw / 6)) }, (_, gi) => {
          const gx = (rx + 3 + gi * 6).toFixed(1);
          if (Number(gx) >= rx + rw - 1) return "";
          return `<line x1="${gx}" y1="${(ry+1.5).toFixed(1)}" x2="${gx}" y2="${(ry+rh-1.5).toFixed(1)}" stroke="#9CA3AF" stroke-width="0.3"/>`;
        }).join('') : '';
        return `<g class="cut-piece-g" data-piece-id="${pl.piece.id}" data-rotated="${pl.rotated ? 1 : 0}" style="cursor:move">
          <rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}"
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
          style="border:1px solid #D1D5DB;border-radius:5px;background:#F9FAFB;touch-action:none">${rects}</svg>
      </div>`;
    }).join('');

    return `<h5 style="margin:10px 0 4px;color:#374151">Grosor: ${thickness} — ${sheets.length} lámina(s)</h5>
      <div class="sheet-list">${sheetCards}</div>
      <div style="overflow-x:auto;margin-top:6px">${svgs}</div>`;
  }).join('<hr style="margin:12px 0;border-color:#E5E7EB">');

  // Cortes estimados: en un patrón de corte por estantes (shelf cutting), separar N piezas
  // en una lámina toma N-1 cortes guillotina (estantes + piezas dentro de cada estante).
  const estimatedCuts = allSheetGroups.reduce((sum, g) =>
    sum + g.sheets.reduce((s, sh) => s + Math.max(0, sh.placements.length - 1), 0), 0);

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
    if (es.top)    cantoMetersByThickness[es.top]    = (cantoMetersByThickness[es.top]    || 0) + (Number(p.width)  || 0) / 100;
    if (es.bottom) cantoMetersByThickness[es.bottom] = (cantoMetersByThickness[es.bottom] || 0) + (Number(p.width)  || 0) / 100;
    if (es.left)   cantoMetersByThickness[es.left]   = (cantoMetersByThickness[es.left]   || 0) + (Number(p.height) || 0) / 100;
    if (es.right)  cantoMetersByThickness[es.right]  = (cantoMetersByThickness[es.right]  || 0) + (Number(p.height) || 0) / 100;
  });
  const totalCantoMeters = Object.values(cantoMetersByThickness).reduce((s, v) => s + v, 0);
  const totalCantoCost = Object.entries(cantoMetersByThickness)
    .reduce((s, [t, m]) => s + m * (cantoPriceByThickness[t] || 0), 0);
  const cantoBreakdown = Object.entries(cantoMetersByThickness)
    .filter(([, m]) => m > 0)
    .map(([t, m]) => `${t}: ${m.toFixed(2)}m`)
    .join(" · ") || "Sin canto";

  els.cutsLayoutOutput.innerHTML = `
    <div class="cuts-summary" style="margin-top:14px">
      <article><span>Piezas</span><strong>${state.editablePieces.length}</strong></article>
      <article><span>Láminas totales</span><strong>${totalSheets}</strong></article>
      <article><span>Área total</span><strong>${(totalArea/10000).toFixed(2)} m²</strong></article>
      <article><span>Lámina</span><strong>${sheetW}×${sheetH} cm</strong></article>
      <article><span>Cortes estimados</span><strong>${estimatedCuts}</strong></article>
      <article><span>Canto total</span><strong>${totalCantoMeters.toFixed(2)} m</strong></article>
    </div>
    <p style="font-size:.78rem;color:#6B7280;margin:6px 0 0">Canto por grosor: ${cantoBreakdown}${totalCantoMeters > 0 ? ` · costo estimado $${totalCantoCost.toFixed(2)}` : ""}. "Cortes estimados" asume corte por estantes (N piezas por lámina ≈ N-1 cortes guillotina) — es una estimación, no la secuencia exacta de corte.</p>
    <h4 style="margin:14px 0 6px">Distribución por grosor</h4>
    ${groupsHtml}`;
}

// ── Manual drag/rotate in cuts SVG ──────────────────────────────────────────
let _cutDrag = null; // { pieceId, svg, sheetIndex, sheetW, sheetH, startX, startY, origX, origY }

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

els.cutsLayoutOutput?.addEventListener("pointerdown", (e) => {
  const g = e.target.closest(".cut-piece-g");
  if (!g) return;
  const svg = g.closest("svg");
  if (!svg) return;
  const rectEl = g.querySelector("rect");
  const pt = _eventToSvgPoint(svg, e);
  _cutDrag = {
    pieceId: g.dataset.pieceId,
    svg,
    sheetIndex: Number(svg.dataset.sheetIndex) || 0,
    startX: pt.x, startY: pt.y,
    origX: Number(rectEl.getAttribute("x")), origY: Number(rectEl.getAttribute("y")),
    rectEl, textEl: g.querySelector("text")
  };
  g.setPointerCapture?.(e.pointerId);
  e.preventDefault();
});

els.cutsLayoutOutput?.addEventListener("pointermove", (e) => {
  if (!_cutDrag) return;
  const pt = _eventToSvgPoint(_cutDrag.svg, e);
  const dx = pt.x - _cutDrag.startX, dy = pt.y - _cutDrag.startY;
  const newX = _cutDrag.origX + dx, newY = _cutDrag.origY + dy;
  _cutDrag.rectEl.setAttribute("x", newX.toFixed(1));
  _cutDrag.rectEl.setAttribute("y", newY.toFixed(1));
  if (_cutDrag.textEl) {
    const w = Number(_cutDrag.rectEl.getAttribute("width")), h = Number(_cutDrag.rectEl.getAttribute("height"));
    _cutDrag.textEl.setAttribute("x", (newX + w / 2).toFixed(1));
    _cutDrag.textEl.setAttribute("y", (newY + h / 2 + 3).toFixed(1));
  }
});

els.cutsLayoutOutput?.addEventListener("pointerup", (e) => {
  if (!_cutDrag) return;
  const piece = state.editablePieces.find(p => p.id === _cutDrag.pieceId);
  const rectEl = _cutDrag.rectEl;
  if (piece && rectEl) {
    const { cmX, cmY } = _svgPxToCm(_cutDrag.svg, Number(rectEl.getAttribute("x")), Number(rectEl.getAttribute("y")));
    const wasRotated = piece.manualPlacement?.rotated ?? (_cutDrag.svg.querySelector(`[data-piece-id="${piece.id}"]`)?.dataset.rotated === "1");
    piece.manualPlacement = { sheetIndex: _cutDrag.sheetIndex, x: cmX, y: cmY, rotated: Boolean(wasRotated) };
  }
  _cutDrag = null;
  recalcCutsLayout();
});

els.cutsLayoutOutput?.addEventListener("dblclick", (e) => {
  const g = e.target.closest(".cut-piece-g");
  if (!g) return;
  const piece = state.editablePieces.find(p => p.id === g.dataset.pieceId);
  if (!piece) return;
  if (piece.grain && !confirm("Esta pieza tiene veta marcada — rotarla manualmente puede no calzar con el resto. ¿Rotar igual?")) return;
  const svg = g.closest("svg");
  const sheetIndex = Number(svg.dataset.sheetIndex) || 0;
  if (piece.manualPlacement) {
    piece.manualPlacement.rotated = !piece.manualPlacement.rotated;
  } else {
    const rectEl = g.querySelector("rect");
    const { cmX, cmY } = _svgPxToCm(svg, Number(rectEl.getAttribute("x")), Number(rectEl.getAttribute("y")));
    piece.manualPlacement = { sheetIndex, x: cmX, y: cmY, rotated: g.dataset.rotated !== "1" };
  }
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
  const rows = [["Mueble","Pieza","Ancho cm (sustrato)","Alto cm (sustrato)","Grosor","Canto arriba","Canto abajo","Canto izq","Canto der","Veta","Canto (resumen)"]];
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

function appendChat(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}`;
  bubble.textContent = text;
  els.chatMessages.appendChild(bubble);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  return bubble;
}

async function sendToAI() {
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
    : "⚙️ Diseñando…");
  els.sendChatBtn.disabled = true;
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;

  try {
    const endpoint = hasImage ? "/api/analyze-space" : "/api/ebanista-ai";
    // Send last 6 turns (12 messages) as conversation context
    const recentHistory = state.chatHistory.slice(-12);
    const body = hasImage
      ? { message: message || "Analiza este espacio y propón muebles de melamina.", imageData: imgDataForRequest }
      : { message, tenant: currentTenant(), currentItem: state.lastDesignItems[0] || null, history: recentHistory, customPrices: tenantPrices().customItems || [] };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);
    const res = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: controller.signal
    });
    clearTimeout(timer);

    const data = await res.json();

    if (!res.ok) {
      pending.textContent = res.status === 503
        ? "⚠️ Sin clave de OpenAI. Configura OPENAI_API_KEY en Render."
        : `❌ Error ${res.status}: ${data.error || "Error desconocido"}`;
      return;
    }

    const assistantReply = data.assistantText || "Propuesta generada.";
    pending.textContent = assistantReply;

    // Update conversation memory (max 20 entries = 10 turns)
    if (!hasImage && message) {
      state.chatHistory.push({ role: "user", text: message });
      state.chatHistory.push({ role: "assistant", text: assistantReply });
      if (state.chatHistory.length > 20) state.chatHistory = state.chatHistory.slice(-20);
    }

    const items = data.items?.length ? data.items : (data.item ? [data.item] : []);
    if (items.length > 0) {
      const normalized = items.map(it => normalizeAssistantItem(it, message));
      state.lastDesignItems = normalized;
      const aiActions = Array.isArray(data.actions) ? data.actions : [];
      const wantsCuts  = aiActions.includes("calculate_cuts");
      const wantsQuote = aiActions.includes("add_to_quote") || !wantsCuts;
      pending.appendChild(document.createElement("br"));
      if (wantsQuote) {
        const btn = document.createElement("button");
        btn.className = "chat-quote-btn";
        btn.textContent = "📋 Enviar a cotización";
        btn.onclick = () => { addItemsToQuote(normalized); showView("quoteView"); };
        pending.appendChild(btn);
      }
      if (wantsCuts) {
        const btn = document.createElement("button");
        btn.className = "chat-quote-btn";
        if (wantsQuote) btn.style.marginLeft = "6px";
        btn.textContent = "✂️ Ir a cortes";
        btn.onclick = () => { addItemsToQuote(normalized); showView("cutsView"); renderCuts(); };
        pending.appendChild(btn);
      }
    }

    // Image renders removed — generateConceptImage disabled

  } catch (e) {
    pending.textContent = e.name === "AbortError"
      ? "⏱ Tiempo agotado (55s). Intenta con imagen más pequeña."
      : `❌ Error: ${e.message}`;
  } finally {
    els.sendChatBtn.disabled = false;
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }
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
    openEbanistaModal(linkId);
    // After modal opens, also show the link immediately
    const t = state.tenants.find(t => t.id === linkId);
    if (t) {
      const link = getTenantLink(t);
      document.getElementById("em_link").value = link;
      document.getElementById("em_result").classList.remove("hidden");
      document.getElementById("em_actions").style.display = "none";
      document.getElementById("saveEbanistaModalBtn").textContent = "Guardado ✓";
    }
    return;
  }

  if (editId) { openEbanistaModal(editId); return; }

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
  document.getElementById("sm_result").classList.add("hidden");
  document.getElementById("sm_actions").style.display = "";
  const btn = document.getElementById("saveSellerModalBtn");
  if (btn) { btn.textContent = "Guardar y ver link →"; btn.disabled = false; }
  document.getElementById("sellerModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("sm_name").focus(), 80);
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
    }
  };
  if (password) payload.password = password;

  try {
    const res = _sellerModalEditId
      ? await fetch(`/api/sellers/${_sellerModalEditId}`, { method: "PUT", headers: adminApiHeader(), body: JSON.stringify(payload) })
      : await fetch("/api/sellers", { method: "POST", headers: adminApiHeader(), body: JSON.stringify(payload) });
    if (!res.ok) { toast("No se pudo guardar el vendedor."); btn.textContent = "Guardar y ver link →"; btn.disabled = false; return; }
    const data = await res.json();
    await loadSellersFromServer();

    document.getElementById("sm_link").value = getSellerLink(data);
    const pwRow = document.getElementById("sm_passwordRow");
    if (data.passwordPlain) { document.getElementById("sm_passwordDisplay").value = data.passwordPlain; pwRow.classList.remove("hidden"); }
    else pwRow.classList.add("hidden");
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
        await navigator.clipboard.writeText(data.passwordPlain).catch(() => {});
        alert(`Nueva contraseña (ya copiada al portapapeles):\n\n${data.passwordPlain}\n\nNo se volverá a mostrar.`);
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

async function loadHandoffSellerOptions() {
  const sel = document.getElementById("handoffNewTarget");
  if (!sel || AUTH.mode !== "ebanista") return;
  try {
    const res = await fetch("/api/sellers/active", { headers: handoffAuthHeader() });
    if (!res.ok) return;
    const list = await res.json();
    sel.innerHTML = '<option value="">Bandeja compartida</option>' +
      list.map(s => `<option value="${s.id}">${escapeHtml(s.name)}${s.company ? " — " + escapeHtml(s.company) : ""}</option>`).join("");
  } catch {}
}

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

document.getElementById("sendHandoffBtn")?.addEventListener("click", async () => {
  const type = document.getElementById("handoffNewType").value;
  const targetId = document.getElementById("handoffNewTarget").value;
  const payload = type === "cuts" ? { pieces: state.editablePieces } : { items: state.draftItems };
  const count = type === "cuts" ? state.editablePieces.length : state.draftItems.length;
  if (!count) { toast(type === "cuts" ? "No hay piezas en Cortes para enviar." : "No hay módulos en la cotización para enviar."); return; }
  try {
    const res = await fetch("/api/handoffs", {
      method: "POST", headers: handoffAuthHeader(),
      body: JSON.stringify({
        type,
        routing: targetId ? { mode: "direct", sellerId: targetId } : { mode: "pool" },
        note: `Envío de ${type === "cuts" ? "cortes" : "cotización"}`,
        payload
      })
    });
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

document.getElementById("addQuoteItemBtn").addEventListener("click", () => {
  const item = readItemFromForm();
  if (!item.width || !item.height || !item.depth) {
    toast("Ingresa al menos ancho, alto y profundidad.", "error");
    return;
  }
  if (state.editingItemId) {
    state.draftItems = state.draftItems.map((d) => d.id === state.editingItemId ? { ...item, id: state.editingItemId } : d);
  } else {
    state.draftItems.push(item);
  }
  resetModuleForm(); // clear all fields + state.editingItemId = null
  renderDraftItems();
  // Collapse the panel
  const panel = document.getElementById("moduleFormPanel");
  const btn   = document.getElementById("toggleModuleFormBtn");
  if (panel && btn) { panel.classList.add("hidden"); btn.textContent = "＋ Agregar módulo"; }
});

els.quoteItemsList.addEventListener("click", (event) => {
  const removeId    = event.target.dataset.removeItem;
  const editId      = event.target.dataset.editItem;
  const duplicateId = event.target.dataset.duplicateItem;

  if (editId) {
    const item = state.draftItems.find((d) => d.id === editId);
    if (!item) return;
    state.editingItemId = editId;
    fillFormFromItem(item);
    renderDraftItems();
    // Expand the form panel
    const panel = document.getElementById("moduleFormPanel");
    const btn   = document.getElementById("toggleModuleFormBtn");
    if (panel && btn) { panel.classList.remove("hidden"); btn.textContent = "▲ Cerrar formulario"; }
    document.getElementById("addQuoteItemBtn").textContent = "Guardar cambios del módulo";
    document.getElementById("itemName")?.focus();
    return;
  }

  if (duplicateId) {
    const item = state.draftItems.find((d) => d.id === duplicateId);
    if (!item) return;
    const copy = calculateItem({ ...item, id: crypto.randomUUID(), name: item.name + " (copia)" });
    state.draftItems.push(copy);
    renderDraftItems();
    toast("Módulo duplicado ✓");
    return;
  }

  if (!removeId) return;
  state.draftItems = state.draftItems.filter((item) => item.id !== removeId);
  if (state.editingItemId === removeId) {
    state.editingItemId = null;
    document.getElementById("addQuoteItemBtn").textContent = "Agregar módulo";
  }
  renderDraftItems();
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

els.addManualPiecesBtn.addEventListener("click", () => {
  const pieces = parseManualPieces(els.manualPiecesInput.value);
  if (!pieces.length) { toast("Escribe al menos: nombre, ancho, alto (separados por coma)", "error"); return; }
  state.manualPieces = [...state.manualPieces, ...pieces];
  els.manualPiecesInput.value = "";
  renderManualPieces();
  // Add directly to editable cuts table (no need to press "Calcular cortes")
  const added = pieces.map(p => ({ ...p, id: p.id || crypto.randomUUID() }));
  state.editablePieces = [...state.editablePieces, ...added];
  renderCutsPiecesTable();
  recalcCutsLayout();
  toast(`${added.length} pieza(s) agregada(s) a la tabla ✓`);
});

els.manualPiecesList.addEventListener("click", (event) => {
  const id = event.target.dataset.removeManualPiece;
  if (!id) return;
  state.manualPieces = state.manualPieces.filter((pieceItem) => pieceItem.id !== id);
  renderManualPieces();
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
  if (field === "grain") { piece.grain = e.target.checked; recalcCutsLayout(); return; }

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
      width: 60, height: 60, thickness: "18 mm",
      edgeSides: { top: null, bottom: null, left: null, right: null }, edge: "Sin canto",
      grain: false, area: 3600
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
  if (!isTenantActive(tenant) || !state.draftItems.length) return;

  const quote = buildQuote(event.currentTarget);
  state.quotes.unshift(quote);
  save();
  renderQuotePaper(quote);
  renderClient();
  renderAdmin();
  toast("Cotización generada ✓");
});

els.printQuoteBtn.addEventListener("click", () => {
  window.print();
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
  if (!state.draftItems.length) return;
  if (!confirm("¿Limpiar todos los módulos de esta cotización?")) return;
  state.draftItems = [];
  state.editingItemId = null;
  renderDraftItems();
});

// CSV export
document.getElementById("exportCutsBtn")?.addEventListener("click", exportCutsCSV);

function applySheetPreset() {
  if (els.sheetPreset.value === "custom") {
    if (state.draftItems.length || state.manualPieces.length) renderCuts();
    return;
  }
  const [width, height] = els.sheetPreset.value.split(",");
  els.sheetWidth.value = width;
  els.sheetHeight.value = height;
  if (state.draftItems.length || state.manualPieces.length) renderCuts();
}

els.sheetPreset.addEventListener("change", () => {
  if (els.sheetPreset.value === "custom") {
    els.sheetWidth.focus();
    return;
  }
  applySheetPreset();
});

els.applySheetPresetBtn.addEventListener("click", () => {
  applySheetPreset();
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
  document.getElementById("appShell").style.display = "";
  document.getElementById("logoutBtn").classList.toggle("hidden", AUTH.mode !== "admin");
  render();
  checkAiBackend();
}

function showLogin() {
  document.getElementById("appLoading")?.remove();
  document.getElementById("loginScreen").style.display = "";
  document.getElementById("appShell").style.display = "none";
}

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

// ── Sync tenants — push local first (localStorage = source of truth) ─────────
async function syncTenantsFromServer() {
  if (window.location.protocol === "file:" || !AUTH.token) return;
  try {
    // 1. Push every local tenant to server (local = source of truth)
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

    // 2. Pull server tenants to add any not in local
    const res = await fetch("/api/tenants", { headers: { Authorization: `Bearer ${AUTH.token}` } });
    if (!res.ok) return;
    const serverTenants = await res.json();
    let changed = false;
    serverTenants.forEach(st => {
      if (!state.tenants.find(t => t.id === st.id)) {
        state.tenants.push({ ...st, catalog: st.catalog || cloneCatalog() });
        changed = true;
      }
    });
    if (changed) { save(); render(); }
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
  document.getElementById("linkModalPassword").value = "";
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

  // ── 3. No valid session → show login ──────────────────────────────────────
  showLogin();
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
tryAutoLogin();
