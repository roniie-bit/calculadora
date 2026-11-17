import test from 'node:test';
import assert from 'node:assert/strict';
import { PERIOD } from '../src/services/studentService.js';
import { planFirstAttendance, applyFirstAttendance } from '../src/services/firstAttendance.js';
import { createFirstAttendanceFlow } from '../src/flows/firstAttendanceFlow.js';
const ADMIN = '5219381949915';
const student = (id, createdAt, status = 'Activo') => ({ id, createdAt, status, group: '5A MAM', fullName: id, period: PERIOD });
test('fecha local: agrega presentes y faltas, excluye Dual, conserva marcas y es idempotente', () => {
  const roster = [student('A', '2026-09-08T01:00:00Z'), student('B', '2026-09-08T14:00:00Z'), student('C', '2026-09-07T15:00:00Z', 'Dual'), student('D', '2026-09-07T14:00:00Z')];
  const db = { sessions: { old: { id: 'old', group: '5A MAM', date: '2026-09-07', subjectKey: 'energia', teacher: ADMIN, status: 'Finalizada', students: [{ id: 'D', status: 'Retardo' }] } }, controls: { active: 1 }, history: [] };
  const plan = planFirstAttendance(roster, db.sessions, ADMIN);
  const item = plan.find(p => p.group === '5A MAM');
  assert.deepEqual(item.additions.map(a => a.status), ['Presente', 'Falta']);
  applyFirstAttendance(db, plan, ADMIN, 'now', 'message');
  assert.deepEqual(db.sessions.old.students.map(a => a.status), ['Retardo', 'Presente', 'Falta']);
  assert.equal(db.history.length, 2); assert.deepEqual(db.controls, { active: 1 });
  const before = structuredClone(db);
  applyFirstAttendance(db, planFirstAttendance(roster, db.sessions, ADMIN), ADMIN, 'later', 'retry');
  assert.deepEqual(db, before);
});
test('fechas inválidas, altas anteriores y folios duplicados detienen la propuesta', () => {
  for (const rows of [[student('A', '')], [student('A', '2026-09-06T14:00:00Z')], [student('A', '2026-09-07'), student('A', '2026-09-07')]]) assert.throws(() => planFirstAttendance(rows, {}, ADMIN));
});
test('vista previa exige confirmación, detecta cambios y no reemplaza controles', async () => {
  const roster = [student('A', '2026-09-07T14:00:00Z')];
  const db = { sessions: {}, history: [], controls: { keep: true } }, sent = [];
  const flow = createFirstAttendanceFlow({ students: { list: async () => roster }, store: { transact: async work => work(db) }, adminNumber: ADMIN,
    now: () => new Date('2026-09-11T12:00:00Z'), send: async (p, m) => sent.push(m) });
  await flow('outsider', 'recuperar primera asistencia'); assert.equal(Object.keys(db.sessions).length, 0);
  await flow(ADMIN, 'recuperar primera asistencia'); const button = sent.at(-1).interactive.action.buttons[0].reply.id;
  assert.equal(Object.keys(db.sessions).length, 0);
  roster[0].status = 'Dual'; await flow(ADMIN, button); assert.equal(Object.keys(db.sessions).length, 0);
  roster[0].status = 'Activo'; await flow(ADMIN, 'recuperar primera asistencia');
  const save = sent.at(-1).interactive.action.buttons[0].reply.id;
  await flow(ADMIN, save, 'save'); await flow(ADMIN, save, 'save');
  assert.equal(Object.keys(db.sessions).length, 1); assert.equal(db.history.length, 1); assert.deepEqual(db.controls, { keep: true });
});
