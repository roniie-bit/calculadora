import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentRepository, PERIOD } from '../src/services/studentService.js';
import { createStudentPhoneFlow } from '../src/flows/studentPhoneFlow.js';
import { createStudentRecordFlow } from '../src/flows/studentRecordFlow.js';
import { parseStudentPhone } from '../src/utils/phone.js';
import { readFile } from 'node:fs/promises';
const ADMIN = '5219381949915', ID = 'EDU-5AMAM-001', OLD = '5219381111111', NEW = '529382222222';

function fixture() {
  const rows = [['header'], [ID, '5A MAM', 'Pérez', '', 'Ana', 'Pérez Ana', OLD, 'No', 'fecha', PERIOD, 'Dual', 'original-request']];
  const history = [];
  const metadata = [{ properties: { title: 'Alumnos', sheetId: 1 } }];
  let fail = false, ambiguous = false, failSend = false, now = 0;
  const sheets = { spreadsheets: {
    get: async () => ({ data: { sheets: structuredClone(metadata) } }),
    values: { get: async ({ range }) => ({ data: { values: structuredClone(range.includes('Historial') ? history : rows) } }) },
    batchUpdate: async ({ requestBody }) => {
      if (requestBody.requests[0].addSheet) { metadata.push({ properties: { title: 'Historial_Telefonos', sheetId: 2 } }); return; }
      if (fail) { fail = false; throw new Error('Fallo antes de guardar'); }
      assert.equal(requestBody.requests.length, 2);
      const [update, append] = requestBody.requests;
      assert.equal(update.updateCells.start.columnIndex, 6);
      assert.equal(update.updateCells.start.sheetId, 1);
      assert.equal(update.updateCells.rows[0].values.length, 1);
      rows[update.updateCells.start.rowIndex][6] = update.updateCells.rows[0].values[0].userEnteredValue.stringValue;
      history.push(...append.appendCells.rows.map(r => r.values.map(c => c.userEnteredValue.stringValue)));
      if (ambiguous) { ambiguous = false; throw new Error('Respuesta perdida después de guardar'); }
    }
  } };
  const repository = createStudentRepository(async () => ({ sheets, spreadsheetId: 'test' }));
  const sent = [];
  const options = { repository, adminNumber: ADMIN, now: () => now, send: async (phone, payload) => {
    if (failSend) { failSend = false; throw new Error('WhatsApp simulado'); } sent.push(payload);
  } };
  let flow = createStudentPhoneFlow(options);
  return { rows, history, repository, sent, run: (raw, phone = ADMIN) => flow(phone, raw, 'message'),
    button: action => sent.findLast(p => p.interactive)?.interactive.action.buttons.find(b => b.reply.id.endsWith(`:${action}`)).reply.id,
    fail: () => { fail = true; }, ambiguous: () => { ambiguous = true; }, failSend: () => { failSend = true; },
    expire: () => { now += 600001; }, restart: () => { flow = createStudentPhoneFlow(options); } };
}

test('valida teléfonos sin corregir entradas ambiguas y normaliza 10, 52, +52 y 521', () => {
  for (const value of ['9382222222', '529382222222', '+529382222222', '5219382222222', '+5219382222222']) assert.equal(parseStudentPhone(value), NEW);
  for (const value of ['', '938222222', '93822222222', '938 222 2222', '938-222-2222', 'tel9382222222', '0000000000', '+19382222222', '=529382222222', '529382222222 ext 1']) assert.equal(parseStudentPhone(value), null);
});

test('confirma el folio y cambia solo WhatsApp, con historial atómico e idempotencia', async () => {
  const f = fixture(); const before = structuredClone(f.rows);
  await f.run(`cambiar teléfono ${ID} 9382222222`);
  assert.deepEqual(f.rows, before);
  assert.match(f.sent.at(-1).interactive.body.text, /Pérez Ana/);
  assert.match(f.sent.at(-1).interactive.body.text, /Nuevo: \+529382222222/);
  const button = f.button('guardar'); await f.run(button);
  assert.deepEqual(f.rows[1], before[1].map((v, i) => i === 6 ? NEW : v));
  assert.equal(f.history.length, 2); assert.deepEqual(f.history[1].slice(1, 5), [ADMIN, ID, OLD, NEW]);
  await f.run(button); assert.equal(f.history.length, 2);
  await f.run(`cambiar telefono ${ID} 9382222222`); assert.match(f.sent.at(-1).text.body, /ya tiene ese número/);
});

test('solo administrador, entradas inválidas, cancelar, vencimiento, reinicio y botones anteriores', async () => {
  const f = fixture();
  await f.run(`cambiar telefono ${ID} 9382222222`, OLD); assert.equal(f.sent.at(-1).type, 'text');
  for (const number of ['938 222 2222', '938222222', '9382222222abc', '=9382222222']) {
    await f.run(`cambiar telefono ${ID} ${number}`); assert.match(f.sent.at(-1).text.body, /10 dígitos/);
  }
  await f.run(`cambiar telefono ${ID} 9381949915`); assert.match(f.sent.at(-1).text.body, /administrador/);
  await f.run('cambiar telefono EDU-5AMAM-999 9382222222'); assert.match(f.sent.at(-1).text.body, /registro único/);
  await f.run(`cambiar telefono ${ID} 9382222222`); const old = f.button('guardar');
  await f.run(`cambiar telefono ${ID} 9383333333`); await f.run(old); assert.equal(f.rows[1][6], OLD);
  await f.run(f.button('cancelar')); assert.equal(f.rows[1][6], OLD);
  await f.run(`cambiar telefono ${ID} 9382222222`); const expired = f.button('guardar'); f.expire(); await f.run(expired);
  assert.equal(f.rows[1][6], OLD);
  await f.run(`cambiar telefono ${ID} 9382222222`); const restart = f.button('guardar'); f.restart(); await f.run(restart);
  assert.equal(f.rows[1][6], OLD); assert.equal(f.history.length, 0);
});

test('rechaza cambios concurrentes del alumno o de número compartido; avisa al compartir', async () => {
  const f = fixture(); await f.run(`cambiar telefono ${ID} 9382222222`);
  f.rows[1][6] = '529384444444'; await f.run(f.button('guardar'));
  assert.equal(f.rows[1][6], '529384444444'); assert.equal(f.history.length, 0);
  await f.run(`cambiar telefono ${ID} 9382222222`);
  f.rows.push([...f.rows[1]]); f.rows[2][0] = 'EDU-5AMAM-002'; f.rows[2][6] = NEW;
  await f.run(f.button('guardar')); assert.equal(f.rows[1][6], '529384444444');
  await f.run(`cambiar telefono ${ID} 9382222222`); assert.match(f.sent.at(-1).interactive.body.text, /comparten ese teléfono/);
  await f.run(f.button('guardar')); assert.equal(f.rows[1][6], NEW); assert.equal(f.rows[2][6], NEW);
});

test('errores antes o después del guardado permiten reintentar sin duplicar historial', async () => {
  const f = fixture(); await f.run(`cambiar telefono ${ID} 9382222222`); const button = f.button('guardar');
  f.fail(); await f.run(button); assert.equal(f.rows[1][6], OLD);
  f.ambiguous(); await f.run(button); assert.equal(f.rows[1][6], NEW); assert.equal(f.history.length, 2);
  await f.run(button); assert.equal(f.history.length, 2); assert.match(f.sent.at(-1).text.body, /actualizado/);
});

test('no escribe ante encabezado de historial incompatible ni filas duplicadas; conserva fila correcta tras huecos', async () => {
  const f = fixture(); await f.run(`cambiar telefono ${ID} 9382222222`);
  const button = f.button('guardar');
  f.history.push(['encabezado incorrecto']); await f.run(button); assert.equal(f.rows[1][6], OLD);
  f.history.length = 0; f.rows.splice(1, 0, []);
  await f.run(button); assert.equal(f.rows[2][6], NEW); assert.deepEqual(f.rows[1], []);
  const g = fixture(); await g.run(`cambiar telefono ${ID} 9382222222`);
  g.rows.push([...g.rows[1]]); await g.run(g.button('guardar'));
  assert.equal(g.rows[1][6], OLD); assert.equal(g.history.length, 0);
});

test('si falla WhatsApp después de guardar no duplica ni revierte la actualización', async () => {
  const f = fixture(); await f.run(`cambiar telefono ${ID} 9382222222`); const button = f.button('guardar');
  f.failSend(); await f.run(button); assert.equal(f.rows[1][6], NEW);
  await f.run(button); assert.equal(f.history.length, 2);
  await f.run(`cambiar telefono ${ID} 9382222222`); assert.match(f.sent.at(-1).text.body, /ya tiene ese número/);
});

test('mi registro deja de aceptar el número anterior y acepta el nuevo', async () => {
  const f = fixture(); await f.run(`cambiar telefono ${ID} 9382222222`); await f.run(f.button('guardar'));
  const messages = []; let reads = 0;
  const store = { transact: async work => { reads++; return work({ sessions: {} }); } };
  const query = createStudentRecordFlow({ students: f.repository, taskStore: store, attendanceStore: store, adminNumber: ADMIN, send: async (phone, payload) => messages.push(payload.text.body) });
  await query(OLD, `mi registro ${ID}`); assert.equal(reads, 0);
  await query('5219382222222', `mi registro ${ID}`); assert.equal(reads, 2); assert.match(messages.join('\n'), /Pérez Ana/);
  const source = await readFile(new URL('../src/services/messageHandler.js', import.meta.url), 'utf8');
  assert.ok(source.indexOf('await this.studentPhoneFlow(') < source.lastIndexOf('await this.teacherTaskFlow('));
});
