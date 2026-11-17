import test from 'node:test';
import assert from 'node:assert/strict';
import { createExamStore } from '../src/services/teacherExamStore.js';
import { createTeacherExamFlow, parseExamGrade, planExamSync } from '../src/flows/teacherExamFlow.js';
import { createStudentRecordFlow } from '../src/flows/studentRecordFlow.js';
import { PERIOD } from '../src/services/studentService.js';
import { SUBJECTS } from '../src/flows/teacherAttendanceFlow.js';

const ADMIN = '5219381949915';
const STUDENT_PHONE = '5219380000001';

function fixture() {
  const names = ['Examenes', 'Control_Examenes', 'Historial_Examenes'];
  const tables = [
    [['Grupo', 'Materia', 'Periodo', 'Folio', 'Nombre alumno', 'Primer parcial', 'Segundo parcial', 'Actualización UTC', 'Docente']],
    [['Grupo', 'Contexto']],
    [['Fecha UTC', 'Docente', 'Grupo', 'Folio', 'Anterior', 'Nuevo', 'Acción', 'Id mensaje']]
  ];
  const batches = [];
  const sent = [];
  let failure = false;
  let sendFailure = false;
  let time = new Date('2026-10-18T15:00:00Z');
  const roster = [
    { id: 'EDU-5AMAM-001', fullName: 'Álvarez Ana', group: '5A MAM', period: PERIOD, status: 'Activo', phone: STUDENT_PHONE },
    { id: 'EDU-5AMAM-002', fullName: 'Pérez José', group: '5A MAM', period: PERIOD, status: 'Activo', phone: '5219380000002' },
    { id: 'EDU-5ALCM-001', fullName: 'García Luis', group: '5A LCM', period: PERIOD, status: 'Activo', phone: '5219380000003' }
  ];

  const sheets = {
    spreadsheets: {
      values: {
        batchGet: async () => ({
          data: { valueRanges: tables.map(values => ({ values: structuredClone(values) })) }
        })
      },
      batchUpdate: async ({ requestBody }) => {
        if (failure) {
          failure = false;
          throw new Error('Sheets simulado');
        }
        batches.push(requestBody.requests);
        for (const request of requestBody.requests) {
          const op = request.appendCells || request.updateCells;
          const index = request.appendCells ? op.sheetId : op.start.sheetId;
          const rows = op.rows.map(row => row.values.map(value =>
            value.userEnteredValue.stringValue ?? value.userEnteredValue.numberValue));
          if (request.appendCells) tables[index].push(...rows);
          else tables[index][op.start.rowIndex] = rows[0];
        }
      }
    }
  };
  const store = createExamStore(async () => ({
    sheets,
    spreadsheetId: 'test',
    ids: Object.fromEntries(names.map((name, index) => [name, index]))
  }));
  const send = async (_phone, payload) => {
    if (sendFailure) {
      sendFailure = false;
      throw new Error('WhatsApp simulado');
    }
    sent.push(payload);
  };
  const options = {
    store,
    students: { list: async () => structuredClone(roster) },
    send,
    adminNumber: ADMIN,
    now: () => time
  };
  let flow = createTeacherExamFlow(options);
  const recordFlow = createStudentRecordFlow({
    students: options.students,
    taskStore: { transact: async work => work({ sessions: {}, controls: {}, history: [] }) },
    attendanceStore: { transact: async work => work({ sessions: {}, controls: {}, history: [] }) },
    examStore: store,
    send,
    adminNumber: ADMIN
  });

  return {
    tables,
    batches,
    sent,
    roster,
    run: (raw, id = 'message') => flow(ADMIN, raw, id),
    outsider: raw => flow('5211111111111', raw, 'outsider'),
    record: raw => recordFlow(ADMIN, raw, 'record'),
    edit: (folio, p1, p2) => {
      const row = tables[0].find((value, index) => index > 0 && value[3] === folio);
      row[5] = p1;
      row[6] = p2;
    },
    row: folio => tables[0].find((value, index) => index > 0 && value[3] === folio),
    control: group => JSON.parse(tables[1].find((value, index) => index > 0 && value[0] === group)[1]),
    button: action => sent.findLast(payload => payload.interactive)
      .interactive.action.buttons.find(button => button.reply.id.endsWith(action)).reply.id,
    fail: () => { failure = true; },
    failSend: () => { sendFailure = true; },
    expire: () => { time = new Date(+time + 600001); },
    restart: () => { flow = createTeacherExamFlow(options); }
  };
}

test('crear examenes prepara una fila por alumno con ambos parciales en cero', async () => {
  const f = fixture();
  await f.run('crear examenes 5A MAM');
  assert.equal(f.tables[0].length, 3);
  assert.deepEqual(f.row('EDU-5AMAM-001').slice(3, 7), ['EDU-5AMAM-001', 'Álvarez Ana', 0, 0]);
  assert.deepEqual(f.row('EDU-5AMAM-002').slice(3, 7), ['EDU-5AMAM-002', 'Pérez José', 0, 0]);
  assert.equal(f.control('5A MAM').synced.length, 2);
  assert.match(f.sent.at(-1).text.body, /Pestaña Examenes preparada/);
});

test('un grupo con dos materias crea una fila independiente por materia', async () => {
  const f = fixture();
  await f.run('crear examenes 5A LCM');
  const rows = f.tables[0].filter((value, index) => index > 0 && value[0] === '5A LCM');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row[1]).sort(), [SUBJECTS.energia, SUBJECTS.organismos].sort());
  assert.ok(rows.every(row => row[3] === 'EDU-5ALCM-001' && row[5] === 0 && row[6] === 0));
  assert.equal(f.control('5A LCM').synced.length, 2);
});

test('la consulta no muestra ediciones manuales hasta sincronizar y conserva 0/0 como sin exámenes', async () => {
  const f = fixture();
  await f.run('crear examenes 5A MAM');
  f.edit('EDU-5AMAM-001', 5, 0);
  f.sent.length = 0;
  await f.record('mi registro EDU-5AMAM-001');
  assert.match(f.sent.map(payload => payload.text?.body || '').join('\n'), /Primer parcial: 0/);

  f.batches.length = 0;
  await f.run('sincronizar examenes');
  assert.equal(f.batches.length, 0);
  assert.equal(f.control('5A MAM').synced.find(a => a.id === 'EDU-5AMAM-001').p1, 0);
  await f.run(f.button('guardar'));
  assert.equal(f.control('5A MAM').synced.find(a => a.id === 'EDU-5AMAM-001').p1, 5);
  assert.equal(f.tables[2].length, 3);

  f.sent.length = 0;
  await f.record('mi registro EDU-5AMAM-001');
  const output = f.sent.map(payload => payload.text?.body || '').join('\n');
  assert.match(output, /Primer parcial: 5/);
  assert.match(output, /Segundo parcial: 0/);
  assert.match(output, /Primer parcial registrado/);
});

test('0 y 0 significa sin exámenes presentados', async () => {
  const f = fixture();
  await f.run('crear examenes 5A MAM');
  f.sent.length = 0;
  await f.record('mi registro EDU-5AMAM-001');
  assert.match(f.sent.map(payload => payload.text?.body || '').join('\n'), /Sin exámenes presentados/);
});

test('valores inválidos, folios ajenos y duplicados bloquean toda la sincronización', async () => {
  for (const mutate of [
    f => f.edit('EDU-5AMAM-001', 11, 0),
    f => f.edit('EDU-5AMAM-001', '=SUM(1)', 0),
    f => { f.tables[0][1][3] = 'EDU-5AMAM-999'; },
    f => { f.tables[0].push([...f.tables[0][1]]); }
  ]) {
    const f = fixture();
    await f.run('crear examenes 5A MAM');
    mutate(f);
    f.batches.length = 0;
    f.sent.length = 0;
    await f.run('sincronizar examenes');
    assert.equal(f.batches.length, 0);
    assert.match(f.sent.at(-1).text.body, /errores|Corrige/i);
    assert.ok(!f.sent.some(payload => payload.interactive));
  }
});

test('cancelar, cambio después de la vista previa y fallos no publican parcialmente', async () => {
  for (const mode of ['cancelar', 'cambio', 'fallo']) {
    const f = fixture();
    await f.run('crear examenes 5A MAM');
    f.edit('EDU-5AMAM-001', 5, 0);
    await f.run('sincronizar examenes');
    const button = f.button('guardar');
    if (mode === 'cancelar') await f.run(f.button('cancelar'));
    if (mode === 'cambio') {
      f.edit('EDU-5AMAM-001', 4, 0);
      await f.run(button);
    }
    if (mode === 'fallo') {
      f.fail();
      await f.run(button);
    }
    assert.equal(f.control('5A MAM').synced.find(a => a.id === 'EDU-5AMAM-001').p1, 0);
  }
});

test('solo el administrador puede crear o sincronizar y los mensajes repetidos no duplican cambios', async () => {
  const f = fixture();
  await f.outsider('crear examenes 5A MAM');
  assert.equal(f.tables[0].length, 1);
  assert.match(f.sent.at(-1).text.body, /exclusiva/);

  await f.run('crear examenes 5A MAM');
  f.edit('EDU-5AMAM-001', 5, 0);
  await f.run('sincronizar examenes');
  const button = f.button('guardar');
  await f.run(button, 'same');
  const history = f.tables[2].length;
  await f.run(button, 'same');
  assert.equal(f.tables[2].length, history);
  await f.run('sincronizar examenes');
  assert.match(f.sent.at(-1).text.body, /ya coinciden/);
});

test('parseExamGrade acepta coma, cero y vacío como cero, y rechaza fuera de rango', () => {
  assert.equal(parseExamGrade('5,5'), 5.5);
  assert.equal(parseExamGrade(0), 0);
  assert.equal(parseExamGrade(''), 0);
  assert.equal(parseExamGrade('10'), 10);
  for (const value of ['-1', '10.01', 'abc', '=SUM(1)', '1e2']) assert.equal(parseExamGrade(value), null);
});

test('planExamSync usa folio y grupo, no el nombre visible de la fila', () => {
  const f = fixture();
  return (async () => {
    await f.run('crear examenes 5A MAM');
    f.edit('EDU-5AMAM-001', 5, 0);
    f.tables[0][1][3] = 'Nombre editado manualmente';
    const db = {
      rows: [{
        group: '5A MAM', subject: 'La energía en los procesos de la vida diaria', period: PERIOD,
        id: 'EDU-5AMAM-001', name: 'Nombre editado manualmente',
        p1: 5, p2: 0, rowIndex: 1
      }],
      control: { '5A MAM': f.control('5A MAM') }
    };
    const plan = planExamSync(db, f.roster, ADMIN);
    assert.equal(plan.errors.length, 0);
    assert.equal(plan.changes[0].id, 'EDU-5AMAM-001');
  })();
});
