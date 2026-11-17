import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentRepository, PERIOD } from '../src/services/studentService.js';
import { createRegistrationFlow } from '../src/flows/studentRegistrationFlow.js';
import { samePhone } from '../src/utils/phone.js';
import config from '../src/config/env.js';

function fixture() {
  const rows = [['headers']];
  let fail = false;
  let failSend = false;
  const sheets = { spreadsheets: { values: {
    get: async () => ({ data: { values: rows.map(r => [...r]) } }),
    update: async request => {
      if (fail) { fail = false; throw new Error('Fallo simulado de Sheets'); }
      const match = /^'Alumnos'!K(\d+)$/.exec(request.range);
      assert.ok(match); assert.equal(request.valueInputOption, 'RAW');
      rows[Number(match[1]) - 1][10] = request.requestBody.values[0][0];
    },
    append: async request => {
      assert.equal(request.valueInputOption, 'RAW');
      if (fail) { fail = false; throw new Error('Fallo simulado de Sheets'); }
      rows.push(...request.requestBody.values);
    }
  } } };
  const repository = createStudentRepository(async () => ({ sheets, spreadsheetId: 'test' }));
  const sent = [];
  const flow = createRegistrationFlow({ repository, adminNumber: '5219381949915', send: async (phone, payload) => {
    if (failSend) { failSend = false; throw new Error('Fallo simulado de WhatsApp'); }
    sent.push({ phone, payload });
  } });
  return { rows, repository, sent, flow, failNext: () => { fail = true; }, failNextSend: () => { failSend = true; } };
}
async function enroll(f, phone, names = 'María Fernanda', shared = false) {
  const input = ['registrarme', ...(shared ? ['sí'] : []), '5A LCM', 'Hernández', 'López', names, 'sí'];
  for (const [i, message] of input.entries()) await f.flow(phone, message, `${phone}-${names}-${i}`);
}

test('dual conserva registro, oculta de listas activas y permite consultar y reactivar', async () => {
  const f = fixture(); await enroll(f, '521111');
  const admin = '5219381949915'; const before = [...f.rows[1]];
  await f.flow('521111', 'dual EDU-5ALCM-001'); assert.equal(f.rows[1][10], 'Activo');
  await f.flow(admin, 'dual EDU-5ALCM-001');
  assert.deepEqual(f.rows[1], before.map((v, i) => i === 10 ? 'Dual' : v));
  await f.flow(admin, 'lista 5A LCM'); assert.doesNotMatch(f.sent.at(-1).payload.text.body, /Hernández/);
  await f.flow(admin, 'alumnos duales 5A LCM'); assert.match(f.sent.at(-1).payload.text.body, /EDU-5ALCM-001/);
  await f.flow(admin, 'dual EDU-5ALCM-001'); assert.equal(f.rows.length, 2);
  await f.flow(admin, 'activar alumno EDU-5ALCM-001'); assert.deepEqual(f.rows[1], before);
  await f.flow(admin, 'lista 5A LCM'); assert.match(f.sent.at(-1).payload.text.body, /Hernández/);
  f.failNext(); await f.flow(admin, 'dual EDU-5ALCM-001'); assert.equal(f.rows[1][10], 'Activo');
  await f.flow(admin, 'dual EDU-5ALCM-001'); assert.equal(f.rows[1][10], 'Dual');
  await f.flow(admin, 'dual EDU-NO-999'); assert.match(f.sent.at(-1).payload.text.body, /No encontré/);
});
test('alta: conserva nombres, grupo y folio; no duplica al compartir el mismo registro', async () => {
  const f = fixture();
  await enroll(f, '521111');
  let students = await f.repository.list();
  assert.equal(students.length, 1);
  assert.equal(students[0].fullName, 'Hernández López María Fernanda');
  assert.equal(students[0].period, PERIOD);
  assert.equal(students[0].id, 'EDU-5ALCM-001');
  await enroll(f, '521111', 'María Fernanda', true);
  students = await f.repository.list();
  assert.equal(students.length, 1);
});
test('un teléfono compartido permite dos alumnos con folios diferentes; No no agrega otro', async () => {
  const f = fixture();
  await enroll(f, '521111');
  await enroll(f, '521111', 'José', true);
  const students = await f.repository.list();
  assert.equal(students.length, 2);
  assert.notEqual(students[0].id, students[1].id);
  assert.equal(students[1].shared, true);
  await f.flow('521111', 'registrarme');
  await f.flow('521111', 'no');
  assert.equal((await f.repository.list()).length, 2);
});
test('fallo al guardar mantiene confirmación para reintentar sin anunciar éxito', async () => {
  const f = fixture();
  f.failNext();
  await enroll(f, '521111');
  assert.equal(f.rows.length, 1);
  assert.match(f.sent.at(-1).payload.text.body, /No pude completar/);
  await f.flow('521111', 'sí');
  assert.equal(f.rows.length, 2);
});
test('consultas exclusivas del docente y conteos por alumno, no por teléfono', async () => {
  const f = fixture();
  await enroll(f, '521111');
  await enroll(f, '521111', 'José', true);
  await f.flow('stranger', 'lista 5A LCM');
  assert.match(f.sent.at(-1).payload.text.body, /únicamente para el docente/);
  await f.flow('5219381949915', 'mis grupos');
  assert.match(f.sent.at(-1).payload.text.body, /5A LCM: 2/);
  assert.match(f.sent.at(-1).payload.text.body, /Total: 2 alumnos/);
  await f.flow('5219381949915', 'lista 5A LCM');
  assert.match(f.sent.at(-1).payload.text.body, /Hernández López José/);
});
test('mensajes repetidos no avanzan dos pasos; permite omitir segundo apellido y cancelar', async () => {
  const f = fixture();
  await f.flow('521111', 'registrarme', '1');
  await f.flow('521111', '3A EV', '2');
  await f.flow('521111', 'García', '3');
  await f.flow('521111', 'García', '3');
  await f.flow('521111', 'omitir', '4');
  await f.flow('521111', 'Ángel', '5');
  await f.flow('521111', 'sí', '6');
  const student = (await f.repository.list())[0];
  assert.equal(student.fullName, 'García Ángel');
  await f.flow('other', 'registrarme');
  await f.flow('other', 'cancelar');
  assert.equal(await f.flow('other', 'hola'), false);
});
test('altas concurrentes: la misma solicitud se guarda una vez y folios no colisionan', async () => {
  const f = fixture();
  const student = { phone: '111', surname: 'García', secondSurname: '', names: 'Ana', group: '5A CM', requestId: 'one' };
  const results = await Promise.all([f.repository.register(student), f.repository.register(student),
    f.repository.register({ ...student, names: 'Luis', requestId: 'two' })]);
  assert.equal(f.rows.length, 3);
  assert.equal(results[0].student.id, results[1].student.id);
  assert.notEqual(results[0].student.id, results[2].student.id);
});
test('grupo inválido y fórmulas en nombres no se aceptan; confirmar No permite corregir', async () => {
  const f = fixture();
  await f.flow('111', 'registrarme');
  await f.flow('111', '9Z');
  assert.equal(f.sent.at(-1).payload.interactive.type, 'list');
  await f.flow('111', '5A CM');
  await f.flow('111', '=IMPORTXML()');
  assert.match(f.sent.at(-1).payload.text.body, /únicamente letras/);
  for (const message of ['Pérez', 'omitir', 'Ana', 'no', '3A EV', 'Pérez', 'omitir', 'Ana', 'sí']) await f.flow('111', message);
  assert.equal((await f.repository.list())[0].group, '3A EV');
});
test('si WhatsApp falla tras guardar, el reintento recupera el mismo folio sin duplicar', async () => {
  const f = fixture();
  for (const message of ['registrarme', '5A CM', 'Pérez', 'omitir', 'Ana']) await f.flow('111', message);
  f.failNextSend();
  await f.flow('111', 'sí');
  const id = (await f.repository.list())[0].id;
  await f.flow('111', 'sí');
  assert.equal(f.rows.length, 2);
  assert.match(f.sent.at(-1).payload.text.body, new RegExp(id));
});
test('listas extensas se dividen sin perder alumnos', async () => {
  const f = fixture();
  for (let i = 0; i < 100; i++) await f.repository.register({ phone: String(i), surname: 'Pérez', secondSurname: '', names: `Alumno ${i}`, group: '5A CM', requestId: String(i) });
  await f.flow('5219381949915', 'lista 5A CM');
  assert.ok(f.sent.length > 1);
  assert.ok(f.sent.every(m => m.payload.text.body.length <= 3500));
  assert.equal(f.sent.map(m => m.payload.text.body).join('\n').match(/Folio:/g).length, 100);
});
test('consecutivos por grupo consideran el máximo guardado y conservan folios antiguos', async () => {
  const f = fixture();
  const student = { phone: '111', surname: 'García', secondSurname: '', names: 'Ana', group: '5A MAM', requestId: 'first' };
  const first = await f.repository.register(student);
  assert.equal(first.student.id, 'EDU-5AMAM-001');
  f.rows[1][0] = 'EDU-5AMAM-099';
  f.rows[1][10] = 'Baja';
  const next = await f.repository.register({ ...student, names: 'Luis', requestId: 'next' });
  assert.equal(next.student.id, 'EDU-5AMAM-100');
  const other = await f.repository.register({ ...student, names: 'José', group: '3A EV', requestId: 'other' });
  assert.equal(other.student.id, 'EDU-3AEV-001');
  f.rows[3][0] = 'EDU-OLD-UUID';
  const retry = await f.repository.register({ ...student, names: 'José', group: '3A EV', requestId: 'other' });
  assert.equal(retry.student.id, 'EDU-OLD-UUID');
});
test('administrador nuevo: acepta ambos formatos y rechaza los números anteriores', async () => {
  assert.equal(config.ADMIN_NUMBER, '5219381949915');
  assert.ok(samePhone('529381949915', config.ADMIN_NUMBER));
  assert.ok(samePhone('+52 938 194 9915', config.ADMIN_NUMBER));
  for (const old of ['5219618309982', '5219381800247', '', '529381949916']) assert.equal(samePhone(old, config.ADMIN_NUMBER), false);
  const f = fixture();
  await f.flow('529381949915', 'mis grupos');
  assert.match(f.sent.at(-1).payload.text.body, /Total: 0 alumnos/);
  await f.flow('5219618309982', 'mis grupos');
  assert.match(f.sent.at(-1).payload.text.body, /únicamente para el docente/);
});
