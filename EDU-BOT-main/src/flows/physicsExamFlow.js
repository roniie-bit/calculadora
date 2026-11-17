// ✅ src/flows/physicsExamFlow.js
import whatsappService from "../services/whatsappService.js";
import { appendToSheetCustom } from "../services/googleSheetsService.js";
import { TextMessage, ButtonsMessageWithText, GetTextUser } from "../util.js";

function normalizeText(s = "") {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export async function handlePhysicsExamFlow(message, phone, userStates) {
  const raw = GetTextUser(message) || "";
  const text = normalizeText(raw);

  // ✅ Trigger robusto
  const isTrigger =
    text === "fisica1" ||
    text === "examen2" ||
    (text.includes("examen") && text.includes("fisica"));

  if (isTrigger) {
    userStates[phone] = userStates[phone] || {};
    userStates[phone].physicsExam = {
      step: "ask_name",
      name: "",
      score: 0
    };

    const msg =
      "🧲 *Examen de Física: 1ª Ley de Newton*\n\n" +
      "Para comenzar, escribe tu *nombre completo*:";
    await whatsappService.sendMessage(phone, TextMessage(msg, phone));
    return true;
  }

  if (!userStates[phone]?.physicsExam) return false;
  const state = userStates[phone].physicsExam;

  // ============================================================
  // 1️⃣ NOMBRE
  // ============================================================
  if (state.step === "ask_name") {
    state.name = (message?.text?.body || "").trim() || "Sin nombre";
    state.step = "q1";

    const msg =
      "❓ *Pregunta 1*\n" +
      "La *Primera Ley de Newton* se conoce como:";
    // ✅ títulos cortos (<=20)
    const buttons = ButtonsMessageWithText(
      msg,
      ["Inercia", "Acción-Reacción", "Fuerza"],
      phone
    );
    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // Respuesta botón (en tu util: regresa ID; aquí ID=title, así que funciona)
  const ans = GetTextUser(message) || "";
  if (!ans) return true;

  // ============================================================
  // 2️⃣ PREGUNTA 1 (Correcta: Inercia)
  // ============================================================
  if (state.step === "q1") {
    if (ans === "Inercia") state.score++;
    state.step = "q2";

    const msg =
      "❓ *Pregunta 2*\n" +
      "Si la *fuerza neta* sobre un objeto es *cero*, entonces el objeto:";
    const buttons = ButtonsMessageWithText(
      msg,
      ["Acelera", "Reposo/MRU", "Cambia dirección"],
      phone
    );
    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 3️⃣ PREGUNTA 2 (Correcta: Reposo/MRU)
  // ============================================================
  if (state.step === "q2") {
    if (ans === "Reposo/MRU") state.score++;
    state.step = "q3";

    const msg =
      "❓ *Pregunta 3*\n" +
      "La *inercia* es la propiedad de:";
    const buttons = ButtonsMessageWithText(
      msg,
      ["Cambiar masa", "Resistir cambio", "Acelerar solo"],
      phone
    );
    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 4️⃣ PREGUNTA 3 (Correcta: Resistir cambio)
  // ============================================================
  if (state.step === "q3") {
    if (ans === "Resistir cambio") state.score++;
    state.step = "q4";

    const msg =
      "❓ *Pregunta 4*\n" +
      "Ejemplo de la *1ª Ley de Newton*:";
    const buttons = ButtonsMessageWithText(
      msg,
      ["Sigue en MRU", "Fuerzas se duplican", "Masa = energía"],
      phone
    );
    await whatsappService.sendMessage(phone, buttons);
    return true;
  }

  // ============================================================
  // 🟢 FINAL + GUARDAR (Correcta: Sigue en MRU)
  // ============================================================
  if (state.step === "q4") {
    if (ans === "Sigue en MRU") state.score++;

    const total = 4;
    const finalGrade = Math.round(((state.score / total) * 10) * 10) / 10;
    const timestamp = new Date().toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
    });

    // Guardar en pestaña nueva dentro de tu misma hoja
    await appendToSheetCustom("Examen_Fisica_1Ley", [
      phone,
      state.name,
      `${finalGrade}/10`,
      `${state.score}/${total}`,
      timestamp,
    ]);

    const resultMsg =
      `🏁 *Examen Finalizado*\n\n` +
      `👤 Estudiante: ${state.name}\n` +
      `✅ Aciertos: ${state.score} de ${total}\n` +
      `📊 Calificación: ${finalGrade}`;

    await whatsappService.sendMessage(phone, TextMessage(resultMsg, phone));
    delete userStates[phone].physicsExam;
    return true;
  }

  return false;
}
