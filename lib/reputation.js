// ── lib/reputation.js — Motor de reputación (niveles Bronce→Diamante) ─────────
// Función PURA que convierte señales objetivas (calificación, trabajos
// completados, antigüedad, verificación de idoneidad) en un puntaje 0–100 y un
// nivel. No guarda estado: la reputación es un valor DERIVADO, siempre fresco.
// La usa jobs.js para exponerla y el directorio para rankear (#4). Cero deps.
"use strict";

// De mayor a menor: el primero cuyo umbral se alcanza gana.
const LEVELS = [
  { key: "diamante", label: "Diamante", min: 90, color: "#7C3AED" },
  { key: "platino",  label: "Platino",  min: 72, color: "#0EA5E9" },
  { key: "oro",      label: "Oro",      min: 52, color: "#F9A825" },
  { key: "plata",    label: "Plata",    min: 28, color: "#9CA3AF" },
  { key: "bronce",   label: "Bronce",   min: 0,  color: "#B45309" }
];

// Puntaje 0–100. Cada componente aporta un tope; la calificación pesa más pero
// exige volumen de reseñas para no premiar a quien tiene "5.0 con 1 reseña".
function computeScore({ ratingAvg = 0, ratingCount = 0, completedJobs = 0, tenureDays = 0, verified = false } = {}) {
  const volume = Math.min(ratingCount / 5, 1);              // 5 reseñas = volumen pleno
  const ratingPart = (Math.min(ratingAvg, 5) / 5) * 40 * volume; // hasta 40
  const jobsPart = Math.min(completedJobs / 20, 1) * 35;    // 20 trabajos = tope, hasta 35
  const tenurePart = Math.min(tenureDays / 365, 1) * 15;    // 1 año = tope, hasta 15
  const verifiedPart = verified ? 10 : 0;                   // idoneidad verificada
  return Math.round(ratingPart + jobsPart + tenurePart + verifiedPart);
}

function levelFor(score) {
  return LEVELS.find(l => score >= l.min) || LEVELS[LEVELS.length - 1];
}

// Devuelve el objeto de reputación completo para mostrar y rankear.
function reputation(inputs = {}) {
  const score = computeScore(inputs);
  const lvl = levelFor(score);
  return {
    score,
    level: lvl.key,
    levelLabel: lvl.label,
    color: lvl.color,
    completedJobs: inputs.completedJobs || 0,
    ratingAvg: Math.round((inputs.ratingAvg || 0) * 10) / 10,
    ratingCount: inputs.ratingCount || 0,
    verified: Boolean(inputs.verified)
  };
}

module.exports = { reputation, computeScore, levelFor, LEVELS };
