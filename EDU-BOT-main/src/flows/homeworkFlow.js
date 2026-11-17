// src/flows/homeworkFlow.js

import whatsappService from "../services/whatsappService.js";
import { 
  saveHomework, 
  listPendingHomeworksByPhone, 
  updateHomeworkStatus 
} from "../services/homeworkService.js";
import {
  formatHomeworkDateFriendly,
  interpretHomeworkRequest,
} from "../services/homeworkInterpreter.js";

export const homeworkStates = {};  
// Estructura:
// homeworkStates[number] = { step, description, dueDate, lastActivity }

export const HOMEWORK_STATE_TTL_MS = 30 * 60 * 1000;
const HOMEWORK_CLEANUP_INTERVAL_MS = 60 * 1000;
const EXIT_COMMANDS = new Set([
  "tarea_salir",
  "salir",
  "cancelar",
  "menu",
  "menú",
  "volver",
  "regresar"
]);
const RESTART_COMMANDS = new Set([
  "tareas",
  "tarea",
  "recordatorio",
  "recordatorios"
]);
const DIRECT_TASK_PATTERN =
  /^(?:tarea\s+\S|(?:quiero\s+)?recordar\b|recuérdame\b|recordatorio\s+\S|registrar\s+tarea\b|nueva\s+tarea\b|quiero\s+(?:crear|registrar|anotar)\s+(?:una\s+)?tarea\b|(?:leer|estudiar|entregar|resolver|completar|preparar|repasar|investigar|imprimir|escribir|realizar)\b.*(?:\b(?:hoy|mañana|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b|\d{1,2}[\/-]\d{1,2}))/i;

export function isHomeworkRegistrationRequest(text) {
  return DIRECT_TASK_PATTERN.test(String(text || "").trim());
}

function createState(step = "menu", extra = {}, now = Date.now()) {
  return { step, ...extra, lastActivity: now };
}

export function isHomeworkStateExpired(
  state,
  now = Date.now(),
  ttlMs = HOMEWORK_STATE_TTL_MS
) {
  return Boolean(
    state &&
    Number.isFinite(state.lastActivity) &&
    now - state.lastActivity >= ttlMs
  );
}

export function cleanupExpiredHomeworkStates(now = Date.now()) {
  let removed = 0;
  for (const phone of Object.keys(homeworkStates)) {
    if (isHomeworkStateExpired(homeworkStates[phone], now)) {
      delete homeworkStates[phone];
      removed += 1;
    }
  }
  return removed;
}

export const homeworkStateCleanupTimer = setInterval(
  cleanupExpiredHomeworkStates,
  HOMEWORK_CLEANUP_INTERVAL_MS
);
homeworkStateCleanupTimer.unref?.();

function sendText(to, text) {
  return whatsappService.sendMessage(to, text);
}

function sendButtons(to, body, options) {
  const btns = options.map(opt => ({
    type: "reply",
    reply: {
      id: opt.id,
      title: opt.title
    }
  }));

  return whatsappService.sendInteractiveButtons(to, body, btns);
}

async function interpretAndAdvance(phone, text, state, now) {
  const completeText = state.description
    ? `${state.description} ${text}`.trim()
    : text;
  const result = await interpretHomeworkRequest(completeText, {
    now: new Date(now),
  });

  if (result.description) state.description = result.description;
  if (result.dueDate) state.dueDate = result.dueDate;

  if (result.status === "ready") {
    state.step = "confirm";
    return sendButtons(
      phone,
      `📝 *Revisa antes de guardar*\n\nTarea: ${state.description}\n📅 Entrega: ${formatHomeworkDateFriendly(
        state.dueDate
      )}\n\n¿Todo está correcto?`,
      [
        { id: "tarea_confirmar", title: "✔ Guardar" },
        { id: "tarea_corregir", title: "✏ Corregir" },
        { id: "tarea_salir", title: "Cancelar" }
      ]
    );
  }

  state.step = "askingDetails";

  if (result.status === "needs_description") {
    return sendText(
      phone,
      result.clarification || "¿Qué tarea quieres recordar?"
    );
  }

  if (result.status === "needs_date") {
    const subject = state.description ? `*${state.description}*` : "la tarea";
    return sendText(
      phone,
      `📅 ¿Cuándo debes entregar ${subject}?\n\nPuedes escribir:\n• mañana\n• viernes\n• 30/10/2026`
    );
  }

  return sendText(
    phone,
    result.clarification ||
      "¿Me confirmas la fecha exacta de entrega de la tarea?"
  );
}

// ============================================================
// FLUJO PRINCIPAL
// ============================================================
export async function homeworkFlow(phone, text) {

  const msg = (text || "").trim();
  const now = Date.now();

  if (EXIT_COMMANDS.has(msg)) {
    delete homeworkStates[phone];
    return sendText(phone, "Conversación de tareas cerrada.");
  }

  if (isHomeworkStateExpired(homeworkStates[phone], now)) {
    delete homeworkStates[phone];

    if (!RESTART_COMMANDS.has(msg) && !DIRECT_TASK_PATTERN.test(msg)) {
      return sendText(
        phone,
        "⏱️ La operación anterior venció por inactividad. Escribe *tareas* para comenzar de nuevo."
      );
    }
  }

  const existingState = homeworkStates[phone];
  if (existingState) existingState.lastActivity = now;

  if (!existingState && DIRECT_TASK_PATTERN.test(msg)) {
    const directState = createState("askingDetails", {}, now);
    homeworkStates[phone] = directState;
    return interpretAndAdvance(phone, msg, directState, now);
  }

  // ============================================================
  // 🔥 ACCESO DIRECTO: “mis tareas” → ver automáticamente
  // ============================================================
  if (msg === "ver" || msg === "ver_pendientes" || msg === "tareas_pendientes") {
    const tasks = await listPendingHomeworksByPhone(phone);

    if (tasks.length === 0) {
      homeworkStates[phone] = createState("menu", {}, now);

      return sendButtons(phone,
        "🎉 *No tienes tareas pendientes.*",
        [
          { id: "tarea_registrar", title: "➕ Registrar" },
          { id: "tarea_salir",     title: "⬅ Salir" }
        ]
      );
    }

    let lista = "📋 *Tus tareas pendientes:*\n\n";
    tasks.forEach((t, i) => {
      lista += `${i + 1}. [${t.dueDate}] ${t.description}\n`;
    });

    homeworkStates[phone] = createState("chooseMarkDone", {}, now);

    return sendButtons(phone,
      lista + "\n¿Qué deseas hacer?",
      [
        { id: "tarea_marcar", title: "✔ Marcar hecha" },
        { id: "tarea_salir",  title: "⬅ Salir" }
      ]
    );
  }

  // ============================================================
  // ESTADO INICIAL
  // ============================================================
  if (!homeworkStates[phone]) {
    homeworkStates[phone] = createState("menu", {}, now);

    return sendButtons(phone,
      "📚 *Tareas y recordatorios*\n\n¿Qué deseas hacer?",
      [
        { id: "tarea_registrar", title: "➕ Registrar" },
        { id: "tarea_ver",       title: "📋 Ver pendientes" },
        { id: "tarea_salir",     title: "⬅ Salir" }
      ]
    );
  }

  const state = homeworkStates[phone];

  // ============================================================
  // MENÚ PRINCIPAL
  // ============================================================
  if (state.step === "menu") {

    if (msg === "tarea_registrar") {
      state.step = "askingDetails";

      return sendText(phone,
        "✏️ Escríbeme la tarea y cuándo la entregas en una sola frase.\n\nEjemplos:\n• Tarea de química para mañana\n• Leer capítulo 4 el viernes\n• Exposición de historia el 30 de octubre"
      );
    }

    if (msg === "tarea_ver") {
      const tasks = await listPendingHomeworksByPhone(phone);

      if (tasks.length === 0) {
        return sendButtons(phone,
          "🎉 *No tienes tareas pendientes.*",
          [
            { id: "tarea_registrar", title: "➕ Registrar" },
            { id: "tarea_salir",     title: "⬅ Salir" }
          ]
        );
      }

      let lista = "📋 *Tus tareas pendientes:*\n\n";
      tasks.forEach((t, i) => {
        lista += `${i + 1}. [${t.dueDate}] ${t.description}\n`;
      });

      state.step = "chooseMarkDone";

      return sendButtons(phone,
        lista + "\n¿Qué deseas hacer?",
        [
          { id: "tarea_marcar", title: "✔ Marcar hecha" },
          { id: "tarea_salir",  title: "⬅ Salir" }
        ]
      );
    }

  }

  if (state.step === "askingDetails") {
    return interpretAndAdvance(phone, msg, state, now);
  }

  // ============================================================
  // REGISTRO → DESCRIPCIÓN
  // ============================================================
  if (state.step === "askingDescription") {
    state.description = msg;
    state.step = "askingDetails";

    return sendText(phone,
      "📅 ¿Cuándo debes entregar la tarea?\n\nPuedes escribir “mañana”, “viernes” o “30/10/2026”."
    );
  }

  // ============================================================
  // REGISTRO → VALIDACIÓN DE FECHA
  // ============================================================
  if (state.step === "askingDate") {
    return interpretAndAdvance(phone, msg, state, now);
  }

  // ============================================================
  // CONFIRMAR GUARDADO
  // ============================================================
  if (state.step === "confirm") {

    if (msg === "tarea_confirmar") {
      const saved = await saveHomework(phone, state.description, state.dueDate);

      if (!saved) {
        return sendText(
          phone,
          "No pude guardar la tarea. Revisa la conexión e intenta confirmarla nuevamente."
        );
      }

      delete homeworkStates[phone];

      return sendButtons(phone,
        "🎉 *¡Tarea registrada!* Te la recordaré cuando llegue la fecha.",
        [
          { id: "tarea_registrar", title: "➕ Registrar otra" },
          { id: "tarea_ver",       title: "📋 Ver tareas" },
          { id: "tarea_salir",     title: "⬅ Salir" }
        ]
      );
    }

    if (msg === "tarea_corregir") {
      state.step = "askingDetails";
      return sendText(
        phone,
        "✏️ Escríbeme la fecha nueva. Puedes usar “mañana”, “viernes” o “30/10/2026”."
      );
    }

  }

  // ============================================================
  // MARCAR COMO HECHA
  // ============================================================
  if (state.step === "chooseMarkDone") {

    if (msg === "tarea_marcar") {
      state.step = "selectTaskNumber";
      return sendText(phone, "✔ Escribe el *número* de la tarea a marcar como completada.");
    }

  }

  // ============================================================
  // SELECCIONAR TAREA A COMPLETAR
  // ============================================================
  if (state.step === "selectTaskNumber") {
    const tasks = await listPendingHomeworksByPhone(phone);
    const index = Number(msg) - 1;

    if (isNaN(index) || index < 0 || index >= tasks.length) {
      return sendText(phone, "❌ Número inválido. Escribe un número de la lista.");
    }

    const tarea = tasks[index];
    const updated = await updateHomeworkStatus(tarea.rowIndex, "Completada");

    if (!updated) {
      return sendText(
        phone,
        "No pude marcar la tarea como completada. Intenta nuevamente."
      );
    }

    delete homeworkStates[phone];

    return sendButtons(phone,
      "✔ *Tarea marcada como completada.*",
      [
        { id: "tarea_ver",   title: "📋 Ver tareas" },
        { id: "tarea_salir", title: "⬅ Salir" }
      ]
    );
  }

  return sendText(phone, "No entendí eso. Volvamos a intentarlo.");
}
