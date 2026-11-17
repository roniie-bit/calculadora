import { createHash, randomUUID } from 'node:crypto';
import { PERIOD, normalize } from '../services/studentService.js';
import { samePhone } from '../utils/phone.js';

export function planDeliverySync(db, adminNumber) {
  const changes = [], errors = [], seen = new Set();
  for (const [index, row] of db.deliveryRows.entries()) {
    if (!row.some(v => String(v ?? '').trim())) continue;
    const [taskId, group, subject, , studentId, , rawStatus, rawPoints, , teacher] = row;
    const task = db.sessions[taskId];
    const label = `Entregas fila ${index + 2} (${taskId || '?'} / ${studentId || '?'})`;
    if (!task) { errors.push(`${label}: tarea desconocida.`); continue; }
    if (!samePhone(task.teacher, adminNumber) || task.period !== PERIOD) continue;
    const key = `${taskId}:${studentId}`;
    if (seen.has(key)) { errors.push(`${label}: tarea y folio duplicados.`); continue; }
    seen.add(key);
    const student = task.students.find(a => a.id === studentId);
    if (!student || group !== task.group || subject !== task.subject || !samePhone(teacher, task.teacher)) {
      errors.push(`${label}: folio, grupo, materia o docente no coincide.`); continue;
    }
    const status = ['Entregó', 'No entregó', 'Sin revisar'].find(s => normalize(s) === normalize(String(rawStatus ?? '')));
    const raw = String(rawPoints ?? '').trim();
    const points = raw === '' ? null : /^\d+(?:[.,]\d{1,2})?$/.test(raw) ? Number(raw.replace(',', '.')) : NaN;
    if (!status || (status === 'Sin revisar' ? points !== null : !Number.isFinite(points) || points === null || points < 0 || points > 999999.99 || (status === 'No entregó' && points !== 0))) {
      errors.push(`${label}: usa Entregó con puntos, No entregó con 0, o Sin revisar sin puntos.`); continue;
    }
    if (student.status !== status || (student.points ?? null) !== points) changes.push({ taskId, studentId, name: student.name, before: structuredClone(student), status, points });
  }
  const fingerprint = createHash('sha256').update(JSON.stringify([db.sessions, db.deliveryRows])).digest('hex');
  return { changes, errors, fingerprint };
}

export function createSyncDeliveriesFlow({ store, send, adminNumber, now = () => new Date() }) {
  let proposal;
  return async (phone, raw = '', messageId = '') => {
    const command = normalize(raw);
    if (command !== 'sincronizar entregas' && !command.startsWith('sincentregas:')) return false;
    const text = body => send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body } });
    if (!samePhone(phone, adminNumber)) { await text('Esta función es exclusiva del administrador.'); return true; }
    try {
      if (command === 'sincronizar entregas') {
        proposal = undefined;
        const plan = await store.transact(db => planDeliverySync(db, adminNumber));
        if (plan.errors.length) { await text(`No se modificó nada. Corrige estos errores y vuelve a sincronizar:\n${plan.errors.slice(0, 15).join('\n')}\nErrores: ${plan.errors.length}.`); return true; }
        if (!plan.changes.length) { await text('Entregas y los registros internos coinciden. No hay cambios que aplicar.'); return true; }
        const token = randomUUID();
        proposal = { ...plan, token, expires: +now() + 600000 };
        let page = `Cambios propuestos: ${plan.changes.length}. Se importarán Estado y Puntos de Entregas al registro que consulta mi registro.\n`;
        for (const c of plan.changes) {
          const line = `\n${c.taskId} · ${c.studentId} · ${c.name}\n${c.before.status} / ${c.before.points ?? 'sin puntos'} → ${c.status} / ${c.points ?? 'sin puntos'}\n`;
          if (page.length + line.length > 3500) { await text(page); page = ''; }
          page += line;
        }
        if (page) await text(page);
        await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'interactive', interactive: { type: 'button', body: { text: '¿Aplicar estas correcciones? Se conserva el valor anterior en Historial_Entregas. La propuesta vence en 10 minutos. No edites las hojas mientras se guarda.' }, action: { buttons: [['guardar', 'Aplicar cambios'], ['cancelar', 'Cancelar']].map(([action, title]) => ({ type: 'reply', reply: { id: `sincentregas:${token}:${action}`, title } })) } } });
      } else {
        const [, token, action] = command.split(':');
        if (!proposal || proposal.token !== token || +now() >= proposal.expires || !['guardar', 'cancelar'].includes(action)) { await text('Propuesta vencida o ya atendida. Usa sincronizar entregas para revisar el estado actual.'); return true; }
        const pending = proposal; proposal = undefined;
        if (action === 'cancelar') { await text('Cancelado. Tus ediciones en Entregas se conservaron; no se importaron.'); return true; }
        const count = await store.transact(db => {
          const fresh = planDeliverySync(db, adminNumber);
          if (fresh.fingerprint !== pending.fingerprint || fresh.errors.length) return null;
          const timestamp = now().toISOString();
          for (const c of fresh.changes) {
            const task = db.sessions[c.taskId], student = task.students.find(a => a.id === c.studentId);
            student.status = c.status; student.points = c.points; student.updatedAt = timestamp; task.updatedAt = timestamp;
            db.history.push([timestamp, adminNumber, c.taskId, c.studentId, JSON.stringify(c.before), JSON.stringify(student), 'Sincronizar Entregas manuales', messageId || `sync-${token}`]);
          }
          return fresh.changes.length;
        });
        await text(count === null ? 'Los datos cambiaron. No se aplicó nada; usa sincronizar entregas nuevamente.' : `✅ Sincronizadas ${count} entregas. Los alumnos verán los cambios con mi registro FOLIO. Valores anteriores guardados en Historial_Entregas.`);
      }
    } catch (error) {
      proposal = undefined;
      console.error('Error sincronizando entregas:', error.message);
      await text('No pude completar la operación. Usa sincronizar entregas para comprobar qué cambios siguen pendientes antes de reintentar.');
    }
    return true;
  };
}
