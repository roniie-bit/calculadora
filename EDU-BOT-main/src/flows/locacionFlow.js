// src/flows/locacionFlow.js

import whatsappService from "../services/whatsappService.js";

/**
 * Flujo que envía la ubicación del plantel CETis 20 al estudiante.
 */
export async function sendLocationFlow(to, callbackSendMenu) {
  // (1) Enviar ubicación REAL del CETis 20
  await whatsappService.sendLocationMessage(
    to,
    18.66101205085158, // LATITUD
    -91.8321150084796, // LONGITUD
    "CETis 20 – Ciudad del Carmen",
    "Av. 21 de Abril 18, Playa Norte, 24115 Ciudad del Carmen, Campeche."
  );

  // (2) Texto informativo actualizado
  const locationText =
    "📍 *Ubicación oficial del plantel CETis 20*\n\n" +
    "Nos encontramos en:\n" +
    "📌 *Av. 21 de Abril #18*\n" +
    "📌 *Col. Playa Norte*\n" +
    "📌 *Cdad. del Carmen, Campeche*\n\n" +
    "Si necesitas más apoyo, aquí estoy para ayudarte 😊";

  await whatsappService.sendMessage(to, locationText);

  // (3) Imagen del plantel (puedes cambiarla cuando quieras)
  const imageUrl =
    "https://static.wixstatic.com/media/613bb7_018e9c29f7b74e9a9295ea8e60e31cc6~mv2.jpg/v1/fill/w_600,h_450,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/506037791_24216101668028218_3171080070840084499_n.jpg";

  await whatsappService.sendMediaMessage(to, "image", imageUrl, "");

  // (4) Regresar al menú
  if (typeof callbackSendMenu === "function") {
    await callbackSendMenu(to);
  }
}

/**
 * Wrapper compatible con messageHandler.js
 */
export async function handleLocationFlow(to, message) {
  return sendLocationFlow(to, async () => {
    const { sendWelcomeMessageAndMenu } = await import("../util.js");
    const menuMessages = sendWelcomeMessageAndMenu(to);

    for (const m of menuMessages) {
      await whatsappService.sendMessage(m.to, m);
    }
  });
}
