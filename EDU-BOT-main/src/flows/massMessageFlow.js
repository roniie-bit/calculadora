// src/flows/massMessageFlow.js
import path from "path";
import { google } from "googleapis";
import whatsappService from "../services/whatsappService.js";
import { appendConversation } from "../services/googleSheetsService.js";

const SPREADSHEET_ID_3 = process.env.SPREADSHEET_ID_3;
const KEY_FILE_3       = process.env.KEY_FILE_3;

/* ------------------------------------------------------------------ */
/* 1.  Marca “pendiente” sólo si A y B tienen datos y D está vacía     */
/* ------------------------------------------------------------------ */
export async function marcarPendientesEnHoja3 () {
  const sheets = google.sheets("v4");
  const auth   = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), "src/credentials", KEY_FILE_3),
    scopes : ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const authClient = await auth.getClient();

  const rangeResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID_3,
    range        : "Hoja 3!A2:D",     // A‑D, desde fila 2
    auth : authClient,
  });

  const rows    = rangeResp.data.values || [];
  const updates = [];

  rows.forEach((r, idx) => {
    const telefono = (r[0] || "").trim();
    const mensaje  = (r[1] || "").trim();
    const estado   = (r[3] || "").toString().trim().toLowerCase();

    if (telefono && mensaje && !estado) {
      updates.push({
        range : `Hoja 3!D${idx + 2}`, // +2 porque empezamos en fila 2
        values: [["pendiente"]],
      });
    }
  });

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID_3,
      resource: { valueInputOption: "USER_ENTERED", data: updates },
      auth: authClient,
    });
    console.log(`✅ ${updates.length} celdas marcadas como 'pendiente'`);
  } else {
    console.log("✅ No había celdas vacías por marcar");
  }
}

/* ------------------------------------------------------------------ */
/* 2.  Envía mensajes sólo a filas con “pendiente” o sin estado        */
/* ------------------------------------------------------------------ */
export async function enviarMensajesMasivos (sendAndLog) {
  const sheets = google.sheets("v4");
  const auth   = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), "src/credentials", KEY_FILE_3),
    scopes : ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const authClient = await auth.getClient();

  // --- leemos A:D directamente (no usamos getRowsThirdSheet) ----
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID_3,
    range        : "Hoja 3!A2:D",
    auth : authClient,
  });
  const rows = resp.data.values || [];

  let enviados = 0;

  for (let i = 0; i < rows.length; i++) {
    const [telRaw, msgRaw, imgRaw = "", estRaw = ""] = rows[i];
    const telefono = (telRaw || "").trim();
    const mensaje  = (msgRaw || "").trim();
    const imagen   = imgRaw.trim();
    const estado   = estRaw.toString().trim().toLowerCase();

    // --- filtros --------------------------------------------------
    if (!telefono || !mensaje)            continue;   // fila incompleta
    if (estado === "enviado")             continue;   // ya enviado
    // --------------------------------------------------------------

    // 1. enviar texto
    await sendAndLog(telefono, mensaje);

    // 2. enviar imagen (si existe)
    if (imagen) {
      await whatsappService.sendMediaMessage(telefono, "image", imagen, "");
      await appendConversation(["Bot", telefono,
        `Media image: ${imagen}`, new Date().toISOString()]);
    }

    // 3. marcar como enviado
    await sheets.spreadsheets.values.update({
      spreadsheetId : SPREADSHEET_ID_3,
      range         : `Hoja 3!D${i + 2}`, // fila real en la hoja
      valueInputOption : "USER_ENTERED",
      resource      : { values: [["enviado"]] },
      auth : authClient,
    });

    enviados++;
  }

  return enviados;
}
