import path from "node:path";
import { google } from "googleapis";
import "dotenv/config";
import {
  buildSncytRow,
  SNCYT_SHEET,
  SNCYT_HEADERS,
} from "../config/sncytSurvey.js";

let ready;

export function resolveSncytSheetConfig(env = process.env) {
  const spreadsheetId = env.SALES_SPREADSHEET_ID;
  const keyFile = env.SALES_KEY_FILE;
  if (!spreadsheetId || !keyFile) {
    throw new Error(
      "Falta configurar SALES_SPREADSHEET_ID o SALES_KEY_FILE para la encuesta SNCyT."
    );
  }

  return { spreadsheetId, keyFile };
}

async function getDemoSheet() {
  if (!ready) {
    ready = (async () => {
      const { spreadsheetId, keyFile } = resolveSncytSheetConfig();

      const auth = new google.auth.GoogleAuth({
        keyFile: path.join(process.cwd(), "src/credentials", keyFile),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      const sheets = google.sheets({
        version: "v4",
        auth: await auth.getClient(),
      });

      let metadata = await sheets.spreadsheets.get({ spreadsheetId });
      let sheet = metadata.data.sheets?.find(
        (item) => item.properties?.title === SNCYT_SHEET
      );

      if (!sheet) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: SNCYT_SHEET,
                    gridProperties: {
                      rowCount: 500,
                      columnCount: SNCYT_HEADERS.length,
                      frozenRowCount: 1,
                    },
                  },
                },
              },
            ],
          },
        });
        metadata = await sheets.spreadsheets.get({ spreadsheetId });
        sheet = metadata.data.sheets?.find(
          (item) => item.properties?.title === SNCYT_SHEET
        );
      }

      if (!sheet) throw new Error("No se pudo crear la pestaña de prueba.");

      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${SNCYT_SHEET}'!A1:S1`,
      });
      const currentHeaders = (headerResponse.data.values?.[0] || []).map(
        (value) => String(value).trim()
      );

      if (currentHeaders.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${SNCYT_SHEET}'!A1:S1`,
          valueInputOption: "RAW",
          requestBody: { values: [SNCYT_HEADERS] },
        });
      } else {
        const headersMatch =
          currentHeaders.length === SNCYT_HEADERS.length &&
          SNCYT_HEADERS.every(
            (header, index) => header === currentHeaders[index]
          );
        if (!headersMatch) {
          throw new Error(
            `Los encabezados de ${SNCYT_SHEET} no coinciden con la encuesta SNCyT.`
          );
        }
      }

      const sheetId = sheet.properties.sheetId;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: { frozenRowCount: 1 },
                },
                fields: "gridProperties.frozenRowCount",
              },
            },
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: SNCYT_HEADERS.length,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 0.05,
                      green: 0.16,
                      blue: 0.28,
                    },
                    textFormat: {
                      foregroundColor: {
                        red: 1,
                        green: 1,
                        blue: 1,
                      },
                      bold: true,
                    },
                  },
                },
                fields:
                  "userEnteredFormat(backgroundColor,textFormat.foregroundColor,textFormat.bold)",
              },
            },
          ],
        },
      });

      return { sheets, spreadsheetId, sheetId };
    })().catch((error) => {
      ready = undefined;
      throw error;
    });
  }

  return ready;
}

export async function ensureSncytSheet() {
  const { spreadsheetId, sheetId } = await getDemoSheet();
  return {
    spreadsheetId,
    sheetId,
    sheetName: SNCYT_SHEET,
  };
}

export async function saveSncytResponse(response) {
  const { sheets, spreadsheetId } = await getDemoSheet();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${SNCYT_SHEET}'!A:S`,
    valueInputOption: "RAW",
    // INSERT_ROWS desplaza las referencias del panel cada vez que llega una
    // respuesta. OVERWRITE agrega después del último registro sin moverlas.
    insertDataOption: "OVERWRITE",
    requestBody: { values: [buildSncytRow(response)] },
  });

  return {
    id: response.id,
    sheetName: SNCYT_SHEET,
  };
}
