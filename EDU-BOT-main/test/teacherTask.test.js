import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeacherTaskFlow, parsePoints, parseSelection } from '../src/flows/teacherTaskFlow.js';
import { createTaskStore } from '../src/services/teacherTaskStore.js';
import { PERIOD } from '../src/services/studentService.js';
const ADMIN = '5219381949915';
function fixture() {
  let db = { sessions: {}, controls: {}, history: [] };
  let failure = false, sendFailure = false, counter = 0;
  const roster = [
    { id: 'EDU-5AMAM-001', fullName: 'Álvarez Ana', group: '5A MAM' },
    { id: 'EDU-5AMAM-002', fullName: 'Pérez José', group: '5A MAM' },
    { id: 'EDU-5ALCM-001', fullName: 'García Luis', group: '5A LCM' }
  ].map(a => ({ ...a, status: 'Activo', period: PERIOD, phone: 'same-phone' }));
  const sent = [];
  const store = { transact: async work => {
    const copy = structuredClone(db); const history = copy.history; copy.history = [];
    copy.seen = new Set(history.map(r => r[7]).filter(Boolean));
    const result = await work(copy);
    if (failure) { failure = false; throw new Error('Sheets simulado'); }
    db = { sessions: copy.sessions, controls: copy.controls, history: [...history, ...copy.history] };
    return result;
  } };
  const options = { store, students: { list: async () => roster }, adminNumber: ADMIN, now: () => new Date('2026-09-09T01:00:00Z'), send: async (phone, payload) => {
    if (sendFailure) { sendFailure = false; throw new Error('WhatsApp simulado'); }
    sent.push(payload);
  } };
  let flow = createTeacherTaskFlow(options);
  return { sent, roster, db: () => db, c: () => db.controls[ADMIN],
    run: (command, id = `m-${++counter}`, phone = ADMIN) => flow(phone, command, id),
    click: (action, id = `m-${++counter}`) => flow(ADMIN, `tarea:${db.controls[ADMIN].token}:${action}`, id),
    restart: () => { flow = createTeacherTaskFlow(options); },
    fail: () => { failure = true; }, failSend: () => { sendFailure = true; } };
}
async function create(f, group = '5A MAM', name = 'Ejercicios', value = '1') {
  await f.run(`crear tarea ${group}`);
  if (group.endsWith('LCM')) await f.click('pick_0');
  await f.run(name); await f.run(value); await f.click('yes');
}
async function review(f, group = '5A MAM', index = 0) {
  await f.run(`revisar tarea ${group}`); await f.click(`pick_${index}`);
}
async function bulk(f, points = '0.7') {
  await f.run('revisar pendientes 5A MAM'); await f.click('pick_0'); await f.run(points);
}

async function fullList(f) {
  await f.run('revisar tarea lista 5A MAM'); await f.click('pick_0');
}

test('dual desaparece de revisiones existentes sin borrar entregas ni asignarle ceros', async () => {
  const f = fixture(); await create(f); await review(f);
  const old = `tarea:${f.c().token}:yesDelivery`;
  f.roster[0].status = 'Dual'; await f.run(old, 'dual-old');
  await f.run(old, 'dual-old');
  assert.equal(f.c().index, 1);
  assert.ok(f.db().sessions.T01.students.every(a => a.points === null));
  await f.run('anterior tarea'); assert.equal(f.c().index, 1);
  await f.run('finalizar tarea'); assert.deepEqual(f.c().zeroIds, ['EDU-5AMAM-002']);
  await f.click('yes'); assert.equal(f.db().sessions.T01.students[0].points, null);
  f.sent.length = 0; await f.run('pendientes tarea 5A MAM'); await f.click('pick_0');
  assert.doesNotMatch(f.sent.map(p => p.text?.body || '').join('\n'), /Álvarez/);
  await bulk(f); assert.deepEqual(f.c().bulkIds, ['EDU-5AMAM-002']);
  await fullList(f); assert.deepEqual(f.c().listIds, ['EDU-5AMAM-002']);
  f.roster[0].status = 'Activo'; await review(f); assert.equal(f.c().index, 0);
  await f.click('yesDelivery'); f.roster[0].status = 'Dual';
  await f.run('tareas alumno EDU-5AMAM-001'); assert.match(f.sent.at(-1).text.body, /Total acumulado: 1/);
  assert.equal(f.db().sessions.T01.students[0].points, 1);
});

test('dual durante revisión por lista rechaza numeración vieja sin aplicar puntos', async () => {
  const f = fixture(); await create(f); await fullList(f);
  f.roster[0].status = 'Dual'; await f.run('entregaron todos');
  assert.ok(f.db().sessions.T01.students.every(a => a.points === null));
  await fullList(f); await f.run('entregaron todos');
  assert.deepEqual(f.db().sessions.T01.students.map(a => a.points), [null, 1]);
});

test('dual invalida propuestas de ceros y entregas en lote sin modificar registros', async () => {
  const f = fixture(); await create(f); await bulk(f);
  await f.run('entregaron 1-2'); f.roster[0].status = 'Dual'; await f.click('yes');
  assert.ok(f.db().sessions.T01.students.every(a => a.points === null));
  await f.run('finalizar tarea'); assert.deepEqual(f.c().zeroIds, ['EDU-5AMAM-002']);
  f.roster[1].status = 'Dual'; await f.click('yes');
  assert.ok(f.db().sessions.T01.students.every(a => a.points === null));
  await f.run('finalizar tarea'); assert.equal(f.c().phase, 'summary');
});

test('inventario muestra avance y grupos vacíos sin alterar la revisión', async () => {
  const f = fixture();
  await create(f, '5A MAM', 'Completa'); await fullList(f); await f.run('entregaron 1');
  await create(f, '5A MAM', 'Parcial'); await review(f, '5A MAM', 1); await f.click('yesDelivery');
  await create(f, '5A MAM', 'Pendiente'); await create(f, '5A LCM', 'Otra materia');
  await review(f, '5A MAM', 1);
  const before = structuredClone(f.db()); f.sent.length = 0;
  await f.run('tareas grupo');
  const output = f.sent.map(p => p.text.body).join('\n');
  assert.match(output, /5A MAM · 3 tareas/);
  assert.match(output, /Calificadas: 1 · 📝 Parciales: 1 · ⏳ Sin calificar: 1/);
  assert.match(output, /T01 — Completa[\s\S]*Calificada · 2\/2/);
  assert.match(output, /T02 — Parcial[\s\S]*Parcialmente calificada · 1\/2/);
  assert.match(output, /T03 — Pendiente[\s\S]*Sin calificar · 0\/2/);
  assert.match(output, /5B LCM · 0 tareas/);
  assert.deepEqual(f.db(), before);
  f.sent.length = 0; await f.run('tareas grupo 5A MAM');
  assert.doesNotMatch(f.sent.map(p => p.text.body).join('\n'), /Otra materia|5B LCM/);
  await f.click('noDelivery'); assert.equal(f.db().sessions.T02.students[1].points, 0);
});

test('inventario respeta docente, periodo y padrón actual, valida grupo y divide mensajes largos', async () => {
  const f = fixture(); await create(f); await fullList(f); await f.run('entregaron todos');
  f.roster.push({ ...f.roster[0], id: 'nuevo', fullName: 'Nuevo alumno' });
  f.sent.length = 0; await f.run('tareas grupo 5A MAM');
  assert.match(f.sent.at(-1).text.body, /Parcialmente calificada · 2\/3/);
  const t = f.db().sessions.T01;
  f.db().sessions.T90 = { ...structuredClone(t), id: 'T90', period: 'otro', name: 'Periodo ajeno' };
  f.db().sessions.T91 = { ...structuredClone(t), id: 'T91', teacher: 'otro', name: 'Docente ajeno' };
  for (let i = 2; i < 70; i++) f.db().sessions[`T${i}`] = { ...structuredClone(t), id: `T${i}`, name: 'Nombre largo '.repeat(10) };
  f.sent.length = 0; await f.run('tareas grupo 5A MAM');
  assert.ok(f.sent.length > 2);
  assert.ok(f.sent.every(p => p.text.body.length <= 3500));
  assert.doesNotMatch(f.sent.map(p => p.text.body).join('\n'), /Periodo ajeno|Docente ajeno/);
  await f.run('tareas grupo inexistente'); assert.match(f.sent.at(-1).text.body, /Especifica el grupo/);
  await f.run('tareas grupo', 'unauthorized', '5211111111111'); assert.match(f.sent.at(-1).text.body, /solo puede/);
  f.roster.forEach(a => { a.status = 'Inactivo'; });
  f.sent.length = 0; await f.run('tareas grupo 5A MAM');
  assert.match(f.sent[1].text.body, /Calificadas: 0/);
  assert.match(f.sent[1].text.body, /Sin alumnos activos/);
});

test('lista completa registra rangos con punto y coma en una respuesta y reemplaza puntos con 1 o 0', async () => {
  const f = fixture();
  for (let i = 3; i <= 39; i++) f.roster.push({ ...f.roster[0], id: `EDU-5AMAM-${i}`, fullName: `Z Alumno ${String(i).padStart(2, '0')}` });
  await create(f, '5A MAM', 'Lista', '5'); await create(f, '5A LCM');
  await review(f); await f.click('yesDelivery'); await f.click('yesDelivery');
  await fullList(f);
  assert.equal(f.c().listIds.length, 39);
  await f.run('entregaron 1-7.9, 10-15,19-39', 'list-once');
  const chosen = new Set([1,2,3,4,5,6,7,9,10,11,12,13,14,15, ...Array.from({ length: 21 }, (_, i) => i + 19)]);
  assert.deepEqual(f.db().sessions.T01.students.map(a => [a.status, a.points]), Array.from({ length: 39 }, (_, i) => chosen.has(i + 1) ? ['Entregó', 1] : ['No entregó', 0]));
  assert.equal(f.db().sessions.T02.students[0].points, null);
  const historyCount = f.db().history.length;
  f.restart(); await f.run('entregaron 1-7.9, 10-15,19-39', 'list-once');
  assert.equal(f.db().history.length, historyCount);
});

test('lista conserva números al pausar y rechaza selecciones o padrones inválidos sin cambios parciales', async () => {
  const f = fixture(); await create(f); await fullList(f);
  const ids = f.c().listIds;
  await f.run('pausar tarea'); f.restart(); await f.run('continuar tarea');
  assert.equal(f.c().phase, 'fullList'); assert.deepEqual(f.c().listIds, ids);
  for (const input of ['1,99', '2-1', '1..2', '0']) await f.run(`entregaron ${input}`);
  assert.ok(f.db().sessions.T01.students.every(a => a.points === null));
  f.roster[1].group = '5A LCM'; await f.run('entregaron 1');
  assert.ok(f.db().sessions.T01.students.every(a => a.points === null));
  f.roster[1].group = '5A MAM';
  f.fail(); await f.run('entregaron todos', 'retry-list');
  assert.ok(f.db().sessions.T01.students.every(a => a.points === null));
  await f.run('entregaron todos', 'retry-list');
  assert.ok(f.db().sessions.T01.students.every(a => a.points === 1));
  await fullList(f); await f.run('entregaron ninguno');
  assert.ok(f.db().sessions.T01.students.every(a => a.status === 'No entregó' && a.points === 0));
});
test('pendientes por lote conserva ceros y puntos anteriores; números estables al actualizar', async () => {
  const f = fixture();
  f.roster.push({ ...f.roster[1], id: 'EDU-5AMAM-003', fullName: 'Zamora Luz' });
  await create(f); await review(f);
  await f.click('yesDelivery'); await f.click('noDelivery'); await f.click('noDelivery');
  await bulk(f);
  await f.run('entregaron 1');
  assert.equal(f.db().sessions.T01.students[1].points, 0);
  await f.click('yes');
  assert.deepEqual(f.db().sessions.T01.students.map(a => a.points), [1, 0.7, 0]);
  assert.deepEqual(f.c().bulkIds, ['EDU-5AMAM-002', 'EDU-5AMAM-003']);
  assert.match(f.sent.slice(-3).map(p => p.text?.body || '').join('\n'), /2\. Zamora/);
  await f.run('entregaron 1');
  assert.match(f.sent.at(-1).text.body, /Selección inválida/);
  await f.run('finalizar tarea');
  assert.equal(f.db().sessions.T01.students[2].status, 'No entregó');
  assert.equal(f.db().sessions.T01.students[2].points, 0);
  await bulk(f, '0.5'); await f.run('entregaron 1'); await f.click('yes');
  assert.deepEqual(f.db().sessions.T01.students.map(a => a.points), [1, 0.7, 0.5]);
});
test('sin revisar solo pasa a cero después de confirmar; lote puede indicar una entrega nueva', async () => {
  const f = fixture(); await create(f); await bulk(f, '1');
  await f.run('entregaron 1'); await f.click('no');
  assert.equal(f.db().sessions.T01.students[0].points, null);
  await f.run('entregaron 1'); await f.click('yes');
  await f.run('finalizar tarea');
  assert.equal(f.c().phase, 'confirmZeros');
  assert.equal(f.db().sessions.T01.students[1].points, null);
  await f.click('no');
  assert.equal(f.db().sessions.T01.students[1].status, 'Sin revisar');
  await f.run('finalizar tarea'); await f.click('yes');
  assert.deepEqual(f.db().sessions.T01.students.map(a => [a.status, a.points]), [['Entregó', 1], ['No entregó', 0]]);
});
test('selección valida todos los números y rangos sin aplicar parcialmente', async () => {
  assert.deepEqual(parseSelection('1, 1, 2-3', 3), [0, 1, 2]);
  for (const input of ['', '0', '-1', '1,', '3-1', '1-9999999999', '2;3', '1.5']) assert.equal(parseSelection(input, 3), null);
  const f = fixture(); await create(f); await bulk(f);
  await f.run('entregaron 1, 99');
  assert.equal(f.c().phase, 'bulk');
  assert.ok(f.db().sessions.T01.students.every(a => a.points === null));
  await f.run('entregaron 1-2'); await f.click('yes');
  assert.ok(f.db().sessions.T01.students.every(a => a.points === 0.7));
});
test('pausa y reinicio conservan puntaje y numeración; reentregas y botones viejos no duplican', async () => {
  const f = fixture(); await create(f); await bulk(f);
  await f.run('entregaron 1');
  const old = `tarea:${f.c().token}:yes`;
  await f.run(old, 'batch-once'); f.restart(); await f.run(old, 'batch-once');
  await f.run(old, 'old-button');
  assert.equal(f.db().sessions.T01.students[1].points, null);
  await f.run('pausar tarea'); f.restart(); await f.run('continuar tarea');
  assert.equal(f.c().phase, 'bulk'); assert.equal(f.c().bulkPoints, 0.7);
  assert.equal(f.c().bulkIds[1], 'EDU-5AMAM-002');
});
test('fallo y cambio de grupo antes de confirmar rechazan todo el lote', async () => {
  const f = fixture(); await create(f); await bulk(f);
  await f.run('entregaron 1-2'); f.fail(); await f.click('yes', 'retry-batch');
  assert.ok(f.db().sessions.T01.students.every(a => a.points === null));
  f.roster[1].group = '5A LCM'; await f.click('yes');
  assert.ok(f.db().sessions.T01.students.every(a => a.points === null));
  f.roster[1].group = '5A MAM';
  await f.run('entregaron 1-2'); f.failSend(); await f.click('yes', 'saved-batch');
  f.restart(); await f.run('continuar tarea');
  assert.ok(f.db().sessions.T01.students.every(a => a.points === 0.7));
  assert.equal(f.db().history.filter(r => r[6] === 'Actualizar entrega').length, 2);
});
test('confirmar ceros no sobrescribe una entrega registrada tras la propuesta', async () => {
  const f = fixture(); await create(f); await review(f); await f.run('finalizar tarea');
  f.db().sessions.T01.students[0].status = 'Entregó'; f.db().sessions.T01.students[0].points = 0.9;
  await f.click('yes');
  assert.deepEqual(f.db().sessions.T01.students.map(a => a.points), [0.9, null]);
});
test('creación y revisión: grupo aislado, valor completo, no entregó cero y sin revisar distinto', async () => {
  const f = fixture(); await create(f); await create(f, '5A LCM');
  assert.deepEqual(Object.keys(f.db().sessions), ['T01', 'T02']);
  await f.run('revisar tarea 5A MAM');
  assert.equal(f.c().choices.length, 1);
  assert.equal(f.c().choices[0].key, 'T01');
  await f.click('pick_0');
  await f.click('yesDelivery');
  assert.equal(f.db().sessions.T01.students[0].points, 1);
  assert.equal(f.db().sessions.T01.students[1].points, null);
  await f.click('noDelivery');
  assert.equal(f.db().sessions.T01.students[1].status, 'No entregó');
  assert.equal(f.db().sessions.T01.students[1].points, 0);
  assert.equal(f.db().sessions.T02.students[0].status, 'Sin revisar');
});
test('entrega posterior requiere confirmación y reemplaza puntos, sin duplicar ni descontar por fecha', async () => {
  const f = fixture(); await create(f); await review(f); await f.click('noDelivery');
  await f.run('entrega T01 EDU-5AMAM-001 0.7');
  assert.equal(f.db().sessions.T01.students[0].points, 0);
  await f.click('yes');
  assert.equal(f.db().sessions.T01.students[0].points, 0.7);
  await f.run('entrega T01 EDU-5AMAM-001 0.9'); await f.click('yes');
  assert.equal(f.db().sessions.T01.students.length, 2);
  assert.equal(f.db().sessions.T01.students[0].points, 0.9);
  assert.ok(f.db().history.some(r => r[4] === 'Entregó | 0.7' && r[5] === 'Entregó | 0.9'));
});
test('puntaje opcional y personalizado admiten coma y cero; cancelación conserva el anterior', async () => {
  const f = fixture(); await create(f); await review(f);
  await f.click('custom'); await f.run('0,7'); await f.click('no');
  assert.equal(f.db().sessions.T01.students[0].status, 'Sin revisar');
  await f.click('custom'); await f.run('0'); await f.click('yes');
  assert.equal(f.db().sessions.T01.students[0].status, 'Entregó');
  assert.equal(f.db().sessions.T01.students[0].points, 0);
  await f.run('entrega T01 EDU-5AMAM-002'); assert.equal(f.c().phase, 'latePoints');
  await f.run('0,7'); await f.click('yes');
  assert.equal(f.db().sessions.T01.students[1].points, 0.7);
  for (const v of ['-1', 'NaN', 'Infinity', '1.234', '=SUM(1)', '1e3', '']) assert.equal(parsePoints(v), null);
});
test('autorización y validación del grupo también al confirmar', async () => {
  const f = fixture();
  await f.run('crear tarea 5A MAM', 'outsider', '5211111111111');
  assert.equal(Object.keys(f.db().sessions).length, 0);
  await create(f);
  await f.run('entrega T01 EDU-5ALCM-001 1');
  assert.match(f.sent.at(-1).text.body, /no está activo/);
  await f.run('entrega T01 EDU-5AMAM-001 1');
  f.roster[0].group = '5A LCM';
  await f.click('yes');
  assert.equal(f.db().sessions.T01.students[0].points, null);
});
test('pausa, reinicio, anterior y protección ante reentrega o botones antiguos', async () => {
  const f = fixture(); await create(f); await review(f);
  const old = `tarea:${f.c().token}:yesDelivery`;
  await f.run(old, 'repeat'); f.restart(); await f.run(old, 'repeat'); await f.run(old, 'new-id');
  assert.equal(f.db().sessions.T01.students[1].points, null);
  await f.run('anterior tarea'); await f.click('noDelivery');
  assert.equal(f.db().sessions.T01.students[0].points, 0);
  await f.run('pausar tarea'); f.restart(); await f.run('continuar tarea');
  assert.equal(f.c().index, 1);
});
test('pendientes separa no entregó y sin revisar; total usa puntos actuales', async () => {
  const f = fixture(); await create(f); await review(f); await f.click('noDelivery');
  await f.run('pendientes tarea 5A MAM'); await f.click('pick_0');
  const output = f.sent.slice(-3).map(p => p.text.body).join('\n');
  assert.match(output, /No entregó:\n\nÁlvarez Ana/);
  assert.match(output, /Sin revisar:\n\nPérez José/);
  await f.run('entrega T01 EDU-5AMAM-001 0.7'); await f.click('yes');
  await f.run('tareas alumno EDU-5AMAM-001');
  assert.match(f.sent.at(-1).text.body, /Total acumulado: 0.7/);
});
test('fallos de Sheets y WhatsApp no duplican tareas o puntos', async () => {
  const f = fixture(); await create(f); await review(f);
  f.fail(); await f.click('yesDelivery', 'failed');
  assert.equal(f.db().sessions.T01.students[0].points, null);
  await f.click('yesDelivery', 'failed');
  assert.equal(f.db().sessions.T01.students[0].points, 1);
  f.failSend(); await f.click('noDelivery', 'sent-failed');
  f.restart(); await f.run('continuar tarea');
  assert.equal(f.db().sessions.T01.students[1].points, 0);
});
test('no consume comandos explícitos de asistencia ni registro', async () => {
  const f = fixture(); await create(f); await review(f);
  for (const command of ['pasar lista 5A MAM', 'pasar lista numeros 5A MAM', 'presentes 1-2', 'faltas 1-2', 'retardos lista 5A MAM', 'retardos 1', 'retardo EDU-5AMAM-001', 'registrarme', 'mis grupos']) assert.equal(await f.run(command), false);
  assert.equal(f.c().phase, 'idle');
  assert.equal(await f.run('p'), false);
  await f.run('continuar tarea');
  assert.equal(f.c().phase, 'review');
});
test('Sheets guarda tarea, entrega, control e historial juntos y actualiza fila existente', async () => {
  const names = ['Tareas_Grupo', 'Control_Tareas', 'Entregas', 'Historial_Entregas'];
  const tables = names.map(() => [['header']]); const batches = [];
  const sheets = { spreadsheets: { values: { batchGet: async () => ({ data: { valueRanges: tables.map(values => ({ values: structuredClone(values) })) } }) },
    batchUpdate: async ({ requestBody }) => {
      batches.push(requestBody.requests);
      for (const request of requestBody.requests) {
        const op = request.appendCells || request.updateCells;
        const index = request.appendCells ? op.sheetId : op.start.sheetId;
        const rows = op.rows.map(r => r.values.map(c => String(c.userEnteredValue.stringValue ?? c.userEnteredValue.numberValue)));
        if (request.appendCells) tables[index].push(...rows); else tables[index][op.start.rowIndex] = rows[0];
      }
    } } };
  const store = createTaskStore(async () => ({ sheets, spreadsheetId: 'test', ids: Object.fromEntries(names.map((name, i) => [name, i])) }));
  await store.transact(db => {
    db.sessions.T01 = { id: 'T01', name: 'Energía', group: '5A MAM', subject: 'Física', value: 1, teacher: ADMIN, createdAt: 'now', students: [{ id: 'EDU-5AMAM-001', name: 'Ana', status: 'No entregó', points: 0 }] };
    db.controls[ADMIN] = { phase: 'summary', taskId: 'T01' };
    db.history.push(['now', ADMIN, 'T01', 'EDU-5AMAM-001', '', 'No entregó | 0', 'Entrega', 'msg']);
  });
  assert.equal(batches[0].length, 4);
  await store.transact(db => { assert.ok(db.seen.has('msg')); db.sessions.T01.students[0].points = 0.7; db.sessions.T01.students[0].status = 'Entregó'; });
  assert.equal(tables[2].length, 2); assert.equal(tables[2][1][7], '0.7');
  assert.equal(batches[1].find(r => r.updateCells?.start.sheetId === 2).updateCells.rows[0].values[7].userEnteredValue.numberValue, 0.7);
});
test('creación duplicada por webhook y tareas paginadas no mezclan grupos', async () => {
  const f = fixture();
  await f.run('crear tarea 5A MAM'); await f.run('Energía'); await f.run('1');
  const confirm = `tarea:${f.c().token}:yes`;
  await f.run(confirm, 'create-once'); f.restart(); await f.run(confirm, 'create-once');
  assert.equal(Object.keys(f.db().sessions).length, 1);
  for (let i = 1; i < 11; i++) await create(f, '5A MAM', `Tarea ${i}`);
  await create(f, '5A LCM');
  await f.run('pendientes tarea 5A MAM');
  assert.equal(f.c().choices.length, 11);
  await f.click('more');
  assert.equal(f.sent.at(-1).interactive.action.sections[0].rows.length, 2);
  await f.click('pick_10');
  assert.equal(f.c().taskId, 'T11');
});

test('el docente puede usar registrar tarea como alias de crear tarea', async () => {
  const f = fixture();
  await f.run('registrar tarea 5A MAM');
  assert.match(f.sent.at(-1).text.body, /Cómo se llama la tarea/i);
});
test('resúmenes largos se dividen y alta posterior aparece como sin revisar', async () => {
  const f = fixture(); await create(f);
  for (let i = 3; i < 110; i++) f.roster.push({ ...f.roster[0], id: `EDU-5AMAM-${i}`, fullName: `Apellido muy largo número ${i} Nombre de prueba` });
  await f.run('pendientes tarea 5A MAM'); await f.click('pick_0');
  assert.equal(f.db().sessions.T01.students.length, 109);
  assert.ok(f.sent.filter(p => p.type === 'text').every(p => p.text.body.length <= 3500));
  assert.ok(f.db().sessions.T01.students.every(a => a.status === 'Sin revisar'));
});
