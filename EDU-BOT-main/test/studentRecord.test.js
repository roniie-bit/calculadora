import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStudentRecordFlow } from '../src/flows/studentRecordFlow.js';
import { PERIOD } from '../src/services/studentService.js';
import { SUBJECTS } from '../src/flows/teacherAttendanceFlow.js';

const ADMIN = '5219381949915';
const PHONE = '5219381111111';
const ID = 'EDU-5AMAM-001';
function fixture() {
  const roster = [{ id: ID, fullName: 'Ana Pérez', phone: PHONE, group: '5A MAM', period: PERIOD, status: 'Activo' }];
  const taskDb = { sessions: {}, controls: { [ADMIN]: { phase: 'review', index: 1 } }, history: [] };
  const attendanceDb = { sessions: {}, controls: { [ADMIN]: { phase: 'roll', index: 2 } }, history: [] };
  let reads = 0, fail = false;
  const store = db => ({ transact: async work => {
    reads++; if (fail) throw new Error('Fallo simulado');
    const before = structuredClone(db); const result = await work(db);
    assert.deepEqual(db, before, 'La consulta no debe modificar datos ni controles'); return result;
  } });
  const sent = [];
  const flow = createStudentRecordFlow({ students: { list: async () => roster }, taskStore: store(taskDb), attendanceStore: store(attendanceDb),
    adminNumber: ADMIN, send: async (phone, payload) => sent.push(payload.text.body) });
  const task = (key, status = 'Entregó', points = 0.7, overrides = {}) => {
    taskDb.sessions[key] = { id: key, teacher: ADMIN, period: PERIOD, group: '5A MAM', subject: 'Física', name: 'Ejercicios', value: 1,
      students: [{ id: ID, status, points }, { id: 'OTRO', status: 'Entregó', points: 99 }], ...overrides };
  };
  const attendance = (key, status, overrides = {}) => {
    attendanceDb.sessions[key] = { teacher: ADMIN, group: '5A MAM', date: '2026-09-10', subject: 'Física', status: 'Finalizada',
      students: [{ id: ID, status }], ...overrides };
  };
  return { flow, roster, sent, task, attendance, reads: () => reads, fail: () => { fail = true; } };
}

test('alumno consulta estados, puntos y asistencias sin modificar registros ni mostrar otros alumnos', async () => {
  const f = fixture();
  f.task('T01'); f.task('T02', 'No entregó', 0); f.task('T03', 'Sin revisar', null); f.task('T04', 'Entregó', 0);
  f.attendance('a', 'Presente'); f.attendance('b', 'Retardo'); f.attendance('c', 'Falta'); f.attendance('d', 'Pendiente', { status: 'En curso' });
  assert.equal(await f.flow(PHONE, `mi registro ${ID}`), true);
  const output = f.sent.join('\n');
  assert.match(output, /Entregadas: 2 · No entregadas: 1 · Sin revisar: 1/);
  assert.match(output, /Puntos registrados: 0.7/);
  assert.match(output, /Entregó · Puntaje: 0/);
  assert.match(output, /Sin revisar · Puntaje: Sin calificar/);
  assert.match(output, /Presente: 1 · 🕒 Retardo: 1 · ❌ Falta: 1/);
  assert.match(output, /Sin pase registrado: 1/);
  assert.match(output, /Lista aún abierta/);
  assert.doesNotMatch(output, /OTRO|99/);
});

test('folio requiere número registrado o docente; admite variantes 52 y dispositivos compartidos', async () => {
  const f = fixture(); f.task('T01');
  await f.flow('5219382222222', `mi registro ${ID}`);
  assert.equal(f.reads(), 0); assert.doesNotMatch(f.sent.join('\n'), /Ana|Ejercicios/);
  await f.flow(PHONE, 'mi registro EDU-5AMAM-999'); assert.equal(f.reads(), 0);
  await f.flow('529381111111', `mi registro ${ID}`); assert.equal(f.reads(), 2);
  await f.flow(ADMIN, `mi registro ${ID}`); assert.equal(f.reads(), 4);
  f.roster.push({ ...f.roster[0], id: 'EDU-5AMAM-002', fullName: 'José López' });
  f.sent.length = 0; await f.flow(PHONE, 'mi registro EDU-5AMAM-002');
  assert.match(f.sent.join('\n'), /José López/); assert.doesNotMatch(f.sent.join('\n'), /Ana Pérez/);
});

test('filtra periodo y docente; permite consultar historial Dual y distingue nuevas tareas sin revisar', async () => {
  const f = fixture();
  f.task('T01'); f.task('T02', 'Entregó', 5, { period: 'otro', name: 'Periodo ajeno' });
  f.task('T03', 'Entregó', 5, { teacher: 'otro', name: 'Docente ajeno' });
  f.task('T04', 'Sin revisar', null, { students: [] });
  f.attendance('old', 'Falta', { date: '2026-07-31' });
  f.attendance('future', 'Falta', { date: '2027-02-01' });
  f.attendance('foreign', 'Falta', { teacher: 'otro' });
  f.attendance('current', 'Presente');
  await f.flow(PHONE, `mi registro ${ID}`);
  assert.match(f.sent.join('\n'), /Tareas: 2/);
  assert.match(f.sent.join('\n'), /Asistencias: 1 clases/);
  assert.doesNotMatch(f.sent.join('\n'), /Periodo ajeno|Docente ajeno/);
  f.roster[0].status = 'Dual'; f.sent.length = 0;
  await f.flow(PHONE, `mi registro ${ID}`);
  assert.match(f.sent.join('\n'), /Dual/); assert.match(f.sent.join('\n'), /Tareas: 1/);
  assert.match(f.sent.join('\n'), /Puntos registrados: 0.7/);
});

test('no captura tareas personales ni folios de correcciones; explica uso y maneja registros vacíos o fallos', async () => {
  const f = fixture();
  for (const input of ['tareas', 'mis tareas', 'tareas grupo', ID, `corregir ${ID}`]) assert.equal(await f.flow(PHONE, input), false);
  await f.flow(PHONE, 'mi registro'); assert.match(f.sent.at(-1), /seguido de tu folio/);
  await f.flow(PHONE, `mi registro ${ID}`); assert.match(f.sent.join('\n'), /Todavía no hay asistencias/);
  f.fail(); f.sent.length = 0; await f.flow(PHONE, `mi registro ${ID}`);
  assert.deepEqual(f.sent, ['No pude consultar tu registro en este momento. Intenta nuevamente en unos minutos.']);
});

test('divide historiales largos y atiende la consulta antes de revisiones y otros módulos', async () => {
  const f = fixture();
  for (let i = 1; i <= 100; i++) f.task(`T${i}`, 'Entregó', 1, { name: 'Nombre largo de tarea '.repeat(5) });
  await f.flow(PHONE, `mi registro ${ID}`);
  assert.ok(f.sent.length > 5); assert.ok(f.sent.every(p => p.length <= 3500));
  const source = await readFile(new URL('../src/services/messageHandler.js', import.meta.url), 'utf8');
  const position = source.indexOf('await this.studentRecordFlow(phone, rawText)');
  assert.ok(position >= 0 && position < source.lastIndexOf('await this.teacherTaskFlow('));
  assert.ok(position < source.lastIndexOf('await this.teacherAttendanceFlow('));
});

test('mi registro muestra una calificación separada por cada materia', async () => {
  const roster = [{ id: 'EDU-5ALCM-001', fullName: 'Ana LCM', phone: PHONE, group: '5A LCM', period: PERIOD, status: 'Activo' }];
  const tasksDb = { sessions: {
    T01: { id: 'T01', teacher: ADMIN, period: PERIOD, group: '5A LCM', subject: SUBJECTS.energia, name: 'Tarea energía', value: 1, partial: 'P1',
      students: [{ id: 'EDU-5ALCM-001', status: 'Entregó', points: 0.8 }] },
    T02: { id: 'T02', teacher: ADMIN, period: PERIOD, group: '5A LCM', subject: SUBJECTS.organismos, name: 'Tarea organismos', value: 10, partial: 'P1',
      students: [{ id: 'EDU-5ALCM-001', status: 'Entregó', points: 5 }] }
  }, controls: {}, history: [] };
  const attendanceDb = { sessions: {
    a1: { id: 'a1', teacher: ADMIN, group: '5A LCM', subject: SUBJECTS.energia, partial: 'P1', date: '2026-09-01', status: 'Finalizada', students: [{ id: 'EDU-5ALCM-001', status: 'Presente' }] },
    a2: { id: 'a2', teacher: ADMIN, group: '5A LCM', subject: SUBJECTS.energia, partial: 'P1', date: '2026-09-02', status: 'Finalizada', students: [{ id: 'EDU-5ALCM-001', status: 'Presente' }] },
    b1: { id: 'b1', teacher: ADMIN, group: '5A LCM', subject: SUBJECTS.organismos, partial: 'P1', date: '2026-09-01', status: 'Finalizada', students: [{ id: 'EDU-5ALCM-001', status: 'Presente' }] },
    b2: { id: 'b2', teacher: ADMIN, group: '5A LCM', subject: SUBJECTS.organismos, partial: 'P1', date: '2026-09-02', status: 'Finalizada', students: [{ id: 'EDU-5ALCM-001', status: 'Falta' }] }
  }, controls: {}, history: [] };
  const examDb = { control: { '5A LCM': { synced: [
    { id: 'EDU-5ALCM-001', subject: SUBJECTS.energia, p1: 5, p2: 0 },
    { id: 'EDU-5ALCM-001', subject: SUBJECTS.organismos, p1: 8, p2: 0 }
  ] } } };
  const store = db => ({ transact: async work => work(db) });
  const sent = [];
  const flow = createStudentRecordFlow({
    students: { list: async () => roster },
    taskStore: store(tasksDb),
    attendanceStore: store(attendanceDb),
    examStore: store(examDb),
    adminNumber: ADMIN,
    send: async (_phone, payload) => sent.push(payload.text.body)
  });

  await flow(PHONE, 'mi registro EDU-5ALCM-001');
  const output = sent.join('\n');
  assert.match(output, new RegExp(SUBJECTS.energia));
  assert.match(output, new RegExp(SUBJECTS.organismos));
  assert.match(output, /Total: 77\.0/);
  assert.match(output, /Total: 59\.0/);
  assert.match(output, /Tareas: 40% · Asistencia: 30% · Examen: 30%/);
});
