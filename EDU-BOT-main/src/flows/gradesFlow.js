// src/flows/gradesFlow.js

import whatsappService from "../services/whatsappService.js";

const keywords = [
  "calificacion",
  "mis calificaciones",
  "mi calificacion",
  "consultar calificacion",
  "nota",
  "cal2do",
  "calificaciones"
];

export default {
  detect(message) {
    const msg = (message || "").toLowerCase().trim();
    if (/^(procesar|generar|actualizar) calificaciones(?:\s|$)/.test(msg)) return false;
    return keywords.some((k) => msg.includes(k));
  },

  async run(phone, userStates) {
    const msg =
      "📘 *Consulta de calificaciones*\n\n" +
      "Ahora debes enviar tu *clave completa en MAYÚSCULAS*.\n\n" +
      "Ejemplo:\n" +
      "• *WYRP1*\n" +
      "• *HMLA2*\n" +
      "• *AGGE3*\n\n" +
      "Envía tu clave para mostrar tu calificación.";

    await whatsappService.sendMessage(phone, msg);

    userStates[phone] = {
      ...(userStates[phone] || {}),
      waitingForGrade: true
    };
  }
};
