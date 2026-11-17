// src/flows/assistanceFlow.js

import whatsappService from "../services/whatsappService.js";
import {
  appendAssistance,
  appendStudentLocation,
  appendConversation
} from "../services/googleSheetsService.js";
import { GetTextUser } from "../util.js";

const asistenciaKeywords = [
  "asistencia",
  "presente",
  "aquí estoy",
  "ya llegué",
  "llegue",
  "presente profe"
];

// 📌 Coordenadas EXACTAS del CETis 20 (actualizadas)
const CETIS_LAT = 18.66101205085158;
const CETIS_LNG = -91.8321150084796;

// 📏 Radio permitido
const MAX_DISTANCE_METERS = 250;

// Estado temporal para almacenar quién está enviando ubicación
const pendingLocation = {}; // { phone: true }

// ----------------------------------------------------
// Función para calcular la distancia entre dos puntos
// ----------------------------------------------------
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = x => (x * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ----------------------------------------------------
// Flujo de asistencia
// ----------------------------------------------------
export async function handleAssistanceFlow(message, phone) {
  const rawText = GetTextUser(message) || "";
  const text = rawText.toLowerCase();

  // 1️⃣ Si el usuario envía ubicación
  if (message.type === "location" && pendingLocation[phone]) {
    const lat = message.location.latitude;
    const lng = message.location.longitude;

    const distancia = calculateDistanceMeters(lat, lng, CETIS_LAT, CETIS_LNG);

    if (distancia <= MAX_DISTANCE_METERS) {
      // Dentro del CETis
      await appendAssistance(phone, "Sin nombre");
      await appendStudentLocation(phone, lat, lng);

      const okMsg =
        "🟢 *Asistencia registrada correctamente.*\n" +
        "📍 ¡Tu ubicación corresponde al CETis 20!\n" +
        `📏 Distancia: ${distancia.toFixed(1)} metros.`;

      await whatsappService.sendMessage(phone, okMsg);
      await appendConversation(["Bot", phone, okMsg]);
    } else {
      // Fuera del CETis
      const failMsg =
        "🔴 *No se pudo registrar tu asistencia.*\n\n" +
        "La ubicación enviada está fuera del CETis 20.\n" +
        `📏 Distancia detectada: ${distancia.toFixed(1)} metros.\n\n` +
        "Intenta enviar nuevamente tu ubicación si fue un error.";

      await whatsappService.sendMessage(phone, failMsg);
      await appendConversation(["Bot", phone, failMsg]);
    }

    delete pendingLocation[phone];
    return true;
  }

  // 2️⃣ Si el texto activa asistencia
  const triggered = asistenciaKeywords.some(k => text.includes(k));
  if (!triggered) return false;

  pendingLocation[phone] = true;

  const askLoc =
    "📍 *Para registrar tu asistencia necesito tu ubicación.*\n\n" +
    "Por favor envíame tu ubicación usando el botón *Enviar ubicación*.";

  await whatsappService.sendMessage(phone, askLoc);
  await appendConversation(["Bot", phone, askLoc]);

  return true;
}
