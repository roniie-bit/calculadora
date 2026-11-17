import test from 'node:test';
import assert from 'node:assert/strict';
import { createMultiTaskFlow, parseMultiDeliveries } from '../src/flows/multiTaskFlow.js';
import { PERIOD } from '../src/services/studentService.js';

const ADMIN = '5219381949915';
function fixture() {
  const roster = ['Ana', 'Beto', 'Carlos', 'Dual'].map((fullName, i) => ({ id: `A${i}`, fullName, group: '5A MAM', period: PERIOD, status: i === 3 ? 'Dual' : 'Activo' }));
  let db = { sessions: Object.fromEntries(['T01', 'T02', 'T03'].map(id => [id, { id, name: id, group: '5A MAM', subject: 'Energía', value: 2, period: PERIOD, teacher: ADMIN, students: roster.map(a => ({ id: a.id, name: a.fullName, status: 'Entregó', points: 0.5 })) }])), controls: {}, history: [] };
  let n = 0, fail = false, failSend = false;
  const sent = [];
  const options = { adminNumber: ADMIN, students: { list: async () => roster }, store: { transact: async work => {
    const copy = structuredClone(db), history = copy.history;
    copy.history = []; copy.seen = new Set(history.map(row => row[7]));
    const result = await work(copy);
    if (fail) { fail = false; throw new Error('Simulated write failure'); }
    db = { ...copy, history: [...history, ...copy.history] }; return result;
  } }, send: async (_, p) => { if (failSend) { failSend = false; throw new Error('Simulated send failure'); } sent.push(p); } };
  let flow = createMultiTaskFlow(options);
  return { roster, sent, db: () => db, c: () => db.controls[`${ADMIN}:multi`],
    run: (text, id = `m${++n}`, phone = ADMIN) => flow(phone, text, id),
    restart: () => { flow = createMultiTaskFlow(options); }, fail: () => { fail = true; }, failSend: () => { failSend = true; } };
}
async function start(f) { await f.run('calificar tareas 5A MAM'); await f.run('tareas juntas T01,T02,T03'); }
const button = f => `multitarea:${f.c().token}:guardar`;
const points = f => Object.values(f.db().sessions).map(t => t.students.map(a => a.points));

test('three tasks save full values together only after confirmation; Dual preserved; duplicate safe', async () => {
  const f = fixture(); await start(f);
  assert.equal(f.c().list.length, 3);
  await f.run('entregas juntas 1.3');
  assert.deepEqual(points(f), Array(3).fill([0.5, 0.5, 0.5, 0.5]));
  const command = button(f); await f.run(command, 'save');
  assert.deepEqual(points(f), Array(3).fill([2, 0, 2, 0.5]));
  const history = f.db().history.length;
  await f.run(command, 'save'); await f.run(command);
  assert.equal(f.db().history.filter(r => r[6] === 'Calificar tareas juntas').length, 9);
  assert.equal(f.db().history.length, history + 1);
});

test('different deliveries per task persist across restart', async () => {
  const f = fixture(); await start(f); f.restart();
  await f.run('continuar tareas juntas');
  await f.run('entregas juntas T01: todos; T02: ninguno\nT03: 2-3');
  f.restart(); await f.run(button(f));
  assert.deepEqual(points(f), [[2,2,2,0.5],[0,0,0,0.5],[0,2,2,0.5]]);
});

test('invalid lists never propose partial grading', async () => {
  const f = fixture(); await start(f);
  for (const value of ['T01: 1; T02: 2', 'T01: 1; T01: 2; T03: 3', 'T01: 1; T02: 2; T03: 4', '0', '3-1', '']) {
    await f.run(`entregas juntas ${value}`); assert.equal(f.c().phase, 'list');
  }
  assert.deepEqual(points(f), Array(3).fill([0.5,0.5,0.5,0.5]));
  assert.equal(parseMultiDeliveries('T01: ninguno; T02: todos', ['T01','T02'], 3).T01.length, 0);
});

test('roster or concurrent grade changes reject whole confirmation', async () => {
  for (const change of [f => { f.roster[0].status = 'Dual'; }, f => { f.db().sessions.T02.students[0].points = 1; }]) {
    const f = fixture(); await start(f); await f.run('entregas juntas todos');
    const command = button(f); change(f); const before = structuredClone(f.db().sessions);
    await f.run(command); assert.deepEqual(f.db().sessions, before); assert.equal(f.c().phase, 'choose');
  }
});

test('group, owner, subject, period and value must match', async () => {
  for (const patch of [{group:'5A LCM'},{teacher:'other'},{subject:'Other'},{period:'old'},{value:3}]) {
    const f = fixture(); f.db().sessions.T02 = {...f.db().sessions.T02, ...patch};
    await start(f); assert.equal(f.c().phase, 'choose');
  }
});

test('authorization, personal commands and cancellation', async () => {
  const f = fixture(); assert.equal(await f.run('mis tareas'), false);
  await f.run('calificar tareas 5A MAM', 'unauthorized', '5211111111111'); assert.equal(f.c(), undefined);
  await start(f); await f.run('entregas juntas todos'); const old = button(f);
  await f.run('cancelar tareas juntas'); await f.run(old);
  assert.deepEqual(points(f), Array(3).fill([0.5,0.5,0.5,0.5]));
});

test('failed write leaves all grades unchanged; failed response recovers saved receipt', async () => {
  const f = fixture(); await start(f); await f.run('entregas juntas todos');
  const command = button(f); f.fail(); await f.run(command);
  assert.deepEqual(points(f), Array(3).fill([0.5,0.5,0.5,0.5]));
  f.failSend(); await f.run(command, 'saved'); f.restart(); await f.run('continuar tareas juntas');
  assert.equal(f.c().phase, 'done'); assert.match(f.sent.at(-1).text.body, /Guardadas/);
  assert.deepEqual(points(f), Array(3).fill([2,2,2,0.5]));
});
