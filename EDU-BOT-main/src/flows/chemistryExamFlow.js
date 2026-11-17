// ✅ src/flows/chemistryExamFlow.js
import whatsappService from "../services/whatsappService.js";
import { appendChemistryExamRow } from "../services/googleSheetsService.js";
import { TextMessage, ButtonsMessageWithText, GetTextUser } from "../util.js";

export async function handleChemistryExamFlow(message, phone, userStates) {
  const text = (GetTextUser(message) || message?.text?.body || "")
    .toLowerCase()
    .trim();

  // ============================================================
  // ACTIVADOR
  // ============================================================
  if (text === "quimica01" || text === "examen quimica") {
    userStates[phone] = {
      chemistry: {
        step: "ask_name",
        name: "",
        score: 0,
        q1: "", q2: "", q3: "", q4: "", q5: "",
        q6: "", q7: "", q8: "", q9: "", q10: ""
      }
    };

    await whatsappService.sendMessage(
      phone,
      TextMessage("🧪 *Examen de Química Básica*\n\nEscribe tu *nombre completo*:", phone)
    );
    return true;
  }

  if (!userStates[phone]?.chemistry) return false;
  const state = userStates[phone].chemistry;

  // Respuesta de botón (en tu util.js, GetTextUser devuelve ID)
  const ans = GetTextUser(message); // en tu ButtonsMessageWithText id=title, así que sirve

  // ✅ CLAVE DE RESPUESTAS CORRECTAS (ajusta si tú quieres otras)
  const correct = {
    q1: "Agua",
    q2: "Cloruro de sodio",
    q3: "Dióxido de carbono",
    q4: "Ácido clorhídrico",
    q5: "Amoniaco",
    q6: "Carbonato de calcio",
    q7: "Ácido sulfúrico",
    q8: "Hidróxido de potasio",
    q9: "Óxido de hierro",
    q10: "Bicarbonato de sodio"
  };

  // ============================================================
  // NOMBRE
  // ============================================================
  if (state.step === "ask_name") {
    state.name = message.text?.body?.trim() || "Sin nombre";
    state.step = "q1";

    await whatsappService.sendMessage(
      phone,
      ButtonsMessageWithText(
        "❓ *1. ¿Cómo se llama H₂O?*",
        ["Agua", "Oxígeno", "Peróxido"],
        phone
      )
    );
    return true;
  }

  // ============================================================
  // q1
  // ============================================================
  if (state.step === "q1") {
    if (!ans) return true;
    state.q1 = ans;
    if (ans === correct.q1) state.score++;
    state.step = "q2";

    await whatsappService.sendMessage(
      phone,
      ButtonsMessageWithText("❓ *2. NaCl es:*", ["Cloruro de sodio", "Sodio", "Sal ácida"], phone)
    );
    return true;
  }

  // q2
  if (state.step === "q2") {
    if (!ans) return true;
    state.q2 = ans;
    if (ans === correct.q2) state.score++;
    state.step = "q3";

    await whatsappService.sendMessage(
      phone,
      ButtonsMessageWithText("❓ *3. CO₂ es:*", ["Dióxido de carbono", "Monóxido", "Oxígeno"], phone)
    );
    return true;
  }

  // q3
  if (state.step === "q3") {
    if (!ans) return true;
    state.q3 = ans;
    if (ans === correct.q3) state.score++;
    state.step = "q4";

    await whatsappService.sendMessage(
      phone,
      ButtonsMessageWithText("❓ *4. HCl es:*", ["Ácido clorhídrico", "Cloro", "Sal"], phone)
    );
    return true;
  }

  // q4
  if (state.step === "q4") {
    if (!ans) return true;
    state.q4 = ans;
    if (ans === correct.q4) state.score++;
    state.step = "q5";

    await whatsappService.sendMessage(
      phone,
      ButtonsMessageWithText("❓ *5. NH₃ es:*", ["Amoniaco", "Nitrógeno", "Ácido"], phone)
    );
    return true;
  }

  // q5
  if (state.step === "q5") {
    if (!ans) return true;
    state.q5 = ans;
    if (ans === correct.q5) state.score++;
    state.step = "q6";

    await whatsappService.sendMessage(
      phone,
      ButtonsMessageWithText("❓ *6. CaCO₃ es:*", ["Carbonato de calcio", "Cal", "Bicarbonato"], phone)
    );
    return true;
  }

  // q6
  if (state.step === "q6") {
    if (!ans) return true;
    state.q6 = ans;
    if (ans === correct.q6) state.score++;
    state.step = "q7";

    await whatsappService.sendMessage(
      phone,
      ButtonsMessageWithText("❓ *7. H₂SO₄ es:*", ["Ácido sulfúrico", "Ácido clorhídrico", "Sulfato"], phone)
    );
    return true;
  }

  // q7
  if (state.step === "q7") {
    if (!ans) return true;
    state.q7 = ans;
    if (ans === correct.q7) state.score++;
    state.step = "q8";

    await whatsappService.sendMessage(
      phone,
      ButtonsMessageWithText("❓ *8. KOH es:*", ["Hidróxido de potasio", "Óxido", "Sal"], phone)
    );
    return true;
  }

  // q8
  if (state.step === "q8") {
    if (!ans) return true;
    state.q8 = ans;
    if (ans === correct.q8) state.score++;
    state.step = "q9";

    await whatsappService.sendMessage(
      phone,
      ButtonsMessageWithText("❓ *9. Fe₂O₃ es:*", ["Óxido de hierro", "Hierro", "Óxido de sodio"], phone)
    );
    return true;
  }

  // q9
  if (state.step === "q9") {
    if (!ans) return true;
    state.q9 = ans;
    if (ans === correct.q9) state.score++;
    state.step = "q10";

    await whatsappService.sendMessage(
      phone,
      ButtonsMessageWithText("❓ *10. NaHCO₃ es:*", ["Bicarbonato de sodio", "Carbonato", "Sal"], phone)
    );
    return true;
  }

  // ============================================================
  // FINAL: q10 + guardar + calificación
  // ============================================================
  if (state.step === "q10") {
    if (!ans) return true;
    state.q10 = ans;
    if (ans === correct.q10) state.score++;

    const totalQuestions = 10;
    const finalGrade = ((state.score / totalQuestions) * 10).toFixed(1);

    const timestamp = new Date().toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
    });

    // ✅ Guardar: agrega columnas de aciertos y calificación
    await appendChemistryExamRow([
      phone,
      state.name,
      state.q1, state.q2, state.q3, state.q4, state.q5,
      state.q6, state.q7, state.q8, state.q9, state.q10,
      `${state.score}/${totalQuestions}`,
      `${finalGrade}/10`,
      timestamp
    ]);

    const resultMsg =
      `🏁 *Examen Finalizado*\n\n` +
      `👤 Estudiante: ${state.name}\n` +
      `✅ Aciertos: ${state.score} de ${totalQuestions}\n` +
      `📊 Calificación: ${finalGrade}/10`;

    await whatsappService.sendMessage(phone, TextMessage(resultMsg, phone));

    delete userStates[phone].chemistry;
    return true;
  }

  return false;
}
