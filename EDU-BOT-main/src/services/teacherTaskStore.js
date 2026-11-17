import path from 'node:path';
import { google } from 'googleapis';
import 'dotenv/config';

const SCHEMA = {
  Tareas_Grupo: ['Clave', 'Creación UTC', 'Grupo', 'Materia', 'Nombre', 'Valor', 'Datos de tarea'],
  Control_Tareas: ['Docente', 'Contexto'],
  Entregas: ['Clave tarea', 'Grupo', 'Materia', 'Nombre tarea', 'Folio', 'Nombre alumno', 'Estado', 'Puntos', 'Actualización UTC', 'Docente'],
  Historial_Entregas: ['Fecha UTC', 'Docente', 'Clave tarea', 'Folio', 'Anterior', 'Nuevo', 'Acción', 'Id mensaje']
};
const cell = value => ({ userEnteredValue: typeof value === 'number' ? { numberValue: value } : { stringValue: String(value ?? '') } });
const rowData = values => ({ values: values.map(cell) });

// Una sola instancia del bot: Sheets no ofrece compare-and-swap entre procesos.
// La sesión, la asistencia, el historial y el recibo se guardan en un batch atómico.
export function createTaskStore(getSheet) {
  let queue = Promise.resolve();
  return {
    transact(work) {
      const task = queue.then(async () => {
        const { sheets, spreadsheetId, ids } = await getSheet();
        const names = Object.keys(SCHEMA);
        const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId,
          ranges: names.map(name => `'${name}'!A:J`) });
        const tables = Object.fromEntries(names.map((name, i) => [name, response.data.valueRanges[i].values || []]));
        const db = { sessions: {}, controls: {}, history: [] };
        for (const row of tables.Tareas_Grupo.slice(1)) if (row[0]) db.sessions[row[0]] = JSON.parse(row[6]);
        for (const row of tables.Control_Tareas.slice(1)) if (row[0]) db.controls[row[0]] = JSON.parse(row[1]);
        db.seen = new Set(tables.Historial_Entregas.slice(1).map(row => row[7]).filter(Boolean));
        db.deliveryRows = tables.Entregas.slice(1);
        const previousSessions = structuredClone(db.sessions);
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
            else if (JSON.stringify(existing[index].map(String)) !== JSON.stringify(row.map(value => String(value ?? '')))) requests.push({ updateCells: {
              start: { sheetId: ids[name], rowIndex: index, columnIndex: 0 }, rows: [rowData(row)], fields: 'userEnteredValue'
            } });
          }
          if (appended.length) requests.push({ appendCells: { sheetId: ids[name], rows: appended, fields: 'userEnteredValue' } });
        }
        upsert('Tareas_Grupo', row => row[0], Object.values(db.sessions).map(s => [s.id, s.createdAt, s.group, s.subject, s.name, s.value, JSON.stringify(s)]));
        upsert('Control_Tareas', row => row[0], Object.entries(db.controls).map(([teacher, control]) => [teacher, JSON.stringify(control)]));
        upsert('Entregas', row => `${row[0]}:${row[4]}`, Object.values(db.sessions).flatMap(s => s.students.filter(a =>
          JSON.stringify(a) !== JSON.stringify(previousSessions[s.id]?.students.find(old => old.id === a.id))).map(a =>
          [s.id, s.group, s.subject, s.name, a.id, a.name, a.status, a.points ?? '', a.updatedAt || s.createdAt, s.teacher])));
        if (db.history.length) requests.push({ appendCells: { sheetId: ids.Historial_Entregas,
          rows: db.history.map(rowData), fields: 'userEnteredValue' } });
        await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
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
    let meta = await sheets.spreadsheets.get({ spreadsheetId });
    for (const name of Object.keys(SCHEMA)) {
      if (!meta.data.sheets.some(s => s.properties.title === name)) {
        try { await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: {
          requests: [{ addSheet: { properties: { title: name } } }]
        } }); } catch (error) {
          const check = await sheets.spreadsheets.get({ spreadsheetId });
          if (!check.data.sheets.some(s => s.properties.title === name)) throw error;
        }
      }
      const check = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${name}'!A1:J1` });
      const header = check.data.values?.[0] || [];
      if (header.length && SCHEMA[name].some((label, i) => header[i] !== label)) throw new Error(`Encabezados incompatibles en ${name}`);
      if (!header.length) await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${name}'!A1`, valueInputOption: 'RAW', requestBody: { values: [SCHEMA[name]] } });
    }
    meta = await sheets.spreadsheets.get({ spreadsheetId });
    const ids = Object.fromEntries(meta.data.sheets.map(s => [s.properties.title, s.properties.sheetId]));
    return { sheets, spreadsheetId, ids };
  })().catch(error => { ready = undefined; throw error; });
  return ready;
}
export default createTaskStore(getSheet);
