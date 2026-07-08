// ── Envío de correo transaccional (v53) ──────────────────────────────────────
// Cero dependencias: usa la API REST de Brevo (plan gratis 300 correos/día) o
// Resend, vía fetch. Mismo patrón que Cloudinary/OpenAI — si las variables de
// entorno no están configuradas, no falla: registra en consola y sigue.
//
// Variables de entorno (configúralas en Render cuando quieras activar el correo):
//   Opción A (Brevo, recomendado):
//     EMAIL_PROVIDER=brevo
//     BREVO_API_KEY=xkeysib-....
//     EMAIL_FROM=notificaciones@tudominio.com   (o el correo verificado en Brevo)
//     EMAIL_FROM_NAME=PiLLA                      (opcional)
//   Opción B (Resend):
//     EMAIL_PROVIDER=resend
//     RESEND_API_KEY=re_....
//     EMAIL_FROM=notificaciones@tudominio.com
//
// Si EMAIL_PROVIDER no está, sendEmail() no hace nada (retorna {ok:false,skipped:true}).

function emailConfigured() {
  const p = process.env.EMAIL_PROVIDER;
  if (p === "brevo") return Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_FROM);
  if (p === "resend") return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  return false;
}

async function sendEmail({ to, subject, html }) {
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(to))) {
    return { ok: false, error: "correo destino inválido" };
  }
  if (!emailConfigured()) {
    console.log(`[email] no configurado — se omitió el envío a ${to} ("${subject}")`);
    return { ok: false, skipped: true };
  }
  const from = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || "PiLLA";
  try {
    if (process.env.EMAIL_PROVIDER === "brevo") {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", "accept": "application/json" },
        body: JSON.stringify({ sender: { email: from, name: fromName }, to: [{ email: to }], subject, htmlContent: html }),
        signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) { const t = await r.text().catch(() => ""); console.log(`[email:brevo] status=${r.status} ${t.slice(0,200)}`); return { ok: false, error: `brevo ${r.status}` }; }
      return { ok: true };
    }
    if (process.env.EMAIL_PROVIDER === "resend") {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `${fromName} <${from}>`, to: [to], subject, html }),
        signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) { const t = await r.text().catch(() => ""); console.log(`[email:resend] status=${r.status} ${t.slice(0,200)}`); return { ok: false, error: `resend ${r.status}` }; }
      return { ok: true };
    }
  } catch (e) {
    console.log(`[email] excepción: ${e.message}`);
    return { ok: false, error: e.message };
  }
  return { ok: false, skipped: true };
}

// Plantilla: solicitud recibida / en revisión
function reviewPendingHtml(name, kind) {
  const rol = kind === "company" ? "empresa" : "perfil profesional";
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1346">
    <h2 style="color:#3B2D8F">¡Recibimos tu solicitud!</h2>
    <p>Hola ${escapeText(name)},</p>
    <p>Tu ${rol} en <strong>PiLLA</strong> quedó registrado y está <strong>en revisión</strong>.
    Nuestro equipo lo revisará y te avisaremos cuando esté aprobado y visible en el directorio.</p>
    <p>Gracias por sumarte al ecosistema de la construcción y el mueble en Panamá.</p>
    <p style="color:#6B7280;font-size:.85rem">— Equipo PiLLA</p>
  </div>`;
}

// Plantilla: aprobado
function approvedHtml(name, kind, accessCode) {
  const rol = kind === "company" ? "empresa" : "perfil profesional";
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1346">
    <h2 style="color:#3B2D8F">¡Tu ${rol} fue aprobado! 🎉</h2>
    <p>Hola ${escapeText(name)},</p>
    <p>Ya estás visible en el directorio de <strong>PiLLA</strong>. Los clientes pueden encontrarte y contactarte.</p>
    ${accessCode ? `<p>Tu código de acceso para entrar a tu panel es: <strong>${escapeText(accessCode)}</strong></p>` : ""}
    <p style="color:#6B7280;font-size:.85rem">— Equipo PiLLA</p>
  </div>`;
}

function escapeText(s) {
  return String(s || "").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

module.exports = { sendEmail, emailConfigured, reviewPendingHtml, approvedHtml };
