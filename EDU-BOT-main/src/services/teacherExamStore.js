import path from 'node:path';
import { google } from 'googleapis';
import 'dotenv/config';

const SCHEMA = {
  Examenes: ['Grupo', 'Materia', 'Periodo', 'Folio', 'Nombre alumno', 'Primer parcial', 'Segundo parcial', 'Actualización UTC', 'Docente'],
  Control_Examenes: ['Grupo', 'Contexto'],
  Historial_Examenes: ['Fecha UTC', 'Docente', 'Grupo', 'Folio', 'Anterior', 'Nuevo', 'Acción', 'Id mensaje']
};
const lastColumn = name => String.fromCharCode(64 + SCHEMA[name].length);
const columnsFor = name => `A:${lastColumn(name)}`;

const cell = value => ({
  userEnteredValue: typeof value === 'number'
    ? { numberValue: value }
    : { stringValue: String(value ?? '') }
});
const rowData = values => ({ values: values.map(cell) });

// La pestaña Examenes es la fuente que edita el docente. El contexto sincronizado
// es lo que consulta el alumno, así una edición no se publica hasta sincronizar.
export function createExamStore(getSheet) {
  let queue = Promise.resolve();

  return {
    transact(work) {
      const task = queue.then(async () => {
        const { sheets, spreadsheetId, ids } = await getSheet();
        const names = Object.keys(SCHEMA);
        const response = await sheets.spreadsheets.values.batchGet({
          spreadsheetId,
          ranges: names.map(name => `'${name}'!${columnsFor(name)}`)
        });
        const tables = Object.fromEntries(names.map((name, index) => [
          name,
          response.data.valueRanges[index].values || []
        ]));

        const db = { rows: [], control: {}, history: [] };
        for (const [index, row] of tables.Examenes.slice(1).entries()) {
          if (!row.some(value => String(value ?? '').trim())) continue;
          db.rows.push({
            group: String(row[0] ?? '').trim(),
            subject: String(row[1] ?? '').trim(),
            period: String(row[2] ?? '').trim(),
            id: String(row[3] ?? '').trim().toUpperCase(),
            name: String(row[4] ?? '').trim(),
            p1: row[5] ?? '',
            p2: row[6] ?? '',
            updatedAt: String(row[7] ?? ''),
            teacher: String(row[8] ?? ''),
            rowIndex: index + 1
          });
        }
        for (const row of tables.Control_Examenes.slice(1)) {
          if (!row[0]) continue;
          try {
            db.control[row[0]] = row[1] ? JSON.parse(row[1]) : {};
          } catch {
            throw new Error(`Contexto inválido en Control_Examenes para ${row[0]}`);
          }
        }
        db.seen = new Set(tables.Historial_Examenes.slice(1).map(row => row[7]).filter(Boolean));

        const before = JSON.stringify({ rows: db.rows, control: db.control });
        const result = await work(db);
        if (before === JSON.stringify({ rows: db.rows, control: db.control }) && !db.history.length) {
          return result;
        }

        const requests = [];
        function upsert(name, keyOf, rows) {
          const existing = tables[name];
          const indexes = new Map(existing.slice(1).map((row, index) => [keyOf(row), index + 1]));
          const appended = [];
          for (const row of rows) {
            const index = indexes.get(keyOf(row));
            if (index === undefined) {
              appended.push(rowData(row));
              continue;
            }
            const current = existing[index].map(value => String(value ?? ''));
            const next = row.map(value => String(value ?? ''));
            if (JSON.stringify(current) !== JSON.stringify(next)) {
              requests.push({
                updateCells: {
                  start: { sheetId: ids[name], rowIndex: index, columnIndex: 0 },
                  rows: [rowData(row)],
                  fields: 'userEnteredValue'
                }
              });
            }
          }
          if (appended.length) {
            requests.push({
              appendCells: { sheetId: ids[name], rows: appended, fields: 'userEnteredValue' }
            });
          }
        }

        upsert('Examenes', row => Array.isArray(row)
          ? `${row[0]}|${row[1]}|${row[2]}|${row[3]}`
          : `${row.group}|${row.subject}|${row.period}|${row.id}`, db.rows.map(row => [
          row.group, row.subject, row.period, row.id, row.name, row.p1, row.p2, row.updatedAt, row.teacher
        ]));
        upsert('Control_Examenes', row => row[0], Object.entries(db.control).map(([group, context]) => [
          group, JSON.stringify(context)
        ]));
        if (db.history.length) {
          requests.push({
            appendCells: {
              sheetId: ids.Historial_Examenes,
              rows: db.history.map(rowData),
              fields: 'userEnteredValue'
            }
          });
        }
        if (requests.length) {
          await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
        }
        return result;
      });
      queue = task.catch(() => {});
      return task;
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
      for (const name of Object.keys(SCHEMA)) {
        if (!meta.data.sheets.some(sheet => sheet.properties.title === name)) {
          try {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: { requests: [{ addSheet: { properties: { title: name } } }] }
            });
          } catch (error) {
            const check = await sheets.spreadsheets.get({ spreadsheetId });
            if (!check.data.sheets.some(sheet => sheet.properties.title === name)) throw error;
          }
        }
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${name}'!A1:${lastColumn(name)}1`
        });
        const header = response.data.values?.[0] || [];
        if (header.length && SCHEMA[name].some((label, index) => header[index] !== label)) {
          if (name === 'Examenes' && header[1] === 'Periodo') {
            throw new Error('La pestaña Examenes tiene el formato anterior sin Materia. Migra o elimina esa pestaña antes de continuar.');
          }
          throw new Error(`Encabezados incompatibles en ${name}`);
        }
        if (!header.length) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${name}'!A1`,
            valueInputOption: 'RAW',
            requestBody: { values: [SCHEMA[name]] }
          });
        }
      }
      meta = await sheets.spreadsheets.get({ spreadsheetId });
      const ids = Object.fromEntries(meta.data.sheets.map(sheet => [
        sheet.properties.title,
        sheet.properties.sheetId
      ]));
      return { sheets, spreadsheetId, ids };
    })().catch(error => {
      ready = undefined;
      throw error;
    });
  }
  return ready;
}

export default createExamStore(getSheet);
