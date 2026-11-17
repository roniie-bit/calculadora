import path from 'node:path';
import { google } from 'googleapis';
import 'dotenv/config';

export const REPORT_SHEET = 'Calificaciones_Primer_Parcial';
export const REPORT_HEADERS = [
  'Grupo',
  'Materia',
  'Periodo',
  'Folio',
  'Nombre alumno',
  'Estado alumno',
  'Tareas 40',
  'Asistencia 30',
  'Examen 30',
  'Total 100',
  'Total 10',
  'Tareas revisadas',
  'Tareas pendientes',
  'Puntos tarea',
  'Tarea posible',
  'Clases consideradas',
  'Presentes',
  'Retardos',
  'Faltas',
  'Asistencia efectiva',
  'Examen P1',
  'Estado',
  'Pendientes',
  'Actualización UTC'
];

export function createGradeReportStore(getSheet) {
  return {
    async refresh(rows) {
      const { sheets, spreadsheetId } = await getSheet();
      const values = [REPORT_HEADERS, ...rows];
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `'${REPORT_SHEET}'!A:X`
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${REPORT_SHEET}'!A1`,
        valueInputOption: 'RAW',
        requestBody: { values }
      });
      return rows.length;
    }
  };
}

let ready;
async function getSheet() {
  if (!ready) {
    ready = (async () => {
      const spreadsheetId = process.env.SPREADSHEET_ID;
      if (!spreadsheetId || !process.env.KEY_FILE) {
        throw new Error('Falta SPREADSHEET_ID o KEY_FILE');
      }
      const auth = new google.auth.GoogleAuth({
        keyFile: path.join(process.cwd(), 'src/credentials', process.env.KEY_FILE),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
      let meta = await sheets.spreadsheets.get({ spreadsheetId });
      if (!meta.data.sheets.some(sheet => sheet.properties.title === REPORT_SHEET)) {
        try {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{ addSheet: { properties: { title: REPORT_SHEET } } }]
            }
          });
        } catch (error) {
          const check = await sheets.spreadsheets.get({ spreadsheetId });
          if (!check.data.sheets.some(sheet => sheet.properties.title === REPORT_SHEET)) throw error;
        }
      }
      const header = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${REPORT_SHEET}'!A1:X1`
      });
      const actual = header.data.values?.[0] || [];
      if (actual.length && REPORT_HEADERS.some((label, index) => actual[index] !== label)) {
        throw new Error(`Encabezados incompatibles en ${REPORT_SHEET}`);
      }
      if (!actual.length) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${REPORT_SHEET}'!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [REPORT_HEADERS] }
        });
      }
      return { sheets, spreadsheetId };
    })().catch(error => {
      ready = undefined;
      throw error;
    });
  }
  return ready;
}

export default createGradeReportStore(getSheet);
