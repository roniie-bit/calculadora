// ======================================================
// ✅ src/flows/deletePersonalDataFlow.js
//  - Envía aviso al admin (robusto)
// ======================================================

import whatsappService from "../services/whatsappService.js";
import config from '../config/env.js';
import { appendConversation } from "../services/googleSheetsService.js";
import { TextMessage } from "../util.js";

export const deleteDataStates = {};

const TRIGGER_WORD = "borrarmisdatospersonales";

const ADMIN_NUMBER = config.ADMIN_NUMBER;

export function detectDeleteDataTrigger(text) {
  return (text || "").toLowerCase().trim() === TRIGGER_WORD;
}

export async function handleDeletePersonalDataFlow(phone, text) {
  const msg = (typeof text === "string" ? text : "").trim().toLowerCase();
  const state = deleteDataStates[phone];

  // --------------------------------------------------
  // 1️⃣ INICIO DEL FLUJO
  // --------------------------------------------------
  if (!state) {
    deleteDataStates[phone] = { step: "confirm" };

    const confirmMsg = {
      messaging_product: "whatsapp",
      to: phone,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text:
            "⚠️ *Solicitud de eliminación de datos personales*\n\n" +
            "¿Confirmas que deseas borrar todos tus datos personales de EDU-BOT?"
        },
        action: {
          buttons: [
            { type: "reply", reply: { id: "delete_yes", title: "Sí, borrar" } },
            { type: "reply", reply: { id: "delete_no", title: "No" } }
          ]
        }
      }
    };

    await whatsappService.sendMessage(phone, confirmMsg);
    await appendConversation(["Bot", phone, "Confirmación para borrar datos"]);
    return true;
  }

  // --------------------------------------------------
  // 2️⃣ CONFIRMACIÓN
  // --------------------------------------------------
  if (state.step === "confirm") {
    if (msg === "delete_no" || msg === "no") {
      delete deleteDataStates[phone];

      const cancelMsg = "❌ Solicitud cancelada. Tus datos no han sido modificados.";
      await whatsappService.sendMessage(phone, cancelMsg);
      await appendConversation(["Bot", phone, cancelMsg]);
      return true;
    }

    if (msg === "delete_yes" || msg === "si" || msg === "sí") {
      state.step = "email";

      const askEmail =
        "📧 *Último paso*\n\n" +
        "Por favor escribe tu *correo electrónico*.\n" +
        "Ahí te confirmaremos que tus datos han sido eliminados.";

      await whatsappService.sendMessage(phone, askEmail);
      await appendConversation(["Bot", phone, askEmail]);
      return true;
    }

    await whatsappService.sendMessage(
      phone,
      "Por favor selecciona una opción usando los botones."
    );
    return true;
  }

  // --------------------------------------------------
  // 3️⃣ RECEPCIÓN DE CORREO + AVISO AL ADMIN
  // --------------------------------------------------
  if (state.step === "email") {
    const email = typeof text === "string" ? text.trim() : "";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      await whatsappService.sendMessage(
        phone,
        "❌ El correo no parece válido. Por favor escribe un correo electrónico real."
      );
      return true;
    }

    console.log(`🗑️ Solicitud de borrado: ${phone} | ${email}`);

    // 🔔 AVISO INTERNO AL ADMIN (con wrapper seguro)
    try {
      const adminMsg =
        "⚠️ *Solicitud de eliminación de datos personales*\n\n" +
        `📱 Teléfono: ${phone}\n` +
        `📧 Correo: ${email}\n\n` +
        "El usuario solicitó la eliminación total de sus datos en EDU-BOT.";

      // ✅ Enviar como payload de texto
      await whatsappService.sendMessage(ADMIN_NUMBER, TextMessage(adminMsg, ADMIN_NUMBER));

      await appendConversation(["Bot", ADMIN_NUMBER, `Aviso admin: borrado solicitado por ${phone}`]);
    } catch (e) {
      console.error("❌ No se pudo notificar al admin:", e);
      await appendConversation(["Bot", phone, "ERROR: no se pudo notificar al admin"]);
      // OJO: no detenemos el flujo del usuario por esto
    }

    const doneMsg =
      "✅ *Tu solicitud de borrado de datos personales ha sido registrada correctamente.*\n\n" +
      `📧 Te enviaremos una confirmación al correo: ${email}`;

    await whatsappService.sendMessage(phone, doneMsg);
    await appendConversation([
      "Bot",
      phone,
      `Solicitud de borrado registrada. Email: ${email}`
    ]);

    delete deleteDataStates[phone];
    return true;
  }

  return false;
}
