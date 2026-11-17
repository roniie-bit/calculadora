import { createHash } from 'node:crypto';
import { PERIOD } from './studentService.js';
import { SUBJECTS, localDate } from '../flows/teacherAttendanceFlow.js';

// Fechas y materias de la primera clase, verificadas con el docente.
export const FIRST_CLASSES = [
  ['5A CM', '2026-09-07', 'energia'], ['5A MAM', '2026-09-07', 'energia'],
  ['5B LCM', '2026-09-07', 'energia'], ['5A PABM', '2026-09-07', 'energia'],
  ['5A LCM', '2026-09-07', 'organismos'], ['5B CM', '2026-09-08', 'energia'],
  ['3A EV', '2026-09-08', 'terrestre']
];

export function planFirstAttendance(students, sessions, teacher) {
  if (PERIOD !== '2026-08 / 2027-01') throw new Error('Las primeras clases requieren verificar fechas para este periodo');
  const current = students.filter(a => a.period === PERIOD);
  if (new Set(current.map(a => a.id)).size !== current.length) throw new Error('Hay folios duplicados');
  return FIRST_CLASSES.map(([group, date, subjectKey]) => {
    const matches = Object.values(sessions).filter(s => s.teacher === teacher && s.group === group && s.date === date && s.subjectKey === subjectKey);
    if (matches.length > 1) throw new Error(`Hay listas duplicadas en ${group}`);
    const existing = matches[0];
    const targetId = existing?.id || `primera-${date}-${group.replaceAll(' ', '')}-${subjectKey}`;
    if (!existing && sessions[targetId]) throw new Error(`La clave de recuperación ya está ocupada en ${group}`);
    if (existing?.numbered) throw new Error(`Hay una revisión por números abierta en ${group}; termínala antes`);
    const roster = current.filter(a => a.group === group && a.status === 'Activo').sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
    const additions = roster.filter(a => !existing?.students.some(s => s.id === a.id)).map(a => {
      const created = new Date(a.createdAt);
      if (!a.createdAt || Number.isNaN(+created)) throw new Error(`Fecha de alta inválida: ${a.id}`);
      const registered = localDate(created);
      if (registered < date) throw new Error(`Alta anterior a la primera clase: ${a.id}; requiere revisión`);
      return { id: a.id, name: a.fullName, status: registered === date ? 'Presente' : 'Falta', registrationDate: registered };
    });
    return { group, date, subjectKey, subject: SUBJECTS[subjectKey], sessionId: targetId,
      existing: !!existing, preserved: existing?.students.length || 0, additions };
  });
}

export function firstAttendanceFingerprint(students, sessions, teacher) {
  return createHash('sha256').update(JSON.stringify({ students: students.filter(a => a.period === PERIOD), sessions: Object.values(sessions).filter(s => s.teacher === teacher) })).digest('hex');
}

export function applyFirstAttendance(db, plan, teacher, timestamp, messageId) {
  for (const item of plan) {
    if (!item.additions.length) continue;
    let s = db.sessions[item.sessionId];
    if (!s) {
      s = { id: item.sessionId, group: item.group, date: item.date, subjectKey: item.subjectKey, subject: item.subject,
        teacher, status: 'Finalizada', createdAt: timestamp, updatedAt: timestamp, students: [], source: 'Primera asistencia por fecha de alta' };
      db.sessions[s.id] = s;
    }
    for (const a of item.additions) {
      if (s.students.some(previous => previous.id === a.id)) continue;
      s.students.push({ id: a.id, name: a.name, status: a.status, updatedAt: timestamp });
      db.history.push([timestamp, teacher, s.id, a.id, '', a.status, `Primera asistencia por alta ${a.registrationDate}`, messageId]);
      s.updatedAt = timestamp;
    }
  }
}
