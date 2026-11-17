export const HOMEWORK_TIME_ZONE = "America/Mexico_City";
export const HOMEWORK_TEMPLATE_NAME =
  process.env.HOMEWORK_REMINDER_TEMPLATE || "recordatorio_tarea_pendiente";
export const HOMEWORK_TEMPLATE_LANGUAGE =
  process.env.HOMEWORK_REMINDER_LANGUAGE || "es_MX";
export const HOMEWORK_DONE_TITLE = "Sí, ya la entregué";
export const HOMEWORK_PENDING_TITLE = "No, sigue pendiente";

function templateParameter(value, fallback) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
  return normalized || fallback;
}

export function dateInMexico(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HOMEWORK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function parseHomeworkDate(value) {
  const text = String(value || "").trim();
  let match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  let day;
  let month;
  let year;

  if (match) {
    [, day, month, year] = match.map(Number);
  } else {
    match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return null;
    [, year, month, day] = match.map(Number);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function homeworkDateToISO(value) {
  const date = parseHomeworkDate(value);
  if (!date) return null;
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(
    date.day
  ).padStart(2, "0")}`;
}

function dayNumber({ year, month, day }) {
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

export function homeworkReminderKind(dueDate, now = new Date()) {
  const due = parseHomeworkDate(dueDate);
  const today = parseHomeworkDate(dateInMexico(now));
  if (!due || !today) return null;

  const days = dayNumber(due) - dayNumber(today);
  if (days === 2) return "two-days";
  if (days === 1) return "tomorrow";
  if (days === 0) return "today";
  if (days < 0) return "overdue";
  return null;
}

export function isHomeworkDateBeforeToday(value, now = new Date()) {
  const dueDate = homeworkDateToISO(value);
  return Boolean(dueDate && dueDate < dateInMexico(now));
}

export function shouldSendHomeworkReminder(task, now = new Date()) {
  const today = dateInMexico(now);
  return Boolean(
    homeworkReminderKind(task.dueDate, now) &&
      task.lastReminder !== today
  );
}

export function buildHomeworkReminderMessage(task) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: task.phone,
    type: "template",
    template: {
      name: HOMEWORK_TEMPLATE_NAME,
      language: { code: HOMEWORK_TEMPLATE_LANGUAGE },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: templateParameter(task.description, "Tarea sin descripción"),
            },
            {
              type: "text",
              text: templateParameter(task.dueDate, "Sin fecha"),
            },
          ],
        },
      ],
    },
  };
}

export function parseHomeworkReminderAnswer(...values) {
  const answer = values
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    answer.includes("ya la entregue") ||
    answer.includes("si, ya") ||
    answer.includes("si ya")
  ) {
    return "done";
  }

  if (
    answer.includes("sigue pendiente") ||
    answer.includes("no, sigue") ||
    answer.includes("todavia no")
  ) {
    return "pending";
  }

  return null;
}
