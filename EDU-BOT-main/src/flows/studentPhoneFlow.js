import { randomUUID } from 'node:crypto';
import { PERIOD, normalize } from '../services/studentService.js';
import { parseStudentPhone, samePhone } from '../utils/phone.js';

export function createStudentPhoneFlow({ repository, send, adminNumber, now = () => Date.now() }) {
  let proposal;
  let queue = Promise.resolve();
  const text = (phone, body) => send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body } });
  async function handle(phone, raw, messageId) {
    const command = normalize(raw);
    if (!/^(cambiar telefono(?:\s|$)|telefono:)/.test(command)) return false;
    if (!samePhone(phone, adminNumber)) { await text(phone, 'Solo el administrador puede cambiar el teléfono de un alumno.'); return true; }
    if (command.startsWith('telefono:')) {
      const match = /^telefono:([a-f0-9-]+):(guardar|cancelar)$/.exec(command);
      if (!match || !proposal || proposal.token !== match[1] || now() >= proposal.expires) {
        await text(phone, 'Esta confirmación venció o ya no corresponde al cambio actual. Escribe nuevamente cambiar telefono FOLIO NUMERO.'); return true;
      }
      if (match[2] === 'cancelar') { proposal = undefined; await text(phone, 'Cambio cancelado. No se modificó el teléfono.'); return true; }
      const result = await repository.changePhone({ student: proposal.student, newPhone: proposal.newPhone, peers: proposal.peers,
        teacher: adminNumber, requestId: proposal.token, messageId });
      proposal = undefined;
      if (!result.saved) await text(phone, 'El registro o los alumnos asociados al número cambiaron desde la propuesta. No se guardó el cambio. Vuelve a escribir cambiar telefono FOLIO NUMERO para revisar los datos actuales.');
      else await text(phone, `✅ Teléfono actualizado\n${result.student.fullName}\n${result.student.id} · ${result.student.group}\nWhatsApp: +${result.student.phone}\nEl folio y su historial se conservan. Ya puede consultar mi registro ${result.student.id} desde el nuevo número.`);
      return true;
    }
    proposal = undefined;
    const match = /^cambiar telefono\s+(edu-[a-z0-9]+-\d+)\s+(\+?\d+)$/.exec(command);
    const newPhone = match && parseStudentPhone(match[2]);
    if (!newPhone) {
      await text(phone, 'Usa cambiar telefono EDU-5AMAM-015 9381234567. Escribe el número mexicano con 10 dígitos, sin espacios, guiones ni letras. También acepta 52 o +52 y la variante 521 antes de esos 10 dígitos. Se mostrará el número normalizado antes de guardar.'); return true;
    }
    const rows = await repository.list();
    const matches = rows.filter(a => a.id === match[1].toUpperCase() && a.period === PERIOD);
    if (matches.length !== 1) { await text(phone, 'No encontré un registro único para ese folio en el periodo actual. No se modificó nada. Revisa el folio con lista GRUPO o alumnos duales.'); return true; }
    const student = matches[0];
    if (samePhone(student.phone, newPhone)) { await text(phone, 'El alumno ya tiene ese número registrado. No se cambió nada.'); return true; }
    if (samePhone(newPhone, adminNumber)) { await text(phone, 'Ese es el número del administrador. Escribe el WhatsApp del alumno.'); return true; }
    const peers = rows.filter(a => a.id !== student.id && a.period === PERIOD && samePhone(a.phone, newPhone)).map(a => a.id).sort();
    proposal = { token: randomUUID(), expires: now() + 10 * 60 * 1000, student: { ...student }, newPhone, peers };
    await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'interactive', interactive: {
      type: 'button', body: { text: `Revisa antes de guardar:\n${student.fullName}\nFolio: ${student.id}\nGrupo: ${student.group} · Estado: ${student.status}\nAnterior: ${student.phone || 'Sin número'}\nNuevo: +${newPhone}\n\nSolo cambiará el WhatsApp de este folio. El número anterior dejará de tener acceso a su consulta y el nuevo lo tendrá.${peers.length ? `\nEste número ya está asociado a ${peers.length} alumno(s). Confirma solo si comparten ese teléfono; podrá consultar esos folios.` : ''}\n¿Guardar? La confirmación vence en 10 minutos.` },
      action: { buttons: ['guardar', 'cancelar'].map(action => ({ type: 'reply', reply: { id: `telefono:${proposal.token}:${action}`, title: action === 'guardar' ? 'Guardar cambio' : 'Cancelar' } })) }
    } });
    return true;
  }
  return (phone, raw = '', messageId = '') => {
    const task = queue.then(async () => {
      try { return await handle(phone, raw, messageId); }
      catch (error) {
        console.error('Error al cambiar teléfono:', error.message);
        await text(phone, 'No pude confirmar la operación. Puedes volver a pulsar Guardar cambio para verificarla; si la confirmación venció, inicia de nuevo cambiar telefono FOLIO NUMERO.');
        return true;
      }
    });
    queue = task.catch(() => {}); return task;
  };
}
