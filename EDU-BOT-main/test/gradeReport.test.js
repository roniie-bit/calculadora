import test from 'node:test';
import assert from 'node:assert/strict';
import { createGradeReportFlow } from '../src/flows/gradeReportFlow.js';
import { createGradeReportStore, REPORT_HEADERS, REPORT_SHEET } from '../src/services/gradeReportStore.js';
import { PERIOD } from '../src/services/studentService.js';
import { SUBJECTS } from '../src/flows/teacherAttendanceFlow.js';
import gradesFlow from '../src/flows/gradesFlow.js';

const ADMIN = '5219381949915';
const PHONE = '5219381111111';

function fixture() {
  const roster = [
    { id: 'EDU-5AMAM-001', fullName: 'Ana MAM', phone: PHONE, group: '5A MAM', period: PERIOD, status: 'Activo' },
    { id: 'EDU-5ALCM-001', fullName: 'Luis LCM', phone: '5219382222222', group: '5A LCM', period: PERIOD, status: 'Activo' }
  ];
  const tasks = { sessions: {
    T01: { id: 'T01', teacher: ADMIN, period: PERIOD, group: '5A MAM', subject: SUBJECTS.energia, value: 1, partial: 'P1',
      students: [{ id: 'EDU-5AMAM-001', status: 'Entregó', points: 1 }] },
    T02: { id: 'T02', teacher: ADMIN, period: PERIOD, group: '5A LCM', subject: SUBJECTS.energia, value: 1, partial: 'P1',
      students: [{ id: 'EDU-5ALCM-001', status: 'Entregó', points: 0.5 }] },
    T03: { id: 'T03', teacher: ADMIN, period: PERIOD, group: '5A LCM', subject: SUBJECTS.organismos, value: 1, partial: 'P1',
      students: [{ id: 'EDU-5ALCM-001', status: 'Entregó', points: 1 }] }
  }, controls: {}, history: [] };
  const attendance = { sessions: {
    a1: { id: 'a1', teacher: ADMIN, group: '5A MAM', subject: SUBJECTS.energia, partial: 'P1', date: '2026-09-01', status: 'Finalizada', students: [{ id: 'EDU-5AMAM-001', status: 'Presente' }] },
    b1: { id: 'b1', teacher: ADMIN, group: '5A LCM', subject: SUBJECTS.energia, partial: 'P1', date: '2026-09-01', status: 'Finalizada', students: [{ id: 'EDU-5ALCM-001', status: 'Presente' }] },
    b2: { id: 'b2', teacher: ADMIN, group: '5A LCM', subject: SUBJECTS.organismos, partial: 'P1', date: '2026-09-01', status: 'Finalizada', students: [{ id: 'EDU-5ALCM-001', status: 'Falta' }] }
  }, controls: {}, history: [] };
  const exams = { control: {
    '5A MAM': { synced: [{ id: 'EDU-5AMAM-001', subject: SUBJECTS.energia, p1: 5, p2: 0 }] },
    '5A LCM': { synced: [
      { id: 'EDU-5ALCM-001', subject: SUBJECTS.energia, p1: 5, p2: 0 },
      { id: 'EDU-5ALCM-001', subject: SUBJECTS.organismos, p1: 8, p2: 0 }
    ] }
  } };
  let rows;
  const reportStore = { refresh: async next => { rows = next; return next.length; } };
  const sent = [];
  const flow = createGradeReportFlow({
    students: { list: async () => roster },
    taskStore: { transact: async work => work(tasks) },
    attendanceStore: { transact: async work => work(attendance) },
    examStore: { transact: async work => work(exams) },
    reportStore,
    send: async (_phone, payload) => sent.push(payload.text.body),
    adminNumber: ADMIN,
    now: () => new Date('2026-10-19T12:00:00Z')
  });
  return {
    flow,
    roster,
    tasks,
    attendance,
    exams,
    sent,
    rows: () => rows,
    run: (raw, phone = ADMIN) => flow(phone, raw),
  };
}

test('procesar calificaciones genera una fila por alumno y materia', async () => {
  const f = fixture();
  await f.run('Procesar calificaciones');
  assert.equal(f.rows().length, 3);
  const mam = f.rows().find(row => row[0] === '5A MAM');
  const energy = f.rows().find(row => row[0] === '5A LCM' && row[1] === SUBJECTS.energia);
  const organisms = f.rows().find(row => row[0] === '5A LCM' && row[1] === SUBJECTS.organismos);

  assert.equal(mam[6], 40);
  assert.equal(mam[7], 30);
  assert.equal(mam[8], 15);
  assert.equal(mam[9], 85);
  assert.equal(energy[9], 65);
  assert.equal(organisms[9], 64);
  assert.equal(mam[21], 'Completa');
  assert.match(f.sent.at(-1), /Reporte actualizado/);
  assert.match(f.sent.at(-1), /Calificaciones completas: 3/);
});

test('el reporte se recalcula completo y refleja cambios posteriores', async () => {
  const f = fixture();
  await f.run('procesar calificaciones');
  const before = f.rows().find(row => row[3] === 'EDU-5AMAM-001')[9];
  f.tasks.sessions.T01.students[0].points = 0;
  await f.run('actualizar calificaciones 5A MAM');
  assert.equal(f.rows().length, 1);
  assert.equal(f.rows()[0][9], 45);
  assert.notEqual(before, f.rows()[0][9]);
});

test('un reporte con pendientes queda marcado como Preliminar', async () => {
  const f = fixture();
  f.tasks.sessions.T01.students[0].status = 'Sin revisar';
  f.tasks.sessions.T01.students[0].points = null;
  await f.run('generar calificaciones');
  const row = f.rows().find(item => item[3] === 'EDU-5AMAM-001');
  assert.equal(row[21], 'Preliminar');
  assert.match(row[22], /tarea\(s\) pendiente/);
  assert.match(f.sent.at(-1), /Preliminares: 1/);
});

test('solo el administrador puede generar el reporte', async () => {
  const f = fixture();
  await f.run('procesar calificaciones', '5211111111111');
  assert.equal(f.rows(), undefined);
  assert.match(f.sent.at(-1), /exclusivo/);
});

test('el almacén reemplaza la pestaña generada con el encabezado actual', async () => {
  let cleared = false;
  let updated;
  const sheets = { spreadsheets: { values: {
    clear: async () => { cleared = true; },
    update: async ({ requestBody }) => { updated = requestBody.values; }
  } } };
  const store = createGradeReportStore(async () => ({ sheets, spreadsheetId: 'test' }));
  const count = await store.refresh([['fila']]);
  assert.equal(count, 1);
  assert.equal(cleared, true);
  assert.equal(updated[0].length, REPORT_HEADERS.length);
  assert.equal(updated[1][0], 'fila');
});

test('REPORT_SHEET tiene el nombre documentado', () => {
  assert.equal(REPORT_SHEET, 'Calificaciones_Primer_Parcial');
});

test('el flujo antiguo de calificaciones no captura el comando administrativo', () => {
  assert.equal(gradesFlow.detect('Procesar calificaciones'), false);
  assert.equal(gradesFlow.detect('calificaciones'), true);
});
