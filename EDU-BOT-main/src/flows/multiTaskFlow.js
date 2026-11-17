import { randomUUID, createHash } from 'node:crypto';
import { GROUPS, PERIOD, normalize } from '../services/studentService.js';
import { samePhone } from '../utils/phone.js';
import { parseSelection } from '../utils/numberSelection.js';

export function parseMultiDeliveries(raw, taskIds, length) {
  const selection = value => value.trim() === 'todos' ? Array.from({ length }, (_, i) => i) : value.trim() === 'ninguno' ? [] : parseSelection(value.trim().replaceAll('.', ','), length);
  if (!raw.includes(':')) {
    const indexes = selection(raw);
    return indexes === null ? null : Object.fromEntries(taskIds.map(id => [id, indexes]));
  }
  const result = {};
  for (const part of raw.split(/[;\n]+/)) {
    const match = /^\s*(t\d+)\s*:\s*(.+?)\s*$/i.exec(part);
    if (!match) return null;
    const id = match[1].toUpperCase();
    if (!taskIds.includes(id) || result[id]) return null;
    const indexes = selection(match[2]);
    if (indexes === null) return null;
    result[id] = indexes;
  }
  return taskIds.every(id => result[id]) ? result : null;
}

export function createMultiTaskFlow({ students, store, send, adminNumber, now = () => new Date() }) {
  const key = `${adminNumber}:multi`;
  return async (phone, raw = '', messageId = '') => {
    const input = normalize(raw);
    if (!/^(calificar tareas(?:\s|$)|tareas juntas(?:\s|$)|entregas juntas(?:\s|$)|continuar tareas juntas$|cancelar tareas juntas$|multitarea:)/.test(input)) return false;
    const payload = body => ({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body } });
    if (!samePhone(phone, adminNumber)) { await send(phone, payload('Solo el docente puede calificar varias tareas.')); return true; }
    try {
      const messages = await store.transact(async db => {
        const output = [], text = body => output.push(payload(body));
        let c = db.controls[key];
        const set = next => { c = { ...next, token: randomUUID().slice(0, 8) }; db.controls[key] = c; };
        const roster = await students.list();
        const active = group => roster.filter(a => a.group === group && a.period === PERIOD && a.status === 'Activo').sort((a, b) => a.fullName.localeCompare(b.fullName, 'es') || a.id.localeCompare(b.id));
        const available = group => Object.values(db.sessions).filter(t => t.teacher === adminNumber && t.group === group && t.period === PERIOD);
        const fingerprint = () => createHash('sha256').update(JSON.stringify({ roster: active(c.group).map(a => [a.id, a.fullName]), tasks: c.taskIds.map(id => db.sessions[id]) })).digest('hex');
        function lines(title, entries) {
          let page = title;
          for (const entry of entries) { if (page.length + entry.length + 2 > 3500) { text(page); page = `${title} (continuación)`; } page += `\n\n${entry}`; }
          text(page);
        }
        function render() {
          if (!c || c.phase === 'idle') { text('Usa calificar tareas GRUPO para comenzar.'); return; }
          if (['list', 'confirm'].includes(c.phase) && fingerprint() !== c.fingerprint) {
            set({ phase: 'choose', group: c.group });
            text('Cambió el grupo o alguna tarea. Selecciona nuevamente; no se cambiaron calificaciones.');
          }
          if (c.phase === 'choose') {
            lines(`Tareas de ${c.group}`, available(c.group).map(t => `${t.id} — ${t.name}\n${t.subject} · ${t.value} puntos`));
            text('Selecciona de 2 a 10 tareas del mismo valor y materia: tareas juntas T01,T02,T03. Deben estar creadas previamente.');
          } else if (c.phase === 'list') {
            lines(`${c.group} · ${c.taskIds.join(', ')} · ${c.value} puntos por tarea`, c.list.map((a, i) => `${i + 1}. ${a.name} — ${a.id}`));
            text(`Mismos alumnos en todas: entregas juntas 1-5.7,9\nListas distintas en un mensaje: entregas juntas ${c.taskIds.map(id => `${id}: 1-5,7`).join('; ')}\nTambién acepta todos o ninguno por lista. En CADA tarea, seleccionados = Entregó con ${c.value} puntos; los demás = No entregó con 0. Reemplaza sus puntos anteriores después de confirmar. Usa continuar tareas juntas para ver esta lista o cancelar tareas juntas para salir.`);
          } else if (c.phase === 'confirm') {
            lines(`Resumen · ${c.group} · ${c.value} puntos por tarea`, c.taskIds.map(id => `${id} — ${db.sessions[id]?.name || id}\nEntregaron: ${c.selected[id].length} · No entregaron: ${c.list.length - c.selected[id].length}`));
            output.push({ messaging_product: 'whatsapp', to: phone, type: 'interactive', interactive: { type: 'button', body: { text: '¿Guardar todas las tareas? Reemplaza estados y puntos anteriores de los alumnos de esta lista. Los alumnos Dual quedan fuera.' }, action: { buttons: [['guardar', 'Guardar todas'], ['volver', 'Corregir listas']].map(([id, title]) => ({ type: 'reply', reply: { id: `multitarea:${c.token}:${id}`, title } })) } } });
          } else text(c.receipt || 'Registro terminado. Usa calificar tareas GRUPO para otra revisión.');
        }
        if (messageId && db.seen.has(messageId)) { render(); return output; }
        if (input.startsWith('calificar tareas')) {
          const group = GROUPS.find(g => normalize(g) === input.slice('calificar tareas'.length).trim());
          if (!group) text(`Indica el grupo: ${GROUPS.join(', ')}.`);
          else if (!available(group).length) text(`No hay tareas. Usa crear tarea ${group}.`);
          else { set({ phase: 'choose', group }); render(); }
        } else if (input.startsWith('tareas juntas')) {
          const value = input.slice('tareas juntas'.length).trim();
          const ids = value.split(/[,.\s]+/).map(id => id.toUpperCase());
          const tasks = ids.map(id => db.sessions[id]);
          if (!c?.group || ids.length < 2 || ids.length > 10 || new Set(ids).size !== ids.length || !ids.every(id => /^T\d+$/.test(id)) || tasks.some(t => !t || t.group !== c.group || t.teacher !== adminNumber || t.period !== PERIOD)) text('Usa calificar tareas GRUPO y elige de 2 a 10 claves distintas de ese grupo: tareas juntas T01,T02.');
          else if (tasks.some(t => t.value !== tasks[0].value || t.subject !== tasks[0].subject) || !(tasks[0].value > 0)) text('Las tareas deben tener la misma materia y el mismo valor mayor que cero.');
          else if (!active(c.group).length) text('El grupo no tiene alumnos activos.');
          else {
            set({ phase: 'list', group: c.group, taskIds: ids, value: tasks[0].value, list: active(c.group).map(a => ({ id: a.id, name: a.fullName })) });
            c.fingerprint = fingerprint(); render();
          }
        } else if (input.startsWith('entregas juntas')) {
          if (!c || !['list', 'confirm'].includes(c.phase)) text('Primero usa calificar tareas GRUPO y tareas juntas T01,T02.');
          else {
            const selected = parseMultiDeliveries(raw.trim().replace(/^entregas\s+juntas\s*/i, '').toLowerCase(), c.taskIds, c.list.length);
            if (!selected) text('Lista inválida. Indica todos los números correctamente y, si separas por tarea, incluye cada clave exactamente una vez. No se cambió ninguna calificación.');
            else { set({ ...c, phase: 'confirm', selected }); render(); }
          }
        } else if (input === 'continuar tareas juntas') render();
        else if (input === 'cancelar tareas juntas') { set({ phase: 'idle' }); text('Revisión cancelada. No se cambiaron calificaciones.'); }
        else if (input.startsWith('multitarea:')) {
          const [, token, action] = input.split(':');
          if (!c || c.phase !== 'confirm' || token !== c.token) { text('Ese botón ya no corresponde a la revisión actual.'); render(); }
          else if (action === 'volver') { set({ ...c, phase: 'list' }); render(); }
          else if (action === 'guardar') {
            if (fingerprint() !== c.fingerprint) {
              set({ phase: 'choose', group: c.group }); text('Cambió el grupo o alguna tarea desde que se mostró la lista. No se guardó nada. Selecciona nuevamente.'); render();
            } else {
              const timestamp = now().toISOString();
              for (const id of c.taskIds) {
                const t = db.sessions[id], selected = new Set(c.selected[id]);
                c.list.forEach((item, i) => {
                  let a = t.students.find(a => a.id === item.id);
                  if (!a) { a = { id: item.id, name: item.name, status: 'Sin revisar', points: null }; t.students.push(a); }
                  const status = selected.has(i) ? 'Entregó' : 'No entregó', points = selected.has(i) ? c.value : 0;
                  db.history.push([timestamp, adminNumber, id, a.id, `${a.status} | ${a.points ?? ''}`, `${status} | ${points}`, 'Calificar tareas juntas', messageId]);
                  a.status = status; a.points = points; a.updatedAt = timestamp;
                });
                t.updatedAt = timestamp;
              }
              const receipt = `✅ Guardadas ${c.taskIds.join(', ')} para ${c.group}. Valor: ${c.value} puntos por tarea. Cada entrega conserva su registro separado.`;
              set({ phase: 'done', receipt }); text(receipt);
            }
          }
        }
        db.history.push([now().toISOString(), adminNumber, '', '', '', '', 'Comando de tareas juntas', messageId]);
        return output;
      });
      for (const m of messages) await send(phone, m);
    } catch (error) {
      console.error('Error tareas juntas:', error.message);
      await send(phone, payload('No pude completar la operación. Usa continuar tareas juntas para consultar el estado guardado antes de reintentar.'));
    }
    return true;
  };
}
