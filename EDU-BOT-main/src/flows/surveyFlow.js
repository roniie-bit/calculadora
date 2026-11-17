// src/flows/surveyFlow.js

import whatsappService from "../services/whatsappService.js";
import { appendSurveyRow } from "../services/googleSheetsService.js";
import { TextMessage, ButtonsMessageWithText } from "../util.js";

export async function handleSurveyFlow(message, phone, userStates) {
  const text = (message?.text?.body || "").toLowerCase();

  // ============================================================
  // ACTIVACIÓN DE LA ENCUESTA (trigger)
  // ============================================================
  if (text === "encuesta01" || text === "encuesta 01" || text === "encuesta1") {

    userStates[phone] = {
      survey: {
        step: "ask_name",
        name: "",
        turno: "",
        semestre: "",
        q1: "",
        q2: "",
        q3: "",
        q4: "",
        q5: "",
        q6: "",
        q7: "",
        q8: "",
        q9: "",
        q10: "",
        q11: "",
        q12: ""
      }
    };

    const msg = "📝 *Iniciemos la Encuesta*\n\nPor favor escribe tu *nombre completo*:";
    await whatsappService.sendMessage(phone, TextMessage(msg, phone));
    return true;
  }

  if (!userStates[phone]?.survey) return false;

  const state = userStates[phone].survey;

  // ============================================================
  // 1️⃣ NOMBRE
  // ============================================================
  if (state.step === "ask_name") {
    state.name = message.text?.body?.trim() || "Sin nombre";
    state.step = "ask_turno";

    const msg = "⏰ *¿En qué turno estudias?*";
    const buttons = ButtonsMessageWithText(msg, ["Matutino", "Vespertino", "Otro"], phone);

    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 2️⃣ TURNO
  // ============================================================
  if (state.step === "ask_turno") {
    if (message.type !== "interactive") {
      await whatsappService.sendMessage(
        phone,
        TextMessage("Por favor selecciona una opción del botón.", phone)
      );
      return true;
    }

    state.turno = message.interactive.button_reply.title;
    state.step = "ask_semestre";

    const msg = "🎓 *¿En qué semestre estás?*";
    const buttons = ButtonsMessageWithText(msg, ["1", "3", "5"], phone);

    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 3️⃣ SEMESTRE
  // ============================================================
  if (state.step === "ask_semestre") {
    if (message.type !== "interactive") return true;

    state.semestre = message.interactive.button_reply.title;
    state.step = "q1";

    const msg = "❓ *1. ¿Te gusta interactuar con inteligencia artificial?*";
    const buttons = ButtonsMessageWithText(msg, ["Sí", "A veces", "No"], phone);

    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 4️⃣ PREGUNTA 1
  // ============================================================
  if (state.step === "q1") {
    state.q1 = message.interactive?.button_reply?.title || "";
    state.step = "q2";

    const msg = "❓ *2. ¿Dónde has visto o usado IA en tu vida diaria?*";
    const buttons = ButtonsMessageWithText(msg, ["Escuela", "Redes sociales", "Teléfono"], phone);

    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 5️⃣ PREGUNTA 2
  // ============================================================
  if (state.step === "q2") {
    state.q2 = message.interactive?.button_reply?.title || "";
    state.step = "q3";

    const msg = "❓ *3. ¿Has usado alguna IA para tareas escolares?*";
    const buttons = ButtonsMessageWithText(msg, ["Sí", "A veces", "No"], phone);

    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 6️⃣ PREGUNTA 3
  // ============================================================
  if (state.step === "q3") {
    state.q3 = message.interactive?.button_reply?.title || "";
    state.step = "q4";

    const msg = "❓ *4. ¿Qué tanto crees que la IA facilita tus actividades como estudiante?*";
    const buttons = ButtonsMessageWithText(msg, ["Poco", "Regular", "Mucho"], phone);

    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 7️⃣ PREGUNTA 4
  // ============================================================
  if (state.step === "q4") {
    state.q4 = message.interactive?.button_reply?.title || "";
    state.step = "q5";

    const msg = "❓ *5. ¿Qué es lo que más te cuesta al hacer tareas?*";
    const buttons = ButtonsMessageWithText(msg, ["Entender", "Resumir", "Organizar"], phone);

    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 8️⃣ PREGUNTA 5
  // ============================================================
  if (state.step === "q5") {
    state.q5 = message.interactive?.button_reply?.title || "";
    state.step = "q6";

    const msg = "❓ *6. ¿Qué tanto te distraes al estudiar?*";
    const buttons = ButtonsMessageWithText(msg, ["Poco", "A veces", "Mucho"], phone);

    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 9️⃣ PREGUNTA 6
  // ============================================================
  if (state.step === "q6") {
    state.q6 = message.interactive?.button_reply?.title || "";
    state.step = "q7";

    const msg = "❓ *7. ¿Cuántas horas al día dedicas a tareas?*";
    const buttons = ButtonsMessageWithText(
      msg,
      ["<1 hora", "1–2 horas", ">2 horas"],
      phone
    );

    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 🔟 PREGUNTA 7
  // ============================================================
  if (state.step === "q7") {
    state.q7 = message.interactive?.button_reply?.title || "";
    state.step = "q8";

    const msg = "❓ *8. ¿En qué te gustaría que la IA te ayudara más?*";
    const buttons = ButtonsMessageWithText(
      msg,
      ["Explicar temas", "Resumir textos", "Organizar tareas"],
      phone
    );

    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 1️⃣1️⃣ PREGUNTA 8
  // ============================================================
  if (state.step === "q8") {
    state.q8 = message.interactive?.button_reply?.title || "";
    state.step = "q9";

    const msg = "❓ *9. ¿Cómo prefieres que una IA te responda?*";
    const buttons = ButtonsMessageWithText(
      msg,
      ["Corto", "Detallado", "Paso a paso"],
      phone
    );

    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 1️⃣2️⃣ PREGUNTA 9
  // ============================================================
  if (state.step === "q9") {
    state.q9 = message.interactive?.button_reply?.title || "";
    state.step = "q10";

    const msg = "❓ *10. ¿Qué tan organizado consideras que eres para estudiar?*";
    const buttons = ButtonsMessageWithText(msg, ["Mucho", "Regular", "Poco"], phone);

    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 1️⃣3️⃣ PREGUNTA 10
  // ============================================================
  if (state.step === "q10") {
    state.q10 = message.interactive?.button_reply?.title || "";
    state.step = "q11";

    const msg = "❓ *11. ¿Crees que la IA puede ayudarte a organizar mejor tu tiempo?*";
    const buttons = ButtonsMessageWithText(msg, ["Sí", "Tal vez", "No"], phone);

    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 1️⃣4️⃣ PREGUNTA 11
  // ============================================================
  if (state.step === "q11") {
    state.q11 = message.interactive?.button_reply?.title || "";
    state.step = "q12";

    const msg = "❓ *12. ¿Usarías una IA para mejorar tu desempeño académico?*";
    const buttons = ButtonsMessageWithText(msg, ["Sí", "Tal vez", "No"], phone);

    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 🟢 GUARDAR RESULTADOS (PREGUNTA 12)
  // ============================================================
  if (state.step === "q12") {
    state.q12 = message.interactive?.button_reply?.title || "";

    const timestamp = new Date().toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
    });

    await appendSurveyRow([
      phone,
      state.name,
      state.turno,
      state.semestre,
      state.q1,
      state.q2,
      state.q3,
      state.q4,
      state.q5,
      state.q6,
      state.q7,
      state.q8,
      state.q9,
      state.q10,
      state.q11,
      state.q12,
      timestamp
    ]);

    const msg =
      "✅ *Gracias por completar la encuesta*\n\nTus respuestas fueron registradas.\n¡Gracias por participar! 🙌";

    await whatsappService.sendMessage(phone, TextMessage(msg, phone));
    delete userStates[phone].survey;
    return true;
  }

  return false;
}
