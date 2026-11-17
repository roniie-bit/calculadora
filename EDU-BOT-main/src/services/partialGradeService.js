import {
  CURRENT_PARTIAL,
  CURRENT_PARTIAL_LABEL,
  GRADE_WEIGHTS,
  MAX_EXAM_GRADE
} from '../config/grading.js';

const number = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = value => Math.round(value * 100) / 100;
const display = value => Number(value || 0).toFixed(1);

export function computePartialGrade({
  studentId,
  group,
  subject,
  tasks = [],
  attendance = [],
  exam,
  partial = CURRENT_PARTIAL
}) {
  let earned = 0;
  let possible = 0;
  let reviewedTasks = 0;
  let pendingTasks = 0;

  for (const task of tasks) {
    if (task.group !== group || task.subject !== subject) continue;
    if ((task.partial || partial) !== partial) continue;
    const value = Math.max(0, number(task.value));
    const entry = task.students?.find(student => student.id === studentId);
    if (!entry || entry.status === 'Sin revisar') {
      pendingTasks++;
      continue;
    }
    if (!['Entregó', 'No entregó'].includes(entry.status)) {
      pendingTasks++;
      continue;
    }
    const points = entry.status === 'No entregó'
      ? 0
      : Math.min(value, Math.max(0, number(entry.points)));
    earned += points;
    possible += value;
    reviewedTasks++;
  }

  let present = 0;
  let late = 0;
  let absent = 0;
  let pendingAttendance = 0;
  let openClasses = 0;
  let attendanceClasses = 0;

  for (const session of attendance) {
    if (session.group !== group || session.subject !== subject) continue;
    if ((session.partial || partial) !== partial) continue;
    if (session.status !== 'Finalizada') {
      openClasses++;
      continue;
    }
    const entry = session.students?.find(student => student.id === studentId);
    if (!entry || entry.status === 'Pendiente') {
      pendingAttendance++;
      continue;
    }
    if (!['Presente', 'Retardo', 'Falta'].includes(entry.status)) {
      pendingAttendance++;
      continue;
    }
    attendanceClasses++;
    if (entry.status === 'Presente') present++;
    else if (entry.status === 'Retardo') late++;
    else absent++;
  }

  const taskPercent = possible > 0 ? earned / possible : null;
  const taskScore = taskPercent === null ? null : round2(taskPercent * GRADE_WEIGHTS.tasks);

  // Un retardo cuenta como asistencia; cada grupo de tres retardos descuenta una.
  const effectiveAbsences = absent + Math.floor(late / 3);
  const attendedClasses = attendanceClasses - effectiveAbsences;
  const attendancePercent = attendanceClasses > 0 ? attendedClasses / attendanceClasses : null;
  const attendanceScore = attendancePercent === null
    ? null
    : round2(attendancePercent * GRADE_WEIGHTS.attendance);

  const examRegistered = Boolean(exam);
  const examGrade = examRegistered
    ? Math.min(MAX_EXAM_GRADE, Math.max(0, number(exam.p1)))
    : null;
  const examScore = examRegistered
    ? round2((examGrade / MAX_EXAM_GRADE) * GRADE_WEIGHTS.exam)
    : null;

  const availableScores = [taskScore, attendanceScore, examScore].filter(score => score !== null);
  const total = round2(availableScores.reduce((sum, score) => sum + score, 0));
  const missing = [];
  if (taskScore === null) missing.push('sin tareas revisadas');
  if (pendingTasks) missing.push(`${pendingTasks} tarea(s) pendiente(s)`);
  if (attendanceScore === null) missing.push('sin clases finalizadas');
  if (pendingAttendance) missing.push(`${pendingAttendance} clase(s) sin marcar`);
  if (openClasses) missing.push(`${openClasses} lista(s) abierta(s)`);
  if (!examRegistered) missing.push('examen no sincronizado');

  const complete = pendingTasks === 0 &&
    pendingAttendance === 0 &&
    openClasses === 0 &&
    taskScore !== null &&
    attendanceScore !== null &&
    examRegistered;

  return {
    studentId,
    group,
    subject,
    partial,
    tasks: {
      earned,
      possible,
      percent: taskPercent,
      score: taskScore,
      reviewed: reviewedTasks,
      pending: pendingTasks
    },
    attendance: {
      present,
      late,
      absent,
      pending: pendingAttendance,
      open: openClasses,
      classes: attendanceClasses,
      effectiveAbsences,
      attendedClasses,
      percent: attendancePercent,
      score: attendanceScore
    },
    exam: {
      registered: examRegistered,
      grade: examGrade,
      score: examScore,
      p2: exam ? number(exam.p2) : null
    },
    total,
    complete,
    missing
  };
}

export function formatGradeSummary(result) {
  const hasAnyScore = [result.tasks.score, result.attendance.score, result.exam.score]
    .some(score => score !== null);
  const lines = [
    `📊 ${CURRENT_PARTIAL_LABEL.toUpperCase()} · ${result.subject}`,
    '',
    `Tareas: ${result.tasks.score === null ? 'sin datos' : `${display(result.tasks.score)} / ${GRADE_WEIGHTS.tasks}`}`,
    result.tasks.percent === null
      ? 'Aún no hay tareas revisadas.'
      : `${display(result.tasks.earned)} de ${display(result.tasks.possible)} puntos (${display(result.tasks.percent * 100)}%)\n` +
        `${display(result.tasks.earned)} / ${display(result.tasks.possible)} × ${GRADE_WEIGHTS.tasks} = ${display(result.tasks.score)}`,
    '',
    `Asistencia: ${result.attendance.score === null ? 'sin datos' : `${display(result.attendance.score)} / ${GRADE_WEIGHTS.attendance}`}`,
    result.attendance.percent === null
      ? 'Aún no hay clases finalizadas.'
      : `${result.attendance.attendedClasses} de ${result.attendance.classes} clases efectivas (${display(result.attendance.percent * 100)}%)\n` +
        `${result.attendance.present} presentes · ${result.attendance.late} retardos · ${result.attendance.absent} faltas\n` +
        `Cada 3 retardos descuentan 1 asistencia.\n` +
        `${result.attendance.attendedClasses} / ${result.attendance.classes} × ${GRADE_WEIGHTS.attendance} = ${display(result.attendance.score)}`,
    '',
    `Examen: ${result.exam.score === null ? 'sin datos' : `${display(result.exam.score)} / ${GRADE_WEIGHTS.exam}`}`,
    result.exam.registered
      ? `${display(result.exam.grade)} de ${MAX_EXAM_GRADE}${result.exam.grade === 0 ? ' · sin examen registrado' : ''}\n` +
        `${display(result.exam.grade)} / ${MAX_EXAM_GRADE} × ${GRADE_WEIGHTS.exam} = ${display(result.exam.score)}`
      : 'Examen no sincronizado.',
    '',
    hasAnyScore
      ? `${result.complete ? 'Total' : 'Total preliminar'}: ${display(result.total)} / 100 (${display(result.total / 10)} / 10)`
      : 'Total: sin datos.',
    result.missing.length ? `Pendiente para cerrar: ${result.missing.join(', ')}.` : 'Calificación completa.',
    '',
    'Tareas: 40% · Asistencia: 30% · Examen: 30%.'
  ];
  return lines.join('\n');
}
