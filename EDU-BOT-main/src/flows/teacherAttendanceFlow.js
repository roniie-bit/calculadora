import { randomUUID } from 'node:crypto';
import { GROUPS, PERIOD, normalize } from '../services/studentService.js';
import { samePhone } from '../utils/phone.js';
import { parseSelection } from '../utils/numberSelection.js';
import { CURRENT_PARTIAL } from '../config/grading.js';

export const SUBJECTS = {
  energia: 'La energía en los procesos de la vida diaria',
  organismos: 'Materia y energía en los organismos',
  terrestre: 'Ciencias naturales III: nuestro hogar, el sistema terrestre'
};
export const subjectsFor = group => group === '3A EV' ? ['terrestre'] : /LCM$/.test(group) ? ['energia', 'organismos'] : ['energia'];
const statuses = { p: 'Presente', presente: 'Presente', f: 'Falta', falta: 'Falta', r: 'Retardo', retardo: 'Retardo' };
const shortId = () => randomUUID().slice(0, 8);
export const localDate = date => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const explicitCommand = text => /^(pasar lista(?:\s|$)|retardos(?:\s|$)|presentes(?:\s|$)|faltas(?:\s|$)|justificar(?:\s|$)|pausar lista$|continuar lista(?:\s|$)|finalizar lista$|ver faltas$|resumen lista$|anterior$|corregir(?:\s|$)|retardo\s|lista:)/.test(text);
export const isTeacherAttendanceCommand = text => explicitCommand(normalize(text));
const HELP = 'Comandos: pasar lista 5A MAM · pasar lista numeros 5A MAM · faltas 2,6-8 · retardos lista 5A MAM · retardos 2,6-8 · corregir lista 5A MAM AAAA-MM-DD · corregir alumno FOLIO · corregir FOLIO AAAA-MM-DD,AAAA-MM-DD · retardo FOLIO. Después usa presentes/justificar 2,5-7, faltas 3,8 o retardos 1,4.';

export function createTeacherAttendanceFlow({ store, students, send, adminNumber, now = () => new Date() }) {
  const teacher = adminNumber;
  const textPayload = (phone, body) => ({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body } });
  return async (phone, raw = '', messageId = '') => {
    const incoming = normalize(raw);
    if (!samePhone(phone, teacher)) {
      if (!explicitCommand(incoming)) return false;
      await send(phone, textPayload(phone, 'El pase de lista está disponible únicamente para el docente.'));
      return true;
    }
    try {
      const output = await store.transact(async db => {
        let control = db.controls[teacher] || { phase: 'idle' };
        if (!explicitCommand(incoming) && (control.phase === 'idle' || (control.phase === 'review' && incoming !== 'cancelar'))) return { handled: false, messages: [] };
        const currentRoster = await students.list();
        const dualIds = new Set(currentRoster.filter(a => a.period === PERIOD && a.status === 'Dual').map(a => a.id));
        const visible = a => !dualIds.has(a.id);
        const eligible = (s, a) => currentRoster.some(r => r.id === a.id && r.group === s.group && r.period === PERIOD && r.status === 'Activo');
        const messages = [];
        const text = body => messages.push(textPayload(phone, body));
        const timestamp = now().toISOString();
        const today = localDate(now());
        const audit = (action, session = '', folio = '', old = '', next = '') => db.history.push([timestamp, teacher, session, folio, old, next, action, messageId]);
        const setControl = next => { control = { ...next, token: shortId() }; db.controls[teacher] = control; };
        const buttons = (body, choices) => messages.push({ messaging_product: 'whatsapp', to: phone, type: 'interactive', interactive: {
          type: 'button', body: { text: body }, action: { buttons: choices.map(([id, title]) => ({ type: 'reply', reply: { id: `lista:${control.token}:${id}`, title } })) }
        } });
        const session = () => db.sessions[control.sessionId];
        function choose(title, choices, page = 0) {
          control.choices = choices;
          control.page = page;
          const selected = choices.slice(page * 9, page * 9 + 9).map((c, i) => ({ id: `lista:${control.token}:choice_${page * 9 + i}`, title: c.title.slice(0, 24), description: c.description?.slice(0, 72) }));
          if ((page + 1) * 9 < choices.length) selected.push({ id: `lista:${control.token}:more`, title: 'Más opciones' });
          messages.push({ messaging_product: 'whatsapp', to: phone, type: 'interactive', interactive: {
            type: 'list', body: { text: title }, action: { button: 'Elegir', sections: [{ title: 'Opciones', rows: selected }] }
          } });
        }
        function summary(s, onlyAbsences = false) {
          const counts = Object.fromEntries(['Presente', 'Falta', 'Retardo', 'Pendiente'].map(status => [status, s.students.filter(a => visible(a) && a.status === status).length]));
          text(`📊 ${s.group} · ${s.date}\n${s.subject}\n${s.status}\n\n✅ Presentes: ${counts.Presente}\n❌ Faltas: ${counts.Falta}\n🕒 Retardos: ${counts.Retardo}\n⏳ Pendientes: ${counts.Pendiente}`);
          let page = '❌ Alumnos con falta:\n';
          for (const a of s.students.filter(a => visible(a) && a.status === 'Falta')) {
            const line = `\n${a.name} — ${a.id}\n`;
            if (page.length + line.length > 3500) { text(page); page = '❌ Faltas (continuación):\n'; }
            page += line;
          }
          text(counts.Falta ? page : 'No hay alumnos registrados con falta.');
          if (!onlyAbsences) buttons('Revisa la lista. Puedes cambiar una falta con: retardo FOLIO.', [
            ['finish', 'Finalizar'], ['correct', 'Corregir'], ['absences', 'Ver faltas']
          ]);
        }
        function render() {
          const s = session();
          if (control.phase === 'numbered' && s) {
            if (s.numbered.mode === 'present') s.numbered.mode = 'absent';
            if (!validNumbered(s)) {
              delete s.numbered; setControl({ phase: 'review', sessionId: s.id });
              text('Cambió la lista o sus registros. No se guardaron marcas. Abre de nuevo pasar lista numeros GRUPO o retardos lista GRUPO para actualizar los números.'); return;
            }
            const modeTitle = s.numbered.mode === 'correct'
              ? 'Corrección de asistencia por números'
              : s.numbered.mode === 'late'
              ? 'Corrección de retardos por números'
              : 'Asistencia por números';
            let page = `📋 ${s.group} · ${s.date}\n${s.subject}\n${modeTitle}\n`;
            for (const [i, item] of s.numbered.items.entries()) {
              const a = s.students.find(a => a.id === item.id);
              const line = `\n${i + 1}. ${a.name} — ${a.id} · ${a.status}\n`;
              if (page.length + line.length > 3500) { text(page); page = `📋 ${s.group} · ${s.date} (continuación)\n`; }
              page += line;
            }
            text(page);
            text(s.numbered.mode === 'correct'
              ? 'Responde presentes 2,5-7, justificar 2,5, faltas 3,8 o retardos 1,4 con los números mostrados. Solo los seleccionados cambian; los demás conservan su estado.'
              : s.numbered.mode === 'absent'
              ? 'Responde faltas 2,6-8 con los números de quienes NO asistieron. También: faltas todos o faltas ninguno. Se guarda directamente: seleccionados Falta; TODOS los demás de esta lista Presente. Reemplaza las marcas anteriores de esta clase.'
              : 'Responde retardos 1-5.7,9 con los números mostrados. También: retardos todos o retardos ninguno. Solo los seleccionados cambiarán a Retardo; los demás conservan su estado. Se guarda directamente.');
          } else if (control.phase === 'folioNumbered') {
            let page = `📋 Asistencias de ${control.folioName}\nFolio: ${control.folio}\n`;
            for (const [i, item] of control.folioItems.entries()) {
              const line = `\n${i + 1}. ${item.date} · ${item.group}\n${item.subject} · ${item.status}\n`;
              if (page.length + line.length > 3500) {
                text(page);
                page = `📋 Asistencias de ${control.folioName} (continuación)\n`;
              }
              page += line;
            }
            text(page);
            text('Responde presentes 2,5-7 (o justificar 2,5-7), faltas 3,8, retardos 1,4, todos o ninguno. Solo cambian los números indicados.');
          } else if (control.phase === 'roll' && s) {
            const a = s.students[control.index];
            if (!visible(a)) { activate(s); return; }
            buttons(`📋 ${s.group} · ${s.date}\n${s.subject}\n\nAlumno ${s.students.filter(visible).findIndex(item => item.id === a.id) + 1} de ${s.students.filter(visible).length}\n${a.name}\n${a.id}\nEstado: ${a.status}\n\nElige un botón o escribe P, F o R.`, [['p', '✅ Presente'], ['f', '❌ Falta'], ['r', '🕒 Retardo']]);
          } else if (control.phase === 'review' && s) summary(s);
          else if (control.phase === 'start') buttons(`📋 ${control.group} · ${control.date}\n${SUBJECTS[control.subjectKey]}\n¿Comenzamos?`, [['yes', 'Comenzar'], ['no', 'Cancelar']]);
          else if (control.phase === 'subject') choose('Selecciona la materia de esta clase.', control.choices);
          else if (['selectSession', 'selectCorrection', 'selectLateList', 'selectBulkCorrection'].includes(control.phase)) choose('Selecciona la clase (fecha y materia).', control.choices, control.page || 0);
          else if (control.phase === 'correctStatus') buttons(`Corregir: ${control.studentName}\n${s.group} · ${s.date}\n${s.subject}\nSelecciona el estado correcto.`, [['p', 'Presente'], ['f', 'Falta'], ['r', 'Retardo']]);
          else if (control.phase === 'confirmCorrection') {
            const a = s.students.find(a => a.id === control.studentId);
            buttons(`${a.name}\n${s.group} · ${s.date}\n${s.subject}\n\nCambiar ${a.status} → ${control.newStatus}\n¿Confirmas?`, [['yes', 'Sí, cambiar'], ['no', 'Cancelar']]);
          } else if (control.phase === 'askFolio') text('Escribe el folio del alumno que quieres corregir.');
          else text(HELP);
        }
        function activate(s) {
          if (s.numbered) { setControl({ phase: 'numbered', sessionId: s.id }); render(); return; }
          const index = s.students.findIndex(a => visible(a) && a.status === 'Pendiente');
          if (index < 0 || s.status === 'Finalizada') setControl({ phase: 'review', sessionId: s.id });
          else { s.status = 'En curso'; s.updatedAt = timestamp; setControl({ phase: 'roll', sessionId: s.id, index }); }
          render();
        }
        function validNumbered(s) {
          const items = s.students.filter(a => eligible(s, a));
          return items.length === s.numbered.items.length && s.numbered.items.every(item => items.some(a => a.id === item.id && a.status === item.status && a.updatedAt === item.updatedAt));
        }
        function openNumbered(s, mode) {
          const items = s.students.filter(a => eligible(s, a)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
          if (!items.length) { text('Esta clase no tiene alumnos activos en su lista.'); return; }
          s.numbered = { mode, items: items.map(a => ({ id: a.id, status: a.status, updatedAt: a.updatedAt })) };
          setControl({ phase: 'numbered', sessionId: s.id }); render();
        }
        function openFolioCorrections(folio, dates) {
          const student = currentRoster.find(a => a.id === folio && a.period === PERIOD);
          if (!student) {
            text('No encontré ese folio en el periodo actual.');
            return;
          }
          const [firstMonth, lastMonth] = PERIOD.split(' / ');
          const sessions = Object.values(db.sessions)
            .filter(s => s.teacher === teacher && s.date.slice(0, 7) >= firstMonth && s.date.slice(0, 7) <= lastMonth &&
              s.students.some(a => a.id === folio) && (!dates || dates.includes(s.date)))
            .sort((a, b) => a.date.localeCompare(b.date) || a.subject.localeCompare(b.subject, 'es'));
          const items = sessions.map(s => {
            const entry = s.students.find(a => a.id === folio);
            return {
              sessionId: s.id,
              date: s.date,
              group: s.group,
              subject: s.subject,
              status: entry.status,
              updatedAt: entry.updatedAt
            };
          });
          if (!items.length) {
            text(`No encontré asistencias para ${student.fullName} en el periodo actual.`);
            return;
          }
          setControl({ phase: 'folioNumbered', folio, folioName: student.fullName, folioItems: items });
          render();
        }
        function prepareCorrection(s, studentId, newStatus, returnTo) {
          const a = s.students.find(a => a.id === studentId);
          if (!visible(a)) { text('El alumno está en Dual. Su asistencia histórica se conserva; no se modificó.'); return; }
          setControl({ phase: newStatus ? 'confirmCorrection' : 'correctStatus', sessionId: s.id, studentId, studentName: a.name, newStatus, returnTo });
          render();
        }
        if ((control.phase === 'roll' && session()?.students[control.index] && !visible(session().students[control.index])) ||
            (['correctStatus', 'confirmCorrection'].includes(control.phase) && dualIds.has(control.studentId))) {
          audit('Actualizar lista por Dual');
          text('El alumno pasó a Dual. No se aplicó la respuesta; la lista se actualizó.');
          activate(session()); return { handled: true, messages };
        }
        if (messageId && db.seen.has(messageId)) { render(); return { handled: true, messages }; }
        let command = incoming;
        if (incoming.startsWith('lista:')) {
          const [, token, action] = incoming.split(':');
          if (token !== control.token) { text('Ese botón pertenece a un paso anterior. Usa la opción actual.'); render(); return { handled: true, messages }; }
          command = action;
        }
        // Recibo persistente: el mismo mensaje no puede marcar al siguiente alumno.
        audit('Comando de lista');
        if (/^retardos lista(?:\s|$)/.test(command)) {
          const args = command.slice('retardos lista'.length).trim();
          const match = /^(.*?)(?:\s+(\d{4}-\d{2}-\d{2}))?$/.exec(args);
          const group = GROUPS.find(g => normalize(g) === match[1]);
          const date = match[2] || today;
          if (!group) text(`Usa retardos lista GRUPO o retardos lista GRUPO AAAA-MM-DD. Grupos: ${GROUPS.join(', ')}.`);
          else {
            const available = Object.values(db.sessions).filter(s => s.teacher === teacher && s.group === group && s.date === date);
            if (!available.length) text(`No hay lista para ${group} en ${date}. Primero pasa asistencia.`);
            else if (available.length === 1) openNumbered(available[0], 'late');
            else { setControl({ phase: 'selectLateList' }); choose('Elige la clase para corregir retardos.', available.map(s => ({ key: s.id, title: `${s.date} ${s.group}`, description: s.subject }))); }
          }
        } else if (/^corregir (?:alumno|asistencias)\s+edu-[a-z0-9]+-\d+/.test(command)) {
          const match = /^corregir (?:alumno|asistencias)\s+(edu-[a-z0-9]+-\d+)(?:\s+(.+))?$/.exec(command);
          const folio = match[1].toUpperCase();
          const datesText = (match[2] || '').trim();
          const dates = datesText ? datesText.split(',').map(date => date.trim()) : null;
          if (dates && (dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date)))) {
            text('Las fechas deben tener formato AAAA-MM-DD separadas por comas.');
          } else {
            openFolioCorrections(folio, dates);
          }
        } else if (/^corregir\s+edu-[a-z0-9]+-\d+\s+\d{4}-\d{2}-\d{2}(?:\s*,\s*\d{4}-\d{2}-\d{2})+$/.test(command)) {
          const match = /^corregir\s+(edu-[a-z0-9]+-\d+)\s+(.+)$/.exec(command);
          const dates = match[2].split(',').map(date => date.trim());
          openFolioCorrections(match[1].toUpperCase(), dates);
        } else if (/^corregir (?:lista|asistencias)(?:\s|$)/.test(command)) {
          const match = /^corregir (?:lista|asistencias)(?:\s+(.+))?$/.exec(command);
          const args = (match?.[1] || '').trim();
          if (!args && session()) {
            openNumbered(session(), 'correct');
          } else {
            const parsed = /^(.*?)(?:\s+(\d{4}-\d{2}-\d{2}))?$/.exec(args);
            const group = GROUPS.find(g => normalize(g) === (parsed?.[1] || '').trim());
            const date = parsed?.[2] || today;
            if (!group) {
              text(`Usa corregir lista GRUPO o corregir asistencias GRUPO AAAA-MM-DD. Grupos: ${GROUPS.join(', ')}.`);
            } else {
              const available = Object.values(db.sessions).filter(s => s.teacher === teacher && s.group === group && s.date === date);
              if (!available.length) text(`No hay lista para ${group} en ${date}. Primero pasa asistencia.`);
              else if (available.length === 1) openNumbered(available[0], 'correct');
              else {
                setControl({ phase: 'selectBulkCorrection' });
                choose('Elige la clase que quieres corregir.', available.map(s => ({ key: s.id, title: `${s.date} ${s.group}`, description: s.subject })));
              }
            }
          }
        } else if (control.phase === 'folioNumbered' && /^(presentes|justificar|faltas|retardos)(?:\s|$)/.test(command)) {
          const kind = command.split(' ')[0];
          const rawSelection = command.slice(kind.length).trim();
          const indexes = rawSelection === 'todos'
            ? control.folioItems.map((_, i) => i)
            : rawSelection === 'ninguno'
            ? []
            : parseSelection(rawSelection.replaceAll('.', ','), control.folioItems.length);
          if (indexes === null) {
            text('Selección inválida. Usa números de la lista, separados por comas o puntos, y rangos como 1-5.7,9. No se guardó ningún cambio.');
          } else if (indexes.length === 0) {
            text('No se cambió ninguna marca. La lista sigue abierta para corrección.');
            render();
          } else {
            const nextStatus = kind === 'faltas' ? 'Falta' : kind === 'retardos' ? 'Retardo' : 'Presente';
            const valid = indexes.every(index => {
              const item = control.folioItems[index];
              const s = db.sessions[item.sessionId];
              const a = s?.students.find(student => student.id === control.folio);
              return a && a.status === item.status && a.updatedAt === item.updatedAt;
            });
            if (!valid) {
              setControl({ phase: 'idle' });
              text('Alguna asistencia cambió desde que se mostró la lista. No se modificó nada; abre de nuevo corregir alumno FOLIO.');
            } else {
              let changed = 0;
              const folioName = control.folioName;
              for (const index of indexes) {
                const item = control.folioItems[index];
                const s = db.sessions[item.sessionId];
                const a = s.students.find(student => student.id === control.folio);
                if (a.status === nextStatus) continue;
                audit('Corregir por folio', s.id, control.folio, a.status, nextStatus);
                a.status = nextStatus;
                a.updatedAt = timestamp;
                s.updatedAt = timestamp;
                if (s.status !== 'Finalizada') {
                  s.status = s.students.some(student => visible(student) && student.status === 'Pendiente') ? 'En curso' : 'En revisión';
                }
                changed++;
              }
              setControl({ phase: 'idle' });
              text(changed
                ? `✅ ${changed} asistencias de ${folioName} cambiadas a ${nextStatus}. Los demás alumnos y fechas no se modificaron.`
                : `No hubo cambios: las fechas seleccionadas ya estaban en ${nextStatus}.`);
            }
          }
        } else if (control.phase === 'numbered' && session()?.numbered?.mode === 'correct' && /^(presentes|justificar|faltas|retardos)(?:\s|$)/.test(command)) {
          const s = session();
          if (!validNumbered(s)) {
            render();
          } else {
            const kind = command.split(' ')[0];
            const rawSelection = command.slice(kind.length).trim();
            const indexes = rawSelection === 'todos'
              ? s.numbered.items.map((_, i) => i)
              : rawSelection === 'ninguno'
              ? []
              : parseSelection(rawSelection.replaceAll('.', ','), s.numbered.items.length);
            if (indexes === null) {
              text('Selección inválida. Usa números de la lista, separados por comas o puntos, y rangos como 1-5.7,9. No se guardó ningún cambio.');
            } else if (indexes.length === 0) {
              text('No se cambió ninguna marca. La lista sigue abierta para corrección.');
              render();
            } else {
              const nextStatus = kind === 'faltas' ? 'Falta' : kind === 'retardos' ? 'Retardo' : 'Presente';
              let changed = 0;
              for (const index of indexes) {
                const item = s.numbered.items[index];
                const student = s.students.find(a => a.id === item.id);
                if (!student || student.status === nextStatus) continue;
                audit('Corregir por lista', s.id, student.id, student.status, nextStatus);
                student.status = nextStatus;
                student.updatedAt = timestamp;
                changed++;
              }
              delete s.numbered;
              s.updatedAt = timestamp;
              if (s.status !== 'Finalizada') {
                s.status = s.students.some(a => visible(a) && a.status === 'Pendiente') ? 'En curso' : 'En revisión';
              }
              setControl({ phase: 'review', sessionId: s.id });
              text(changed
                ? `✅ ${changed} alumnos cambiados a ${nextStatus}. Los demás conservaron su estado.`
                : `No hubo cambios: los alumnos seleccionados ya estaban en ${nextStatus}.`);
              summary(s, true);
            }
          }
        } else if (/^presentes(?:\s|$)/.test(command)) {
          text('El pase por números ahora usa faltas. Escribe faltas 2,6-8 para quienes no asistieron, o faltas ninguno si asistieron todos. No se cambió ninguna marca.');
          if (control.phase === 'numbered') render();
        } else if (/^(faltas|retardos)(?:\s|$)/.test(command)) {
          const s = session();
          const kind = command.split(' ')[0];
          if (s?.numbered?.mode === 'present') s.numbered.mode = 'absent';
          if (control.phase !== 'numbered' || !s?.numbered || (kind === 'faltas' ? 'absent' : 'late') !== s.numbered.mode) {
            text('Primero abre pasar lista numeros GRUPO para indicar faltas, o retardos lista GRUPO para retardos.');
          } else if (!validNumbered(s)) {
            render();
          } else {
            const rawSelection = command.slice(kind.length).trim();
            const indexes = rawSelection === 'todos' ? s.numbered.items.map((_, i) => i) : rawSelection === 'ninguno' ? [] : parseSelection(rawSelection.replaceAll('.', ','), s.numbered.items.length);
            if (indexes === null) text('Selección inválida. Usa números de la lista, separados por comas o puntos, y rangos como 1-5.7,9. No se guardó ningún cambio.');
            else {
              const selected = new Set(indexes);
              const mode = s.numbered.mode;
              s.numbered.items.forEach((item, i) => {
                if (mode === 'late' && !selected.has(i)) return;
                const a = s.students.find(a => a.id === item.id);
                const next = mode === 'late' ? 'Retardo' : selected.has(i) ? 'Falta' : 'Presente';
                audit(mode === 'late' ? 'Retardo por lista' : 'Asistencia por lista', s.id, a.id, a.status, next);
                a.status = next; a.updatedAt = timestamp;
              });
              delete s.numbered; s.updatedAt = timestamp;
              if (s.status !== 'Finalizada') s.status = s.students.some(a => visible(a) && a.status === 'Pendiente') ? 'En curso' : 'En revisión';
              setControl({ phase: 'review', sessionId: s.id });
              text(mode === 'late' ? `✅ ${indexes.length} alumnos marcados con Retardo. Los demás conservaron su estado.` : '✅ Asistencia guardada: los seleccionados tienen falta y los demás de la lista están presentes.');
              summary(s);
            }
          }
        } else if (command.startsWith('pasar lista')) {
          const numbered = /^pasar lista numeros(?:\s|$)/.test(command);
          const group = GROUPS.find(g => normalize(g) === command.slice(numbered ? 'pasar lista numeros'.length : 'pasar lista'.length).trim());
          if (!group) { text(`Escribe pasar lista seguido del grupo: ${GROUPS.join(', ')}.`); return { handled: true, messages }; }
          const current = session();
          if (current && control.phase === 'roll') {
            text('Tienes un pase de lista en curso. Escribe pausar lista antes de abrir otro grupo.'); render();
          } else {
            const subjects = subjectsFor(group);
            if (subjects.length > 1) {
              setControl({ phase: 'subject', group, date: today, numbered });
              choose('Selecciona la materia.', subjects.map(key => ({ key, title: key === 'energia' ? 'Energía: vida diaria' : 'Materia y organismos', description: SUBJECTS[key] })));
            } else { setControl({ phase: 'start', group, date: today, subjectKey: subjects[0], numbered }); render(); }
          }
        } else if (command === 'pausar lista') {
          const s = session();
          if (s && s.status !== 'Finalizada') { s.status = 'Pausada'; s.updatedAt = timestamp; audit('Pausar', s.id); }
          setControl({ phase: 'idle' });
          text('Avance guardado. Para retomarlo escribe continuar lista.');
        } else if (command.startsWith('continuar lista')) {
          const groupText = command.slice('continuar lista'.length).trim();
          const open = Object.values(db.sessions).filter(s => s.teacher === teacher && (s.status !== 'Finalizada' || s.numbered) && (!groupText || normalize(s.group) === groupText)).sort((a, b) => b.date.localeCompare(a.date));
          if (!open.length) text('No hay listas abiertas para esa selección. Escribe pasar lista y el grupo.');
          else if (open.length === 1) activate(open[0]);
          else { setControl({ phase: 'selectSession' }); choose('¿Qué lista deseas continuar?', open.map(s => ({ key: s.id, title: `${s.date} ${s.group}`, description: `${s.subject} · ${s.status}` }))); }
        } else if (command === 'more' && control.choices) {
          control.page = (control.page || 0) + 1;
          control.token = shortId();
          choose('Selecciona la clase.', control.choices, control.page);
        } else if (command.startsWith('choice_') && control.choices) {
          const choice = control.choices[Number(command.slice(7))];
          if (!choice) text('Selección no válida.');
          else if (control.phase === 'subject') { setControl({ phase: 'start', group: control.group, date: control.date, subjectKey: choice.key, numbered: control.numbered }); render(); }
          else if (control.phase === 'selectLateList') openNumbered(db.sessions[choice.key], 'late');
          else if (control.phase === 'selectBulkCorrection') openNumbered(db.sessions[choice.key], 'correct');
          else if (control.phase === 'selectSession') activate(db.sessions[choice.key]);
          else if (control.phase === 'selectCorrection') prepareCorrection(db.sessions[choice.key], control.studentId, control.newStatus, control.returnTo);
        } else if (control.phase === 'start' && ['yes', 'si', 'no'].includes(command)) {
          if (command === 'no') { setControl({ phase: 'idle' }); text('Inicio cancelado.'); }
          else {
            const existing = Object.values(db.sessions).find(s => s.date === control.date && s.group === control.group && s.subjectKey === control.subjectKey && s.teacher === teacher);
            if (existing) {
              text('Esta clase ya tiene una lista. Recuperé su avance.');
              if (control.numbered) openNumbered(existing, 'absent');
              else { delete existing.numbered; activate(existing); }
            }
            else {
              const roster = (await students.list()).filter(a => a.group === control.group && a.period === PERIOD && a.status === 'Activo').sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
              if (!roster.length) { text('Este grupo no tiene alumnos activos registrados. Regístralos antes de iniciar.'); setControl({ phase: 'idle' }); }
              else {
                const s = { id: randomUUID(), date: control.date, group: control.group, subjectKey: control.subjectKey, subject: SUBJECTS[control.subjectKey], partial: CURRENT_PARTIAL, teacher,
                  status: 'En curso', createdAt: timestamp, updatedAt: timestamp,
                  students: roster.map(a => ({ id: a.id, name: a.fullName, status: 'Pendiente', updatedAt: timestamp })) };
                db.sessions[s.id] = s; audit('Iniciar', s.id);
                if (control.numbered) openNumbered(s, 'absent'); else activate(s);
              }
            }
          }
        } else if (command === 'anterior' && session() && ['roll', 'review'].includes(control.phase)) {
          const s = session();
          if (s.status === 'Finalizada') text('Para modificar una lista finalizada escribe corregir seguido del folio.');
          else {
            const limit = control.phase === 'review' ? s.students.length : control.index;
            let index = s.students.findLastIndex((a, i) => visible(a) && i < limit);
            if (index < 0) index = s.students.findIndex(visible);
            if (index < 0) activate(s);
            else { setControl({ phase: 'roll', sessionId: s.id, index }); render(); }
          }
        } else if (statuses[command] && control.phase === 'roll') {
          const s = session();
          const a = s.students[control.index];
          const old = a.status;
          a.status = statuses[command]; a.updatedAt = timestamp; s.updatedAt = timestamp;
          audit('Marcar', s.id, a.id, old, a.status);
          const next = s.students.findIndex((a, i) => visible(a) && i > control.index && a.status === 'Pendiente');
          const index = next >= 0 ? next : s.students.findIndex(a => visible(a) && a.status === 'Pendiente');
          if (index < 0) { s.status = 'En revisión'; setControl({ phase: 'review', sessionId: s.id }); }
          else setControl({ phase: 'roll', sessionId: s.id, index });
          render();
        } else if (['finalizar lista', 'finish'].includes(command)) {
          const s = session();
          if (s) delete s.numbered;
          if (!s) text('No hay una lista seleccionada.');
          else if (s.students.some(a => visible(a) && a.status === 'Pendiente')) { text('Aún hay alumnos pendientes. No se convertirán en faltas automáticamente.'); activate(s); }
          else { s.status = 'Finalizada'; s.updatedAt = timestamp; audit('Finalizar', s.id); setControl({ phase: 'review', sessionId: s.id }); text('✅ Lista finalizada y guardada. Puedes corregirla después con corregir FOLIO o retardo FOLIO.'); summary(s, true); }
        } else if (['ver faltas', 'absences', 'resumen lista'].includes(command)) {
          if (session()) { summary(session(), true); if (control.phase === 'roll') render(); }
          else text('Selecciona una lista con continuar lista o pasar lista GRUPO.');
        } else if (['correct', 'corregir'].includes(command) && session()) {
          setControl({ phase: 'askFolio', sessionId: session().id, returnTo: { ...control } }); render();
        } else if (/^(retardo|corregir)\s/.test(command) || (control.phase === 'askFolio' && command.startsWith('edu-'))) {
          const parts = command.split(' ');
          const folio = (control.phase === 'askFolio' && parts[0].startsWith('edu-') ? parts[0] : parts[1]).toUpperCase();
          const date = parts[2];
          if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { text('La fecha debe tener formato AAAA-MM-DD.'); return { handled: true, messages }; }
          const candidates = Object.values(db.sessions).filter(s => s.teacher === teacher && s.students.some(a => a.id.toUpperCase() === folio) &&
            (control.phase === 'askFolio' ? s.id === control.sessionId : s.date === (date || today)));
          const newStatus = parts[0] === 'retardo' ? 'Retardo' : undefined;
          const returnTo = control.phase === 'askFolio' ? control.returnTo : { ...control };
          if (!candidates.length) text('No encontré ese folio en las listas de esa fecha. Verifica el folio o escribe corregir FOLIO AAAA-MM-DD.');
          else if (candidates.length === 1) prepareCorrection(candidates[0], folio, newStatus, returnTo);
          else { setControl({ phase: 'selectCorrection', studentId: folio, newStatus, returnTo }); choose('El alumno tiene varias clases. ¿Cuál quieres corregir?', candidates.map(s => ({ key: s.id, title: `${s.date} ${s.group}`, description: s.subject }))); }
        } else if (control.phase === 'correctStatus' && statuses[command]) {
          setControl({ ...control, phase: 'confirmCorrection', newStatus: statuses[command] }); render();
        } else if (control.phase === 'confirmCorrection' && ['yes', 'si', 'no'].includes(command)) {
          const s = session();
          if (command !== 'no') {
            const a = s.students.find(a => a.id === control.studentId);
            audit('Corregir', s.id, a.id, a.status, control.newStatus);
            a.status = control.newStatus; a.updatedAt = timestamp; s.updatedAt = timestamp;
            text(`✅ ${a.name}: ${a.status}. Corrección guardada en ${s.group}, ${s.date}.`);
          } else text('Corrección cancelada.');
          const back = control.returnTo;
          setControl(back && ['roll', 'review'].includes(back.phase) ? back : { phase: 'review', sessionId: s.id }); render();
        } else if (command === 'cancelar') {
          const s = session();
          if (s) delete s.numbered;
          if (s && s.status !== 'Finalizada') { s.status = 'Pausada'; s.updatedAt = timestamp; }
          setControl({ phase: 'idle' }); text('Operación cerrada. Los registros guardados se conservan.');
        } else {
          text(HELP); render();
        }
        db.controls[teacher] = control;
        return { handled: true, messages };
      });
      for (const payload of output.messages) await send(phone, payload);
      return output.handled;
    } catch (error) {
      console.error('Error en pase de lista:', error.message);
      await send(phone, textPayload(phone, 'No pude completar la operación. Escribe continuar lista para recuperar el estado guardado antes de seguir marcando alumnos.'));
      return true;
    }
  };
}
