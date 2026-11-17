import path from 'node:path';
import { google } from 'googleapis';
import 'dotenv/config';
import { parseStudentPhone, samePhone } from '../utils/phone.js';
import { withTimeout } from '../utils/withTimeout.js';

export const GROUPS = ['5A MAM', '5A LCM', '5B LCM', '5A CM', '5B CM', '5A PABM', '3A EV'];
export const PERIOD = '2026-08 / 2027-01';
const HEADERS = ['Folio', 'Grupo', 'Primer apellido', 'Segundo apellido', 'Nombres', 'Nombre completo', 'WhatsApp', 'Dispositivo compartido', 'Fecha de registro', 'Periodo', 'Estado', 'Id de solicitud'];
export const normalize = (text = '') => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();

// Serializa las operaciones locales y vuelve a consultar antes de cada alta.
export function createStudentRepository(
  getSheet,
  { requestTimeoutMs = 15000 } = {}
) {
  let queue = Promise.resolve();
  const exclusive = (work) => {
    const result = queue.then(work);
    queue = result.catch(() => {});
    return result;
  };
  async function list() {
    const { sheets, spreadsheetId } = await getSheet();
    const response = await withTimeout(
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "'Alumnos'!A:L"
      }),
      requestTimeoutMs,
      'lectura de alumnos'
    );
    return (response.data.values || []).slice(1).filter(r => r[0]).map(r => ({
      id: r[0], group: r[1], surname: r[2], secondSurname: r[3] || '', names: r[4],
      fullName: r[5], phone: String(r[6] || ''), shared: r[7] === 'Sí',
      createdAt: r[8], period: r[9], status: r[10], requestId: r[11]
    }));
  }
  async function register(student) {
    return exclusive(async () => {
      const rows = await list();
      const previous = rows.find(r => r.requestId === student.requestId);
      if (previous) return { student: previous, existing: true };
      const fullName = [student.surname, student.secondSurname, student.names].filter(Boolean).join(' ');
      const duplicate = rows.find(r => r.phone === student.phone && r.period === PERIOD &&
        normalize(r.fullName) === normalize(fullName));
      if (duplicate) return { student: duplicate, existing: true };
      if (!GROUPS.includes(student.group)) throw new Error('Grupo no válido');
      const prefix = `EDU-${student.group.replace(/\s/g, '')}-`;
      const highest = rows.reduce((max, row) => {
        if (!row.id.startsWith(prefix)) return max;
        const suffix = row.id.slice(prefix.length);
        return /^\d+$/.test(suffix) ? Math.max(max, Number(suffix)) : max;
      }, 0);
      const id = `${prefix}${String(highest + 1).padStart(3, '0')}`;
      const saved = { ...student, fullName, id, createdAt: new Date().toISOString(), period: PERIOD, status: 'Activo' };
      const { sheets, spreadsheetId } = await getSheet();
      await withTimeout(
        sheets.spreadsheets.values.append({
          spreadsheetId, range: "'Alumnos'!A:L", valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [[saved.id, saved.group, saved.surname, saved.secondSurname, saved.names,
            saved.fullName, saved.phone, saved.shared ? 'Sí' : 'No', saved.createdAt, saved.period, saved.status, saved.requestId]] }
        }),
        requestTimeoutMs,
        'registro de alumno'
      );
      return { student: saved, existing: false };
    });
  }
  async function setStatus(id, status) {
    if (!['Dual', 'Activo'].includes(status)) throw new Error('Estado no válido');
    return exclusive(async () => {
      const { sheets, spreadsheetId } = await getSheet();
      const response = await withTimeout(
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "'Alumnos'!A:L"
        }),
        requestTimeoutMs,
        'lectura de alumnos para actualización'
      );
      const rows = response.data.values || [];
      const index = rows.findIndex((r, i) => i > 0 && r[0] === id && r[9] === PERIOD);
      if (index < 0) return null;
      const row = rows[index];
      if (!['Activo', 'Dual'].includes(row[10])) throw new Error('Solo se pueden cambiar alumnos activos o duales');
      if (row[10] !== status) await withTimeout(
        sheets.spreadsheets.values.update({
          spreadsheetId, range: `'Alumnos'!K${index + 1}`, valueInputOption: 'RAW', requestBody: { values: [[status]] }
        }),
        requestTimeoutMs,
        'actualización de estado de alumno'
      );
      return { id, fullName: row[5], group: row[1], status };
    });
  }
  async function changePhone({ student, newPhone, peers, teacher, requestId, messageId }) {
    if (parseStudentPhone(newPhone) !== newPhone || !requestId || !teacher) throw new Error('Cambio de teléfono no válido');
    return exclusive(async () => {
      const { sheets, spreadsheetId } = await getSheet();
      const metadata = await withTimeout(
        sheets.spreadsheets.get({ spreadsheetId }),
        requestTimeoutMs,
        'metadatos para cambio de teléfono'
      );
      const studentSheet = metadata.data.sheets.find(s => s.properties.title === 'Alumnos');
      if (!studentSheet) throw new Error('No existe Alumnos');
      const historyName = 'Historial_Telefonos';
      let historySheet = metadata.data.sheets.find(s => s.properties.title === historyName);
      if (!historySheet) {
        await withTimeout(
          sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests: [{ addSheet: { properties: { title: historyName } } }] }
          }),
          requestTimeoutMs,
          'creación de historial de teléfonos'
        );
        const updated = await withTimeout(
          sheets.spreadsheets.get({ spreadsheetId }),
          requestTimeoutMs,
          'verificación de historial de teléfonos'
        );
        historySheet = updated.data.sheets.find(s => s.properties.title === historyName);
      }
      const headers = ['Fecha UTC', 'Docente', 'Folio', 'Anterior', 'Nuevo', 'Id cambio', 'Id mensaje'];
      const history = await withTimeout(
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${historyName}'!A:G`
        }),
        requestTimeoutMs,
        'lectura de historial de teléfonos'
      );
      const historyRows = history.data.values || [];
      if (historyRows.length && headers.some((h, i) => historyRows[0][i] !== h)) throw new Error('Encabezados incompatibles en historial de teléfonos');
      const response = await withTimeout(
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "'Alumnos'!A:L"
        }),
        requestTimeoutMs,
        'lectura de alumnos para cambio de teléfono'
      );
      const rows = response.data.values || [];
      const indexes = rows.flatMap((r, i) => i > 0 && r[0] === student.id && r[9] === PERIOD ? [i] : []);
      if (indexes.length !== 1) return { saved: false };
      const index = indexes[0], row = rows[index];
      const savedStudent = { ...student, phone: newPhone };
      if (historyRows.slice(1).some(r => r[5] === requestId && r[2] === student.id && r[4] === newPhone)) {
        return { saved: row[6] === newPhone, student: savedStudent };
      }
      const currentPeers = rows.slice(1).filter(r => r[0] && r[0] !== student.id && r[9] === PERIOD && samePhone(r[6], newPhone)).map(r => r[0]).sort();
      if (String(row[6] || '') !== student.phone || row[1] !== student.group || row[5] !== student.fullName || row[10] !== student.status ||
          JSON.stringify(currentPeers) !== JSON.stringify(peers)) return { saved: false };
      const cells = values => ({ values: values.map(value => ({ userEnteredValue: { stringValue: String(value ?? '') } })) });
      const audit = [new Date().toISOString(), teacher, student.id, student.phone, newPhone, requestId, messageId];
      // El teléfono y su historial se guardan en el mismo batch; no se reescribe la fila del alumno.
      await withTimeout(
        sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                updateCells: {
                  start: {
                    sheetId: studentSheet.properties.sheetId,
                    rowIndex: index,
                    columnIndex: 6
                  },
                  rows: [cells([newPhone])],
                  fields: 'userEnteredValue'
                }
              },
              {
                appendCells: {
                  sheetId: historySheet.properties.sheetId,
                  rows: [
                    ...(historyRows.length ? [] : [cells(headers)]),
                    cells(audit)
                  ],
                  fields: 'userEnteredValue'
                }
              }
            ]
          }
        }),
        requestTimeoutMs,
        'guardado de cambio de teléfono'
      );
      return { saved: true, student: savedStudent };
    });
  }
  return { list, register, setStatus, changePhone };
}

let sheetReady;
async function getStudentSheet() {
  if (!sheetReady) {
    sheetReady = (async () => {
      const spreadsheetId = process.env.SPREADSHEET_ID;
      if (!spreadsheetId || !process.env.KEY_FILE) throw new Error('Falta configurar SPREADSHEET_ID o KEY_FILE');
      const auth = new google.auth.GoogleAuth({
        keyFile: path.join(process.cwd(), 'src/credentials', process.env.KEY_FILE),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
      const metadata = await withTimeout(
        sheets.spreadsheets.get({ spreadsheetId }),
        15000,
        'metadatos de alumnos'
      );
      if (!metadata.data.sheets?.some(s => s.properties.title === 'Alumnos')) {
        try {
          await withTimeout(
            sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [{ addSheet: { properties: { title: 'Alumnos' } } }]
              }
            }),
            15000,
            'creación de hoja de alumnos'
          );
        } catch (error) {
          const check = await withTimeout(
            sheets.spreadsheets.get({ spreadsheetId }),
            15000,
            'verificación de hoja de alumnos'
          );
          if (!check.data.sheets?.some(s => s.properties.title === 'Alumnos')) throw error;
        }
      }
      const header = await withTimeout(
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "'Alumnos'!A1:L1"
        }),
        15000,
        'encabezados de alumnos'
      );
      const actual = header.data.values?.[0] || [];
      if (actual.length && HEADERS.some((h, i) => actual[i] !== h)) throw new Error('La pestaña Alumnos tiene un formato diferente');
      if (!actual.length) await withTimeout(
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "'Alumnos'!A1:L1",
          valueInputOption: 'RAW',
          requestBody: { values: [HEADERS] }
        }),
        15000,
        'creación de encabezados de alumnos'
      );
      return { sheets, spreadsheetId };
    })().catch(error => { sheetReady = undefined; throw error; });
  }
  return sheetReady;
}

export default createStudentRepository(getStudentSheet);
