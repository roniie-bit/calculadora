import { PERIOD, normalize } from '../services/studentService.js';
import { samePhone } from '../utils/phone.js';
import { SUBJECTS, subjectsFor } from './teacherAttendanceFlow.js';
import { computePartialGrade, formatGradeSummary } from '../services/partialGradeService.js';

// Consulta explícita para no capturar folios usados por las correcciones docentes.
export function createStudentRecordFlow({ students, taskStore, attendanceStore, examStore, send, adminNumber }) {
  return async (phone, raw = '') => {
    const command = normalize(raw);
    if (!/^mi registro(?:\s|$)/.test(command)) return false;
    const text = body => send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body } });
    const match = /^mi registro\s+(edu-[a-z0-9]+-\d+)$/.exec(command);
    if (!match) {
      await text('Para consultar tus tareas, asistencias y calificación del primer parcial, escribe mi registro seguido de tu folio. Ejemplo: mi registro EDU-5AMAM-015. Usa el número de WhatsApp con el que te registraste.');
      return true;
    }
    try {
      const id = match[1].toUpperCase();
      const student = (await students.list()).find(a => a.id === id && a.period === PERIOD);
      if (!student || (!samePhone(phone, adminNumber) && !samePhone(phone, student.phone))) {
        await text('No puedo consultar ese folio desde este número. Verifica tu folio y escribe desde el WhatsApp registrado. Si cambiaste de número, solicita al docente que actualice tu registro.');
        return true;
      }
      const examPromise = examStore
        ? examStore.transact(db => {
            const group = db.control?.[student.group]?.synced || [];
            return group.filter(exam => exam.id === id);
          })
        : Promise.resolve([]);
      const [tasks, attendance, exams] = await Promise.all([
        taskStore.transact(db => Object.values(db.sessions).filter(t => samePhone(t.teacher, adminNumber) && t.period === PERIOD &&
          (t.students.some(a => a.id === id) || (student.status === 'Activo' && t.group === student.group)))
          .map(t => ({ id: t.id, name: t.name, group: t.group, subject: t.subject, value: t.value,
            partial: t.partial || 'P1', students: t.students,
            status: t.students.find(a => a.id === id)?.status || 'Sin revisar', points: t.students.find(a => a.id === id)?.points ?? null }))),
        attendanceStore.transact(db => {
          const [firstMonth, lastMonth] = PERIOD.split(' / ');
          return Object.values(db.sessions).filter(s => samePhone(s.teacher, adminNumber) && s.date.slice(0, 7) >= firstMonth && s.date.slice(0, 7) <= lastMonth && s.students.some(a => a.id === id))
            .map(s => ({ id: s.id, date: s.date, group: s.group, subject: s.subject, partial: s.partial || 'P1',
              status: s.status, studentStatus: s.students.find(a => a.id === id).status, students: s.students,
              open: s.status !== 'Finalizada' }));
        }),
        examPromise
      ]);
      const pages = [];
      function lines(title, entries) {
        let page = title;
        for (const entry of entries) {
          if (page.length + entry.length + 2 > 3500) { pages.push(page); page = `${title} (continuación)`; }
          page += `\n\n${entry}`;
        }
        pages.push(page);
      }
      pages.push(`📘 ${student.fullName}\nFolio: ${student.id}\nGrupo: ${student.group} · ${student.status}\nPeriodo: ${PERIOD}`);
      const subjectGrades = subjectsFor(student.group).map(key => {
        const subject = SUBJECTS[key];
        const exam = exams.find(item => item.subject === subject);
        return computePartialGrade({
          studentId: id,
          group: student.group,
          subject,
          tasks,
          attendance,
          exam
        });
      });
      for (const grade of subjectGrades) pages.push(formatGradeSummary(grade));
      const delivered = tasks.filter(t => t.status === 'Entregó').length;
      const missing = tasks.filter(t => t.status === 'No entregó').length;
      const unreviewed = tasks.filter(t => t.status === 'Sin revisar').length;
      const points = tasks.reduce((total, t) => total + Math.round((t.points || 0) * 100), 0) / 100;
      lines(`📚 Tareas: ${tasks.length}\nEntregadas: ${delivered} · No entregadas: ${missing} · Sin revisar: ${unreviewed}\nPuntos registrados: ${points} (suma, no promedio ni calificación final)`, tasks.sort((a, b) => a.id.localeCompare(b.id, 'es', { numeric: true })).map(t =>
        `${t.id} — ${t.name}\n${t.group} · ${t.subject}\n${t.status} · Puntaje: ${t.points ?? 'Sin calificar'} · Valor de la tarea: ${t.value}`
      ).concat(tasks.length ? [] : ['Todavía no hay tareas registradas para consultar.']));
      if (exams.length) {
        pages.push(subjectGrades.map(grade => {
          const exam = exams.find(item => item.subject === grade.subject);
          const p1 = exam ? Number(exam.p1) || 0 : 0;
          const p2 = exam ? Number(exam.p2) || 0 : 0;
          const estado = p1 === 0 && p2 === 0
            ? 'Sin exámenes presentados.'
            : p1 > 0 && p2 === 0
            ? 'Primer parcial registrado.'
            : p1 === 0 && p2 > 0
            ? 'Segundo parcial registrado.'
            : 'Primer y segundo parcial registrados.';
          return `📝 Exámenes · ${grade.subject}\n\nPrimer parcial: ${p1}\nSegundo parcial: ${p2}\n\n${estado}`;
        }).join('\n\n'));
      } else {
        pages.push('📝 Exámenes\n\nAún no hay calificaciones de examen sincronizadas.');
      }
      const count = status => attendance.filter(a => a.studentStatus === status).length;
      lines(`📋 Asistencias: ${attendance.length} clases\n✅ Presente: ${count('Presente')} · 🕒 Retardo: ${count('Retardo')} · ❌ Falta: ${count('Falta')}\n⏳ Sin pase registrado: ${count('Pendiente')}`, attendance.sort((a, b) => b.date.localeCompare(a.date) || a.subject.localeCompare(b.subject, 'es')).map(a =>
        `${a.date} · ${a.group}\n${a.subject}\n${a.studentStatus === 'Pendiente' ? 'Sin pase registrado' : a.studentStatus}${a.open ? ' · Lista aún abierta' : ''}`
      ).concat(attendance.length ? [] : ['Todavía no hay asistencias registradas para tu folio.']));
      pages.push('Sin revisar no significa No entregó; Sin pase registrado no significa Falta. Las tareas y clases pendientes no se incluyen en el cálculo preliminar. Si encuentras un error, coméntalo con tu docente.');
      for (const page of pages) await text(page);
    } catch (error) {
      console.error('Error en consulta de registro:', error.message);
      await text('No pude consultar tu registro en este momento. Intenta nuevamente en unos minutos.');
    }
    return true;
  };
}
