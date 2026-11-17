// ✅ src/flows/mathExamFlow.js
import whatsappService from "../services/whatsappService.js";
import { appendToSheetCustom } from "../services/googleSheetsService.js";
import { TextMessage, ButtonsMessageWithText, GetTextUser } from "../util.js";

export async function handleMathExamFlow(message, phone, userStates) {
  const text = (GetTextUser(message) || message?.text?.body || "").toLowerCase().trim();

  if (text === "examen de matematicas" || text === "examen1") {
    userStates[phone] = {
      mathExam: { step: "ask_name", name: "", score: 0 }
    };

    const msg =
      "🧮 *Examen de Matemáticas: Sumas y Restas*\n\n" +
      "Para comenzar, escribe tu *nombre completo*:";
    await whatsappService.sendMessage(phone, TextMessage(msg, phone));
    return true;
  }

  if (!userStates[phone]?.mathExam) return false;
  const state = userStates[phone].mathExam;

  if (state.step === "ask_name") {
    state.name = message.text?.body?.trim() || "Sin nombre";
    state.step = "q1";

    const msg = "❓ *Pregunta 1*\n¿Cuánto es 12 + 15?";
    await whatsappService.sendMessage(phone, ButtonsMessageWithText(msg, ["25", "27", "30"], phone));
    return true;
  }

  const ans = GetTextUser(message); // <-- botón id (en tu caso id=title)

  if (state.step === "q1") {
    if (!ans) return true;
    if (ans === "27") state.score++;
    state.step = "q2";

    const msg = "❓ *Pregunta 2*\n¿Cuánto es 50 - 18?";
    await whatsappService.sendMessage(phone, ButtonsMessageWithText(msg, ["32", "42", "38"], phone));
    return true;
  }

  if (state.step === "q2") {
    if (!ans) return true;
    if (ans === "32") state.score++;
    state.step = "q3";

    const msg = "❓ *Pregunta 3*\n¿Cuánto es 120 + 80?";
    await whatsappService.sendMessage(phone, ButtonsMessageWithText(msg, ["180", "200", "220"], phone));
    return true;
  }

  if (state.step === "q3") {
    if (!ans) return true;
    if (ans === "200") state.score++;
    state.step = "q4";

    const msg = "❓ *Pregunta 4*\n¿Cuánto es 45 - 9?";
    await whatsappService.sendMessage(phone, ButtonsMessageWithText(msg, ["34", "36", "40"], phone));
    return true;
  }

  if (state.step === "q4") {
    if (!ans) return true;
    if (ans === "36") state.score++;
    state.step = "final";

    const msg = "❓ *Pregunta 5*\n¿Cuánto es 8 + 8 + 8?";
    await whatsappService.sendMessage(phone, ButtonsMessageWithText(msg, ["16", "24", "32"], phone));
    return true;
  }

  if (state.step === "final") {
    if (!ans) return true;
    if (ans === "24") state.score++;

    const totalQuestions = 5;
    const finalGrade = (state.score / totalQuestions) * 10;
    const timestamp = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

    await appendToSheetCustom("Examen_Mate", [
      phone,
      state.name,
      `${finalGrade}/10`,
      `${state.score}/${totalQuestions}`,
      timestamp,
    ]);

    const resultMsg =
      `🏁 *Examen Finalizado*\n\n` +
      `👤 Estudiante: ${state.name}\n` +
      `✅ Aciertos: ${state.score} de ${totalQuestions}\n` +
      `📊 Calificación: ${finalGrade}`;

    await whatsappService.sendMessage(phone, TextMessage(resultMsg, phone));
    delete userStates[phone].mathExam;
    return true;
  }

  return false;
}
