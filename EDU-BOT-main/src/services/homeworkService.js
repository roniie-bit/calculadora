// src/services/homeworkService.js

import dotenv from "dotenv";
dotenv.config();

import path from "path";
import { google } from "googleapis";
import { dateInMexico, parseHomeworkDate } from "./homeworkReminder.js";
import { withTimeout } from "../utils/withTimeout.js";

const MAIN_SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const MAIN_KEY_FILE = process.env.KEY_FILE;
const HOMEWORK_SHEET = "Tareas-Alumnos";
const GOOGLE_TIMEOUT_MS = 15000;
const HOMEWORK_HEADERS = [
  "Teléfono",
  "Descripción de la tarea",
  "Fecha de entrega (dd/mm/aaaa)",
  "Estado",
  "Último recordatorio",
  "Notas IA",
  "ID mensaje recordatorio",
  "Respuesta recordatorio",
];

// ================================
//  HELPERS BÁSICOS
// ================================
async function getSheetsService() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), "src/credentials", MAIN_KEY_FILE),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient });
}

// Crea la hoja "Tareas-Alumnos" si no existe y agrega encabezados
async function ensureHomeworkSheet() {
  const sheets = await getSheetsService();

  // 1️⃣ Traer metadatos del spreadsheet
  const metadata = await withTimeout(
    sheets.spreadsheets.get({
      spreadsheetId: MAIN_SPREADSHEET_ID,
    }),
    GOOGLE_TIMEOUT_MS,
    "metadatos de tareas"
  );

  const sheetExists = (metadata.data.sheets || []).some(
    (s) => s.properties.title.trim() === HOMEWORK_SHEET
  );

  // 2️⃣ Si no existe, la creamos
  if (!sheetExists) {
    await withTimeout(
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: HOMEWORK_SHEET,
                },
              },
            },
          ],
        },
      }),
      GOOGLE_TIMEOUT_MS,
      "creación de hoja de tareas"
    );

    // 3️⃣ Encabezados
    await withTimeout(
      sheets.spreadsheets.values.append({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: `${HOMEWORK_SHEET}!A1:H1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [HOMEWORK_HEADERS],
        },
      }),
      GOOGLE_TIMEOUT_MS,
      "encabezados de tareas"
    );
  } else {
    const headersResponse = await withTimeout(
      sheets.spreadsheets.values.get({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: `${HOMEWORK_SHEET}!A1:H1`,
      }),
      GOOGLE_TIMEOUT_MS,
      "encabezados de tareas"
    );
    const currentHeaders = headersResponse.data.values?.[0] || [];

    if (
      currentHeaders[6] !== HOMEWORK_HEADERS[6] ||
      currentHeaders[7] !== HOMEWORK_HEADERS[7]
    ) {
      await withTimeout(
        sheets.spreadsheets.values.update({
          spreadsheetId: MAIN_SPREADSHEET_ID,
          range: `${HOMEWORK_SHEET}!G1:H1`,
          valueInputOption: "RAW",
          requestBody: {
            values: [HOMEWORK_HEADERS.slice(6)],
          },
        }),
        GOOGLE_TIMEOUT_MS,
        "migración de encabezados de tareas"
      );
    }
  }

  return sheets;
}

// ================================
//  GUARDAR NUEVA TAREA
// ================================
export async function saveHomework(phone, description, dueDateStr, aiNotes = "") {
  try {
    const parsedDate = parseHomeworkDate(dueDateStr);
    if (!parsedDate) return 0;

    const sheets = await ensureHomeworkSheet();

    const timestamp = dateInMexico();
    const normalizedDate = `${String(parsedDate.day).padStart(2, "0")}/${String(
      parsedDate.month
    ).padStart(2, "0")}/${parsedDate.year}`;

    const row = [
      String(phone),
      description,
      normalizedDate,
      "Pendiente",      // Estado inicial
      "",               // Último recordatorio (vacío al inicio)
      aiNotes || `Registrada por EDU-BOT el ${timestamp}`,
      "",
      "",
    ];

    const response = await withTimeout(
      sheets.spreadsheets.values.append({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: `${HOMEWORK_SHEET}!A:H`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      }),
      GOOGLE_TIMEOUT_MS,
      "guardado de tarea"
    );

    return response.data.updates?.updatedCells || 0;
  } catch (error) {
    console.error("❌ Error al guardar tarea:", error);
    return 0;
  }
}

// ================================
//  LISTAR TAREAS PENDIENTES POR NÚMERO
// ================================
export async function listPendingHomeworksByPhone(phone) {
  const rows = await listAllPendingHomeworks();
  return rows.filter((task) => task.phone === String(phone));
}

export async function listAllPendingHomeworks() {
  try {
    const sheets = await ensureHomeworkSheet();

    const res = await withTimeout(
      sheets.spreadsheets.values.get({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: `${HOMEWORK_SHEET}!A:H`,
      }),
      GOOGLE_TIMEOUT_MS,
      "lectura de tareas"
    );

    const rows = res.data.values || [];
    if (rows.length <= 1) return []; // solo encabezados

    const [, ...data] = rows;

    return data
      .map((r, idx) => ({
        rowIndex: idx + 2,        // +2 porque empieza en A2
        phone: r[0] || "",
        description: r[1] || "",
        dueDate: r[2] || "",
        status: (r[3] || "").toLowerCase(),
        lastReminder: r[4] || "",
        notes: r[5] || "",
        reminderMessageId: r[6] || "",
        reminderResponse: r[7] || "",
      }))
      .filter(
        (t) =>
          (t.status === "" || t.status === "pendiente")
      );
  } catch (error) {
    console.error("❌ Error al leer tareas:", error);
    return [];
  }
}

// ================================
//  ACTUALIZAR ESTADO DE UNA TAREA
// ================================
export async function updateHomeworkStatus(rowIndex, newStatus) {
  try {
    const sheets = await ensureHomeworkSheet();

    await withTimeout(
      sheets.spreadsheets.values.update({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: `${HOMEWORK_SHEET}!D${rowIndex}`, // Columna Estado
        valueInputOption: "RAW",
        requestBody: { values: [[newStatus]] },
      }),
      GOOGLE_TIMEOUT_MS,
      "actualización de tarea"
    );

    return true;
  } catch (error) {
    console.error("❌ Error al actualizar estado de tarea:", error);
    return false;
  }
}

// ================================
//  MARCAR FECHA/HORA DE RECORDATORIO
// ================================
export async function setHomeworkReminderTimestamp(
  rowIndex,
  timestamp = dateInMexico()
) {
  try {
    const sheets = await ensureHomeworkSheet();

    await withTimeout(
      sheets.spreadsheets.values.update({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: `${HOMEWORK_SHEET}!E${rowIndex}`, // Columna Último recordatorio
        valueInputOption: "RAW",
        requestBody: { values: [[timestamp]] },
      }),
      GOOGLE_TIMEOUT_MS,
      "registro de recordatorio"
    );

    return true;
  } catch (error) {
    console.error("❌ Error al marcar recordatorio de tarea:", error);
    return false;
  }
}

export async function markHomeworkReminderSent(
  rowIndex,
  reminderMessageId,
  sentDate = dateInMexico()
) {
  try {
    const sheets = await ensureHomeworkSheet();
    const response = await withTimeout(
      sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            {
              range: `${HOMEWORK_SHEET}!E${rowIndex}`,
              values: [[sentDate]],
            },
            {
              range: `${HOMEWORK_SHEET}!G${rowIndex}`,
              values: [[reminderMessageId]],
            },
            {
              range: `${HOMEWORK_SHEET}!H${rowIndex}`,
              values: [[""]],
            },
          ],
        },
      }),
      GOOGLE_TIMEOUT_MS,
      "envío de recordatorio"
    );

    return (response.data.totalUpdatedCells || 0) > 0;
  } catch (error) {
    console.error("❌ Error al guardar el envío del recordatorio:", error);
    return false;
  }
}

export async function findHomeworkByReminderMessageId(reminderMessageId) {
  if (!reminderMessageId) return null;
  const tasks = await listAllPendingHomeworks();
  return (
    tasks.find(
      (task) =>
        task.reminderMessageId === reminderMessageId &&
        task.reminderResponse === ""
    ) || null
  );
}

export async function findOpenHomeworkReminderByPhone(phone) {
  const tasks = await listAllPendingHomeworks();
  const open = tasks.filter(
    (task) =>
      task.phone === String(phone) &&
      task.reminderMessageId &&
      task.reminderResponse === ""
  );

  return open.length === 1 ? open[0] : null;
}

export async function recordHomeworkReminderResponse(rowIndex, answer) {
  try {
    const sheets = await ensureHomeworkSheet();
    const completed = answer === "done";
    const response = await withTimeout(
      sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            {
              range: `${HOMEWORK_SHEET}!D${rowIndex}`,
              values: [[completed ? "Completada" : "Pendiente"]],
            },
            {
              range: `${HOMEWORK_SHEET}!H${rowIndex}`,
              values: [[completed ? "Entregada" : "Sigue pendiente"]],
            },
          ],
        },
      }),
      GOOGLE_TIMEOUT_MS,
      "respuesta del recordatorio"
    );

    return (response.data.totalUpdatedCells || 0) > 0;
  } catch (error) {
    console.error("❌ Error al registrar la respuesta del recordatorio:", error);
    return false;
  }
}
