// src/flows/adminChatFlow.js

import whatsappService from "../services/whatsappService.js";
import { samePhone } from '../utils/phone.js';
import { appendConversation } from "../services/googleSheetsService.js";

/**
 * 🔹 Maneja comandos del admin (startchat, stopchat)
 */
export async function handleAdminChatCommands(message, number, adminNumber, adminChatState) {
  if (!samePhone(number, adminNumber) || message.type !== "text") {
    return false;
  }

  const inputLower = message.text.body.toLowerCase().trim();

  // startchat <num>
  if (inputLower.startsWith("startchat ")) {
    const parts = inputLower.split(" ");
    if (parts.length < 2) {
      const errorMsg = "Formato inválido. Usa: startchat <num>";
      await whatsappService.sendMessage(adminNumber, errorMsg);
      await appendConversation(["Bot", adminNumber, errorMsg, new Date().toISOString()]);
      return true;
    }

    const targetNum = parts[1].trim();
    adminChatState.isChatting = true;
    adminChatState.targetNumber = targetNum;

    const startMsg = `🔵 Se ha iniciado el chat directo con ${targetNum}`;
    await whatsappService.sendMessage(adminNumber, startMsg);
    await appendConversation(["Bot", adminNumber, startMsg, new Date().toISOString()]);

    return true;
  }

  // stopchat
  if (inputLower === "stopchat") {
    const oldTarget = adminChatState.targetNumber;
    adminChatState.isChatting = false;
    adminChatState.targetNumber = null;

    const stopMsg = `🔴 Se ha finalizado la conversación con ${oldTarget || "N/A"}.`;
    await whatsappService.sendMessage(adminNumber, stopMsg);
    await appendConversation(["Bot", adminNumber, stopMsg, new Date().toISOString()]);

    if (oldTarget) {
      const endMsg = "La conversación con el asesor ha terminado. Si necesitas más ayuda, escribe de nuevo.";
      await whatsappService.sendMessage(oldTarget, endMsg);
      await appendConversation(["Bot", oldTarget, endMsg, new Date().toISOString()]);
    }

    return true;
  }

  return false;
}

/**
 * 🔹 Admin y alumno conversando directo (chat puente)
 */
export async function handleOngoingAdminChat(message, number, adminNumber, adminChatState) {
  if (!adminChatState.isChatting || !adminChatState.targetNumber) {
    return false;
  }

  const target = adminChatState.targetNumber;

  // ADMIN → alumno
  if (samePhone(number, adminNumber) && message.type === "text") {
    const adminMsg = message.text.body;
    const forwardMsg = `(Admin) dice: ${adminMsg}`;

    await whatsappService.sendMessage(target, forwardMsg);
    await appendConversation(["Bot", target, forwardMsg, new Date().toISOString()]);

    return true;
  }

  // Alumno → admin
  if (number === target) {
    if (message.type === "text") {
      const userMsg = message.text.body;
      const forwardMsg = `(${number}) dice: ${userMsg}`;
      await whatsappService.sendMessage(adminNumber, forwardMsg);
      await appendConversation(["Bot", adminNumber, forwardMsg, new Date().toISOString()]);
    } 
    else if (["image","video","audio","document"].includes(message.type)) {
      const mediaId = message[message.type]?.id;
      await whatsappService.sendMediaMessageById(
        adminNumber, 
        message.type, 
        mediaId, 
        `(${number}) envió un ${message.type}`
      );
      await appendConversation(["Bot", adminNumber, `Media ${message.type} recibida de ${number}`, new Date().toISOString()]);
    } 
    else {
      const unknownMsg = `(${number}) ha enviado un mensaje tipo ${message.type}.`;
      await whatsappService.sendMessage(adminNumber, unknownMsg);
      await appendConversation(["Bot", adminNumber, unknownMsg, new Date().toISOString()]);
    }

    return true;
  }

  return false;
}

/**
 * 🔹 Wrapper que une BOTH (commands + ongoing chat)
 * Esto es lo que messageHandler necesita.
 */
export async function handleAdminChatFlow(message, number, adminNumber, adminChatState) {
  // 1) Primero intenta comandos del admin
  const handledCommand = await handleAdminChatCommands(message, number, adminNumber, adminChatState);
  if (handledCommand) return true;

  // 2) Luego intenta el chat continuo
  const handledChat = await handleOngoingAdminChat(message, number, adminNumber, adminChatState);
  if (handledChat) return true;

  return false;
}
