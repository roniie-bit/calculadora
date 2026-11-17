import { GROUPS, PERIOD, normalize } from '../services/studentService.js';
import { SUBJECTS, subjectsFor } from './teacherAttendanceFlow.js';
import { samePhone } from '../utils/phone.js';
import { computePartialGrade } from '../services/partialGradeService.js';
import { CURRENT_PARTIAL } from '../config/grading.js';
import { REPORT_SHEET } from '../services/gradeReportStore.js';

const isCommand = raw => /^(procesar|generar|actualizar) calificaciones(?:\s|$)/.test(normalize(raw));

const numberOrBlank = value => value === null || value === undefined ? '' : value;

export function createGradeReportFlow({
  students,
  taskStore,
  attendanceStore,
  examStore,
  reportStore,
  send,
  adminNumber,
  now = () => new Date()
}) {
  return async (phone, raw = '') => {
    if (!isCommand(raw)) return false;
    const text = body => send(phone, {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body }
    });
    if (!samePhone(phone, adminNumber)) {
      await text('El reporte de calificaciones es exclusivo del administrador.');
      return true;
    }

    const input = normalize(raw);
    const groupText = input.replace(/^(procesar|generar|actualizar) calificaciones\s*/, '').trim();
    const group = groupText ? GROUPS.find(candidate => normalize(candidate) === groupText) : undefined;
    if (groupText && !group) {
      await text(`Grupo no válido. Opciones: ${GROUPS.join(', ')}`);
      return true;
    }

    try {
      const [roster, tasks, attendance, examControl] = await Promise.all([
        students.list(),
        taskStore.transact(db => Object.values(db.sessions).filter(task =>
          samePhone(task.teacher, adminNumber) && task.period === PERIOD)),
        attendanceStore.transact(db => Object.values(db.sessions).filter(session => {
          const [firstMonth, lastMonth] = PERIOD.split(' / ');
          return samePhone(session.teacher, adminNumber) &&
            session.date.slice(0, 7) >= firstMonth &&
            session.date.slice(0, 7) <= lastMonth;
        })),
        examStore.transact(db => db.control || {})
      ]);

      const selectedGroups = group ? [group] : GROUPS;
      const rows = [];
      const timestamp = now().toISOString();
      for (const currentGroup of selectedGroups) {
        const groupStudents = roster
          .filter(student => student.period === PERIOD &&
            student.group === currentGroup &&
            ['Activo', 'Dual'].includes(student.status))
          .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
        for (const subjectKey of subjectsFor(currentGroup)) {
          const subject = SUBJECTS[subjectKey];
          for (const student of groupStudents) {
            const exam = examControl[currentGroup]?.synced?.find(item =>
              item.id === student.id && item.subject === subject);
            const grade = computePartialGrade({
              studentId: student.id,
              group: currentGroup,
              subject,
              tasks,
              attendance,
              exam,
              partial: CURRENT_PARTIAL
            });
            rows.push([
              currentGroup,
              subject,
              PERIOD,
              student.id,
              student.fullName,
              student.status,
              numberOrBlank(grade.tasks.score),
              numberOrBlank(grade.attendance.score),
              numberOrBlank(grade.exam.score),
              numberOrBlank(grade.total),
              numberOrBlank(grade.total / 10),
              grade.tasks.reviewed,
              grade.tasks.pending,
              grade.tasks.earned,
              grade.tasks.possible,
              grade.attendance.classes,
              grade.attendance.present,
              grade.attendance.late,
              grade.attendance.absent,
              grade.attendance.attendedClasses,
              grade.exam.grade,
              grade.complete ? 'Completa' : 'Preliminar',
              grade.missing.join('; '),
              timestamp
            ]);
          }
        }
      }

      const count = await reportStore.refresh(rows);
      const complete = rows.filter(row => row[21] === 'Completa').length;
      const preliminary = count - complete;
      await text(
        `✅ Reporte actualizado en la pestaña ${REPORT_SHEET}.\n\n` +
        `Filas: ${count}\nCalificaciones completas: ${complete}\nPreliminares: ${preliminary}\n\n` +
        'Se usaron tareas 40%, asistencia 30% y examen 30%. Las tareas y clases pendientes se excluyeron.'
      );
    } catch (error) {
      console.error('Error generando calificaciones:', error.message);
      await text('No pude generar el reporte. Revisa que las pestañas y encabezados estén disponibles y vuelve a intentarlo.');
    }
    return true;
  };
}
