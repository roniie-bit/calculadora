import { randomUUID } from 'node:crypto';
import { samePhone } from '../utils/phone.js';
import { GROUPS, PERIOD, normalize } from '../services/studentService.js';

const nameValid = value => value.length >= 1 && value.length <= 80 && /\p{L}/u.test(value) && /^[\p{L}\p{M} '\u2019-]+$/u.test(value);
const starts = new Set(['registrarme', 'registro', 'registrar alumno', 'alta', 'registro_alumno']);
const yes = value => ['si', 'registro_si'].includes(value);
const no = value => ['no', 'registro_no'].includes(value);
export const isStudentManagementCommand = raw => /^(dual(?:\s|$)|activar alumno(?:\s|$)|alumnos duales(?:\s|$))/.test(normalize(raw));

export function createRegistrationFlow({ repository, send, adminNumber }) {
  const sessions = new Map();
  const locks = new Map();
  const text = (phone, body) => send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body } });
  async function groups(phone) {
    await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'interactive', interactive: {
      type: 'list', body: { text: 'Selecciona tu grupo. Puedes escribir cancelar para salir del registro.' },
      action: { button: 'Elegir grupo', sections: [{ title: 'Grupos', rows: GROUPS.map((g, i) => ({ id: `registro_grupo_${i}`, title: g })) }] }
    } });
  }
  async function question(phone, body) {
    await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'interactive', interactive: {
      type: 'button', body: { text: body }, action: { buttons: [
        { type: 'reply', reply: { id: 'registro_si', title: 'Sí' } },
        { type: 'reply', reply: { id: 'registro_no', title: 'No' } }
      ] }
    } });
  }
  async function handle(phone, raw, messageId) {
    const value = raw.trim().replace(/\s+/g, ' ');
    const command = normalize(value);
    if (isStudentManagementCommand(command)) {
      if (!samePhone(phone, adminNumber)) { await text(phone, 'Esta función está disponible únicamente para el docente.'); return true; }
      if (/^alumnos duales(?:\s|$)/.test(command)) {
        const groupText = command.slice('alumnos duales'.length).trim();
        const group = GROUPS.find(g => normalize(g) === groupText);
        if (groupText && !group) { await text(phone, `Grupo no válido. Opciones: ${GROUPS.join(', ')}`); return true; }
        const duals = (await repository.list()).filter(a => a.period === PERIOD && a.status === 'Dual' && (!group || a.group === group)).sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
        let page = `📋 Alumnos duales${group ? ` · ${group}` : ''} · ${duals.length}\n`;
        for (const a of duals) {
          const line = `\n${a.fullName} — ${a.id}\n${a.group} · Dual\n`;
          if (page.length + line.length > 3500) { await text(phone, page); page = 'Alumnos duales (continuación)\n'; }
          page += line;
        }
        await text(phone, page); return true;
      }
      const match = /^(dual|activar alumno)\s+(edu-\S+)$/.exec(command);
      if (!match) { await text(phone, 'Usa dual EDU-5AMAM-015 o activar alumno EDU-5AMAM-015. Consulta folios con lista GRUPO o alumnos duales.'); return true; }
      const student = await repository.setStatus(match[2].toUpperCase(), match[1] === 'dual' ? 'Dual' : 'Activo');
      if (!student) await text(phone, 'No encontré ese folio en el periodo actual. No se cambió ningún registro.');
      else await text(phone, `✅ ${student.fullName}\n${student.id} · ${student.group}\nEstado: ${student.status}\n${student.status === 'Dual' ? 'Ya no aparecerá en las listas de trabajo ni como pendiente. Su registro e historial se conservan. Consulta: alumnos duales. Para devolverlo: activar alumno ' + student.id : 'Volverá a aparecer en las listas de trabajo. Conserva su folio e historial.'}`);
      return true;
    }
    const isReport = command === 'mis grupos' || command.startsWith('lista ');
    if (isReport) {
      if (!samePhone(phone, adminNumber)) { await text(phone, 'Esta consulta está disponible únicamente para el docente.'); return true; }
      const active = (await repository.list()).filter(r => r.period === PERIOD && r.status === 'Activo');
      if (command === 'mis grupos') {
        await text(phone, `📊 Alumnos registrados · ${PERIOD}\n\n${GROUPS.map(g => `${g}: ${active.filter(r => r.group === g).length}`).join('\n')}\n\nTotal: ${active.length} alumnos.\nConsulta los nombres con: lista 5A LCM`);
      } else {
        const group = GROUPS.find(g => normalize(g) === command.slice(6));
        if (!group) { await text(phone, `Grupo no válido. Opciones: ${GROUPS.join(', ')}`); return true; }
        const students = active.filter(r => r.group === group).sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
        let page = `📋 ${group} · ${students.length} alumnos registrados\n`;
        for (const [i, student] of students.entries()) {
          const line = `\n${i + 1}. ${student.fullName}\nFolio: ${student.id}\n`;
          if (page.length + line.length > 3500) { await text(phone, page); page = `📋 ${group} (continuación)\n`; }
          page += line;
        }
        await text(phone, page);
      }
      return true;
    }
    let state = sessions.get(phone);
    if (state && Date.now() - state.updatedAt > 30 * 60 * 1000) { sessions.delete(phone); state = undefined; }
    if (!state && !starts.has(command)) return false;
    if (state && messageId && state.lastMessageId === messageId) return true;
    if (command === 'cancelar') { sessions.delete(phone); await text(phone, 'Registro cancelado. Escribe registrarme para comenzar de nuevo.'); return true; }
    if (!state) {
      const records = (await repository.list()).filter(r => r.phone === phone);
      state = { step: records.length ? 'shared' : 'group', phone, shared: false, requestId: randomUUID(), updatedAt: Date.now() };
      sessions.set(phone, state);
      if (records.length) await question(phone, 'Este número ya tiene un alumno registrado. ¿Estás usando un dispositivo prestado o compartido para registrar a otro alumno?');
      else await groups(phone);
    } else if (state.step === 'shared') {
      if (yes(command)) { state.shared = true; state.step = 'group'; await groups(phone); }
      else if (no(command)) {
        sessions.delete(phone);
        await text(phone, 'No crearé otro registro. Si necesitas corregir tus datos, solicita el cambio al docente. Para registrar a otra persona desde este dispositivo, escribe registrarme y responde Sí.');
      } else await question(phone, '¿Estás usando un dispositivo prestado o compartido para registrar a otro alumno?');
    } else if (state.step === 'group') {
      const group = GROUPS.find((g, i) => normalize(g) === command || command === `registro_grupo_${i}`);
      if (!group) await groups(phone);
      else { state.group = group; state.step = 'surname'; await text(phone, 'Escribe tu primer apellido, con acentos si corresponde.'); }
    } else if (['surname', 'secondSurname', 'names'].includes(state.step)) {
      const omitted = state.step === 'secondSurname' && ['omitir', 'no tengo'].includes(command);
      if (!omitted && !nameValid(value)) await text(phone, 'Escribe únicamente letras, espacios, guiones o apóstrofos (máximo 80 caracteres).');
      else {
        state[state.step] = omitted ? '' : value;
        if (state.step === 'surname') { state.step = 'secondSurname'; await text(phone, 'Escribe tu segundo apellido. Si no tienes, escribe omitir.'); }
        else if (state.step === 'secondSurname') { state.step = 'names'; await text(phone, 'Escribe tu nombre o nombres completos.'); }
        else { state.step = 'confirm'; await question(phone, `Confirma tus datos:\n\nNombre: ${[state.surname, state.secondSurname, state.names].filter(Boolean).join(' ')}\nGrupo: ${state.group}\n\n¿Son correctos?`); }
      }
    } else if (state.step === 'confirm') {
      if (no(command)) { state.step = 'group'; await groups(phone); }
      else if (yes(command)) {
        const result = await repository.register(state);
        const student = result.student;
        await text(phone, `${result.existing ? 'Ya existe este registro; conservamos tu folio.' : '✅ Registro completado.'}\n\nFolio: ${student.id}\nAlumno: ${student.fullName}\nGrupo: ${student.group}\n\nGuarda tu folio para identificarte después.`);
        sessions.delete(phone);
      } else await question(phone, '¿Confirmas que tus datos son correctos?');
    }
    state.updatedAt = Date.now();
    state.lastMessageId = messageId;
    return true;
  }
  return async (phone, raw = '', messageId) => {
    if (!phone || phone === 'DESCONOCIDO') return false;
    const prior = locks.get(phone) || Promise.resolve();
    const task = prior.then(async () => {
      const previous = sessions.get(phone);
      const snapshot = previous ? { ...previous } : undefined;
      try { return await handle(phone, raw, messageId); }
      catch (error) {
        if (snapshot) sessions.set(phone, snapshot);
        else sessions.delete(phone);
        throw error;
      }
    });
    const settled = task.catch(() => {});
    locks.set(phone, settled);
    try { return await task; }
    catch (error) {
      console.error('Error en registro de alumnos:', error.message);
      await text(phone, 'No pude completar la operación. Tus datos no se han confirmado como guardados. Intenta nuevamente tu último mensaje en unos momentos.');
      return true;
    } finally {
      // Elimina únicamente el bloqueo que pertenece a esta llamada.
      if (locks.get(phone) === settled) locks.delete(phone);
    }
  };
}
