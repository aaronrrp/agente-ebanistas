// ── Generador de PDF mínimo, sin dependencias ───────────────────────────────
// No es un motor de layout general: solo sabe armar el documento de una
// cotización (texto + líneas + tabla simple), con salto de página automático.
// Usa las 14 fuentes estándar de PDF (Helvetica/Helvetica-Bold/Courier) — esas
// no requieren incrustar ningún archivo de fuente, cualquier lector de PDF las
// trae integradas.

const PAGE_WIDTH = 612;  // Carta, en puntos (72pt = 1 pulgada)
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Los textos en español (acentos, ñ, ¿) caen dentro de Latin-1 (0-255), que es
// justo lo que WinAnsiEncoding (la codificación estándar de PDF) espera —
// un byte por carácter, NO utf-8. Cualquier carácter fuera de ese rango
// (emoji, etc.) se reemplaza para no corromper el stream.
// Para el stream COMPLETO (operadores PDF + texto ya saneado) -- NUNCA debe tocar
// saltos de línea/tabs/espacios (0x00-0x1F), son los separadores entre operadores.
// Solo reemplaza lo que de verdad cae fuera de Latin-1 (256+).
function toPdfBytes(str) {
  const safe = String(str ?? "").replace(/[^\x00-ÿ]/g, "?");
  return Buffer.from(safe, "latin1");
}
// Para texto que va DENTRO de un literal "(...)" -- ahí sí hay que evitar caracteres
// de control (un salto de línea crudo ahí rompería el operador, no solo el texto).
function escapePdfText(str) {
  const safe = String(str ?? "").replace(/[^ -ÿ]/g, "?");
  return safe.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

const FONT = { regular: "/F1", bold: "/F2", mono: "/F3" };

class QuotePdf {
  constructor() {
    this.pages = [];
    this._startPage();
  }

  _startPage() {
    this.ops = [];
    this.y = PAGE_HEIGHT - MARGIN;
    this.pages.push(this.ops);
  }

  _ensureSpace(height) {
    if (this.y - height < MARGIN) this._startPage();
  }

  // Una línea de texto en una sola posición x.
  text(str, { x = MARGIN, size = 10, font = FONT.regular, color = "0 0 0" } = {}) {
    this._ensureSpace(size + 4);
    this.ops.push(`${color} rg BT ${font} ${size} Tf ${x.toFixed(1)} ${this.y.toFixed(1)} Td (${escapePdfText(str)}) Tj ET`);
    this.y -= size + 4;
    return this;
  }

  // Varias celdas en la misma fila (columnas con x fijo) — usado para la tabla.
  row(cells, { size = 9, font = FONT.mono, color = "0 0 0", gapAfter = 4 } = {}) {
    this._ensureSpace(size + gapAfter);
    for (const cell of cells) {
      this.ops.push(`${color} rg BT ${font} ${size} Tf ${cell.x.toFixed(1)} ${this.y.toFixed(1)} Td (${escapePdfText(cell.text)}) Tj ET`);
    }
    this.y -= size + gapAfter;
    return this;
  }

  hr({ color = "0.7 0.7 0.7", lineWidth = 0.5 } = {}) {
    this._ensureSpace(8);
    this.y -= 2;
    this.ops.push(`${lineWidth} w ${color} RG ${MARGIN} ${this.y.toFixed(1)} m ${(PAGE_WIDTH - MARGIN).toFixed(1)} ${this.y.toFixed(1)} l S`);
    this.y -= 8;
    return this;
  }

  // Banda de color sólida a todo el ancho de la página (sin margen) — el acento
  // "premium" de la portada, equivalente al border-top de .quote-doc-premium en
  // pantalla. Se dibuja directo en el stream actual, no mueve el cursor de texto.
  band({ height = 6, color = "0.09 0.42 0.36" } = {}) {
    this.ops.push(`${color} rg 0 ${(PAGE_HEIGHT - height).toFixed(1)} ${PAGE_WIDTH} ${height} re f`);
    return this;
  }

  gap(amount = 8) {
    this._ensureSpace(amount);
    this.y -= amount;
    return this;
  }

  // Corta un texto largo a varias líneas según un ancho aproximado en caracteres
  // (suficiente para notas/condiciones — no es medición real de glifo por glifo).
  paragraph(str, { x = MARGIN, size = 9, font = FONT.regular, maxChars = 95 } = {}) {
    const words = String(str ?? "").split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars) {
        if (line) this.text(line, { x, size, font });
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) this.text(line, { x, size, font });
    return this;
  }

  toBuffer() {
    const objects = [];
    // 1: Catalog, 2: Pages, luego pares (Page, Contents) por cada página,
    // y al final las 3 fuentes estándar.
    const pageObjNums = [];
    const contentObjNums = [];
    let nextNum = 3; // 1 y 2 ya reservados para Catalog/Pages
    for (let i = 0; i < this.pages.length; i++) {
      pageObjNums.push(nextNum++);
      contentObjNums.push(nextNum++);
    }
    const fontRegularNum = nextNum++;
    const fontBoldNum = nextNum++;
    const fontMonoNum = nextNum++;

    objects.push({ num: 1, body: `<< /Type /Catalog /Pages 2 0 R >>` });
    objects.push({
      num: 2,
      body: `<< /Type /Pages /Kids [${pageObjNums.map(n => `${n} 0 R`).join(" ")}] /Count ${pageObjNums.length} >>`
    });

    for (let i = 0; i < this.pages.length; i++) {
      const pageNum = pageObjNums[i];
      const contentNum = contentObjNums[i];
      objects.push({
        num: pageNum,
        body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
          `/Resources << /Font << /F1 ${fontRegularNum} 0 R /F2 ${fontBoldNum} 0 R /F3 ${fontMonoNum} 0 R >> >> ` +
          `/Contents ${contentNum} 0 R >>`
      });
      const streamText = this.pages[i].join("\n");
      const streamBytes = toPdfBytes(streamText);
      objects.push({ num: contentNum, stream: streamBytes });
    }

    objects.push({ num: fontRegularNum, body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>` });
    objects.push({ num: fontBoldNum, body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>` });
    objects.push({ num: fontMonoNum, body: `<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>` });

    objects.sort((a, b) => a.num - b.num);

    const chunks = [Buffer.from("%PDF-1.4\n", "latin1")];
    const offsets = [0]; // offsets[0] es el objeto 0 (libre), no se usa
    let pos = chunks[0].length;

    for (const obj of objects) {
      offsets[obj.num] = pos;
      let buf;
      if (obj.stream) {
        const header = Buffer.from(`${obj.num} 0 obj\n<< /Length ${obj.stream.length} >>\nstream\n`, "latin1");
        const footer = Buffer.from("\nendstream\nendobj\n", "latin1");
        buf = Buffer.concat([header, obj.stream, footer]);
      } else {
        buf = Buffer.from(`${obj.num} 0 obj\n${obj.body}\nendobj\n`, "latin1");
      }
      chunks.push(buf);
      pos += buf.length;
    }

    const xrefStart = pos;
    const totalObjects = objects.length + 1; // +1 por el objeto 0 libre
    let xref = `xref\n0 ${totalObjects}\n0000000000 65535 f \n`;
    const maxNum = Math.max(...objects.map(o => o.num));
    for (let n = 1; n <= maxNum; n++) {
      const offset = offsets[n];
      xref += offset != null
        ? `${String(offset).padStart(10, "0")} 00000 n \n`
        : `0000000000 00000 f \n`;
    }
    chunks.push(Buffer.from(xref, "latin1"));

    chunks.push(Buffer.from(
      `trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`,
      "latin1"
    ));

    return Buffer.concat(chunks);
  }
}

// ── Layout específico de una cotización (ebanista o vendedor) ──────────────
// Recibe los mismos datos que ya usa renderEbanistaMaterialQuotePaper /
// renderSellerQuotePaper en el cliente, para que el PDF coincida con lo que
// se ve en pantalla.
function money(n) { return `$${Number(n || 0).toFixed(2)}`; }

function padCol(str, width) {
  const s = String(str ?? "");
  // ".." en vez de "…" -- el carácter de elipsis real cae fuera de Latin-1/WinAnsi
  // y se reemplazaba por "?" al escribirlo en el PDF.
  return s.length > width ? s.slice(0, width - 2) + ".." : s + " ".repeat(width - s.length);
}

function buildQuotePdf({ quote, brand, taxLabel, defaultTaxPct = 0, extraLines = [], summary = null }) {
  const doc = new QuotePdf();
  doc.band();

  doc.text(brand?.name || "Cotización", { size: 18, font: FONT.bold });
  if (brand?.tagline) doc.text(brand.tagline, { size: 9, color: "0.4 0.4 0.4" });
  doc.gap(4);
  doc.text(`Cotización ${quote.number || ""}`, { size: 11, font: FONT.bold, color: "0.09 0.42 0.36" });
  doc.text(`Cliente: ${quote.clientName || "Sin asignar"}`, { size: 9 });
  if (quote.location) doc.text(`Ubicación: ${quote.location}`, { size: 9 });
  doc.text(`Fecha: ${quote.date || ""}    Vencimiento: ${quote.dueDate || ""}`, { size: 9 });
  doc.gap(10);

  if (summary) {
    doc.text("Resumen", { size: 10, font: FONT.bold });
    doc.paragraph(summary, { size: 9 });
    doc.gap(6);
  }
  doc.hr();
  doc.gap(4);

  // Encabezados de tabla (monoespaciada para alinear columnas sin medir glifos)
  const COL = { desc: MARGIN, qty: MARGIN + 260, price: MARGIN + 340, amount: MARGIN + 430 };
  doc.row(
    [
      { x: COL.desc, text: padCol("Descripción", 35) },
      { x: COL.qty, text: padCol("Cant.", 13) },
      { x: COL.price, text: padCol("Precio", 11) },
      { x: COL.amount, text: padCol("Importe", 10) }
    ],
    { font: FONT.bold, size: 9 }
  );
  doc.hr({ color: "0.85 0.85 0.85" });

  let subtotal = 0;
  for (const it of quote.items || []) {
    const qty = Number(it.qty) || 0;
    const unitPrice = Number(it.unitPrice) || 0;
    const lineTotal = qty * unitPrice;
    subtotal += lineTotal;
    // El "% por línea" solo se muestra cuando el ITEM trae su propia tasa (caso
    // vendedor) -- el impuesto general de una cotización de ebanista (defaultTaxPct
    // sin override por línea) va únicamente en el resumen de totales, igual que en
    // pantalla (renderEbanistaMaterialQuotePaper no lo repite por línea).
    const descLine = it.taxPercent > 0 ? `${it.description} (${it.taxPercent}% ${taxLabel || ""})` : String(it.description || "");
    doc.row([
      { x: COL.desc, text: padCol(descLine, 35) },
      { x: COL.qty, text: padCol(`${qty} ${it.unit || ""}`, 13) },
      { x: COL.price, text: padCol(money(unitPrice), 11) },
      { x: COL.amount, text: padCol(money(lineTotal), 10) }
    ]);
  }

  let taxAmount = 0;
  if (taxLabel) {
    taxAmount = (quote.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0) * ((Number(it.taxPercent ?? defaultTaxPct)) / 100), 0);
  }
  if (quote.manoObra > 0) {
    subtotal += quote.manoObra;
    doc.row([{ x: COL.desc, text: padCol("Mano de obra / instalación", 38) }, { x: COL.amount, text: padCol(money(quote.manoObra), 10) }]);
  }
  if (quote.transport > 0) {
    subtotal += quote.transport;
    doc.row([{ x: COL.desc, text: padCol("Transporte", 38) }, { x: COL.amount, text: padCol(money(quote.transport), 10) }]);
  }

  doc.gap(6);
  doc.hr();
  doc.gap(4);

  const total = quote.manualTotal > 0 ? quote.manualTotal : subtotal + taxAmount;
  if (taxAmount > 0) doc.text(`Subtotal ${money(subtotal - taxAmount)}  ·  ${taxLabel} (${defaultTaxPct}%) ${money(taxAmount)}`, { size: 9, color: "0.4 0.4 0.4" });
  doc.text(`Total: ${money(total)}`, { size: 13, font: FONT.bold, color: "0.09 0.42 0.36" });

  const benefitLines = String(quote.benefits || "").split(/\n|·|•/).map(s => s.trim()).filter(Boolean);
  if (benefitLines.length) {
    doc.gap(10);
    doc.text("Beneficios incluidos", { size: 10, font: FONT.bold });
    for (const b of benefitLines) doc.text(`-  ${b}`, { size: 9 });
  }

  if (quote.notes) {
    doc.gap(10);
    doc.text("Notas", { size: 10, font: FONT.bold });
    doc.paragraph(quote.notes, { size: 9 });
  }

  const validityDays = Math.max(1, Math.round((new Date(quote.dueDate) - new Date(quote.date)) / 86400000) || 0);
  const terms = [
    quote.deliveryTime ? ["Tiempo de entrega", quote.deliveryTime] : null,
    quote.paymentTerms ? ["Forma de pago", quote.paymentTerms] : null,
    quote.warranty ? ["Garantía", quote.warranty] : null,
    ["Vigencia de la oferta", `${validityDays} día(s), hasta el ${quote.dueDate || ""}`]
  ].filter(Boolean);
  doc.gap(10);
  doc.text("Condiciones comerciales", { size: 10, font: FONT.bold });
  for (const [label, value] of terms) doc.text(`${label}: ${value}`, { size: 9 });

  for (const line of extraLines) {
    if (!line) continue;
    doc.gap(8);
    if (line.title) doc.text(line.title, { size: 10, font: FONT.bold });
    doc.paragraph(line.body, { size: 9 });
  }

  doc.gap(14);
  doc.hr({ color: "0.85 0.85 0.85" });
  if (brand?.footer) doc.text(brand.footer, { size: 8, color: "0.5 0.5 0.5" });

  return doc.toBuffer();
}

module.exports = { buildQuotePdf };
