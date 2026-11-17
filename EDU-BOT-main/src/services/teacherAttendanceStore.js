import path from 'node:path';
import { google } from 'googleapis';
import 'dotenv/config';
import { withTimeout } from '../utils/withTimeout.js';

const SCHEMA = {
  Listas_Docente: ['Id lista', 'Fecha', 'Grupo', 'Materia', 'Estado', 'Actualización UTC', 'Datos de sesión'],
  Control_Lista: ['Docente', 'Contexto'],
  Asistencias: ['Id lista', 'Fecha', 'Grupo', 'Materia', 'Folio', 'Nombre', 'Estado', 'Actualización UTC', 'Docente'],
  Historial_Lista: ['Fecha UTC', 'Docente', 'Id lista', 'Folio', 'Anterior', 'Nuevo', 'Acción', 'Id mensaje']
};
const cell = value => ({ userEnteredValue: { stringValue: String(value ?? '') } });
const rowData = values => ({ values: values.map(cell) });

// Una sola instancia del bot: Sheets no ofrece compare-and-swap entre procesos.
// La sesión, la asistencia, el historial y el recibo se guardan en un batch atómico.
export function createAttendanceStore(
  getSheet,
  { requestTimeoutMs = 15000 } = {}
) {
  let queue = Promise.resolve();
  return {
    transact(work) {
      const task = queue.then(async () => {
        const { sheets, spreadsheetId, ids } = await getSheet();
        const names = Object.keys(SCHEMA);
        const response = await withTimeout(
          sheets.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges: names.map(name => `'${name}'!A:I`)
          }),
          requestTimeoutMs,
          'lectura de asistencias'
        );
        const tables = Object.fromEntries(names.map((name, i) => [name, response.data.valueRanges[i].values || []]));
        const db = { sessions: {}, controls: {}, history: [] };
        for (const row of tables.Listas_Docente.slice(1)) if (row[0]) db.sessions[row[0]] = JSON.parse(row[6]);
        for (const row of tables.Control_Lista.slice(1)) if (row[0]) db.controls[row[0]] = JSON.parse(row[1]);
        db.seen = new Set(tables.Historial_Lista.slice(1).map(row => row[7]).filter(Boolean));
        const before = JSON.stringify({ sessions: db.sessions, controls: db.controls });
        const result = await work(db);
        if (before === JSON.stringify({ sessions: db.sessions, controls: db.controls }) && !db.history.length) return result;
        const requests = [];
        function upsert(name, keyOf, rows) {
          const existing = tables[name];
          const indexes = new Map(existing.slice(1).map((row, i) => [keyOf(row), i + 1]));
          const appended = [];
          for (const row of rows) {
            const index = indexes.get(keyOf(row));
            if (index === undefined) appended.push(rowData(row));
            else if (JSON.stringify(existing[index]) !== JSON.stringify(row)) requests.push({ updateCells: {
              start: { sheetId: ids[name], rowIndex: index, columnIndex: 0 }, rows: [rowData(row)], fields: 'userEnteredValue'
            } });
          }
          if (appended.length) requests.push({ appendCells: { sheetId: ids[name], rows: appended, fields: 'userEnteredValue' } });
        }
        upsert('Listas_Docente', row => row[0], Object.values(db.sessions).map(s => [s.id, s.date, s.group, s.subject, s.status, s.updatedAt, JSON.stringify(s)]));
        upsert('Control_Lista', row => row[0], Object.entries(db.controls).map(([teacher, control]) => [teacher, JSON.stringify(control)]));
        upsert('Asistencias', row => `${row[0]}:${row[4]}`, Object.values(db.sessions).flatMap(s => s.students.map(a =>
          [s.id, s.date, s.group, s.subject, a.id, a.name, a.status, a.updatedAt || s.createdAt, s.teacher])));
        if (db.history.length) requests.push({ appendCells: { sheetId: ids.Historial_Lista,
          rows: db.history.map(rowData), fields: 'userEnteredValue' } });
        await withTimeout(
          sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests }
          }),
          requestTimeoutMs,
          'guardado de asistencias'
        );
        return result;
      });
      queue = task.catch(() => {});
      return task;
    }
  };
}

let ready;
async function getSheet() {
  if (!ready) ready = (async () => {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId || !process.env.KEY_FILE) throw new Error('Falta SPREADSHEET_ID o KEY_FILE');
    const auth = new google.auth.GoogleAuth({ keyFile: path.join(process.cwd(), 'src/credentials', process.env.KEY_FILE),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    let meta = await withTimeout(
      sheets.spreadsheets.get({ spreadsheetId }),
      15000,
      'metadatos de asistencias'
    );
    for (const name of Object.keys(SCHEMA)) {
      if (!meta.data.sheets.some(s => s.properties.title === name)) {
        try { await withTimeout(sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: {
          requests: [{ addSheet: { properties: { title: name } } }]
        } }), 15000, 'creación de hoja de asistencia'); } catch (error) {
          const check = await withTimeout(
            sheets.spreadsheets.get({ spreadsheetId }),
            15000,
            'verificación de hoja de asistencia'
          );
          if (!check.data.sheets.some(s => s.properties.title === name)) throw error;
        }
      }
      const check = await withTimeout(
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${name}'!A1:I1`
        }),
        15000,
        'encabezados de asistencia'
      );
      const header = check.data.values?.[0] || [];
      if (header.length && SCHEMA[name].some((label, i) => header[i] !== label)) throw new Error(`Encabezados incompatibles en ${name}`);
      if (!header.length) await withTimeout(
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${name}'!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [SCHEMA[name]] }
        }),
        15000,
        'creación de encabezados de asistencia'
      );
    }
    meta = await withTimeout(
      sheets.spreadsheets.get({ spreadsheetId }),
      15000,
      'identificadores de hojas de asistencia'
    );
    const ids = Object.fromEntries(meta.data.sheets.map(s => [s.properties.title, s.properties.sheetId]));
    return { sheets, spreadsheetId, ids };
  })().catch(error => { ready = undefined; throw error; });
  return ready;
}
export default createAttendanceStore(getSheet);
