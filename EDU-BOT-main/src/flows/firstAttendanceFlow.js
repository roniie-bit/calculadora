import { randomUUID } from 'node:crypto';
import { samePhone } from '../utils/phone.js';
import { normalize } from '../services/studentService.js';
import { planFirstAttendance, firstAttendanceFingerprint, applyFirstAttendance } from '../services/firstAttendance.js';

export function createFirstAttendanceFlow({ students, store, send, adminNumber, now = () => new Date() }) {
  let proposal;
  let queue = Promise.resolve();
  async function handle(phone, raw, messageId) {
    const input = normalize(raw);
    if (input !== 'recuperar primera asistencia' && !input.startsWith('primera:')) return false;
    const text = body => send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body } });
    if (!samePhone(phone, adminNumber)) { await text('Esta función es exclusiva del administrador.'); return true; }
    const roster = await students.list();
    if (input.startsWith('primera:')) {
      const [, token, action] = input.split(':');
      if (!proposal || token !== proposal.token || +now() >= proposal.expires || !['guardar', 'cancelar'].includes(action)) {
        await text('La propuesta venció o ya fue atendida. Usa recuperar primera asistencia.'); return true;
      }
      if (action === 'cancelar') { proposal = undefined; await text('Cancelado. No se cambiaron asistencias.'); return true; }
      const saved = await store.transact(db => {
        if (firstAttendanceFingerprint(roster, db.sessions, adminNumber) !== proposal.fingerprint) return false;
        applyFirstAttendance(db, planFirstAttendance(roster, db.sessions, adminNumber), adminNumber, now().toISOString(), messageId);
        return true;
      });
      proposal = undefined;
      await text(saved ? '✅ Primera asistencia recuperada. Las marcas anteriores y los controles de revisión se conservaron; las incorporaciones quedaron en el historial.' : 'Los datos cambiaron desde la propuesta. No se aplicó nada. Vuelve a usar recuperar primera asistencia.');
      return true;
    }
    const snapshot = await store.transact(db => ({ plan: planFirstAttendance(roster, db.sessions, adminNumber), fingerprint: firstAttendanceFingerprint(roster, db.sessions, adminNumber) }));
    proposal = { token: randomUUID(), expires: +now() + 600000, fingerprint: snapshot.fingerprint };
    const lines = snapshot.plan.map(p => `${p.group} · ${p.date}\n${p.subject}\nAgregar: ${p.additions.filter(a => a.status === 'Presente').length} presentes, ${p.additions.filter(a => a.status === 'Falta').length} faltas. Conservar: ${p.preserved}.`);
    await text(`Primera asistencia · periodo agosto 2026–enero 2027\n\n${lines.join('\n\n')}\n\nSolo agrega alumnos activos que falten en la primera lista. No reemplaza marcas; excluye Dual.`);
    if (!snapshot.plan.some(p => p.additions.length)) { proposal = undefined; await text('Ya está completa. No hay registros que agregar.'); return true; }
    await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'interactive', interactive: {
      type: 'button', body: { text: '¿Guardar estas incorporaciones? La propuesta vence en 10 minutos.' }, action: { buttons: ['guardar', 'cancelar'].map(action => ({ type: 'reply', reply: { id: `primera:${proposal.token}:${action}`, title: action === 'guardar' ? 'Guardar' : 'Cancelar' } })) }
    } });
    return true;
  }
  return (phone, raw = '', messageId = '') => {
    const task = queue.then(() => handle(phone, raw, messageId)).catch(async error => {
      console.error('Error primera asistencia:', error.message);
      await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: 'No pude completar la recuperación. Usa recuperar primera asistencia para revisar los datos antes de reintentar.' } }); return true;
    });
    queue = task.catch(() => {}); return task;
  };
}
