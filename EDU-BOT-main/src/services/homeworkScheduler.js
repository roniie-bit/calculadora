// src/services/homeworkScheduler.js

import cron from "node-cron";
import {
  listAllPendingHomeworks,
  markHomeworkReminderSent,
} from "./homeworkService.js";
import whatsappService from "./whatsappService.js";
import {
  HOMEWORK_TIME_ZONE,
  buildHomeworkReminderMessage,
  dateInMexico,
  shouldSendHomeworkReminder,
} from "./homeworkReminder.js";

/*
  SCHEDULE:
  ───────────────────────────────────
  0 6 * * *  → Ejecutar todos los días a las 6:00 AM de México
*/
let isRunning = false;

export function startHomeworkScheduler() {
  console.log("⏰ Scheduler de tareas activado…");

  cron.schedule("0 6 * * *", async () => {
    console.log("🔎 Revisando tareas pendientes…");

    try {
      await revisarTareasPendientes();
    } catch (err) {
      console.error("❌ Error en el scheduler:", err);
    }
  }, { timezone: HOMEWORK_TIME_ZONE });
}

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================
export async function revisarTareasPendientes({
  now = new Date(),
  loadTasks = listAllPendingHomeworks,
  send = (phone, payload) => whatsappService.sendMessage(phone, payload),
  markSent = markHomeworkReminderSent,
} = {}) {
  if (isRunning) {
    console.warn("⚠️ El scheduler de tareas ya está ejecutándose.");
    return { sent: 0, skipped: true };
  }

  isRunning = true;
  let sent = 0;

  try {
    const tasks = await loadTasks();
    const today = dateInMexico(now);

    for (const task of tasks) {
      if (!shouldSendHomeworkReminder(task, now)) continue;

      try {
        const response = await send(
          task.phone,
          buildHomeworkReminderMessage(task)
        );
        const reminderMessageId = response?.messages?.[0]?.id;
        if (!reminderMessageId) {
          console.error(
            `❌ WhatsApp no devolvió ID para el recordatorio de ${task.phone}.`
          );
          continue;
        }

        const saved = await markSent(task.rowIndex, reminderMessageId, today);
        if (!saved) {
          console.error(
            `❌ No se pudo registrar el recordatorio enviado a ${task.phone}.`
          );
        }
        sent += 1;
      } catch (error) {
        console.error(
          `❌ Error enviando recordatorio a ${task.phone}:`,
          error.message
        );
      }
    }

    return { sent, skipped: false };
  } finally {
    isRunning = false;
  }
}

export async function procesarTarea(
  phone,
  tarea,
  {
    now = new Date(),
    send = (number, payload) => whatsappService.sendMessage(number, payload),
    markSent = markHomeworkReminderSent,
  } = {}
) {
  if (!shouldSendHomeworkReminder(tarea, now)) return null;

  const response = await send(phone, buildHomeworkReminderMessage(tarea));
  const reminderMessageId = response?.messages?.[0]?.id;
  if (!reminderMessageId) return null;

  await markSent(tarea.rowIndex, reminderMessageId, dateInMexico(now));
  return reminderMessageId;
}

export default {
  startHomeworkScheduler,
  revisarTareasPendientes,
};
