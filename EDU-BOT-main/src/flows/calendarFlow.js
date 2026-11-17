/* eslint-disable no-await-in-loop */

import whatsappService from "../services/whatsappService.js";
import * as calendarService from "../services/calendarService.js";
import { appendConversation } from "../services/googleSheetsService.js";
import pkg from "date-fns-tz";
import { format } from "date-fns";
import es from "date-fns/locale/es/index.js";

const { utcToZonedTime } = pkg;

// Zona horaria
const TIME_ZONE = process.env.TIME_ZONE || "America/Mexico_City";

// --------------------------------------------------------
// Helpers pequeños
// --------------------------------------------------------
function normalizeMsg(text) {
  return (text || "").toLowerCase().trim();
}

function sameLocalDate(a, b) {
  return a.toISOString().split("T")[0] === b.toISOString().split("T")[0];
}

function getMatutinoSlots() {
  return ["11:30", "12:00", "12:30", "13:00", "13:30"];
}

function getVespertinoSlots() {
  return ["16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"];
}

async function askShift(number) {
  await whatsappService.sendInteractiveButtons(
    number,
    "¿Matutino o Vespertino?",
    [
      { type: "reply", reply: { id: "matutino", title: "Matutino" } },
      { type: "reply", reply: { id: "vespertino", title: "Vespertino" } },
    ]
  );
}

// --------------------------------------------------------
// FLUJO PRINCIPAL
// --------------------------------------------------------
export async function handleCalendarFlow(
  number,          // número en formato 521...
  calendarState,
  incomingMessage,
  sendWelcomeMenu
) {
  const state = calendarState[number];
  if (!state) return;

  // Inicializar contadores internos
  if (state.attempts === undefined) state.attempts = 0;
  if (state.page === undefined) state.page = 0;

  // Registrar mensaje entrante (si lo hay)
  if (incomingMessage && typeof incomingMessage === "string") {
    await appendConversation(["Alumno", number, incomingMessage]);
  }

  const msg = normalizeMsg(incomingMessage);

  // ------------------------------------
  // CANCELACIÓN GLOBAL
  // ------------------------------------
  if (["cancelar", "salir"].includes(msg)) {
    delete calendarState[number];

    const txt =
      "Has cancelado el proceso de agendar cita. Te regreso al menú principal.";

    await whatsappService.sendMessage(number, txt);
    await appendConversation(["Bot", number, txt]);

    if (sendWelcomeMenu) await sendWelcomeMenu(number);
    return;
  }

  // ------------------------------------
  // STEP: ask_day → Hoy / Mañana / Otro
  // ------------------------------------
  if (state.step === "ask_day") {
    // Primera vez que entra: mandamos los botones
    if (!state.daySelectionSent) {
      const question = "¿Para cuándo deseas la cita?";
      const today = new Date();

      let buttons = [
        { type: "reply", reply: { id: "hoy", title: "Hoy" } },
        { type: "reply", reply: { id: "otro", title: "Otro día" } },
      ];

      // Si hoy NO es sábado, ofrecemos "mañana"
      if (today.getDay() !== 6) {
        buttons.splice(1, 0, {
          type: "reply",
          reply: { id: "manana", title: "Mañana" },
        });
      }

      await whatsappService.sendInteractiveButtons(number, question, buttons);
      await appendConversation(["Bot", number, question]);

      state.daySelectionSent = true;
      return;
    }

    // Respuestas válidas
    if (["hoy", "manana", "mañana", "otro"].includes(msg)) {
      state.attempts = 0;
    }

    // HOY
    if (msg === "hoy") {
      const nowLocal = utcToZonedTime(new Date(), TIME_ZONE);

      // Si ya son ≥ 18:00, no se agenda hoy
      if (nowLocal.getHours() >= 18) {
        await whatsappService.sendInteractiveButtons(
          number,
          "Lo siento, ya no se puede agendar para HOY. Elige otra opción:",
          [
            { type: "reply", reply: { id: "manana", title: "Mañana" } },
            { type: "reply", reply: { id: "otro", title: "Otro día" } },
          ]
        );
        return;
      }

      state.date = new Date();
      const zoned = utcToZonedTime(state.date, TIME_ZONE);
      const formatted = format(zoned, "EEEE d 'de' MMMM", { locale: es });

      await whatsappService.sendMessage(number, `Hoy ${formatted}`);
      state.step = "ask_shift";

      // Pedimos turno
      state.shiftSelectionSent = false;
      state.page = 0;
      await askShift(number);
      return;
    }

    // MAÑANA
    if (msg === "manana" || msg === "mañana") {
      const localNow = utcToZonedTime(new Date(), TIME_ZONE);
      const tomorrow = new Date(localNow);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Domingo = no laboral
      if (tomorrow.getDay() === 0) {
        await whatsappService.sendMessage(
          number,
          "El domingo no es laborable. Elige otra opción."
        );
        return;
      }

      state.date = tomorrow;

      const zoned = utcToZonedTime(state.date, TIME_ZONE);
      const formatted = format(zoned, "EEEE d 'de' MMMM", { locale: es });

      await whatsappService.sendMessage(number, `Mañana ${formatted}`);
      state.step = "ask_shift";

      state.shiftSelectionSent = false;
      state.page = 0;
      await askShift(number);
      return;
    }

    // OTRO DÍA → lista de fechas
    if (msg === "otro") {
      state.attempts = 0;
      state.step = "select_date";
      await sendDateList(number, state);
      return;
    }

    // Intento inválido
    await handleAttempts(
      number,
      state,
      "❗ No entendí. Escribe *hoy*, *mañana*, *otro* o *cancelar*.",
      calendarState,
      sendWelcomeMenu
    );
    return;
  }

  // ------------------------------------
  // STEP: ask_date (YYYY-MM-DD)
  // ------------------------------------
  if (state.step === "ask_date") {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(msg)) {
      await handleAttempts(
        number,
        state,
        "❗ Formato incorrecto. Debe ser YYYY-MM-DD.",
        calendarState,
        sendWelcomeMenu
      );
      return;
    }

    const [y, m, d] = msg.split("-");
    state.date = new Date(+y, +m - 1, +d);

    state.step = "ask_shift";
    state.shiftSelectionSent = false;
    state.page = 0;

    await askShift(number);
    return;
  }

  // ------------------------------------
  // STEP: select_date (lista interactiva)
  // ------------------------------------
  if (state.step === "select_date") {
    const chosen = state.availableDates?.find((f) => f.id === msg);

    if (!chosen) {
      await handleAttempts(
        number,
        state,
        "❗ Selección incorrecta. Usa los botones de la lista.",
        calendarState,
        sendWelcomeMenu
      );
      return;
    }

    state.date = chosen.dateObj;
    state.step = "ask_shift";
    state.shiftSelectionSent = false;
    state.page = 0;

    await askShift(number);
    return;
  }

  // ------------------------------------
  // STEP: ask_shift (matutino / vespertino)
  // ------------------------------------
  if (state.step === "ask_shift") {
    if (!["matutino", "vespertino"].includes(msg)) {
      await handleAttempts(
        number,
        state,
        "❗ Opción inválida. Escribe *matutino* o *vespertino*.",
        calendarState,
        sendWelcomeMenu
      );
      return;
    }

    state.shift = msg;
    state.attempts = 0;

    // Slots base
    state.availableSlots =
      msg === "matutino" ? getMatutinoSlots() : getVespertinoSlots();

    const nowLocal = utcToZonedTime(new Date(), TIME_ZONE);

    // Si es hoy, cortamos horarios pasados +30 min
    if (sameLocalDate(nowLocal, state.date)) {
      const cutoff = new Date(nowLocal.getTime() + 30 * 60000);

      state.availableSlots = state.availableSlots.filter((s) => {
        const [h, m] = s.split(":").map(Number);
        const d = new Date(
          nowLocal.getFullYear(),
          nowLocal.getMonth(),
          nowLocal.getDate(),
          h,
          m
        );
        return d >= cutoff;
      });
    }

    // Quitamos horarios ocupados en Calendar
    const svc = await calendarService.getCalendarService();
    const events = await calendarService.getEventsForDay(svc, state.date);

    const busy = new Set(
      events
        .filter((e) => e.start?.dateTime)
        .map((e) => {
          const dt = utcToZonedTime(new Date(e.start.dateTime), TIME_ZONE);
          return `${dt.getHours().toString().padStart(2, "0")}:${dt
            .getMinutes()
            .toString()
            .padStart(2, "0")}`;
        })
    );

    state.availableSlots = state.availableSlots.filter((s) => !busy.has(s));

    // Si NO hay horarios en este turno → probamos el alterno
    if (state.availableSlots.length === 0) {
      const alt = msg === "matutino" ? "vespertino" : "matutino";
      state.shift = alt;

      state.availableSlots =
        alt === "matutino" ? getMatutinoSlots() : getVespertinoSlots();
      state.availableSlots = state.availableSlots.filter((s) => !busy.has(s));

      if (state.availableSlots.length === 0) {
        await whatsappService.sendMessage(
          number,
          "Lo sentimos, ese día está lleno. Por favor elige otra fecha."
        );
        state.step = "ask_day";
        state.daySelectionSent = false;
        return;
      }

      await whatsappService.sendMessage(
        number,
        `Ese turno está lleno. Mostrando horarios del turno ${alt}.`
      );
    }

    // Pasamos a seleccionar hora
    state.step = "ask_time";
    state.page = 0;

    await sendTimeOptions(number, state);
    return;
  }

  // ------------------------------------
  // STEP: ask_time (selección de horario)
  // ------------------------------------
  if (state.step === "ask_time") {
    // Paginación
    if (msg === "mas") {
      state.attempts = 0;
      state.page++;
      await sendTimeOptions(number, state);
      return;
    }

    const selected = state.availableMapping[msg] || msg;

    const occupied = await isSlotOccupied(state.date, selected);
    if (!state.availableSlots.includes(selected) || occupied) {
      await handleAttempts(
        number,
        state,
        "❗ Horario inválido u ocupado. Usa los botones.",
        calendarState,
        sendWelcomeMenu
      );
      return;
    }

    state.attempts = 0;
    state.selectedSlot = selected;

    // Crear evento en Calendar
    state.eventResult = await calendarService.createCalendarEvent(
      state.date,
      selected,
      number
    );

    state.step = "ask_patient_name";
    await whatsappService.sendMessage(
      number,
      "Por favor, indícame el nombre del alumno:"
    );
    return;
  }

  // ------------------------------------
  // STEP: ask_patient_name (nombre)
  // ------------------------------------
  if (state.step === "ask_patient_name") {
    if (!msg || msg.trim().length < 2) {
      await handleAttempts(
        number,
        state,
        "❗ Ingresa un nombre válido del alumno.",
        calendarState,
        sendWelcomeMenu
      );
      return;
    }

    state.patientName = incomingMessage;

    await calendarService.updateCalendarEvent(
      state.eventResult.id,
      state.patientName
    );

    const conf = `Cita confirmada para el ${state.date
      .toISOString()
      .split("T")[0]} a las ${state.selectedSlot}.\nNombre: ${state.patientName}`;

    await whatsappService.sendMessage(number, conf);
    await appendConversation(["Bot", number, conf]);

    delete calendarState[number];

    if (sendWelcomeMenu) await sendWelcomeMenu(number);
  }
}

// --------------------------------------------------------
// HANDLERS AUXILIARES
// --------------------------------------------------------
async function handleAttempts(
  number,
  state,
  warn,
  calendarState,
  sendWelcomeMenu
) {
  state.attempts += 1;

  if (state.attempts === 1) {
    await whatsappService.sendMessage(number, warn);
  } else if (state.attempts === 2) {
    await whatsappService.sendMessage(
      number,
      "📌 Aún no entiendo. Escribe *ayuda* o *cancelar*."
    );
  } else {
    await whatsappService.sendMessage(
      number,
      "⚠️ Reiniciando proceso. Regresándote al menú."
    );
    // Reinicia el flujo de calendario SOLO para ese número
    if (calendarState && calendarState[number]) {
      delete calendarState[number];
    }
    if (sendWelcomeMenu) await sendWelcomeMenu(number);
  }
}

async function isSlotOccupied(dateObj, slot) {
  const svc = await calendarService.getCalendarService();
  const events = await calendarService.getEventsForDay(svc, dateObj);

  const busy = new Set();

  events.forEach((e) => {
    if (e.start?.dateTime) {
      const dt = utcToZonedTime(new Date(e.start.dateTime), TIME_ZONE);
      busy.add(
        `${dt.getHours().toString().padStart(2, "0")}:${dt
          .getMinutes()
          .toString()
          .padStart(2, "0")}`
      );
    }
  });

  return busy.has(slot);
}

// --------------------------------------------------------
// LISTA DE FECHAS
// --------------------------------------------------------
export async function sendDateList(number, state) {
  const nowLocal = utcToZonedTime(new Date(), TIME_ZONE);
  const today = new Date(
    nowLocal.getFullYear(),
    nowLocal.getMonth(),
    nowLocal.getDate()
  );

  const dates = [];

  for (let i = 2; i <= 14 && dates.length < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    // Saltar domingos
    if (d.getDay() === 0) continue;

    dates.push({
      id: `fecha_${i}`,
      title: `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1
      ).padStart(2, "0")}/${d.getFullYear()}`,
      dateObj: d,
    });
  }

  state.availableDates = dates;

  await whatsappService.sendMessage(number, {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: "Selecciona una fecha (sin domingos):" },
      footer: { text: "Próximos 7 días" },
      action: {
        button: "Elegir",
        sections: [
          {
            title: "Fechas (7 días)",
            rows: dates.map((d) => ({
              id: d.id,
              title: d.title,
            })),
          },
        ],
      },
    },
  });

  await appendConversation(["Bot", number, "Lista de fechas enviada."]);
}

// --------------------------------------------------------
// HORARIOS PAGINADOS
// --------------------------------------------------------
export async function sendTimeOptions(number, state) {
  const perPage = 2;
  const start = state.page * perPage;
  const slice = state.availableSlots.slice(start, start + perPage);

  const buttons = slice.map((s) => ({
    type: "reply",
    reply: { id: s.replace(/:/g, "_"), title: s },
  }));

  if (start + perPage < state.availableSlots.length) {
    buttons.push({ type: "reply", reply: { id: "mas", title: "Más" } });
  }

  state.availableMapping = {};
  slice.forEach((s) => {
    state.availableMapping[s.replace(/:/g, "_")] = s;
  });

  const q = `Horarios disponibles: ${slice.join(", ")}.`;

  await whatsappService.sendInteractiveButtons(number, q, buttons);
  await appendConversation(["Bot", number, q]);
}
