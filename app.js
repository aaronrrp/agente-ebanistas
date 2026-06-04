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

const defaultTenants = [
  {
    id: crypto.randomUUID(),
    companyName: "Muebles Rivera",
    contactName: "Luis Rivera",
    phone: "+507 6000-0001",
    email: "ventas@mueblesrivera.com",
    plan: "Pro",
    status: "active",
    expiresAt: "2026-07-03",
    margin: 35,
    installBase: 85,
    transportBase: 35,
    materials: "Melamina hidrófuga RH blanca, nogal y gris; canto PVC; bisagras cierre suave; correderas telescópicas.",
    terms: "60% para iniciar fabricación y 40% contra entrega o antes de instalación. La cotización puede variar si cambian medidas, materiales, herrajes o condiciones de instalación.",
    catalog: cloneCatalog()
  },
  {
    id: crypto.randomUUID(),
    companyName: "Ebanistería El Cedro",
    contactName: "María Santos",
    phone: "+507 6000-0002",
    email: "cotizaciones@elcedro.com",
    plan: "Básico",
    status: "suspended",
    expiresAt: "2026-05-28",
    margin: 28,
    installBase: 70,
    transportBase: 25,
    materials: "Melamina hidrófuga blanca, gris y madera clara. Herrajes estándar.",
    terms: "50% de abono inicial y 50% al finalizar. No incluye plomería, electricidad ni retiro de muebles existentes.",
    catalog: cloneCatalog()
  }
];

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
  install_hour: 25, transport_base: 30, transport_km: 0.50
};

const state = {
  tenants: load("tm_tenants", defaultTenants),
  quotes: load("tm_quotes", []),
  selectedTenantId: localStorage.getItem("tm_selected_tenant") || null,
  draftItems: [],
  manualPieces: [],
  currentImageData: null,
  lastDesignItems: [],
  editingItemId: null,
  aiBackendAvailable: false,
  globalPrices: load("tm_global_prices", defaultGlobalPrices)
};

if (!state.selectedTenantId || !state.tenants.some((tenant) => tenant.id === state.selectedTenantId)) {
  state.selectedTenantId = state.tenants[0]?.id || null;
}

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
  plan: document.getElementById("plan"),
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
  furnitureBrief: document.getElementById("furnitureBrief"),
  interpretFurnitureBtn: document.getElementById("interpretFurnitureBtn"),
  aiAddFurnitureBtn: document.getElementById("aiAddFurnitureBtn"),
  aiAddAndCutsBtn: document.getElementById("aiAddAndCutsBtn"),
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
  cutsOutput: document.getElementById("cutsOutput")
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
async function loadGlobalPrices() {
  try {
    const res = await fetch("/api/prices");
    if (res.ok) {
      const data = await res.json();
      state.globalPrices = { ...defaultGlobalPrices, ...data };
      localStorage.setItem("tm_global_prices", JSON.stringify(state.globalPrices));
      renderPricesForm();
    }
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

function renderPricesForm() {
  const fields = [
    ["melamina_std","melamina_lg","canto_pvc","canto_grueso","backing_m2"],
    ["bisagra_std","bisagra_sc","corredera_std","corredera_sc"],
    ["jalador_chico","jalador_grande","jalador_premium"],
    ["install_hour","transport_base","transport_km"]
  ].flat();
  fields.forEach(k => {
    const el = document.getElementById(`price_${k}`);
    if (el) el.value = state.globalPrices[k] ?? defaultGlobalPrices[k];
  });
}

function collectPricesFromForm() {
  const keys = Object.keys(defaultGlobalPrices);
  keys.forEach(k => {
    const el = document.getElementById(`price_${k}`);
    if (el) state.globalPrices[k] = parseFloat(el.value) || defaultGlobalPrices[k];
  });
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
  setSelectOptions("furnitureType", catalog.furnitureTypes);
  setSelectOptions("edgeBanding", catalog.edgeOptions);
  setSelectOptions("hinges", catalog.hingeOptions);
  setSelectOptions("drawerSlides", catalog.slideOptions);
  setSelectOptions("handles", catalog.handleOptions);
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
    return `
      <article class="tenant-card">
        <header>
          <div>
            <strong>${t.companyName}</strong>
            <p>${t.plan} · ${t.phone || "—"} · vence ${t.expiresAt} ${badge}</p>
          </div>
          <span class="status-pill ${act ? "status-active" : "status-suspended"}">${act ? "Activo" : "Suspendido"}</span>
        </header>
        <div class="card-actions">
          <button class="tiny-btn highlight-btn" type="button" data-link-tenant="${t.id}">🔗 Ver link</button>
          <button class="tiny-btn" type="button" data-edit-tenant="${t.id}">✏️ Editar</button>
          <button class="tiny-btn ${act ? "danger-btn" : ""}" type="button" data-toggle-tenant="${t.id}">${act ? "Suspender" : "Activar"}</button>
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
  els.plan.value = tenant.plan;
  els.status.value = tenant.status;
  els.expiresAt.value = tenant.expiresAt;
  els.margin.value = tenant.margin;
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

function renderClient() {
  const tenant = currentTenant();
  if (!tenant) return;
  const active = isTenantActive(tenant);

  // Show logo if available
  if (tenant.logoBase64) {
    els.clientTitle.innerHTML = `<img src="${tenant.logoBase64}" alt="Logo" style="max-height:32px;max-width:80px;object-fit:contain;vertical-align:middle;margin-right:.5rem">Agente IA de ${tenant.companyName}`;
  } else {
    els.clientTitle.textContent = `Agente IA de ${tenant.companyName}`;
  }

  els.subscriptionBanner.className = `subscription-banner active ${active ? "ok" : "danger"}`;
  els.subscriptionBanner.textContent = active
    ? `Suscripción activa hasta ${tenant.expiresAt}. Puede usar diseño IA y cotizaciones.`
    : "Suscripción inactiva o vencida. Diseño IA y cotizaciones quedan bloqueados.";

  els.clientSummary.innerHTML = summaryItem("Empresa", tenant.companyName)
    + summaryItem("Plan", tenant.plan)
    + summaryItem("Estado", active ? "Activo" : statusLabel(tenant.status))
    + summaryItem("Vence", tenant.expiresAt)
    + summaryItem("Margen", `${tenant.margin}%`)
    + summaryItem("Contacto", tenant.phone);

  const tenantQuotes = state.quotes.filter((quote) => quote.tenantId === tenant.id).slice(0, 6);
  els.quoteHistory.innerHTML = tenantQuotes.length ? tenantQuotes.map((quote) => `
    <article class="history-card">
      <header>
        <strong>${quote.finalClient}</strong>
        <span>${money(quote.total)}</span>
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
  const minimal = {
    id: tenant.id, companyName: tenant.companyName, contactName: tenant.contactName || "",
    phone: tenant.phone || "", email: tenant.email || "", plan: tenant.plan || "Básico",
    status: tenant.status, expiresAt: tenant.expiresAt, margin: tenant.margin || 30,
    installBase: tenant.installBase || 75, transportBase: tenant.transportBase || 30,
    materials: tenant.materials || "", terms: tenant.terms || "", accessCode: tenant.accessCode
  };
  // URL-encode the JSON directly — no base64, no + / = corruption
  const encoded = encodeURIComponent(JSON.stringify(minimal));
  return `${window.location.origin}/?code=${tenant.accessCode}&d=${encoded}`;
}

let _ebModalEditId = null;

function openEbanistaModal(editId) {
  _ebModalEditId = editId || null;
  const t = editId ? state.tenants.find(t => t.id === editId) : null;
  document.getElementById("ebanistaModalTitle").textContent = editId ? "Editar ebanista" : "Nuevo ebanista";
  document.getElementById("em_company").value = t?.companyName || "";
  document.getElementById("em_contact").value = t?.contactName || "";
  document.getElementById("em_phone").value = t?.phone || "";
  document.getElementById("em_plan").value = t?.plan || "Básico";
  document.getElementById("em_expires").value = t?.expiresAt || addDays(30);
  document.getElementById("em_result").classList.add("hidden");
  document.getElementById("em_actions").style.display = "";
  const btn = document.getElementById("saveEbanistaModalBtn");
  if (btn) { btn.textContent = "Guardar y ver link →"; btn.disabled = false; }
  document.getElementById("ebanistaModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("em_company").focus(), 80);
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
    plan: document.getElementById("em_plan").value,
    status: existing?.status || "active",
    expiresAt: document.getElementById("em_expires").value || addDays(30),
    margin: existing?.margin ?? 30,
    installBase: existing?.installBase ?? 75,
    transportBase: existing?.transportBase ?? 30,
    materials: existing?.materials || "Melamina hidrófuga, canto PVC, herrajes estándar.",
    terms: existing?.terms || "60% para iniciar fabricación y 40% contra entrega.",
    accessCode,
    catalog: existing?.catalog || cloneCatalog()
  };

  if (existing) { Object.assign(existing, tenantData); }
  else { state.tenants.unshift(tenantData); state.selectedTenantId = id; }
  save(); render();

  // Background server sync (non-blocking)
  if (window.location.protocol !== "file:" && AUTH.token) {
    fetch(`/api/tenants/${id}`, { method: "PUT", headers: adminApiHeader(), body: JSON.stringify(tenantData) }).catch(() => {});
  }

  const link = getTenantLink(tenantData);
  document.getElementById("em_link").value = link;
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
    plan: els.plan.value,
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
    melamineThickness: document.getElementById("melamineThickness").value,
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
  const technicalFactor = (thicknessFactor[item.melamineThickness] || 1) * (edgeFactor[item.edgeBanding] || 1);
  const materialCost = Math.max(85, linearMeters * base * heightFactor * depthFactor * technicalFactor);
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

function optionCost(map, key, fallback) {
  if (String(key).toLowerCase().startsWith("no incluir")) return 0;
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
    els.quoteItemsList.innerHTML = `<p class="muted">No hay muebles agregados. Agrega un mueble para cotizar.</p>`;
    return;
  }

  els.quoteItemsList.innerHTML = state.draftItems.map((item, index) => `
    <article class="quote-item-card ${state.editingItemId === item.id ? "editing" : ""}">
      <header>
        <div>
          <strong>${index + 1}. ${item.name}</strong>
          <p>${item.width} x ${item.height} x ${item.depth} cm · ${item.complexityLabel}</p>
        </div>
        <span>${money(item.finalPrice)}</span>
      </header>
      <p>${item.melamineThickness} · medidas ${placementLabel(item.dimensionBasis)} · repisas ${placementLabel(item.shelfPlacement)} · puertas ${placementLabel(item.doorPlacement)} · fondo ${placementLabel(item.backPlacement)} · ${item.edgeBanding} · ${item.hinges} · ${item.drawerSlides} · ${item.handles}</p>
      ${item.manualPrice > 0 ? `<p class="manual-note">Precio manual aplicado. Calculado: ${money(item.calculated)}</p>` : ""}
      <button class="tiny-btn" type="button" data-edit-item="${item.id}">Editar</button>
      <button class="tiny-btn" type="button" data-remove-item="${item.id}">Quitar</button>
    </article>
  `).join("");
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
  const installCost = form.includeInstall.checked ? tenant.installBase + (state.draftItems.length * 28) : 0;
  const transportCost = form.includeTransport.checked ? tenant.transportBase : 0;
  const itemsSubtotal = state.draftItems.reduce((sum, item) => sum + item.finalPrice, 0);
  const marginAmount = itemsSubtotal * (tenant.margin / 100);
  const contingency = itemsSubtotal * 0.08;
  const calculatedTotal = Math.ceil((itemsSubtotal + installCost + transportCost + marginAmount + contingency) / 5) * 5;
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
    installCost,
    transportCost,
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
                Melamina: ${item.melamineThickness}<br>
                Canto: ${item.edgeBanding}<br>
                Bisagras: ${item.hinges}<br>
                Correderas: ${item.drawerSlides}<br>
                Jaladores: ${item.handles}<br>
                Puertas: ${item.doors} (${placementLabel(item.doorPlacement)}) · Gavetas: ${item.drawers} (${placementLabel(item.drawerPlacement)}) · Repisas: ${item.shelves} (${placementLabel(item.shelfPlacement)}) · Fondo: ${placementLabel(item.backPlacement)}
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
          <tr><th>Instalación</th><td>${quote.installCost ? money(quote.installCost) : "No incluida"}</td></tr>
          <tr><th>Transporte</th><td>${quote.transportCost ? money(quote.transportCost) : "No incluido"}</td></tr>
          <tr><th>Total calculado</th><td>${money(quote.calculatedTotal)}</td></tr>
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
  return Array.from({ length: qty }, (_, index) => ({
    id: crypto.randomUUID(),
    furniture: item.name,
    name: qty > 1 ? `${name} ${index + 1}` : name,
    width: roundCm(width),
    height: roundCm(height),
    thickness: item.melamineThickness,
    edge: edgeForPiece(name, item.edgeBanding),
    area: roundCm(width * height)
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

function edgeForPiece(name, edgeBanding) {
  const edgeText = edgeBanding.toLowerCase();
  const pieceName = name.toLowerCase();
  if (edgeText.startsWith("no incluir")) return "Sin canto";
  if (edgeText.includes("todos los cantos") || edgeText.includes("premium")) return "Todos los cantos expuestos";
  if (pieceName.includes("puerta") || pieceName.includes("frente")) return "4 cantos";
  if (edgeText.includes("frentes")) return "Canto frontal visible";
  return "Según instalación";
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
  if (!state.draftItems.length && !state.manualPieces.length) {
    els.cutsOutput.innerHTML = `<p class="muted">No hay muebles ni piezas manuales. Primero agrega muebles en Cotizar o pega piezas manuales.</p>`;
    return;
  }

  const result = calculateCuts();

  // Group by thickness
  const byThickness = {};
  result.pieces.forEach(p => {
    const key = p.thickness || "18 mm";
    if (!byThickness[key]) byThickness[key] = [];
    byThickness[key].push(p);
  });

  const thicknessTablesHtml = Object.entries(byThickness).map(([thickness, pieces]) => `
    <h4>Cortes — ${thickness}</h4>
    <table class="quote-table cuts-table">
      <thead><tr><th>Lámina</th><th>Mueble</th><th>Pieza</th><th>Medida</th><th>Canto</th></tr></thead>
      <tbody>${pieces.map(p => {
        const sheetNum = result.sheets.find(s => s.pieces.some(sp => sp.id === p.id))?.number || "?";
        return `<tr><td>Lámina ${sheetNum}</td><td>${p.furniture}</td><td>${p.name}</td><td>${p.width} x ${p.height} cm</td><td>${p.edge}</td></tr>`;
      }).join("")}</tbody>
    </table>
  `).join("");

  els.cutsOutput.innerHTML = `
    <div class="cuts-summary">
      <article><span>Piezas</span><strong>${result.pieces.length}</strong></article>
      <article><span>Láminas estimadas</span><strong>${result.sheets.length}</strong></article>
      <article><span>Área total</span><strong>${(result.totalArea / 10000).toFixed(2)} m²</strong></article>
      <article><span>Lámina</span><strong>${result.sheetWidth} x ${result.sheetHeight} cm</strong></article>
    </div>

    ${thicknessTablesHtml}

    <h4>Uso por lámina</h4>
    <div class="sheet-list">
      ${result.sheets.map((sheet) => {
        const utilPct = Math.min(100, Math.round((sheet.used / result.usableArea) * 100));
        const barClass = utilPct > 90 ? "full" : utilPct > 75 ? "warn" : "";
        return `
          <div class="sheet-card">
            <strong>Lámina ${sheet.number}</strong>
            <div class="util-bar-wrap"><div class="util-bar ${barClass}" style="width:${utilPct}%"></div></div>
            <span>${utilPct}% utilizado · ${(sheet.used / 10000).toFixed(2)} m² de ${(result.usableArea / 10000).toFixed(2)} m² útiles</span>
          </div>
        `;
      }).join("")}
    </div>
  `;

  renderCutsVisual(result);
}

function renderCutsVisual(result) {
  const container = document.getElementById("cutsVisual");
  if (!container || !result.sheets.length) return;
  const SW = 400, SH = 200;
  const colors = ["#DBEAFE","#FEF3C7","#D1FAE5","#FCE7F3","#EDE9FE","#FEE2E2"];
  const svgs = result.sheets.map((sheet) => {
    let cx = 5, cy = 5, rowH = 0;
    const rects = sheet.pieces.map((p, pi) => {
      const pw = Math.max(30, Math.min(180, (p.width / result.sheetWidth) * (SW - 10)));
      const ph = Math.max(14, Math.min(80, (p.height / result.sheetHeight) * (SH - 10)));
      if (cx + pw > SW - 5) { cx = 5; cy += rowH + 2; rowH = 0; }
      if (cy + ph > SH - 5) return "";
      rowH = Math.max(rowH, ph);
      const r = `<rect x="${cx}" y="${cy}" width="${pw}" height="${ph}" fill="${colors[pi % colors.length]}" stroke="#9CA3AF" stroke-width="0.5" rx="2"/>
        <text x="${cx+pw/2}" y="${cy+ph/2+4}" text-anchor="middle" font-size="7" fill="#374151" overflow="hidden">${p.name.slice(0,14)}</text>`;
      cx += pw + 2;
      return r;
    }).join("");
    return `<div style="display:inline-block;margin:.5rem">
      <p style="font-size:.75rem;font-weight:600;margin:0 0 4px">Lámina ${sheet.number}</p>
      <svg width="${SW}" height="${SH}" style="border:1px solid #E5E7EB;border-radius:6px;background:#FAFAFA">${rects}</svg>
    </div>`;
  });
  container.innerHTML = `<h4>Distribución visual de láminas</h4><div style="overflow-x:auto">${svgs.join("")}</div>`;
}

function exportCutsCSV() {
  if (!state.draftItems.length && !state.manualPieces.length) return;
  const result = calculateCuts();
  const rows = [["Lámina","Mueble","Pieza","Ancho cm","Alto cm","Grosor","Canto"]];
  result.sheets.forEach(sheet => {
    sheet.pieces.forEach(p => {
      rows.push([sheet.number, p.furniture, p.name, p.width, p.height, p.thickness, p.edge]);
    });
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
    const body = hasImage
      ? { message: message || "Analiza este espacio y propón muebles de melamina.", imageData: imgDataForRequest }
      : { message, tenant: currentTenant(), currentItem: state.lastDesignItems[0] || null };

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

    pending.textContent = data.assistantText || "Propuesta generada.";

    const items = data.items?.length ? data.items : (data.item ? [data.item] : []);
    if (items.length > 0) {
      const normalized = items.map(it => normalizeAssistantItem(it, message));
      state.lastDesignItems = normalized;
      const btn = document.createElement("button");
      btn.className = "chat-quote-btn";
      btn.textContent = "📋 Enviar a cotización";
      btn.onclick = () => { fillFormFromItem(normalized[0], message); showView("quoteView"); };
      pending.appendChild(document.createElement("br"));
      pending.appendChild(btn);
    }

    if (data.designPrompt) generateConceptImage(data.designPrompt, pending);

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
    if (data.imageUrl) {
      wrap.innerHTML = `
        <img src="${data.imageUrl}" alt="Render conceptual"
             style="width:100%;border-radius:8px;display:block"
             title="Clic para ampliar" onclick="window.open(this.src,'_blank')">
        <div style="display:flex;gap:8px;margin-top:6px">
          <button onclick="downloadRender('${data.imageUrl}')"
             style="font-size:0.75rem;background:none;border:none;color:#059669;cursor:pointer;padding:0">⬇ Descargar</button>
        </div>`;
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
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `diseno-ebanista-${Date.now()}.jpg`;
    a.click();
    URL.revokeObjectURL(a.href);
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
  item.width = Number(item.width || base.width);
  item.height = Number(item.height || base.height);
  item.depth = Number(item.depth || base.depth);
  item.doors = Number(item.doors || 0);
  item.drawers = Number(item.drawers || 0);
  item.shelves = Number(item.shelves || 0);
  item.manualPrice = Number(item.manualPrice || 0);
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
    .filter((item) => !state.draftItems.some((draft) => itemSignature(draft) === itemSignature(item)))
    .map((item) => calculateItem({ ...item, id: crypto.randomUUID() }));

  state.draftItems = [...state.draftItems, ...additions];
  renderDraftItems();
  if (additions.length > 0) toast("Mueble agregado a cotización ✓");
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
  const btn = event.target.closest("button[data-link-tenant], button[data-edit-tenant], button[data-toggle-tenant]");
  if (!btn) return;

  const linkId   = btn.dataset.linkTenant;
  const editId   = btn.dataset.editTenant;
  const toggleId = btn.dataset.toggleTenant;

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

els.interpretFurnitureBtn.addEventListener("click", () => {
  applyFurnitureBrief(els.furnitureBrief.value);
});

els.aiAddFurnitureBtn.addEventListener("click", () => {
  applyFurnitureBrief(els.furnitureBrief.value, { addToQuote: true });
});

els.aiAddAndCutsBtn.addEventListener("click", () => {
  applyFurnitureBrief(els.furnitureBrief.value, { addToQuote: true, calculateCuts: true });
});

document.getElementById("addQuoteItemBtn").addEventListener("click", () => {
  const item = readItemFromForm();
  if (!item.width || !item.height || !item.depth) return;
  if (state.editingItemId) {
    state.draftItems = state.draftItems.map((draft) => draft.id === state.editingItemId ? { ...item, id: state.editingItemId } : draft);
    state.editingItemId = null;
    document.getElementById("addQuoteItemBtn").textContent = "Agregar mueble";
  } else {
    state.draftItems.push(item);
  }
  renderDraftItems();
});

els.quoteItemsList.addEventListener("click", (event) => {
  const removeId = event.target.dataset.removeItem;
  const editId = event.target.dataset.editItem;

  if (editId) {
    const item = state.draftItems.find((draft) => draft.id === editId);
    if (!item) return;
    state.editingItemId = editId;
    fillFormFromItem(item);
    renderDraftItems();
    return;
  }

  if (!removeId) return;
  state.draftItems = state.draftItems.filter((item) => item.id !== removeId);
  if (state.editingItemId === removeId) {
    state.editingItemId = null;
    document.getElementById("addQuoteItemBtn").textContent = "Agregar mueble";
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
  if (!pieces.length) return;
  state.manualPieces = [...state.manualPieces, ...pieces];
  els.manualPiecesInput.value = "";
  renderManualPieces();
});

els.manualPiecesList.addEventListener("click", (event) => {
  const id = event.target.dataset.removeManualPiece;
  if (!id) return;
  state.manualPieces = state.manualPieces.filter((pieceItem) => pieceItem.id !== id);
  renderManualPieces();
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
  linkModalTenantId: null
};

function showApp() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appShell").style.display = "";
  document.getElementById("logoutBtn").classList.toggle("hidden", AUTH.mode !== "admin");
  render();
  checkAiBackend();
}

function showLogin() {
  document.getElementById("loginScreen").style.display = "";
  document.getElementById("appShell").style.display = "none";
}

function setLoginError(msg) {
  const el = document.getElementById("loginError");
  el.textContent = msg;
  el.classList.toggle("hidden", !msg);
}

// ── Tab switch ────────────────────────────────────────────────────────────
document.querySelectorAll("[data-login-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-login-tab]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.loginTab;
    document.getElementById("loginCodePanel").classList.toggle("hidden", tab !== "code");
    document.getElementById("loginAdminPanel").classList.toggle("hidden", tab !== "admin");
    setLoginError("");
  });
});

// ── Enter key in login inputs ──────────────────────────────────────────────
document.getElementById("loginCodeInput")?.addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("loginCodeBtn").click();
});
document.getElementById("loginPasswordInput")?.addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("loginAdminBtn").click();
});

// ── Ebanista login with code ───────────────────────────────────────────────
document.getElementById("loginCodeBtn")?.addEventListener("click", async () => {
  const code = document.getElementById("loginCodeInput").value.trim();
  if (!code) { setLoginError("Ingresa tu código de acceso."); return; }

  // Try server first; fall back to local state (for offline/demo)
  let tenant = null;
  if (window.location.protocol !== "file:") {
    try {
      const res = await fetch(`/api/tenant-by-code?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
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
  state.selectedTenantId = tenant.id;
  sessionStorage.setItem("ebAuthMode", "ebanista");
  sessionStorage.setItem("ebTenantId", tenant.id);
  save();

  // Hide admin nav item from ebanistas
  document.querySelector('[data-view="adminView"]')?.classList.add("hidden");
  showApp();
  showView("clientView");
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
  AUTH.mode = null; AUTH.token = null; AUTH.tenantId = null;
  sessionStorage.removeItem("ebAuthMode");
  sessionStorage.removeItem("ebAdminToken");
  sessionStorage.removeItem("ebTenantId");
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
async function tryAutoLogin() {
  // 1. Check URL for ?code=
  const params = new URLSearchParams(window.location.search);
  const urlCode = params.get("code");
  if (urlCode) {
    // Try URL-encoded tenant data first (works even when server is sleeping)
    const urlData = params.get("d");
    if (urlData) {
      try {
        // Try as plain JSON first (new format, URLSearchParams already decoded it)
        // Fall back to base64 variants for older links
        let decoded;
        try {
          decoded = JSON.parse(urlData);
        } catch {
          // Old base64 link — handle spaces (+ decoded as space) and URL-safe chars
          const b64 = urlData.replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/');
          const mod4 = b64.length % 4;
          const padded = mod4 ? b64 + '='.repeat(4 - mod4) : b64;
          decoded = JSON.parse(decodeURIComponent(escape(atob(padded))));
        }
        const today = new Date().toISOString().slice(0, 10);
        if (decoded.accessCode === urlCode) {
          if (decoded.status !== "active" || decoded.expiresAt < today) {
            // Show login screen with error
            showLogin();
            document.getElementById("loginCodePanel")?.classList.remove("hidden");
            setLoginError("Tu acceso está suspendido o venció. Contacta al administrador.");
            return;
          }
          // Valid tenant from URL — log in without hitting server
          const existing = state.tenants.find(t => t.id === decoded.id);
          if (existing) { Object.assign(existing, decoded); }
          else { decoded.catalog = decoded.catalog || cloneCatalog(); state.tenants.push(decoded); }
          save();
          AUTH.mode = "ebanista";
          AUTH.tenantId = decoded.id;
          state.selectedTenantId = decoded.id;
          sessionStorage.setItem("ebAuthMode", "ebanista");
          sessionStorage.setItem("ebTenantId", decoded.id);
          document.querySelector('[data-view="adminView"]')?.classList.add("hidden");
          showApp();
          showView("clientView");
          return;
        }
      } catch {}
    }

    document.getElementById("loginCodeInput").value = urlCode;
    // Switch to ebanista tab
    document.querySelectorAll("[data-login-tab]").forEach(b => b.classList.remove("active"));
    document.querySelector('[data-login-tab="code"]')?.classList.add("active");
    document.getElementById("loginCodePanel")?.classList.remove("hidden");
    document.getElementById("loginAdminPanel")?.classList.add("hidden");
    document.getElementById("loginCodeBtn")?.click();
    return;
  }

  // 2. Restore session from sessionStorage
  const savedMode = sessionStorage.getItem("ebAuthMode");
  const savedToken = sessionStorage.getItem("ebAdminToken");
  const savedTenantId = sessionStorage.getItem("ebTenantId");

  if (savedMode === "admin" && savedToken) {
    // Verify token is still valid
    if (window.location.protocol !== "file:") {
      try {
        const res = await fetch("/api/auth/check", { headers: { Authorization: `Bearer ${savedToken}` } });
        const data = res.ok ? await res.json() : null;
        if (data?.valid) {
          AUTH.mode = "admin"; AUTH.token = savedToken;
          document.querySelector('[data-view="adminView"]')?.classList.remove("hidden");
          showApp();
          showView("adminView");
          syncTenantsFromServer();
          loadGlobalPrices();
          return;
        }
      } catch {}
    } else {
      // file:// mode: always allow
      AUTH.mode = "admin";
      showApp();
      showView("adminView");
      return;
    }
  }

  if (savedMode === "ebanista" && savedTenantId) {
    const tenant = state.tenants.find(t => t.id === savedTenantId);
    if (tenant) {
      AUTH.mode = "ebanista"; AUTH.tenantId = savedTenantId;
      state.selectedTenantId = savedTenantId;
      document.querySelector('[data-view="adminView"]')?.classList.add("hidden");
      showApp();
      showView("clientView");
      return;
    }
  }

  // 3. No valid session → show login
  showLogin();
}

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

// ── Bootstrap ──────────────────────────────────────────────────────────────
tryAutoLogin();
