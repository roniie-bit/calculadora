import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeacherAttendanceFlow,
  isTeacherAttendanceCommand,
  localDate,
} from '../src/flows/teacherAttendanceFlow.js';
import { createAttendanceStore } from '../src/services/teacherAttendanceStore.js';
import { PERIOD } from '../src/services/studentService.js';

const ADMIN = '5219381949915';

test('reconoce comandos de asistencia sin capturar preguntas académicas', () => {
  assert.equal(isTeacherAttendanceCommand('pasar lista 5A MAM'), true);
  assert.equal(isTeacherAttendanceCommand('continuar lista'), true);
  assert.equal(isTeacherAttendanceCommand('¿Cómo se calcula la hipotenusa?'), false);
});

function fixture(group = '5A MAM', count = 3) {
  let data = { sessions: {}, controls: {}, history: [] };
  let fail = false;
  const roster = Array.from({ length: count }, (_, i) => ({ id: `EDU-${group.replaceAll(' ', '')}-${String(i + 1).padStart(3, '0')}`,
    group, fullName: `Apellido ${String(i + 1).padStart(3, '0')} Nombre`, period: PERIOD, status: 'Activo', phone: 'shared' }));
  const store = { transact: async work => {
    const copy = structuredClone(data);
    copy.seen = new Set(copy.history.map(r => r[7]).filter(Boolean));
    const oldHistory = copy.history;
    copy.history = [];
    const result = await work(copy);
    if (fail) { fail = false; throw new Error('Fallo simulado de guardado'); }
    data = { sessions: copy.sessions, controls: copy.controls, history: [...oldHistory, ...copy.history] };
    return result;
  } };
  const sent = [];
  let failSend = false;
  const options = { store, students: { list: async () => roster }, adminNumber: ADMIN, now: () => new Date('2026-09-08T14:00:00Z'), send: async (phone, payload) => {
    if (failSend) { failSend = false; throw new Error('Fallo simulado de envío'); }
    sent.push(payload);
  } };
  let flow = createTeacherAttendanceFlow(options);
  let id = 0;
  return { sent, roster, data: () => data, control: () => data.controls[ADMIN], sessions: () => Object.values(data.sessions),
    run: (message, messageId = `msg-${++id}`, phone = ADMIN) => flow(phone, message, messageId),
    restart: () => { flow = createTeacherAttendanceFlow(options); },
    button: action => `lista:${data.controls[ADMIN].token}:${action}`,
    failNext: () => { fail = true; }, failNextSend: () => { failSend = true; } };
}
async function start(f, group = '5A MAM', subject = 0) {
  await f.run(`pasar lista ${group}`);
  if (group.endsWith('LCM')) await f.run(f.button(`choice_${subject}`));
  await f.run(f.button('yes'));
}

async function startNumbers(f, group = '5A MAM', subject = 0) {
  await f.run(`pasar lista numeros ${group}`);
  if (group.endsWith('LCM')) await f.run(f.button(`choice_${subject}`));
  await f.run(f.button('yes'));
}

test('asistencia numerada marca seleccionados con falta y los demás presentes con rangos mixtos', async () => {
  const f = fixture('5A MAM', 40); await startNumbers(f);
  assert.equal(f.control().phase, 'numbered');
  await f.run('faltas 1-5.7.8-20,23,40', 'batch-present');
  const expected = new Set([1,2,3,4,5,7,...Array.from({ length: 13 }, (_, i) => i + 8),23,40]);
  assert.deepEqual(f.sessions()[0].students.map(a => a.status), Array.from({ length: 40 }, (_, i) => expected.has(i + 1) ? 'Falta' : 'Presente'));
  assert.equal(f.data().history.filter(r => r[6] === 'Asistencia por lista').length, 40);
  f.restart(); await f.run('faltas 1-5.7.8-20,23,40', 'batch-present');
  assert.equal(f.data().history.filter(r => r[6] === 'Asistencia por lista').length, 40);
  await f.run('finalizar lista'); assert.equal(f.sessions()[0].status, 'Finalizada');
  await f.run('retardos lista 5A MAM'); await f.run('retardos 6.21-22');
  assert.equal(f.sessions()[0].status, 'Finalizada');
  assert.equal(f.sessions()[0].students[5].status, 'Retardo');
  assert.equal(f.sessions()[0].students[20].status, 'Retardo');
  assert.equal(f.sessions()[0].students[21].status, 'Retardo');
  assert.equal(f.sessions()[0].students[23].status, 'Presente');
  assert.equal(f.sessions()[0].students[0].status, 'Falta');
});

test('listas anteriores migran a faltas y el comando presentes no cambia marcas', async () => {
  const f = fixture(); await startNumbers(f);
  f.sessions()[0].numbered.mode = 'present';
  await f.run('pausar lista'); f.restart(); await f.run('continuar lista');
  assert.equal(f.sessions()[0].numbered.mode, 'absent');
  assert.match(f.sent.at(-1).text.body, /Responde faltas/);
  await f.run('presentes 1-2');
  assert.ok(f.sessions()[0].students.every(a => a.status === 'Pendiente'));
  await f.run('faltas 2');
  assert.deepEqual(f.sessions()[0].students.map(a => a.status), ['Presente', 'Falta', 'Presente']);
});

test('listas numeradas conservan números al pausar y rechazan errores y cambios del padrón', async () => {
  const f = fixture(); f.roster[0].status = 'Dual'; await startNumbers(f);
  assert.equal(f.sessions()[0].students.length, 2);
  const items = structuredClone(f.sessions()[0].numbered.items);
  await f.run('pausar lista'); f.restart(); await f.run('continuar lista');
  assert.deepEqual(f.sessions()[0].numbered.items, items);
  for (const input of ['0', '3', '2-1', '1..2', '1,', '1;2']) await f.run(`faltas ${input}`);
  assert.ok(f.sessions()[0].students.every(a => a.status === 'Pendiente'));
  f.roster[1].status = 'Dual'; await f.run('faltas ninguno');
  assert.ok(f.sessions()[0].students.every(a => a.status === 'Pendiente'));
  await startNumbers(f); await f.run('faltas todos');
  assert.deepEqual(f.sessions()[0].students.map(a => a.status), ['Pendiente', 'Falta']);
  await f.run('retardos lista 5A MAM'); await f.run('retardos ninguno');
  assert.deepEqual(f.sessions()[0].students.map(a => a.status), ['Pendiente', 'Falta']);
});

test('lotes respetan materia, fecha y acceso docente y permiten alternar con pase individual', async () => {
  const f = fixture('5A LCM');
  await f.run('pasar lista numeros 5A LCM', 'outsider', '5211111111111'); assert.equal(f.sessions().length, 0);
  await startNumbers(f, '5A LCM', 0); await f.run('faltas ninguno');
  await startNumbers(f, '5A LCM', 1); await f.run('faltas todos');
  await f.run('retardos lista 5A LCM 2026-09-07'); assert.match(f.sent.at(-1).text.body, /No hay lista/);
  await f.run('retardos lista 5A LCM 2026-09-08'); assert.equal(f.control().phase, 'selectLateList');
  await f.run(f.button('choice_1')); await f.run('retardos 1');
  assert.deepEqual(f.sessions()[0].students.map(a => a.status), ['Presente', 'Presente', 'Presente']);
  assert.deepEqual(f.sessions()[1].students.map(a => a.status), ['Retardo', 'Falta', 'Falta']);
  await start(f, '5A LCM', 1); await f.run('anterior'); await f.run('p');
  assert.equal(f.sessions()[1].students[2].status, 'Presente');
  assert.equal(f.sessions().length, 2);
});

test('fallo de guardado o envío no aplica parcialmente ni duplica el lote; lista larga se divide', async () => {
  const f = fixture('5A MAM', 100); await startNumbers(f);
  assert.ok(f.sent.filter(p => p.text).every(p => p.text.body.length <= 3500));
  f.failNext(); await f.run('faltas 51-100', 'retry-batch');
  assert.ok(f.sessions()[0].students.every(a => a.status === 'Pendiente'));
  f.failNextSend(); await f.run('faltas 51-100', 'retry-batch');
  f.restart(); await f.run('faltas 51-100', 'retry-batch');
  assert.equal(f.data().history.filter(r => r[6] === 'Asistencia por lista').length, 100);
  assert.equal(f.sessions()[0].students.filter(a => a.status === 'Falta').length, 50);
  await f.run('retardos lista 5A MAM');
  f.sessions()[0].students[0].status = 'Retardo';
  await f.run('retardos 2');
  assert.equal(f.sessions()[0].students[1].status, 'Presente');
});

test('dual omite alumnos en listas abiertas y nuevas conservando sus asistencias', async () => {
  const f = fixture(); await start(f); await f.run('f');
  f.roster[0].status = 'Dual'; f.roster[1].status = 'Dual';
  await f.run('p', 'dual-old');
  await f.run('p', 'dual-old');
  assert.equal(f.control().index, 2);
  assert.deepEqual(f.sessions()[0].students.map(a => a.status), ['Falta', 'Pendiente', 'Pendiente']);
  await f.run('anterior'); assert.equal(f.control().index, 2);
  await f.run('p'); f.sent.length = 0;
  await f.run('finalizar lista'); assert.equal(f.sessions()[0].status, 'Finalizada');
  assert.doesNotMatch(f.sent.map(p => p.text?.body || '').join('\n'), /Apellido 001|Apellido 002/);
  assert.deepEqual(f.sessions()[0].students.map(a => a.status), ['Falta', 'Pendiente', 'Presente']);
  f.roster[0].status = 'Activo'; await f.run('resumen lista');
  assert.match(f.sent.at(-1).text.body, /Apellido 001/);
  const fresh = fixture(); fresh.roster[0].status = 'Dual'; await start(fresh);
  assert.equal(fresh.sessions()[0].students.length, 2);
});
test('pase completo: pendientes, P/F/R, resumen, finalización y no duplica la clase', async () => {
  const f = fixture();
  await start(f);
  assert.deepEqual(f.sessions()[0].students.map(a => a.status), ['Pendiente', 'Pendiente', 'Pendiente']);
  for (const status of ['p', 'f', 'r']) await f.run(status);
  assert.equal(f.control().phase, 'review');
  assert.deepEqual(f.sessions()[0].students.map(a => a.status), ['Presente', 'Falta', 'Retardo']);
  await f.run('finalizar lista');
  assert.equal(f.sessions()[0].status, 'Finalizada');
  await start(f);
  assert.equal(f.sessions().length, 1);
  assert.equal(f.sessions()[0].status, 'Finalizada');
  assert.equal(await f.run('mis grupos'), false);
});
test('pausa y reinicio recuperan el siguiente pendiente, sin convertirlo en falta', async () => {
  const f = fixture();
  await start(f);
  await f.run('p');
  await f.run('pausar lista');
  f.restart();
  await f.run('continuar lista');
  assert.equal(f.control().index, 1);
  await f.run('finalizar lista');
  assert.notEqual(f.sessions()[0].status, 'Finalizada');
  assert.equal(f.sessions()[0].students[2].status, 'Pendiente');
});
test('anterior permite corregir y regresa al próximo pendiente', async () => {
  const f = fixture();
  await start(f);
  await f.run('f');
  await f.run('anterior');
  assert.equal(f.control().index, 0);
  await f.run('p');
  assert.equal(f.control().index, 1);
  assert.equal(f.sessions()[0].students[0].status, 'Presente');
});
test('reentrega y botón viejo no marcan al siguiente; sobrevive al reinicio', async () => {
  const f = fixture();
  await start(f);
  const oldButton = f.button('p');
  await f.run(oldButton, 'duplicate');
  f.restart();
  await f.run(oldButton, 'duplicate');
  await f.run(oldButton, 'different-message');
  assert.equal(f.control().index, 1);
  assert.equal(f.sessions()[0].students[1].status, 'Pendiente');
});
test('retardo al finalizar actualiza la misma asistencia y deja anterior/nuevo en historial', async () => {
  const f = fixture('5A MAM', 1);
  await start(f);
  await f.run('f');
  await f.run('finalizar lista');
  await f.run(`retardo ${f.roster[0].id}`);
  assert.equal(f.control().phase, 'confirmCorrection');
  assert.equal(f.sessions()[0].students[0].status, 'Falta');
  await f.run(f.button('yes'));
  assert.equal(f.sessions()[0].students.length, 1);
  assert.equal(f.sessions()[0].students[0].status, 'Retardo');
  assert.equal(f.sessions()[0].status, 'Finalizada');
  assert.ok(f.data().history.some(r => r[4] === 'Falta' && r[5] === 'Retardo' && r[6] === 'Corregir'));
});

test('corregir lista permite cambiar solo los números seleccionados en una lista finalizada', async () => {
  const f = fixture('5A MAM', 3);
  await start(f);
  await f.run('p'); await f.run('f'); await f.run('f');
  await f.run('finalizar lista');
  assert.deepEqual(f.sessions()[0].students.map(a => a.status), ['Presente', 'Falta', 'Falta']);

  await f.run('corregir lista 5A MAM 2026-09-08');
  assert.equal(f.control().phase, 'numbered');
  assert.equal(f.sessions()[0].numbered.mode, 'correct');
  await f.run('presentes 2');
  assert.deepEqual(f.sessions()[0].students.map(a => a.status), ['Presente', 'Presente', 'Falta']);
  assert.equal(f.sessions()[0].status, 'Finalizada');

  await f.run('corregir asistencias 5A MAM 2026-09-08');
  await f.run('justificar 3');
  assert.deepEqual(f.sessions()[0].students.map(a => a.status), ['Presente', 'Presente', 'Presente']);

  await f.run('corregir lista 5A MAM 2026-09-08');
  await f.run('faltas 1,3');
  assert.deepEqual(f.sessions()[0].students.map(a => a.status), ['Falta', 'Presente', 'Falta']);
  assert.ok(f.data().history.some(r => r[4] === 'Presente' && r[5] === 'Falta' && r[6] === 'Corregir por lista'));
});

test('la corrección masiva rechaza una selección inválida sin cambiar marcas', async () => {
  const f = fixture('5A MAM', 3);
  await start(f);
  await f.run('p'); await f.run('f'); await f.run('p');
  await f.run('finalizar lista');
  await f.run('corregir lista 5A MAM 2026-09-08');
  const before = f.sessions()[0].students.map(a => a.status);
  await f.run('presentes 2,99');
  assert.deepEqual(f.sessions()[0].students.map(a => a.status), before);
  assert.equal(f.control().phase, 'numbered');
});

test('la corrección masiva pide elegir materia cuando hay dos clases el mismo día', async () => {
  const f = fixture('5A LCM', 1);
  await start(f, '5A LCM', 0); await f.run('f'); await f.run('finalizar lista');
  await start(f, '5A LCM', 1); await f.run('p'); await f.run('finalizar lista');
  await f.run('corregir lista 5A LCM 2026-09-08');
  assert.equal(f.control().phase, 'selectBulkCorrection');
  await f.run(f.button('choice_1'));
  assert.equal(f.control().phase, 'numbered');
  assert.equal(f.sessions()[1].numbered.mode, 'correct');
  await f.run('faltas 1');
  assert.equal(f.sessions()[1].students[0].status, 'Falta');
  assert.equal(f.sessions()[0].students[0].status, 'Falta');
});

test('corregir alumno FOLIO muestra sus asistencias y permite cambiar solo las elegidas', async () => {
  const f = fixture('5A MAM', 2);
  await start(f);
  await f.run('p'); await f.run('f');
  await f.run('finalizar lista');
  const second = structuredClone(f.sessions()[0]);
  second.id = 'second-date';
  second.date = '2026-09-09';
  second.students[0].status = 'Falta';
  second.students[1].status = 'Presente';
  f.data().sessions[second.id] = second;

  await f.run(`corregir alumno ${f.roster[0].id}`);
  assert.equal(f.control().phase, 'folioNumbered');
  assert.equal(f.control().folioItems.length, 2);
  await f.run('presentes 1,2');
  assert.equal(f.sessions()[0].students[0].status, 'Presente');
  assert.equal(f.sessions()[1].students[0].status, 'Presente');
  assert.equal(f.sessions()[0].students[1].status, 'Falta');
  assert.equal(f.control().phase, 'idle');
});

test('corregir FOLIO con varias fechas abre solo esas fechas', async () => {
  const f = fixture('5A MAM', 1);
  await start(f);
  await f.run('p');
  await f.run('finalizar lista');
  const second = structuredClone(f.sessions()[0]);
  second.id = 'second-date';
  second.date = '2026-09-09';
  second.students[0].status = 'Falta';
  f.data().sessions[second.id] = second;

  await f.run(`corregir ${f.roster[0].id} 2026-09-08, 2026-09-09`);
  assert.equal(f.control().phase, 'folioNumbered');
  assert.equal(f.control().folioItems.length, 2);
  await f.run('faltas 1');
  assert.equal(f.sessions()[0].students[0].status, 'Falta');
  assert.equal(f.sessions()[1].students[0].status, 'Falta');
});
test('corrección general y cancelación no alteran el alumno equivocado', async () => {
  const f = fixture();
  await start(f);
  await f.run('f');
  await f.run(`corregir ${f.roster[0].id}`);
  await f.run('p');
  await f.run('no');
  assert.equal(f.sessions()[0].students[0].status, 'Falta');
  assert.equal(f.control().index, 1);
  await f.run(`corregir ${f.roster[0].id}`);
  await f.run('p');
  await f.run('si');
  assert.equal(f.sessions()[0].students[0].status, 'Presente');
  assert.equal(f.control().index, 1);
});
test('LCM separa materias y exige elegir clase para corregir', async () => {
  const f = fixture('5A LCM', 1);
  await start(f, '5A LCM', 0);
  await f.run('f');
  await f.run('finalizar lista');
  await start(f, '5A LCM', 1);
  await f.run('p');
  await f.run('finalizar lista');
  assert.equal(f.sessions().length, 2);
  await f.run(`retardo ${f.roster[0].id}`);
  assert.equal(f.control().phase, 'selectCorrection');
  await f.run(f.button('choice_0'));
  await f.run('si');
  assert.equal(f.sessions()[0].students[0].status, 'Retardo');
  assert.equal(f.sessions()[1].students[0].status, 'Presente');
});
test('solo el docente accede, incluido formato 52; grupo vacío no crea lista', async () => {
  const f = fixture('5A MAM', 0);
  await f.run('pasar lista 5A MAM', 'outsider', '5219381800247');
  assert.equal(f.sessions().length, 0);
  assert.match(f.sent.at(-1).text.body, /únicamente para el docente/);
  await f.run('pasar lista 5A MAM', 'authorized', '529381949915');
  await f.run('si');
  assert.equal(f.sessions().length, 0);
});
test('fallo de escritura no avanza; fallo al enviar después de guardar se recupera sin marcar dos veces', async () => {
  const f = fixture();
  await start(f);
  f.failNext();
  await f.run('p', 'first');
  assert.equal(f.control().index, 0);
  await f.run('p', 'first');
  assert.equal(f.control().index, 1);
  f.failNextSend();
  await f.run('f', 'second');
  f.restart();
  await f.run('f', 'second');
  assert.equal(f.control().index, 2);
  assert.equal(f.sessions()[0].students[2].status, 'Pendiente');
});
test('resumen largo se divide y fecha usa zona escolar', async () => {
  assert.equal(localDate(new Date('2026-09-08T02:00:00Z')), '2026-09-07');
  const f = fixture('5A MAM', 100);
  await start(f);
  for (let i = 0; i < 100; i++) await f.run('f');
  assert.ok(f.sent.filter(p => p.type === 'text').every(p => p.text.body.length <= 3500));
});
test('botón Corregir usa la clase seleccionada y fecha explícita selecciona historial', async () => {
  const f = fixture('5A MAM', 1);
  await start(f);
  await f.run('f');
  await f.run(f.button('correct'));
  await f.run(f.roster[0].id);
  assert.equal(f.control().phase, 'correctStatus');
  await f.run('r');
  await f.run('si');
  assert.equal(f.sessions()[0].students[0].status, 'Retardo');
  await f.run(`corregir ${f.roster[0].id} 2026-09-07`);
  assert.match(f.sent.at(-1).text.body, /No encontré/);
  await f.run(`corregir ${f.roster[0].id} 2026-09-08`);
  assert.equal(f.control().phase, 'correctStatus');
});
test('listas abiertas de varios días se paginan y se retoma la seleccionada', async () => {
  const f = fixture('5A MAM', 1);
  await start(f);
  await f.run('pausar lista');
  const first = f.sessions()[0];
  for (let i = 1; i < 12; i++) f.data().sessions[`session-${i}`] = { ...structuredClone(first), id: `session-${i}`, date: `2026-08-${String(i).padStart(2, '0')}` };
  await f.run('continuar lista');
  assert.equal(f.control().phase, 'selectSession');
  assert.equal(f.sent.at(-1).interactive.action.sections[0].rows.length, 10);
  await f.run(f.button('more'));
  assert.equal(f.control().page, 1);
  const chosen = f.control().choices[9].key;
  await f.run(f.button('choice_9'));
  assert.equal(f.control().sessionId, chosen);
  assert.equal(f.control().phase, 'roll');
});

test('adaptador Sheets: sesión, control, asistencias y auditoría en un único batch; corrección actualiza fila', async () => {
  const titles = ['Listas_Docente', 'Control_Lista', 'Asistencias', 'Historial_Lista'];
  const tables = titles.map(() => [['header']]);
  const batches = [];
  const sheets = { spreadsheets: {
    values: { batchGet: async () => ({ data: { valueRanges: tables.map(values => ({ values: structuredClone(values) })) } }) },
    batchUpdate: async ({ requestBody }) => {
      batches.push(requestBody.requests);
      for (const request of requestBody.requests) {
        const op = request.appendCells || request.updateCells;
        const index = request.appendCells ? op.sheetId : op.start.sheetId;
        const rows = op.rows.map(r => r.values.map(c => c.userEnteredValue.stringValue));
        if (request.appendCells) tables[index].push(...rows);
        else tables[index][op.start.rowIndex] = rows[0];
      }
    }
  } };
  const store = createAttendanceStore(async () => ({ sheets, spreadsheetId: 'test', ids: Object.fromEntries(titles.map((t, i) => [t, i])) }));
  await store.transact(db => {
    db.sessions.s = { id: 's', date: '2026-09-08', group: '5A MAM', subject: 'Energía', status: 'En curso', teacher: ADMIN, updatedAt: 'now', createdAt: 'now', students: [{ id: 'EDU-5AMAM-001', name: 'Ana', status: 'Falta' }] };
    db.controls[ADMIN] = { phase: 'roll', sessionId: 's', index: 0 };
    db.history.push(['now', ADMIN, 's', 'EDU-5AMAM-001', 'Pendiente', 'Falta', 'Marcar', 'one']);
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 4);
  await store.transact(db => {
    assert.ok(db.seen.has('one'));
    db.sessions.s.students[0].status = 'Retardo';
    db.history.push(['later', ADMIN, 's', 'EDU-5AMAM-001', 'Falta', 'Retardo', 'Corregir', 'two']);
  });
  assert.equal(tables[2].length, 2);
  assert.equal(tables[2][1][6], 'Retardo');
  assert.equal(tables[3].length, 3);
  assert.ok(batches[1].some(r => r.updateCells?.start.sheetId === 2));
});
