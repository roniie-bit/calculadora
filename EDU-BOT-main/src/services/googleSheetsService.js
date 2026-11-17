// ✅ src/services/googleSheetsService.js

import dotenv from "dotenv";
dotenv.config();

import path from "path";
import { google } from "googleapis";
import { withTimeout } from "../utils/withTimeout.js";

// =========================================================
//   VARIABLES DE ENTORNO
// =========================================================
const MAIN_SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const MAIN_KEY_FILE = process.env.KEY_FILE;

const SPREADSHEET_ID_2 = process.env.SPREADSHEET_ID_2;
const KEY_FILE_2 = process.env.KEY_FILE_2;

const SPREADSHEET_ID_3 = process.env.SPREADSHEET_ID_3;
const KEY_FILE_3 = process.env.KEY_FILE_3;

const SALES_SPREADSHEET_ID = process.env.SALES_SPREADSHEET_ID;
const SALES_KEY_FILE = process.env.SALES_KEY_FILE;

// Calificaciones
const GRADES_SPREADSHEET_ID = process.env.GRADES_SPREADSHEET_ID;
const GRADES_KEY_FILE = process.env.GRADES_KEY_FILE;

// =========================================================
// AUTH HELPERS
// =========================================================
const authenticate = async (keyFile) => {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), "src/credentials", keyFile),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return auth.getClient();
};

async function getAuthToken() {
  return authenticate(MAIN_KEY_FILE);
}

async function ensureSheetExists({ spreadsheetId, keyFile, sheetName, headers }) {
  const authClient = await authenticate(keyFile);
  const sheetsService = google.sheets({ version: "v4", auth: authClient });

  const metadata = await sheetsService.spreadsheets.get({ spreadsheetId });

  const exists = (metadata.data.sheets || []).some(
    (s) => (s.properties.title || "").trim() === sheetName
  );

  if (!exists) {
    await sheetsService.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });

    if (headers && headers.length) {
      await sheetsService.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    }
  }

  return sheetsService;
}

// =========================================================
// APPEND GENÉRICO
// =========================================================
async function addRowToSheet(auth, spreadsheetId, values, range) {
  const sheetsService = google.sheets({ version: "v4", auth });

  const request = {
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  };

  const response = await sheetsService.spreadsheets.values.append(request);
  return response.data;
}

// =========================================================
// GUARDAR RESERVAS (HOJA PRINCIPAL)
// =========================================================
const appendToSheet = async (data) => {
  try {
    const authClient = await authenticate(MAIN_KEY_FILE);
    const timestamp = new Date().toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
    });

    const newData = [...data, timestamp];
    await addRowToSheet(authClient, MAIN_SPREADSHEET_ID, newData, "reservas");
    return "Datos correctamente agregados";
  } catch (error) {
    console.error(error);
  }
};

// =========================================================
// REGISTRO DE CONVERSACIÓN DEL EDU-BOT
// =========================================================
export const appendConversation = async (data) => {
  try {
    const authClient = await authenticate(MAIN_KEY_FILE);
    const sheetsService = google.sheets({ version: "v4", auth: authClient });

    const [tipo, numero, mensaje] = data;
    const timestamp = new Date().toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
    });

    const row = [
      tipo || "N/A",
      numero || "SIN-NUMERO",
      mensaje || "",
      timestamp,
    ];

    await withTimeout(
      sheetsService.spreadsheets.values.append({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: "Conversacion!A:D",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      }),
      10000,
      "registro de conversación"
    );

    return "Conversación registrada ✔";
  } catch (error) {
    console.error("❌ Error al registrar conversación:", error);
    return "Error registrando conversación ❌";
  }
};

// =========================================================
// LECTURAS GENÉRICAS
// =========================================================
export const getRowsThirdSheet = async (spreadsheetId, keyFile) => {
  const authClient = await authenticate(keyFile);
  const sheetsService = google.sheets({ version: "v4", auth: authClient });
  const range = "Hoja 3!A:C";
  const response = await sheetsService.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return response.data.values || [];
};

export const readIslaFirstSheetLast10 = async (spreadsheetId, keyFile) => {
  const authClient = await authenticate(keyFile);
  const sheetsService = google.sheets({ version: "v4", auth: authClient });
  const range = "A:D";
  const response = await sheetsService.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const rows = response.data.values || [];
  return rows.slice(-10);
};

// =========================================================
// LISTAS EMPLEADOS / VENDEDORES
// =========================================================
export const readEmployeesList = async (spreadsheetId, keyFile) => {
  try {
    const authClient = await authenticate(keyFile);
    const sheetsService = google.sheets({ version: "v4", auth: authClient });

    const range = "A:B";
    const response = await sheetsService.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    const employees = {};

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 2) employees[row[0].trim()] = row[1].trim();
    }

    return employees;
  } catch (error) {
    console.error("Error al leer empleados:", error);
    return {};
  }
};

export const readVendorsList = async (spreadsheetId, keyFile) => {
  try {
    const authClient = await authenticate(keyFile);
    const sheetsService = google.sheets({ version: "v4", auth: authClient });

    const range = "A:B";
    const response = await sheetsService.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    const vendors = {};

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 2) vendors[row[0]] = row[1];
    }

    return vendors;
  } catch (error) {
    console.error("Error al leer vendedores:", error);
    return {};
  }
};

// =========================================================
// AGREGAR EMPLEADO
// =========================================================
export const addEmployee = async (spreadsheetId, keyFile, employeeCode, employeeName) => {
  try {
    const authClient = await authenticate(keyFile);
    const sheetsService = google.sheets({ version: "v4", auth: authClient });

    const request = {
      spreadsheetId,
      range: "A:B",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[employeeCode, employeeName]] },
    };

    const response = await sheetsService.spreadsheets.values.append(request);
    return response.data.updates?.updatedCells || 0;
  } catch (error) {
    console.error(error);
    return 0;
  }
};

// =========================================================
// ASISTENCIA EMPLEADOS (SIMI)
// =========================================================
export const appendAttendance = async (employeeCode, employeeName, phoneNumber, locName, address, latLong) => {
  try {
    const authClient = await authenticate(KEY_FILE_2);
    const sheetsService = google.sheets({ version: "v4", auth: authClient });

    const timestamp = new Date().toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
    });

    const row = [employeeCode, employeeName, phoneNumber, locName, address, latLong, timestamp];

    const response = await sheetsService.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID_2,
      range: "Hoja 1!A:G",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return response.data.updates?.updatedCells || 0;
  } catch (error) {
    console.error("Error al registrar asistencia:", error);
    return 0;
  }
};

// =========================================================
// VENTAS
// =========================================================
export const appendSale = async (sellerCode, sellerName, amount, customerPhone) => {
  try {
    const authClient = await authenticate(SALES_KEY_FILE);
    const sheetsService = google.sheets({ version: "v4", auth: authClient });

    const timestamp = new Date().toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
    });

    const row = [sellerCode, sellerName, amount, customerPhone, timestamp];

    const response = await sheetsService.spreadsheets.values.append({
      spreadsheetId: SALES_SPREADSHEET_ID,
      range: "A:E",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return response.data.updates?.updatedCells || 0;
  } catch (error) {
    console.error(error);
    return 0;
  }
};

// =========================================================
// LECTURAS HOJA 2
// =========================================================
export async function getRowsSecondSheetFull(spreadsheetId, keyFile) {
  const authClient = await authenticate(keyFile);
  const sheetsService = google.sheets({ version: "v4", auth: authClient });
  const range = "Hoja 1!A:G";
  const response = await sheetsService.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return response.data.values || [];
}

export async function searchInSecondSheet(spreadsheetId, keyFile, searchValue) {
  const rows = await getRowsSecondSheetFull(spreadsheetId, keyFile);
  return rows.filter((row) => row[0] === searchValue).slice(-10);
}

// =========================================================
// PARSE DE FECHAS
// =========================================================
export function parseDateFromSheet(dateStr) {
  dateStr = (dateStr || "").replace(",", "");
  const parts = dateStr.split(" ");
  const datePart = parts[0];
  const timePart = parts[1];
  const ampm = parts[2]?.toLowerCase() || "";

  const [day, month, year] = datePart.split("/").map(Number);
  let [hour, minute, second] = timePart.split(":").map(Number);

  if (ampm.includes("p") && hour < 12) hour += 12;
  if (ampm.includes("a") && hour === 12) hour = 0;

  return new Date(year, month - 1, day, hour, minute, second);
}

// =========================================================
// ASISTENCIA ALUMNOS (SIMI)
// =========================================================
export const appendAssistance = async (studentNumber, studentName = "Sin nombre") => {
  try {
    const authClient = await authenticate(KEY_FILE_2);
    const sheetsService = google.sheets({ version: "v4", auth: authClient });

    const timestamp = new Date().toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
    });

    const row = [
      studentNumber,
      studentName,
      studentNumber,
      "Asistencia alumno",
      "Registro automático EDU-BOT",
      "",
      timestamp,
    ];

    const response = await sheetsService.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID_2,
      range: "Hoja 1!A:G",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return response.data.updates?.updatedCells || 0;
  } catch (error) {
    console.error("❌ Error al registrar asistencia del alumno:", error);
    return 0;
  }
};

// =========================================================
// UBICACIÓN ALUMNO
// =========================================================
export const appendStudentLocation = async (studentNumber, lat, lng) => {
  try {
    const authClient = await authenticate(KEY_FILE_2);
    const sheetsService = google.sheets({ version: "v4", auth: authClient });

    const timestamp = new Date().toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
    });

    const row = [
      studentNumber,
      "Sin nombre",
      studentNumber,
      "Sin nombre",
      "Sin dirección",
      `${lat}, ${lng}`,
      timestamp,
    ];

    const response = await sheetsService.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID_2,
      range: "Hoja 1!A:G",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return response.data.updates?.updatedCells || 0;
  } catch (error) {
    console.error("❌ Error al registrar ubicación del alumno:", error);
    return 0;
  }
};

// =========================================================
// ✅ ENCUESTA — GUARDAR EN NUEVA PESTAÑA "Encuesta_01" (17 columnas)
// =========================================================
export const appendSurveyRow = async (valuesArr) => {
  try {
    const sheetName = "Encuesta_01";

    const sheetsService = await ensureSheetExists({
      spreadsheetId: MAIN_SPREADSHEET_ID,
      keyFile: MAIN_KEY_FILE,
      sheetName,
      headers: [
        "Teléfono",
        "Nombre",
        "Turno",
        "Semestre",
        "P1",
        "P2",
        "P3",
        "P4",
        "P5",
        "P6",
        "P7",
        "P8",
        "P9",
        "P10",
        "P11",
        "P12",
        "Fecha",
      ],
    });

    await sheetsService.spreadsheets.values.append({
      spreadsheetId: MAIN_SPREADSHEET_ID,
      range: `${sheetName}!A:Q`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [valuesArr] },
    });

    return true;
  } catch (err) {
    console.error("❌ Error guardando encuesta:", err);
    return false;
  }
};

// =========================================================
// EMOCIONAL
// =========================================================
async function ensureEmotionalSheet() {
  return ensureSheetExists({
    spreadsheetId: MAIN_SPREADSHEET_ID,
    keyFile: MAIN_KEY_FILE,
    sheetName: "Emocional",
    headers: [
      "Fecha",
      "Hora",
      "Teléfono",
      "Tipo",
      "Mensaje / Nota",
      "Emoción",
      "Notas adicionales",
      "Remisión",
    ],
  });
}

export const logEmotionalEntry = async (phone) => {
  try {
    const sheetsService = await ensureEmotionalSheet();

    const now = new Date();
    const fecha = now.toLocaleDateString("es-MX", {
      timeZone: "America/Mexico_City",
    });
    const hora = now.toLocaleTimeString("es-MX", {
      timeZone: "America/Mexico_City",
    });

    const row = [
      fecha,
      hora,
      phone,
      "Ingreso",
      "Alumno ingresó al módulo emocional",
      "",
      "",
      "No",
    ];

    await sheetsService.spreadsheets.values.append({
      spreadsheetId: MAIN_SPREADSHEET_ID,
      range: "Emocional!A:H",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return true;
  } catch (err) {
    console.error("❌ Error en logEmotionalEntry:", err);
    return false;
  }
};

export const logEmotionalMessage = async (phone, messageText) => {
  try {
    const sheetsService = await ensureEmotionalSheet();

    const now = new Date();
    const fecha = now.toLocaleDateString("es-MX", {
      timeZone: "America/Mexico_City",
    });
    const hora = now.toLocaleTimeString("es-MX", {
      timeZone: "America/Mexico_City",
    });

    const row = [fecha, hora, phone, "Mensaje", messageText || "", "", "", "No"];

    await sheetsService.spreadsheets.values.append({
      spreadsheetId: MAIN_SPREADSHEET_ID,
      range: "Emocional!A:H",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return true;
  } catch (err) {
    console.error("❌ Error en logEmotionalMessage:", err);
    return false;
  }
};

export const logEmotionalReferral = async (phone, extraNote = "") => {
  try {
    const sheetsService = await ensureEmotionalSheet();

    const now = new Date();
    const fecha = now.toLocaleDateString("es-MX", {
      timeZone: "America/Mexico_City",
    });
    const hora = now.toLocaleTimeString("es-MX", {
      timeZone: "America/Mexico_City",
    });

    const row = [
      fecha,
      hora,
      phone,
      "Remisión",
      extraNote || "Se sugiere canalizar el caso.",
      "",
      "",
      "Sí",
    ];

    await sheetsService.spreadsheets.values.append({
      spreadsheetId: MAIN_SPREADSHEET_ID,
      range: "Emocional!A:H",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return true;
  } catch (err) {
    console.error("❌ Error en logEmotionalReferral:", err);
    return false;
  }
};

// =========================================================
// CALIFICACIONES (GRADES)
// =========================================================
async function ensureGradesSheet() {
  const authClient = await authenticate(GRADES_KEY_FILE);
  const sheetsService = google.sheets({ version: "v4", auth: authClient });

  const metadata = await sheetsService.spreadsheets.get({
    spreadsheetId: GRADES_SPREADSHEET_ID,
  });

  const exists = (metadata.data.sheets || []).some(
    (s) => (s.properties.title || "").trim() === "Calificaciones"
  );

  if (!exists) {
    await sheetsService.spreadsheets.batchUpdate({
      spreadsheetId: GRADES_SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Calificaciones" } } }],
      },
    });

    await sheetsService.spreadsheets.values.update({
      spreadsheetId: GRADES_SPREADSHEET_ID,
      range: "Calificaciones!A1",
      valueInputOption: "RAW",
      requestBody: { values: [["Iniciales", "NombreCompleto", "Calificacion"]] },
    });
  }

  return sheetsService;
}

export async function getStudentGrade(initials) {
  try {
    const sheetsService = await ensureGradesSheet();
    const response = await sheetsService.spreadsheets.values.get({
      spreadsheetId: GRADES_SPREADSHEET_ID,
      range: "Calificaciones!A:C",
    });

    const rows = response.data.values || [];
    const target = (initials || "").trim().toUpperCase();

    const row = rows.find(
      (r) => (r[0] || "").trim().toUpperCase() === target
    );

    if (!row) return null;

    return {
      folio: row[0], // lo dejo así para no romper tu messageHandler actual
      nombre: row[1] || "Sin nombre",
      calificacion: row[2] || "Sin calificación",
    };
  } catch (err) {
    console.error("❌ Error en getStudentGrade:", err);
    return null;
  }
}

// =========================================================
// EXAMEN FÍSICA – (si lo sigues usando aparte)
// =========================================================
export async function appendPhysicsExamRow(row) {
  const sheetName = "Examen_Fisica_1Ley";

  const sheetsService = await ensureSheetExists({
    spreadsheetId: MAIN_SPREADSHEET_ID,
    keyFile: MAIN_KEY_FILE,
    sheetName,
    headers: [
      "Teléfono",
      "Nombre",
      "Pregunta 1",
      "Pregunta 2",
      "Pregunta 3",
      "Pregunta 4",
      "Calificación",
      "Fecha",
    ],
  });

  await sheetsService.spreadsheets.values.append({
    spreadsheetId: MAIN_SPREADSHEET_ID,
    range: `${sheetName}!A:H`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  return true;
}

// =========================================================
// ✅ appendToSheetCustom (la usa matemáticas y física)
// =========================================================
export async function appendToSheetCustom(sheetName, values) {
  try {
    const auth = await getAuthToken();
    const sheetsService = google.sheets({ version: "v4", auth });

    const meta = await sheetsService.spreadsheets.get({
      spreadsheetId: MAIN_SPREADSHEET_ID,
    });

    const sheetExists = (meta.data.sheets || []).some(
      (s) => s.properties.title === sheetName
    );

    if (!sheetExists) {
      await sheetsService.spreadsheets.batchUpdate({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });

      const headers = ["WhatsApp", "Nombre", "Resultado", "Aciertos", "Fecha"];
      await sheetsService.spreadsheets.values.update({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    }

    await sheetsService.spreadsheets.values.append({
      spreadsheetId: MAIN_SPREADSHEET_ID,
      range: `${sheetName}!A:E`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
  } catch (error) {
    console.error("Error en appendToSheetCustom:", error);
  }
}

// ============================================================
// ✅ EXAMEN QUÍMICA – GUARDA EN MAIN_SPREADSHEET_ID (FIX)
// ============================================================
export async function appendChemistryExamRow(rowData) {
  const sheetName = "Examen_Quimica";

  const sheetsService = await ensureSheetExists({
    spreadsheetId: MAIN_SPREADSHEET_ID,
    keyFile: MAIN_KEY_FILE,
    sheetName,
    headers: [
      "Teléfono",
      "Nombre",
      "P1",
      "P2",
      "P3",
      "P4",
      "P5",
      "P6",
      "P7",
      "P8",
      "P9",
      "P10",
      "Fecha",
    ],
  });

  await sheetsService.spreadsheets.values.append({
    spreadsheetId: MAIN_SPREADSHEET_ID,
    range: `${sheetName}!A:M`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [rowData] },
  });

  return true;
}

// =========================================================
// EXPORT PRINCIPAL
// =========================================================
export default appendToSheet;
