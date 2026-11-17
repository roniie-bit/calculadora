import { randomUUID } from 'node:crypto';
import { GROUPS, PERIOD, normalize } from '../services/studentService.js';
import { SUBJECTS } from './teacherAttendanceFlow.js';
import { CURRENT_PARTIAL } from '../config/grading.js';
import { samePhone } from '../utils/phone.js';
import { parseSelection } from '../utils/numberSelection.js';
export { parseSelection } from '../utils/numberSelection.js';

export const isTaskCommand = command => /^(tareas grupo(?:\s|$)|crear tarea(?:\s|$)|revisar pendientes(?:\s|$)|entregaron(?:\s|$)|revisar tarea(?:\s|$)|resumen tarea(?:\s|$)|pendientes tarea(?:\s|$)|tareas alumno(?:\s|$)|entrega(?:\s|$)|pausar tarea$|continuar tarea(?:\s|$)|anterior tarea$|finalizar tarea$|tarea:)/.test(normalize(command));
export function parsePoints(raw) {
  if (!/^\d{1,6}(?:[.,]\d{1,2})?$/.test(raw.trim())) return null;
  return Number(raw.replace(',', '.'));
}
const HELP = 'Comandos: tareas grupo · tareas grupo GRUPO · crear tarea GRUPO · revisar tarea GRUPO · revisar tarea lista GRUPO · revisar pendientes GRUPO · entregaron 1, 3 · pendientes tarea GRUPO · resumen tarea GRUPO · tareas alumno FOLIO · entrega T01 FOLIO 0.7 · pausar tarea · continuar tarea · anterior tarea.';
const bulkResume = control => control.phase === 'fullList' ? { taskId: control.taskId, phase: 'fullList', listIds: control.listIds } : control.bulkIds ? { taskId: control.taskId, bulkIds: control.bulkIds, bulkPoints: control.bulkPoints } : control.pausedBulk;
export function createTeacherTaskFlow({ store, students, send, adminNumber, suspendOther = async () => {}, now = () => new Date() }) {
  const teacher = adminNumber;
  return async (phone, raw = '', messageId = '') => {
    const normalized = normalize(raw);
    const input =
      samePhone(phone, teacher) && /^registrar tarea(?:\s|$)/.test(normalized)
        ? `crear tarea${normalized.slice("registrar tarea".length)}`
        : normalized;
    if (!samePhone(phone, teacher)) {
      if (!isTaskCommand(input)) return false;
      await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: 'Las entregas y los puntos solo puede registrarlos y consultarlos el docente.' } });
      return true;
    }
    // Permite cambiar explícitamente a los otros módulos sin consumir su comando.
    try {
      if (/^(pasar lista|retardos(?:\s|$)|presentes(?:\s|$)|faltas(?:\s|$)|continuar lista|pausar lista|finalizar lista|ver faltas|resumen lista|corregir|retardo |lista:|registrarme$|mis grupos$|lista )/.test(input)) {
        await store.transact(db => {
          const current = db.controls[teacher];
          if (current && !['idle', 'summary'].includes(current.phase)) db.controls[teacher] = { phase: 'idle', lastTaskId: current.taskId || current.lastTaskId, pausedBulk: bulkResume(current) };
        });
        return false;
      }
      const inventory = /^tareas grupo(?:\s+(.*))?$/.exec(input);
      if (isTaskCommand(input) && !inventory) await suspendOther();
      const result = await store.transact(async db => {
        let c = db.controls[teacher] || { phase: 'idle' };
        if (!isTaskCommand(input) && ['idle', 'summary'].includes(c.phase)) return { handled: false, messages: [] };
        const dualIds = new Set((await students.list()).filter(a => a.period === PERIOD && a.status === 'Dual').map(a => a.id));
        const visible = a => !dualIds.has(a.id);
        const messages = [];
        const timestamp = now().toISOString();
        const text = body => messages.push({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body } });
        const set = next => { c = { ...next, token: randomUUID().slice(0, 8) }; db.controls[teacher] = c; };
        const task = () => db.sessions[c.taskId];
        const log = (action, t, a, before = '', after = '') => db.history.push([timestamp, teacher, t?.id || '', a?.id || '', before, after, action, messageId]);
        const buttons = (body, choices) => messages.push({ messaging_product: 'whatsapp', to: phone, type: 'interactive', interactive: {
          type: 'button', body: { text: body }, action: { buttons: choices.map(([key, title]) => ({ type: 'reply', reply: { id: `tarea:${c.token}:${key}`, title } })) }
        } });
        function choices(body, rows, page = 0) {
          c.choices = rows; c.page = page;
          const items = rows.slice(page * 9, page * 9 + 9).map((r, i) => ({ id: `tarea:${c.token}:pick_${page * 9 + i}`, title: r.title.slice(0, 24), description: (r.description || '').slice(0, 72) }));
          if ((page + 1) * 9 < rows.length) items.push({ id: `tarea:${c.token}:more`, title: 'Más tareas' });
          messages.push({ messaging_product: 'whatsapp', to: phone, type: 'interactive', interactive: { type: 'list', body: { text: body }, action: { button: 'Elegir', sections: [{ title: 'Opciones', rows: items }] } } });
        }
        function lines(title, entries) {
          let page = title;
          for (const entry of entries) {
            if (page.length + entry.length + 2 > 3500) { text(page); page = `${title} (continuación)`; }
            page += `\n\n${entry}`;
          }
          text(page);
        }
        function report(t, pending = false) {
          const statusRows = status => t.students.filter(a => visible(a) && a.status === status);
          text(`📋 ${t.id} — ${t.name}\n${t.group} · ${t.subject}\nValor: ${t.value}\n\n✅ Entregaron: ${statusRows('Entregó').length}\n❌ No entregaron: ${statusRows('No entregó').length}\n⏳ Sin revisar: ${statusRows('Sin revisar').length}`);
          if (pending) {
            for (const status of ['No entregó', 'Sin revisar']) lines(`${status}:`, statusRows(status).map(a => `${a.name} — ${a.id}`).concat(statusRows(status).length ? [] : ['Ninguno.']));
          } else lines('Puntos por alumno:', t.students.filter(visible).map(a => `${a.name} — ${a.id}\n${a.status} · ${a.points ?? '—'} puntos`));
        }
        function bulkList(t) {
          text(`📋 ${t.id} — ${t.name}\n${t.group}\nPuntaje de esta revisión: ${c.bulkPoints}\nLos números se conservan durante esta revisión.`);
          for (const status of ['No entregó', 'Sin revisar']) {
            const entries = c.bulkIds.flatMap((id, i) => {
              const a = t.students.find(a => a.id === id);
              return a && visible(a) && a.status === status ? [`${i + 1}. ${a.name} — ${a.id}${status === 'No entregó' ? ' · 0 puntos' : ''}`] : [];
            });
            lines(`${status}:`, entries.length ? entries : ['Ninguno.']);
          }
          text('Escribe entregaron 1, 3 (también acepta 5-8). Puedes seleccionar nombres de cualquiera de las dos secciones. Solo ellos recibirán los puntos, después de confirmar.\nLos demás conservan su estado: No entregó sigue en 0; Sin revisar permanece sin revisar.\nPara terminar: finalizar tarea.');
        }
        function render() {
          const t = task();
          if (c.phase === 'fullList' && c.listIds.some(id => dualIds.has(id))) {
            set({ phase: 'summary', taskId: t.id });
            text(`Cambió la lista: hay alumnos duales. Abre revisar tarea lista ${t.group} para obtener la numeración actualizada. No se cambiaron puntos.`);
          } else if (c.phase === 'fullList') {
            lines(`📋 ${t.id} — ${t.name}\n${t.group} · Registro por lista`, c.listIds.map((id, i) => {
              const a = t.students.find(a => a.id === id);
              return `${i + 1}. ${a.name} — ${a.id}`;
            }));
            text('Responde entregaron 1-7.9, 10-15,19-39 usando los números de esta lista. Acepta comas o puntos y rangos. Para marcar a todos: entregaron todos. Si nadie entregó: entregaron ninguno.\nSe guardará en una sola respuesta: los seleccionados tendrán Entregó · 1 punto y TODOS los demás de esta lista No entregó · 0 puntos. Esto reemplaza sus registros anteriores, aunque la tarea tenga otro valor.');
          } else if (c.phase === 'bulkPoints') text(`${t.id} — ${t.name}\n${t.group}\n¿Cuántos puntos darás a quienes entreguen en esta revisión? Por ejemplo: 0.7. No se modifican entregas anteriores.`);
          else if (c.phase === 'bulk') bulkList(t);
          else if (c.phase === 'confirmBulk') {
            lines(`Confirmar entregas · ${t.id} · ${t.group}\nPuntaje por alumno: ${c.bulkPoints}`, c.selected.map(item => {
              const a = t.students.find(a => a.id === item.id);
              return `${a.name} — ${a.id}\n${item.status} → Entregó · ${c.bulkPoints} puntos`;
            }));
            buttons(`¿Guardar estas ${c.selected.length} entregas? Los demás conservan su estado y puntos.`, [['yes', 'Guardar'], ['no', 'Cancelar']]);
          } else if (c.phase === 'confirmZeros') {
            lines(`${t.id} · ${t.group}\nAlumnos SIN REVISAR que pasarían a No entregó · 0:`, c.zeroIds.map(id => {
              const a = t.students.find(a => a.id === id); return `${a.name} — ${id}`;
            }));
            buttons(`Quedan ${c.zeroIds.length} alumnos sin revisar. ¿Marcarlos como No entregó con 0 puntos y terminar?`, [['yes', 'Sí, poner cero'], ['no', 'Dejar sin revisar']]);
          } else if (c.phase === 'review') {
            const a = t.students[c.index];
            if (!visible(a)) { advance(t); return; }
            buttons(`${t.id} — ${t.name}\n${t.group} · Valor: ${t.value}\n\nAlumno ${t.students.filter(visible).findIndex(s => s.id === a.id) + 1} de ${t.students.filter(visible).length}\n${a.name}\n${a.id}\n${a.status} · ${a.points ?? '—'} puntos`, [['yesDelivery', 'Entregó'], ['noDelivery', 'No entregó'], ['custom', 'Otro puntaje']]);
          } else if (c.phase === 'name') text('¿Cómo se llama la tarea? Escribe el nombre (máximo 120 caracteres).');
          else if (c.phase === 'value') text('¿Cuántos puntos vale? Por ejemplo: 1.');
          else if (c.phase === 'confirmCreate') buttons(`${c.group}\n${c.subject}\n${c.name}\nValor: ${c.value} puntos\n¿Crear la tarea?`, [['yes', 'Crear'], ['no', 'Cancelar']]);
          else if (['subject', 'select'].includes(c.phase)) choices(c.phase === 'subject' ? 'Elige la materia.' : `Elige una tarea de ${c.group}.`, c.choices, c.page || 0);
          else if (['custom', 'latePoints'].includes(c.phase)) text(`¿Cuántos puntos asignas a ${c.studentName}? Puedes escribir 0, 0.7, 1… (hasta dos decimales).`);
          else if (c.phase === 'confirmDelivery') {
            const a = t.students.find(a => a.id === c.studentId);
            buttons(`${a.name}\n${t.group} · ${t.id} — ${t.name}\nAntes: ${a.status} · ${a.points ?? '—'}\nNuevo: Entregó · ${c.points} puntos\n¿Guardar cambio?`, [['yes', 'Guardar'], ['no', 'Cancelar']]);
          } else if (c.phase === 'summary') report(t);
          else text(HELP);
        }
        function advance(t, start = 0) {
          let index = t.students.findIndex((a, i) => visible(a) && i >= start && a.status === 'Sin revisar');
          if (index < 0) index = t.students.findIndex(a => visible(a) && a.status === 'Sin revisar');
          if (index < 0) { set({ phase: 'summary', taskId: t.id }); text('✅ Revisión terminada. Puedes actualizar entregas después con entrega CLAVE FOLIO PUNTOS.'); }
          else set({ phase: 'review', taskId: t.id, index });
          render();
        }
        const owned = id => db.sessions[id]?.teacher === teacher ? db.sessions[id] : undefined;
        async function sync(t) {
          const active = (await students.list()).filter(a => a.group === t.group && a.period === t.period && a.status === 'Activo');
          for (const a of active) if (!t.students.some(s => s.id === a.id)) t.students.push({ id: a.id, name: a.fullName, status: 'Sin revisar', points: null });
          t.students.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        }
        function saveDelivery(t, a, status, points) {
          log('Actualizar entrega', t, a, `${a.status} | ${a.points ?? ''}`, `${status} | ${points}`);
          a.status = status; a.points = points; a.updatedAt = timestamp; t.updatedAt = timestamp;
        }
        if (inventory) {
          const group = inventory[1] ? GROUPS.find(g => normalize(g) === inventory[1]) : undefined;
          if (inventory[1] && !group) text(`Especifica el grupo completo: ${GROUPS.join(', ')}. O usa tareas grupo para ver todos.`);
          else {
            const roster = (await students.list()).filter(a => a.period === PERIOD && a.status === 'Activo');
            text(`📚 Tareas por grupo · ${PERIOD}\nCalificada = todos los alumnos activos revisados, incluidos quienes no entregaron y tienen 0. Solo aparecen tareas ya creadas en el bot.`);
            for (const currentGroup of group ? [group] : GROUPS) {
              const active = roster.filter(a => a.group === currentGroup);
              const tasks = Object.values(db.sessions).filter(t => t.teacher === teacher && t.period === PERIOD && t.group === currentGroup).sort((a, b) => a.id.localeCompare(b.id, 'es', { numeric: true }));
              const entries = tasks.map(t => {
                const reviewed = active.filter(a => ['Entregó', 'No entregó'].includes(t.students.find(s => s.id === a.id)?.status)).length;
                const state = !active.length ? 'Sin alumnos activos' : reviewed === active.length ? 'Calificada' : reviewed ? 'Parcialmente calificada' : 'Sin calificar';
                return { state, line: `${t.id} — ${t.name}\n${t.subject} · Valor: ${t.value}\n${state} · ${reviewed}/${active.length} alumnos revisados · ${active.length - reviewed} sin revisar` };
              });
              lines(`${currentGroup} · ${tasks.length} tareas\n✅ Calificadas: ${entries.filter(e => e.state === 'Calificada').length} · 📝 Parciales: ${entries.filter(e => e.state === 'Parcialmente calificada').length} · ⏳ Sin calificar: ${entries.filter(e => e.state === 'Sin calificar').length} · Sin alumnos: ${entries.filter(e => e.state === 'Sin alumnos activos').length}`, entries.length ? entries.map(e => e.line) : [`No hay tareas cargadas. Usa crear tarea ${currentGroup}.`]);
            }
          }
          return { handled: true, messages };
        }
        const currentDual = c.phase === 'review' && task()?.students[c.index] && !visible(task().students[c.index]);
        const proposedDual = ['custom', 'latePoints', 'confirmDelivery'].includes(c.phase) && dualIds.has(c.studentId);
        if (currentDual || proposedDual) {
          log('Actualizar revisión por Dual');
          text('El alumno pasó a Dual. No se aplicó la respuesta; la revisión se actualizó.');
          advance(task()); return { handled: true, messages };
        }
        if (c.phase === 'confirmBulk' && c.selected.some(a => !visible(a))) {
          set({ phase: 'bulk', taskId: c.taskId, bulkIds: c.bulkIds, bulkPoints: c.bulkPoints });
          text('Hay alumnos duales en la selección. No se aplicó el lote; selecciona nuevamente.'); render(); return { handled: true, messages };
        }
        if (c.phase === 'confirmZeros' && c.zeroIds.some(id => dualIds.has(id))) {
          set({ phase: 'summary', taskId: c.taskId }); text('Cambió la lista por alumnos duales. No se aplicaron ceros. Puedes volver a finalizar tarea.'); render(); return { handled: true, messages };
        }
        if (messageId && db.seen.has(messageId)) { render(); return { handled: true, messages }; }
        let command = input;
        if (input.startsWith('tarea:')) {
          const [, token, action] = raw.trim().split(':');
          if (token !== c.token) { text('Ese botón ya no corresponde al paso actual.'); render(); return { handled: true, messages }; }
          command = action.toLowerCase();
        }
        log('Comando de tareas');
        const groupCommand = /^revisar tarea lista(?:\s+(.*))?$/.test(command)
          ? ['revisar tarea lista', 'fullList', command.slice('revisar tarea lista'.length).trim()]
          : /^revisar pendientes(?:\s+(.*))?$/.test(command)
          ? ['revisar pendientes', 'bulk', command.slice('revisar pendientes'.length).trim()]
          : /^(crear|revisar|resumen|pendientes) tarea(?:\s+(.*))?$/.exec(command);
        if (groupCommand) {
          const group = GROUPS.find(g => normalize(g) === (groupCommand[2] || ''));
          if (!group) text(`Especifica el grupo completo: ${GROUPS.join(', ')}.`);
          else if (groupCommand[1] === 'crear') {
            const keys = group === '3A EV' ? ['terrestre'] : group.endsWith('LCM') ? ['energia', 'organismos'] : ['energia'];
            if (keys.length === 1) { set({ phase: 'name', group, subject: SUBJECTS[keys[0]] }); render(); }
            else { set({ phase: 'subject', group }); choices('Elige la materia.', keys.map(key => ({ key, title: key === 'energia' ? 'Energía: vida diaria' : 'Materia y organismos', description: SUBJECTS[key] }))); }
          } else {
            const available = Object.values(db.sessions).filter(t => t.group === group && t.teacher === teacher && t.period === PERIOD);
            if (!available.length) text(`No hay tareas para ${group}. Usa crear tarea ${group}.`);
            else { set({ phase: 'select', group, action: groupCommand[1] }); choices(`Tareas de ${group}`, available.map(t => ({ key: t.id, title: `${t.id} ${t.name}`, description: `${t.subject} · ${t.value} puntos` }))); }
          }
        } else if (command === 'more' && c.choices) {
          set({ ...c, page: (c.page || 0) + 1 }); render();
        } else if (/^pick_\d+$/.test(command) && c.choices) {
          const selected = c.choices[Number(command.slice(5))];
          if (!selected) text('Selección no válida.');
          else if (c.phase === 'subject') { set({ phase: 'name', group: c.group, subject: SUBJECTS[selected.key] }); render(); }
          else if (c.phase === 'select') {
            const t = owned(selected.key);
            if (!t || t.group !== c.group) text('Esa tarea no pertenece al grupo seleccionado.');
            else {
              await sync(t);
              if (c.action === 'fullList') {
                const active = (await students.list()).filter(a => a.group === t.group && a.period === t.period && a.status === 'Activo');
                const listIds = t.students.filter(a => active.some(s => s.id === a.id)).map(a => a.id);
                if (!listIds.length) text('No hay alumnos activos registrados en este grupo.');
                else { set({ phase: 'fullList', taskId: t.id, listIds }); render(); }
              } else if (c.action === 'bulk') {
                const ids = t.students.filter(a => visible(a) && a.status !== 'Entregó').map(a => a.id);
                if (!ids.length) { set({ phase: 'summary', taskId: t.id }); text('Todos los alumnos de esta tarea ya entregaron.'); report(t); }
                else { set({ phase: 'bulkPoints', taskId: t.id, bulkIds: ids }); render(); }
              } else if (c.action === 'revisar') {
                if (!t.students.length) text('No hay alumnos activos registrados en este grupo.');
                else advance(t);
              } else { const pending = c.action === 'pendientes'; set({ phase: 'summary', taskId: t.id }); report(t, pending); }
            }
          }
        } else if (command === 'pausar tarea' || command === 'cancelar') {
          const taskId = c.taskId || c.lastTaskId;
          set({ phase: 'idle', lastTaskId: taskId, pausedBulk: bulkResume(c) }); text('Avance guardado. Escribe continuar tarea para retomarlo, o revisar tarea GRUPO para elegir otra.');
        } else if (command === 'continuar tarea') {
          const t = owned(c.taskId || c.lastTaskId);
          if (!t) text('Elige la revisión con revisar tarea seguido del grupo.');
          else {
            const saved = bulkResume(c);
            if (saved?.taskId === t.id) { set({ ...saved, phase: saved.phase === 'fullList' ? 'fullList' : saved.bulkPoints === undefined ? 'bulkPoints' : 'bulk' }); render(); }
            else { await sync(t); advance(t); }
          }
        } else if (command.startsWith('entregaron')) {
          if (c.phase === 'fullList') {
            const selection = command.slice('entregaron'.length).trim();
            const indexes = selection === 'ninguno' ? [] : selection === 'todos' ? c.listIds.map((_, i) => i) : parseSelection(selection.replaceAll('.', ','), c.listIds.length);
            if (indexes === null) text('Selección inválida. Usa entregaron 1-7.9, 10-15, o entregaron ninguno. No se cambió ninguna entrega.');
            else {
              const t = task();
              const active = (await students.list()).filter(a => a.group === t.group && a.period === t.period && a.status === 'Activo');
              if (active.length !== c.listIds.length || !c.listIds.every(id => active.some(a => a.id === id) && t.students.some(a => a.id === id))) {
                text(`Cambió la lista del grupo. No se guardó ningún cambio. Vuelve a abrir revisar tarea lista ${t.group}.`);
              } else {
                const delivered = new Set(indexes);
                c.listIds.forEach((id, i) => saveDelivery(t, t.students.find(a => a.id === id), delivered.has(i) ? 'Entregó' : 'No entregó', delivered.has(i) ? 1 : 0));
                set({ phase: 'summary', taskId: t.id });
                text('✅ Registro por lista guardado.'); report(t);
              }
            }
          } else if (c.phase !== 'bulk') text('Primero usa revisar tarea lista GRUPO, o revisar pendientes GRUPO para entregas posteriores.');
          else {
            const indexes = parseSelection(command.slice('entregaron'.length).trim(), c.bulkIds.length);
            const t = task();
            const selected = indexes?.map(i => t.students.find(a => a.id === c.bulkIds[i]));
            if (!selected?.length || selected.some(a => !a || !visible(a) || a.status === 'Entregó')) text('Selección inválida. Usa los números de alumnos que todavía aparecen en la lista, por ejemplo: entregaron 1, 3-5. No se cambió ninguna entrega.');
            else {
              set({ ...c, phase: 'confirmBulk', selected: selected.map(a => ({ id: a.id, status: a.status, points: a.points })) }); render();
            }
          }
        } else if (command.startsWith('tareas alumno')) {
          const id = command.slice('tareas alumno'.length).trim().toUpperCase();
          const tasks = Object.values(db.sessions).filter(t => t.teacher === teacher && t.period === PERIOD && t.students.some(a => a.id === id));
          if (!tasks.length) text('No encontré entregas ni revisiones para ese folio. Verifica el folio del alumno.');
          else {
            let cents = 0;
            lines(`📚 ${tasks[0].students.find(a => a.id === id).name} — ${id}`, tasks.map(t => {
              const a = t.students.find(a => a.id === id); cents += Math.round((a.points || 0) * 100);
              return `${t.id} — ${t.name}\n${t.group} · ${a.status} · ${a.points ?? '—'} puntos`;
            }));
            text(`Total acumulado: ${cents / 100} puntos. Sin revisar no cuenta como cero ni como entrega.`);
          }
        } else if (command.startsWith('entrega')) {
          const match = /^entrega\s+(t\d+)\s+(edu-\S+)(?:\s+(\S+))?$/.exec(command);
          if (!match) text('Usa: entrega T01 EDU-5AMAM-015 0.7. El puntaje es opcional.');
          else {
            const t = owned(match[1].toUpperCase());
            const a = (await students.list()).find(a => a.id.toUpperCase() === match[2].toUpperCase());
            const points = match[3] === undefined ? undefined : parsePoints(match[3]);
            if (!t) text('No encontré esa clave de tarea.');
            else if (!a || a.group !== t.group || a.period !== t.period || a.status !== 'Activo') text('El alumno no está activo en el grupo y periodo de esa tarea. No se guardó ningún cambio.');
            else if (points === null) text('Puntaje inválido. Usa un número no negativo con hasta dos decimales.');
            else {
              if (!t.students.some(s => s.id === a.id)) t.students.push({ id: a.id, name: a.fullName, status: 'Sin revisar', points: null });
              set({ phase: points === undefined ? 'latePoints' : 'confirmDelivery', taskId: t.id, studentId: a.id, studentName: a.fullName, points,
                back: c.phase === 'review' ? { taskId: c.taskId, studentId: task().students[c.index].id } : undefined });
              render();
            }
          }
        } else if (command === 'anterior tarea' || command === 'anterior') {
          const t = task();
          if (t && ['review', 'summary'].includes(c.phase) && t.students.some(visible)) {
            const limit = c.phase === 'summary' ? t.students.length : c.index;
            let index = t.students.findLastIndex((a, i) => visible(a) && i < limit);
            if (index < 0) index = t.students.findIndex(visible);
            set({ phase: 'review', taskId: t.id, index }); render();
          }
          else text('Primero selecciona una tarea para revisar.');
        } else if (command === 'finalizar tarea') {
          if (task()) {
            const t = task(); const zeroIds = t.students.filter(a => visible(a) && a.status === 'Sin revisar').map(a => a.id);
            if (zeroIds.length) { set({ ...c, phase: 'confirmZeros', taskId: t.id, zeroIds }); render(); }
            else { set({ phase: 'summary', taskId: t.id }); report(t); }
          }
          else text('Primero selecciona una tarea.');
        } else if (c.phase === 'bulkPoints') {
          const points = parsePoints(raw);
          if (points === null) text('Escribe un número no negativo con hasta dos decimales.');
          else { set({ ...c, phase: 'bulk', bulkPoints: points }); render(); }
        } else if (c.phase === 'confirmBulk' && ['yes', 'si', 'no'].includes(command)) {
          const t = task();
          if (command !== 'no') {
            const active = (await students.list()).filter(a => a.group === t.group && a.period === t.period && a.status === 'Activo');
            const valid = c.selected.every(item => {
              const a = t.students.find(a => a.id === item.id);
              return active.some(s => s.id === item.id) && a?.status === item.status && a?.points === item.points && a.status !== 'Entregó';
            });
            if (valid) {
              for (const item of c.selected) saveDelivery(t, t.students.find(a => a.id === item.id), 'Entregó', c.bulkPoints);
              text(`✅ ${c.selected.length} entregas guardadas con ${c.bulkPoints} puntos cada una.`);
            } else text('Cambió el registro de alguno de los alumnos. No se aplicó el lote; revisa la lista y selecciona nuevamente.');
          } else text('Selección cancelada. No se cambiaron puntos.');
          set({ phase: 'bulk', taskId: t.id, bulkIds: c.bulkIds, bulkPoints: c.bulkPoints }); render();
        } else if (c.phase === 'confirmZeros' && ['yes', 'si', 'no'].includes(command)) {
          const t = task();
          if (command !== 'no') {
            const pending = c.zeroIds.map(id => t.students.find(a => a.id === id));
            const active = (await students.list()).filter(a => a.group === t.group && a.period === t.period && a.status === 'Activo');
            if (pending.every(a => a?.status === 'Sin revisar' && active.some(s => s.id === a.id))) {
              for (const a of pending) saveDelivery(t, a, 'No entregó', 0);
              text(`✅ ${pending.length} alumnos registrados como No entregó · 0 puntos.`);
            } else text('Cambió el estado o grupo de algún alumno. No se aplicaron ceros; revisa nuevamente antes de finalizar.');
          } else text('Los alumnos sin revisar conservan su estado.');
          set({ phase: 'summary', taskId: t.id }); report(t);
        } else if (c.phase === 'name') {
          const name = raw.trim().replace(/\s+/g, ' ');
          if (!name || name.length > 120) text('El nombre debe tener entre 1 y 120 caracteres.');
          else { set({ ...c, phase: 'value', name }); render(); }
        } else if (c.phase === 'value') {
          const value = parsePoints(raw);
          if (value === null || value <= 0) text('Escribe un valor mayor que cero, con hasta dos decimales. Por ejemplo: 1.');
          else { set({ ...c, phase: 'confirmCreate', value }); render(); }
        } else if (c.phase === 'confirmCreate' && ['yes', 'si', 'no'].includes(command)) {
          if (command === 'no') { set({ phase: 'idle' }); text('Creación cancelada.'); }
          else {
            const max = Math.max(0, ...Object.keys(db.sessions).map(id => /^T\d+$/.test(id) ? Number(id.slice(1)) : 0));
            const id = `T${String(max + 1).padStart(2, '0')}`;
            const roster = (await students.list()).filter(a => a.group === c.group && a.period === PERIOD && a.status === 'Activo').sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
            const t = { id, group: c.group, subject: c.subject, name: c.name, value: c.value, period: PERIOD, partial: CURRENT_PARTIAL, teacher, createdAt: timestamp, updatedAt: timestamp,
              students: roster.map(a => ({ id: a.id, name: a.fullName, status: 'Sin revisar', points: null })) };
            db.sessions[id] = t; log('Crear tarea', t);
            set({ phase: 'idle', lastTaskId: id }); text(`✅ ${id} — ${t.name}\nGrupo: ${t.group}\nValor: ${t.value} puntos\nPara comenzar: revisar tarea ${t.group}`);
          }
        } else if (c.phase === 'review' && ['yesdelivery', 'entrego', 'nodelivery', 'no entrego', 'custom', 'otro puntaje'].includes(command)) {
          const t = task(); const a = t.students[c.index];
          if (['custom', 'otro puntaje'].includes(command)) { set({ ...c, phase: 'custom', studentId: a.id, studentName: a.name }); render(); }
          else {
            const delivered = ['yesdelivery', 'entrego'].includes(command);
            saveDelivery(t, a, delivered ? 'Entregó' : 'No entregó', delivered ? t.value : 0);
            advance(t, c.index + 1);
          }
        } else if (['custom', 'latePoints'].includes(c.phase)) {
          const points = parsePoints(raw);
          if (points === null) text('Escribe un número no negativo con hasta dos decimales.');
          else {
            const back = c.phase === 'custom' ? { taskId: c.taskId, studentId: c.studentId } : c.back;
            set({ ...c, phase: 'confirmDelivery', points, back }); render();
          }
        } else if (c.phase === 'confirmDelivery' && ['yes', 'si', 'no'].includes(command)) {
          const t = task(); const a = t.students.find(a => a.id === c.studentId);
          if (command !== 'no') {
            const current = (await students.list()).find(s => s.id === a.id);
            if (!current || current.group !== t.group || current.period !== t.period || current.status !== 'Activo') {
              set({ phase: 'summary', taskId: t.id }); text('El alumno ya no está activo en ese grupo. No se aplicó la entrega.'); return { handled: true, messages };
            }
            saveDelivery(t, a, 'Entregó', c.points); text(`✅ ${t.id} · ${a.name}: ${a.points} puntos. Actualizado sin duplicar la entrega.`);
          } else text('Cambio cancelado.');
          const back = c.back;
          if (back && owned(back.taskId)) {
            const previous = owned(back.taskId); const index = previous.students.findIndex(s => s.id === back.studentId);
            if (command === 'no' && index >= 0) { set({ phase: 'review', taskId: previous.id, index }); render(); }
            else advance(previous, Math.max(index, 0));
          } else { set({ phase: 'summary', taskId: t.id }); report(t); }
        } else { text(HELP); render(); }
        db.controls[teacher] = c;
        return { handled: true, messages };
      });
      for (const payload of result.messages) await send(phone, payload);
      return result.handled;
    } catch (error) {
      console.error('Error en tareas del docente:', error.message);
      await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: 'No pude completar la operación. Usa continuar tarea o revisar tarea GRUPO para recuperar el estado guardado antes de volver a registrar puntos.' } });
      return true;
    }
  };
}
