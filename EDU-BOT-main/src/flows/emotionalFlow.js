// ===============================================
//  MÓDULO EMOCIONAL - EDU BOT
//  Conversación segura, IA empática, remisión opcional
// ===============================================

import whatsappService from "../services/whatsappService.js";
import config from '../config/env.js';
import {
  logEmotionalEntry,
  logEmotionalMessage,
  logEmotionalReferral
} from "../services/googleSheetsService.js";
import { askAIEmotional } from "../services/openAiService.js";

// Estados temporales de conversación
export const emotionalStates = {};

const ADMIN_NUMBER = config.ADMIN_NUMBER;
const MAX_SESSION_TIME = 30 * 60 * 1000;   // 30 minutos
const MAX_IDLE_TIME = 4 * 60 * 1000;      // 10 minutos

// ===============================================
//  AVISO AL ADMIN
// ===============================================
async function notifyAdminEmotionalEntry(phone, firstMessage = "", emotionalLabel = "emocional") {
  try {
    const adminMsg =
      "⚠ *Aviso interno – Módulo emocional EDU-BOT*\n\n" +
      "Un alumno ingresó al módulo emocional.\n\n" +
      `📱 Número: ${phone}\n` +
      `🏷️ Nivel detectado: ${emotionalLabel}\n\n` +
      (
        firstMessage
          ? `📝 Primer mensaje:\n${firstMessage}\n\n`
          : ""
      ) +
      "Para iniciar chat directo escribe:\n" +
      `startchat ${phone}`;

    await whatsappService.sendMessage(ADMIN_NUMBER, adminMsg);

  } catch (err) {
    console.error("❌ No se pudo enviar aviso emocional al admin:", err);
  }
}

// ===============================================
//  INICIO DEL FLUJO
// ===============================================
export async function startEmotionalFlow(phone, firstMessage = "", emotionalLabel = "emocional") {

  emotionalStates[phone] = {
    step: 1,
    startTime: Date.now(),
    lastInteraction: Date.now(),
    conversation: []
  };

  await logEmotionalEntry(phone);

  await notifyAdminEmotionalEntry(phone, firstMessage, emotionalLabel);

  // Si el alumno entró desde una frase emocional detectada por IA,
  // usamos ese mismo mensaje como primer mensaje del flujo.
  if (firstMessage && firstMessage.trim() !== "") {
    const state = emotionalStates[phone];

    state.conversation.push({ from: "alumno", text: firstMessage });

    await logEmotionalMessage(phone, firstMessage);

    const respuestaIA = await askAIEmotional(firstMessage);

    state.conversation.push({ from: "bot", text: respuestaIA });

    await whatsappService.sendMessage(phone, respuestaIA);

    state.step = 2;

    return whatsappService.sendMessage(
      phone,
      "¿Te gustaría que tu situación sea remitida a *Servicios Escolares* para que puedan apoyarte mejor?\n\nResponde: *Sí* o *No*."
    );
  }

  // Si el alumno entró desde el menú o escribió "apoyo emocional",
  // se mantiene el funcionamiento original.
  return whatsappService.sendMessage(
    phone,
    "💬 *Gracias por acercarte.*\nEstoy aquí para escucharte.\n\n¿Cómo te sientes hoy? Puedes escribirme con tus palabras."
  );
}

// ===============================================
//  FLUJO DE MENSAJES
// ===============================================
export async function emotionalFlow(phone, text) {
  const state = emotionalStates[phone];

  if (!state) return startEmotionalFlow(phone);

  const now = Date.now();

  // -----------------------------
  // TIMEOUT → Sesión completa
  // -----------------------------
  if (now - state.startTime > MAX_SESSION_TIME) {
    delete emotionalStates[phone];
    return whatsappService.sendMessage(
      phone,
      "⏳ El módulo emocional se ha cerrado por tiempo.\nSi deseas continuar, vuelve a ingresar desde el menú 💬."
    );
  }

  // -----------------------------
  // TIMEOUT → Inactividad
  // -----------------------------
  if (now - state.lastInteraction > MAX_IDLE_TIME) {
    delete emotionalStates[phone];
    return whatsappService.sendMessage(
      phone,
      "⌛ Parece que te ausentaste un momento.\nSi deseas continuar, solo vuelve a entrar al módulo emocional 💬."
    );
  }

  // Actualizar interacción
  state.lastInteraction = now;

  state.conversation.push({ from: "alumno", text });

  await logEmotionalMessage(phone, text);

  // -----------------------------
  // PASO 1 → Apoyo inicial
  // -----------------------------
  if (state.step === 1) {
    const respuestaIA = await askAIEmotional(text);

    state.conversation.push({ from: "bot", text: respuestaIA });

    await whatsappService.sendMessage(phone, respuestaIA);

    state.step = 2;

    return whatsappService.sendMessage(
      phone,
      "¿Te gustaría que tu situación sea remitida a *Servicios Escolares* para que puedan apoyarte mejor?\n\nResponde: *Sí* o *No*."
    );
  }

  // -----------------------------
  // PASO 2 → Remisión
  // -----------------------------
  if (state.step === 2) {
    const normalized = text.trim().toLowerCase();

    if (normalized === "si" || normalized === "sí") {

      await logEmotionalReferral(phone, text);

      await whatsappService.sendMessage(
        ADMIN_NUMBER,
        `⚠ *Solicitud a Servicios Escolares*\nUn alumno ha pedido ser remitido.\nNúmero: ${phone}`
      );

      await whatsappService.sendMessage(
        phone,
        "Gracias por confiar 🙏\nYa envié tu solicitud para que puedan darte acompañamiento personalizado.\nSi deseas seguir platicando, aquí estoy para escucharte."
      );

      state.step = 3;
      return;
    }

    if (normalized === "no") {
      await whatsappService.sendMessage(
        phone,
        "Está bien, gracias por decirlo 💙\nSi deseas seguir platicando, cuéntame un poco más. Estoy aquí contigo."
      );
      state.step = 3;
      return;
    }

    return whatsappService.sendMessage(
      phone,
      "Por favor responde únicamente *Sí* o *No*."
    );
  }

  // -----------------------------
  // PASO 3 → Conversación libre
  // -----------------------------
  if (state.step === 3) {
    const respuestaIA = await askAIEmotional(text);

    state.conversation.push({ from: "bot", text: respuestaIA });

    return whatsappService.sendMessage(phone, respuestaIA);
  }
}
