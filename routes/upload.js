// ── Subida de fotos (perfil/portafolio/empresas/retazos) ────────────────────
// Sin disco persistente en el plan free de Render, así que las imágenes no se
// guardan en el servidor — se reenvían a Cloudinary (plan gratuito) por HTTPS plano,
// sin SDK, igual de "cero dependencias" que el resto del proyecto. La API secret
// nunca llega al navegador: el cliente manda la imagen en base64 a este endpoint, y
// es el SERVIDOR quien firma y sube a Cloudinary -- mismo principio que
// OPENAI_API_KEY, que tampoco sale nunca del servidor.
//
// Subida FIRMADA (no "unsigned preset"): evita que cualquiera con el cloud_name
// pueda subir contenido arbitrario a la cuenta sin pasar por este servidor.
//
// Variables de entorno necesarias (mismo patrón que ADMIN_PASSWORD/OPENAI_API_KEY,
// se configuran a mano en Render): CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
// CLOUDINARY_API_SECRET. Mientras no estén configuradas, este endpoint responde
// 503 con un mensaje claro -- igual que el resto de la app "corre en modo local"
// sin IA real cuando falta OPENAI_API_KEY.
const crypto = require("node:crypto");
const { sendJson, readBody, dataUrlToBlob } = require("../lib/shared.js");

function cloudinaryConfigured() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

function signParams(params, apiSecret) {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  return crypto.createHash("sha1").update(sorted + apiSecret).digest("hex");
}

async function uploadToCloudinary(blob, folder) {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = { timestamp, folder: folder || "agente-ebanistas" };
  const signature = signParams(paramsToSign, process.env.CLOUDINARY_API_SECRET);

  const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
  const form = new FormData();
  form.append("file", blob, `foto.${ext}`);
  form.append("api_key", process.env.CLOUDINARY_API_KEY);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", paramsToSign.folder);

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const ar = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30000)
  });
  const ad = await ar.json();
  if (!ar.ok || !ad.secure_url) {
    console.log(`[upload-image] Cloudinary respondió status=${ar.status} error="${ad.error?.message}"`);
    return { ok: false, error: ad.error?.message || "No se pudo subir la imagen." };
  }
  return { ok: true, url: ad.secure_url };
}

async function handle(req, res, { method, p }) {
  if (method !== "POST" || p !== "/api/upload-image") return false;

  if (!cloudinaryConfigured()) {
    console.log("[upload-image] CLOUDINARY_* no configurado -- ver routes/upload.js para las 3 variables necesarias");
    sendJson(res, 503, { error: "Subida de imágenes no configurada todavía en el servidor. Pega un link a la foto por ahora." });
    return true;
  }

  const body = await readBody(req);
  const data = body ? JSON.parse(body) : {};
  if (typeof data.imageData !== "string" || !data.imageData.startsWith("data:image/")) {
    sendJson(res, 400, { error: "Se requiere una imagen." });
    return true;
  }
  const blob = dataUrlToBlob(data.imageData);
  if (!blob) { sendJson(res, 400, { error: "Imagen inválida." }); return true; }
  if (blob.size > 8_000_000) { sendJson(res, 400, { error: "La imagen es demasiado grande (máximo ~8MB)." }); return true; }

  try {
    const result = await uploadToCloudinary(blob, data.folder);
    if (!result.ok) { sendJson(res, 502, { error: result.error }); return true; }
    sendJson(res, 200, { url: result.url });
  } catch (e) {
    console.log(`[upload-image] excepción: ${e.message}`);
    sendJson(res, 503, { error: "No se pudo subir la imagen, intenta de nuevo." });
  }
  return true;
}

module.exports = { handle };
