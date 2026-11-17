import {
  HOMEWORK_TIME_ZONE,
  dateInMexico,
  homeworkDateToISO,
  isHomeworkDateBeforeToday,
  parseHomeworkDate,
} from "./homeworkReminder.js";

const MONTHS = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const WEEKDAYS = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  "miércoles": 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  "sábado": 6,
  sabado: 6,
};

function isoFromParts({ year, month, day }) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function mentionedMonth(text) {
  return Object.keys(MONTHS).find((month) =>
    new RegExp(`\\b${month}\\b`, "i").test(text)
  );
}

function dateAfterDays(today, days) {
  const date = new Date(
    Date.UTC(today.year, today.month - 1, today.day + Number(days))
  );
  return isoFromParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

function weekdayNumber(isoDate) {
  return new Date(`${isoDate}T12:00:00.000Z`).getUTCDay();
}

function cleanDescription(text, matchedDate = "") {
  let description = matchedDate
    ? text.replace(matchedDate, " ")
    : text;

  return description
    .replace(
      /^\s*(?:por\s+favor\s+)?(?:(?:quiero|necesito|me\s+gustaría)\s+)?(?:recuérdame|recordarme|recordar|registra|registrar|anota|anotar|agrega|agregar|nueva|nuevo)\b/i,
      " "
    )
    .replace(/^\s*(?:una\s+|la\s+)?(?:tarea|pendiente)\s*[:\-]?\s*(?:de|para|sobre)?\s*/i, " ")
    .replace(/\b(?:mejor|cambia|cambiar|corrige|corregir|en\s+realidad)\b/gi, " ")
    .replace(/(?:\b(?:para|el|la|del|de|antes|vence|entrega)\s*){1,3}$/i, " ")
    .replace(/^\s*(?:(?:para|el|la|del|de)\s+){1,3}/i, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "")
    .trim();
}

function explicitDate(text, today) {
  let match = /(primer|primero|último|ultimo)\s+(domingo|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado)\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de|del)\s+(\d{4}))?\b/i.exec(text);
  if (match) {
    const year = match[4] ? Number(match[4]) : today.year;
    const month = MONTHS[match[3].toLowerCase()];
    const targetWeekday = WEEKDAYS[match[2].toLowerCase()];
    const first = new Date(Date.UTC(year, month - 1, 1));
    const last = new Date(Date.UTC(year, month, 0));
    let day;

    if (/primer|primero/i.test(match[1])) {
      const offset = (targetWeekday - first.getUTCDay() + 7) % 7;
      day = 1 + offset;
    } else {
      const offset = (last.getUTCDay() - targetWeekday + 7) % 7;
      day = last.getUTCDate() - offset;
    }

    return {
      status: "resolved",
      iso: isoFromParts({ year, month, day }),
      matched: match[0],
    };
  }

  match = /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/.exec(text);
  if (match) {
    let year = match[3] ? Number(match[3]) : today.year;
    if (year < 100) year += 2000;
    const parts = {
      year,
      month: Number(match[2]),
      day: Number(match[1]),
    };
    const iso = isoFromParts(parts);

    if (!parseHomeworkDate(iso)) {
      return { status: "invalid", matched: match[0], clarification: "La fecha no existe. ¿Puedes escribirla nuevamente?" };
    }
    return { status: "resolved", iso, matched: match[0] };
  }

  match = /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de|del)\s+(\d{4}))?\b/i.exec(text);
  if (match) {
    const parts = {
      year: match[3] ? Number(match[3]) : today.year,
      month: MONTHS[match[2].toLowerCase()],
      day: Number(match[1]),
    };
    const iso = isoFromParts(parts);

    if (!parseHomeworkDate(iso)) {
      return { status: "invalid", matched: match[0], clarification: "La fecha no existe. ¿Puedes escribirla nuevamente?" };
    }
    return { status: "resolved", iso, matched: match[0] };
  }

  return null;
}

function relativeDate(text, today) {
  let match = /\b(pasado\s+mañana|mañana|hoy)\b/i.exec(text);
  if (match) {
    const days = /pasado/i.test(match[1]) ? 2 : /mañana/i.test(match[1]) ? 1 : 0;
    return {
      status: "resolved",
      iso: dateAfterDays(today, days),
      matched: match[0],
    };
  }

  match = /\ben\s+(\d{1,3})\s+(días?|dias?|semanas?)\b/i.exec(text);
  if (match) {
    const amount = Number(match[1]);
    const days = /semana/i.test(match[2]) ? amount * 7 : amount;
    if (!Number.isSafeInteger(days) || days < 0) {
      return {
        status: "invalid",
        matched: match[0],
        clarification: "No pude entender cuántos días faltan. ¿Puedes escribir otra fecha?",
      };
    }
    return {
      status: "resolved",
      iso: dateAfterDays(today, days),
      matched: match[0],
    };
  }

  match = /\b(?:(este|próximo|proximo)\s+)?(domingo|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado)\b/i.exec(text);
  if (match) {
    const target = WEEKDAYS[match[2].toLowerCase()];
    const todayIso = isoFromParts(today);
    const current = weekdayNumber(todayIso);
    let days = (target - current + 7) % 7;
    if (/próximo|proximo/i.test(match[1] || "") && days === 0) days = 7;

    return {
      status: "resolved",
      type: "weekday",
      iso: dateAfterDays(today, days),
      matched: match[0],
    };
  }

  match = /\b(fin\s+de\s+semana|próxima\s+semana|proxima\s+semana|siguiente\s+semana|fin\s+de\s+mes|próximo\s+mes|proximo\s+mes)\b/i.exec(text);
  if (match) {
    const clarification = /fin\s+de\s+semana/i.test(match[1])
      ? "¿La entregas el sábado o el domingo?"
      : "¿Qué día exacto de esa semana o mes quieres usar?";
    return {
      status: "ambiguous",
      matched: match[0],
      clarification,
    };
  }

  return null;
}

function normalizeAIResult(result, text, today) {
  const description = String(result?.description || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  const dueDate = homeworkDateToISO(result?.due_date);
  const status = String(result?.status || "").toLowerCase();

  if (status === "ready" && description && dueDate) {
    const monthMentioned = mentionedMonth(text);
    if (
      monthMentioned &&
      Number(dueDate.slice(5, 7)) !== MONTHS[monthMentioned]
    ) {
      return {
        status: "needs_clarification",
        description,
        clarification:
          "No pude confirmar la fecha exacta. ¿Puedes escribir el día y el mes de entrega?",
      };
    }

    if (dueDate < isoFromParts(today)) {
      return {
        status: "invalid",
        description,
        clarification: "Esa fecha ya pasó. ¿Para qué día es la tarea?",
      };
    }
    return { status: "ready", description, dueDate };
  }

  if (status === "needs_description") {
    return {
      status: "needs_description",
      dueDate,
      clarification:
        String(result?.clarification || "").trim() ||
        "¿Qué tarea quieres recordar?",
    };
  }

  if (status === "needs_clarification") {
    return {
      status: "needs_clarification",
      description,
      dueDate,
      clarification:
        String(result?.clarification || "").trim() ||
        "¿Me confirmas la fecha exacta de entrega?",
    };
  }

  return {
    status: "needs_date",
    description: description || cleanDescription(text),
    clarification:
      String(result?.clarification || "").trim() ||
      "¿Cuándo debes entregar la tarea?",
  };
}

async function defaultAIExtractor(text, context) {
  const { extractHomeworkDetailsWithAI } = await import("./openAiService.js");
  return extractHomeworkDetailsWithAI(text, context);
}

export async function interpretHomeworkRequest(
  input,
  { now = new Date(), aiExtractor = defaultAIExtractor } = {}
) {
  const text = String(input || "").trim();
  if (!text) {
    return {
      status: "needs_description",
      clarification: "¿Qué tarea quieres recordar?",
    };
  }

  const today = parseHomeworkDate(dateInMexico(now));
  const localDate =
    explicitDate(text, today) ||
    relativeDate(text, today);
  const localDescription = cleanDescription(text, localDate?.matched || "");

  if (localDate?.status === "invalid") {
    return {
      status: "invalid",
      description: localDescription,
      clarification: localDate.clarification,
    };
  }

  if (localDate?.status === "ambiguous") {
    return {
      status: "needs_clarification",
      description: localDescription,
      clarification: localDate.clarification,
    };
  }

  if (localDate?.status === "resolved") {
    if (!localDescription) {
      return {
        status: "needs_description",
        dueDate: localDate.iso,
        clarification: "¿Qué tarea quieres recordar?",
      };
    }
    if (
      localDate.type === "weekday" &&
      mentionedMonth(text) &&
      !new RegExp(`\\b${mentionedMonth(text)}\\b`, "i").test(
        localDate.matched
      )
    ) {
      return {
        status: "needs_clarification",
        description: localDescription,
        clarification:
          "¿Qué fecha exacta de ese mes quieres usar? Puedes escribir, por ejemplo, “último viernes de noviembre”.",
      };
    }
    if (isHomeworkDateBeforeToday(localDate.iso, now)) {
      return {
        status: "invalid",
        description: localDescription,
        clarification: "Esa fecha ya pasó. ¿Para qué día es la tarea?",
      };
    }
    return {
      status: "ready",
      description: localDescription,
      dueDate: localDate.iso,
    };
  }

  try {
    const aiResult = await aiExtractor(text, {
      today: dateInMexico(now),
      weekday: new Intl.DateTimeFormat("es-MX", {
        timeZone: HOMEWORK_TIME_ZONE,
        weekday: "long",
      }).format(now),
    });
    return normalizeAIResult(aiResult, text, today);
  } catch (error) {
    console.error("❌ No se pudo interpretar la tarea con IA:", error.message);
    return {
      status: "needs_date",
      description: localDescription || text,
      clarification:
        "¿Cuándo debes entregar la tarea? Puedes escribir, por ejemplo, “mañana”, “viernes” o “30/10/2026”.",
    };
  }
}

export function formatHomeworkDateFriendly(isoDate) {
  const date = parseHomeworkDate(isoDate);
  if (!date) return String(isoDate || "");

  const label = new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(
    new Date(Date.UTC(date.year, date.month - 1, date.day, 12))
  );

  return label.charAt(0).toUpperCase() + label.slice(1);
}
