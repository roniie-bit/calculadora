import { createHash, randomUUID } from 'node:crypto';
import { GROUPS, PERIOD, normalize } from '../services/studentService.js';
import { samePhone } from '../utils/phone.js';
import { SUBJECTS, subjectsFor } from './teacherAttendanceFlow.js';

const PROPOSAL_TTL = 10 * 60 * 1000;

export function parseExamGrade(raw) {
  const value = String(raw ?? '').trim().replace(',', '.');
  if (value === '') return 0;
  if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(value)) return null;
  const grade = Number(value);
  return Number.isFinite(grade) && grade >= 0 && grade <= 10 ? grade : null;
}

const gradeLabel = value => value === null || value === undefined ? '—' : String(value);

export function planExamSync(db, roster, adminNumber, groupFilter = '', timestamp = new Date().toISOString()) {
  const changes = [];
  const errors = [];
  const seen = new Set();
  const nextGroups = {};
  const eligible = roster.filter(student => student.period === PERIOD && ['Activo', 'Dual'].includes(student.status));

  for (const row of db.rows) {
    if (groupFilter && row.group !== groupFilter) continue;
    const label = `Examenes fila ${row.rowIndex ? row.rowIndex + 1 : '?'} (${row.group || '?'} / ${row.subject || '?'} / ${row.id || '?'})`;
    if (!GROUPS.includes(row.group)) {
      errors.push(`${label}: grupo desconocido.`);
      continue;
    }
    const subjects = subjectsFor(row.group).map(key => SUBJECTS[key]);
    if (!subjects.includes(row.subject)) {
      errors.push(`${label}: materia no válida para el grupo.`);
      continue;
    }
    if (row.period !== PERIOD) {
      errors.push(`${label}: el periodo debe ser ${PERIOD}.`);
      continue;
    }
    const student = eligible.find(a => a.id === row.id && a.group === row.group);
    if (!student) {
      errors.push(`${label}: el folio no pertenece a un alumno activo o Dual de ese grupo y periodo.`);
      continue;
    }
    const key = `${row.group}|${row.subject}|${row.id}`;
    if (seen.has(key)) {
      errors.push(`${label}: grupo, materia y folio duplicados.`);
      continue;
    }
    seen.add(key);

    const p1 = parseExamGrade(row.p1);
    const p2 = parseExamGrade(row.p2);
    if (p1 === null || p2 === null) {
      errors.push(`${label}: Primer parcial y Segundo parcial deben ser números de 0 a 10.`);
      continue;
    }

    const previous = db.control[row.group]?.synced?.find(entry =>
      entry.id === row.id && entry.subject === row.subject);
    const same = previous && previous.p1 === p1 && previous.p2 === p2 &&
      previous.name === student.fullName && previous.subject === row.subject;
    const next = {
      id: row.id,
      name: student.fullName,
      subject: row.subject,
      p1,
      p2,
      updatedAt: same ? previous.updatedAt : timestamp,
      teacher: adminNumber
    };
    nextGroups[row.group] ||= [];
    nextGroups[row.group].push(next);
    if (!same) {
      changes.push({
        group: row.group,
        subject: row.subject,
        id: row.id,
        name: student.fullName,
        before: previous || null,
        after: next
      });
    }
  }

  const syncedByGroup = {};
  for (const [group, rows] of Object.entries(nextGroups)) {
    syncedByGroup[group] = {
      synced: rows,
      updatedAt: changes.some(change => change.group === group)
        ? timestamp
        : db.control[group]?.updatedAt || timestamp
    };
  }

  return {
    changes,
    errors,
    syncedByGroup,
    fingerprint: createHash('sha256')
      .update(JSON.stringify([db.rows, db.control, groupFilter]))
      .digest('hex')
  };
}

function examGroup(raw) {
  const value = normalize(raw).replace(/^crear examenes\s*/, '').trim();
  if (!value) return { all: true };
  const group = GROUPS.find(candidate => normalize(candidate) === value);
  return group ? { group } : { error: `Grupo no válido. Opciones: ${GROUPS.join(', ')}` };
}

export function createTeacherExamFlow({ store, students, send, adminNumber, now = () => new Date() }) {
  let proposal;

  return async (phone, raw = '', messageId = '') => {
    const command = normalize(raw);
    const isCreate = /^crear examenes(?:\s|$)/.test(command);
    const isSync = /^sincronizar examenes(?:\s|$)/.test(command);
    const isButton = command.startsWith('examenes:');
    if (!isCreate && !isSync && !isButton) return false;
    if (!samePhone(phone, adminNumber)) {
      await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: 'La creación y sincronización de exámenes es exclusiva del administrador.' } });
      return true;
    }

    try {
      if (isCreate) {
        const selected = examGroup(raw);
        if (selected.error) {
          await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: selected.error } });
          return true;
        }
        const groups = selected.group ? [selected.group] : GROUPS;
        const result = await store.transact(async db => {
          const roster = await students.list();
          const timestamp = now().toISOString();
          const messages = [];
          const counts = {};
          for (const group of groups) {
            const active = roster
              .filter(student => student.period === PERIOD && student.status === 'Activo' && student.group === group)
              .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
            const subjectKeys = subjectsFor(group);
            const existing = new Map((db.control[group]?.synced || [])
              .filter(entry => entry.subject)
              .map(entry => [`${entry.subject}|${entry.id}`, entry]));
            for (const subjectKey of subjectKeys) {
              const subject = SUBJECTS[subjectKey];
              for (const student of active) {
                let row = db.rows.find(item =>
                  item.group === group && item.subject === subject &&
                  item.period === PERIOD && item.id === student.id);
                if (!row) {
                  row = {
                    group,
                    subject,
                    period: PERIOD,
                    id: student.id,
                    name: student.fullName,
                    p1: 0,
                    p2: 0,
                    updatedAt: timestamp,
                    teacher: adminNumber
                  };
                  db.rows.push(row);
                }
                const key = `${subject}|${student.id}`;
                if (!existing.has(key)) {
                  existing.set(key, {
                    id: student.id,
                    name: student.fullName,
                    subject,
                    p1: 0,
                    p2: 0,
                    updatedAt: timestamp,
                    teacher: adminNumber
                  });
                }
              }
            }
            db.control[group] = { synced: [...existing.values()], updatedAt: timestamp };
            db.history.push([timestamp, adminNumber, group, '', '', '', 'Crear exámenes', messageId]);
            counts[group] = { students: active.length, subjects: subjectKeys.length };
          }
          const lines = Object.entries(counts).map(([group, count]) =>
            `${group}: ${count.students} alumnos × ${count.subjects} materia(s), ambos parciales en 0.`);
          messages.push({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: {
              body:
                `✅ Pestaña Examenes preparada.\n\n${lines.join('\n')}\n\n` +
                'Edita las columnas Primer parcial y Segundo parcial en la hoja. Cuando termines, envía sincronizar examenes.'
            }
          });
          return { messages };
        });
        for (const payload of result.messages) await send(phone, payload);
        return true;
      }

      if (isSync) {
        proposal = undefined;
        const suffix = command.replace(/^sincronizar examenes\s*/, '').trim();
        const group = suffix ? GROUPS.find(candidate => normalize(candidate) === suffix) : undefined;
        if (suffix && !group) {
          await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: `Grupo no válido. Opciones: ${GROUPS.join(', ')}` } });
          return true;
        }
        const result = await store.transact(async db => {
          const roster = await students.list();
          const plan = planExamSync(db, roster, adminNumber, group || '', now().toISOString());
          const messages = [];
          const text = body => messages.push({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body } });
          if (plan.errors.length) {
            text(`No se modificó nada. Corrige estos errores en Examenes y vuelve a sincronizar:\n\n${plan.errors.slice(0, 15).join('\n')}\n\nErrores: ${plan.errors.length}.`);
            return { messages };
          }
          if (!plan.changes.length) {
            text('La pestaña Examenes y las calificaciones que consultan los alumnos ya coinciden. No hay cambios que aplicar.');
            return { messages };
          }
          return { messages, plan };
        });
        if (!result.plan) {
          for (const payload of result.messages) await send(phone, payload);
          return true;
        }
        const token = randomUUID();
        proposal = { ...result.plan, groupFilter: group || '', token, expires: +now() + PROPOSAL_TTL };
        let page = `Cambios propuestos: ${result.plan.changes.length}. Se importarán Primer parcial y Segundo parcial de Examenes.\n`;
        for (const change of result.plan.changes) {
          const before = change.before
            ? `${gradeLabel(change.before.p1)} / ${gradeLabel(change.before.p2)}`
            : '— / —';
          const line = `\n${change.group} · ${change.subject} · ${change.id} · ${change.name}\n${before} → ${gradeLabel(change.after.p1)} / ${gradeLabel(change.after.p2)}\n`;
          if (page.length + line.length > 3500) {
            await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: page } });
            page = '';
          }
          page += line;
        }
        if (page) await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: page } });
        await send(phone, {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: '¿Aplicar estas calificaciones a lo que consultan los alumnos? La propuesta vence en 10 minutos. No edites Examenes mientras se guarda.' },
            action: {
              buttons: [
                ['guardar', 'Aplicar cambios'],
                ['cancelar', 'Cancelar']
              ].map(([action, title]) => ({
                type: 'reply',
                reply: { id: `examenes:${token}:${action}`, title }
              }))
            }
          }
        });
        return true;
      }

      const [, token, action] = command.split(':');
      if (!proposal || proposal.token !== token || +now() >= proposal.expires || !['guardar', 'cancelar'].includes(action)) {
        await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: 'Propuesta vencida o ya atendida. Usa sincronizar examenes para revisar el estado actual.' } });
        return true;
      }
      const pending = proposal;
      proposal = undefined;
      if (action === 'cancelar') {
        await send(phone, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: 'Cancelado. Las ediciones de Examenes se conservaron y no se publicaron a los alumnos.' } });
        return true;
      }

      const result = await store.transact(async db => {
        const roster = await students.list();
        const fresh = planExamSync(db, roster, adminNumber, pending.groupFilter || '', now().toISOString());
        if (fresh.fingerprint !== pending.fingerprint || fresh.errors.length) return { mismatch: true };
        const timestamp = now().toISOString();
        for (const [group, context] of Object.entries(fresh.syncedByGroup)) {
          db.control[group] = context;
        }
        for (const change of fresh.changes) {
          const row = db.rows.find(item =>
            item.group === change.group && item.subject === change.subject && item.id === change.id);
          if (row) {
            row.updatedAt = timestamp;
            row.teacher = adminNumber;
          }
          db.history.push([
            timestamp,
            adminNumber,
            change.group,
            change.id,
            change.before ? JSON.stringify({ subject: change.subject, p1: change.before.p1, p2: change.before.p2 }) : '',
            JSON.stringify({ subject: change.subject, p1: change.after.p1, p2: change.after.p2 }),
            'Sincronizar exámenes',
            messageId || `sync-${token}`
          ]);
        }
        return { count: fresh.changes.length };
      });
      await send(phone, {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: {
          body: result.mismatch
            ? 'Los datos cambiaron. No se aplicó nada; usa sincronizar examenes nuevamente.'
            : `✅ Sincronizados ${result.count} registros. Los alumnos verán las calificaciones con mi registro FOLIO. Los valores anteriores quedaron en Historial_Examenes.`
        }
      });
      return true;
    } catch (error) {
      proposal = undefined;
      console.error('Error en exámenes:', error.message);
      await send(phone, {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: 'No pude completar la operación. Usa sincronizar examenes para comprobar qué cambios siguen pendientes antes de reintentar.' }
      });
      return true;
    }
  };
}
