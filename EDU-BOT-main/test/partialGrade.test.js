import test from 'node:test';
import assert from 'node:assert/strict';
import { computePartialGrade, formatGradeSummary } from '../src/services/partialGradeService.js';

const SUBJECT = 'La energía en los procesos de la vida diaria';
const OTHER = 'Materia y energía en los organismos';

function task(subject, value, status, points, partial = 'P1') {
  return {
    group: '5A MAM',
    subject,
    partial,
    value,
    students: [{ id: 'A', status, points }]
  };
}

function session(subject, status, date = '2026-09-01', partial = 'P1') {
  return {
    group: '5A MAM',
    subject,
    partial,
    status: 'Finalizada',
    students: [{ id: 'A', status }]
  };
}

test('normaliza tareas por su valor, excluye pendientes y calcula los tres componentes', () => {
  const tasks = [
    task(SUBJECT, 1, 'Entregó', 0.8),
    task(SUBJECT, 5, 'Entregó', 4),
    task(SUBJECT, 2, 'Sin revisar', null)
  ];
  const attendance = [
    ...Array.from({ length: 9 }, () => session(SUBJECT, 'Presente')),
    ...Array.from({ length: 3 }, () => session(SUBJECT, 'Retardo'))
  ];
  const result = computePartialGrade({
    studentId: 'A',
    group: '5A MAM',
    subject: SUBJECT,
    tasks,
    attendance,
    exam: { p1: 5, p2: 0 }
  });

  assert.equal(result.tasks.earned, 4.8);
  assert.equal(result.tasks.possible, 6);
  assert.equal(result.tasks.score, 32);
  assert.equal(result.tasks.pending, 1);
  assert.equal(result.attendance.late, 3);
  assert.equal(result.attendance.effectiveAbsences, 1);
  assert.equal(result.attendance.attendedClasses, 11);
  assert.equal(result.attendance.score, 27.5);
  assert.equal(result.exam.score, 15);
  assert.equal(result.total, 74.5);
  assert.equal(result.complete, false);
  assert.ok(result.missing.includes('1 tarea(s) pendiente(s)'));
  assert.match(formatGradeSummary(result), /32\.0 \/ 40/);
  assert.match(formatGradeSummary(result), /Cada 3 retardos descuentan 1 asistencia/);
  assert.match(formatGradeSummary(result), /Total preliminar: 74\.5 \/ 100/);
});

test('uno o dos retardos cuentan como asistencia completa', () => {
  const practice = [
    ...Array.from({ length: 8 }, () => session(SUBJECT, 'Presente')),
    session(SUBJECT, 'Retardo'),
    session(SUBJECT, 'Retardo')
  ];
  const result = computePartialGrade({
    studentId: 'A', group: '5A MAM', subject: SUBJECT,
    tasks: [task(SUBJECT, 1, 'Entregó', 1)],
    attendance: practice,
    exam: { p1: 10, p2: 0 }
  });
  assert.equal(result.attendance.effectiveAbsences, 0);
  assert.equal(result.attendance.score, 30);
  assert.equal(result.total, 100);
  assert.equal(result.complete, true);
});

test('no mezcla materias y no cuenta listas abiertas', () => {
  const tasks = [
    task(SUBJECT, 1, 'Entregó', 0.5),
    task(OTHER, 1, 'Entregó', 1)
  ];
  const attendance = [
    session(SUBJECT, 'Presente'),
    session(OTHER, 'Falta'),
    { ...session(SUBJECT, 'Presente'), status: 'En curso' }
  ];
  const first = computePartialGrade({
    studentId: 'A', group: '5A MAM', subject: SUBJECT,
    tasks, attendance, exam: { subject: SUBJECT, p1: 5, p2: 0 }
  });
  const second = computePartialGrade({
    studentId: 'A', group: '5A MAM', subject: OTHER,
    tasks, attendance, exam: { subject: OTHER, p1: 8, p2: 0 }
  });

  assert.equal(first.tasks.score, 20);
  assert.equal(second.tasks.score, 40);
  assert.equal(first.attendance.open, 1);
  assert.equal(second.attendance.absent, 1);
  assert.notEqual(first.total, second.total);
});

test('un puntaje mayor al valor de la tarea no supera el componente', () => {
  const result = computePartialGrade({
    studentId: 'A', group: '5A MAM', subject: SUBJECT,
    tasks: [task(SUBJECT, 1, 'Entregó', 8)],
    attendance: [session(SUBJECT, 'Presente')],
    exam: { p1: 10, p2: 0 }
  });
  assert.equal(result.tasks.earned, 1);
  assert.equal(result.tasks.score, 40);
});

test('sin datos no inventa una calificación completa', () => {
  const result = computePartialGrade({
    studentId: 'A', group: '5A MAM', subject: SUBJECT,
    tasks: [], attendance: [], exam: null
  });
  assert.equal(result.tasks.score, null);
  assert.equal(result.attendance.score, null);
  assert.equal(result.exam.score, null);
  assert.equal(result.complete, false);
  assert.equal(result.total, 0);
  assert.match(formatGradeSummary(result), /sin datos/);
});
