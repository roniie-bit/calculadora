import { randomUUID } from "node:crypto";
import whatsappService from "../services/whatsappService.js";
import { saveSncytResponse } from "../services/sncytSurveyStore.js";
import {
  SNCYT_QUESTIONS,
  getSncytTriggerSession,
} from "../config/sncytSurvey.js";
import { TextMessage } from "../util.js";

const normalize = (value = "") =>
  value
    .trim()
    .toLocaleLowerCase("es-MX")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function isSncytSurveyTrigger(text = "") {
  return getSncytTriggerSession(normalize(text)) !== null;
}

function questionMessage(question, index) {
  const options = question.options
    .map((option, optionIndex) => `${optionIndex + 1}. ${option}`)
    .join("\n");
  const instruction =
    question.instruction ||
    "Responde con el número de una opción.";

  return (
    `Encuesta de prueba SNCyT 2026\n` +
    `Pregunta ${index + 1} de ${SNCYT_QUESTIONS.length}\n\n` +
    `*${question.title}*\n\n${options}\n\n${instruction}`
  );
}

function parseNumberList(text) {
  if (!/^\s*\d+(?:\s*[,; ]\s*\d+)*\s*$/.test(text)) return null;
  return [...new Set(text.match(/\d+/g).map(Number))];
}

function validateChoice(text, question) {
  const numbers = parseNumberList(text);
  if (!numbers) return { error: "Responde usando los números de las opciones." };

  if (question.multiple) {
    if (numbers.some((number) => number < 1 || number > question.options.length)) {
      return { error: "Escribe solo números de opciones que aparecen en el mensaje." };
    }

    const noCommunicationIndex = question.options.length;
    if (numbers.includes(noCommunicationIndex) && numbers.length > 1) {
      return {
        error:
          "La opción de que no te comunicaste debe elegirse sola. Vuelve a responder.",
      };
    }

    return {
      value: numbers.map((number) => question.options[number - 1]),
    };
  }

  if (numbers.length !== 1 || numbers[0] < 1 || numbers[0] > question.options.length) {
    return {
      error: "Selecciona un solo número de los que aparecen en el mensaje.",
    };
  }

  return { value: question.options[numbers[0] - 1] };
}

export function createSncytSurveyFlow({
  send = (phone, payload) => whatsappService.sendMessage(phone, payload),
  saveResponse = saveSncytResponse,
  now = () => new Date(),
  makeId = () => `DEMO-${randomUUID().slice(0, 8).toUpperCase()}`,
} = {}) {
  async function sendQuestion(phone, state) {
    const question = SNCYT_QUESTIONS[state.step];
    await send(
      phone,
      TextMessage(questionMessage(question, state.step), phone)
    );
  }

  async function finishSurvey(phone, userStates) {
    const state = userStates[phone]?.sncytDemo;
    if (!state) return true;

    state.step = "saving";
    const response = {
      id: state.id,
      session: state.session,
      submittedAt: now().toISOString(),
      answers: state.answers,
    };

    try {
      const saved = await saveResponse(response);
      delete userStates[phone].sncytDemo;
      await send(
        phone,
        TextMessage(
          `Respuesta de prueba registrada.\n\n` +
            `ID: ${saved.id}\n` +
            `Pestaña: ${saved.sheetName}\n\n` +
            `No se guardaron tu nombre ni tu número de WhatsApp.`,
          phone
        )
      );
    } catch (error) {
      state.step = "retry_save";
      console.error("❌ No se pudo guardar la encuesta de prueba SNCyT:", error);
      await send(
        phone,
        TextMessage(
          "No pude guardar la respuesta. Escribe REINTENTAR para intentarlo otra vez.",
          phone
        )
      );
    }

    return true;
  }

  return async function handleSncytSurveyFlow(message, phone, userStates) {
    const text = message?.text?.body || "";
    const normalizedText = normalize(text);
    const state = userStates[phone]?.sncytDemo;

    if (!state) {
      const session = getSncytTriggerSession(normalizedText);
      if (!session) return false;

      userStates[phone] ||= {};
      userStates[phone].sncytDemo = {
        id: makeId(),
        step: 0,
        session,
        answers: {},
      };

      await send(
        phone,
        TextMessage(
          `Encuesta de prueba SNCyT 2026\n\n` +
            `Son ${SNCYT_QUESTIONS.length} preguntas y tardarás cerca de dos minutos. ` +
            `Responde con los números de las opciones.\n\n` +
            `No incluyas datos personales. Puedes escribir CANCELAR en cualquier momento.\n\n` +
            `Comencemos.`,
          phone
        )
      );
      await sendQuestion(phone, userStates[phone].sncytDemo);
      return true;
    }

    if (normalizedText === "cancelar") {
      delete userStates[phone].sncytDemo;
      await send(phone, TextMessage("Encuesta de prueba cancelada.", phone));
      return true;
    }

    if (state.step === "retry_save") {
      if (normalizedText !== "reintentar") {
        await send(
          phone,
          TextMessage(
            "Escribe REINTENTAR para guardar las respuestas que ya completaste.",
            phone
          )
        );
        return true;
      }
      return finishSurvey(phone, userStates);
    }

    if (state.step === "saving") return true;

    const question = SNCYT_QUESTIONS[state.step];
    const validation = validateChoice(text, question);

    if (validation.error) {
      await send(phone, TextMessage(validation.error, phone));
      await sendQuestion(phone, state);
      return true;
    }

    state.answers[question.id] = validation.value;
    state.step += 1;

    if (state.step >= SNCYT_QUESTIONS.length) {
      return finishSurvey(phone, userStates);
    }

    await sendQuestion(phone, state);
    return true;
  };
}

export const handleSncytSurveyFlow = createSncytSurveyFlow();
