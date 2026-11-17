import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskStore } from '../src/services/teacherTaskStore.js';
import { createSyncDeliveriesFlow, planDeliverySync } from '../src/flows/syncDeliveriesFlow.js';
import { PERIOD } from '../src/services/studentService.js';
const ADMIN = '5219381949915';
function fixture() {
  const task = { id: 'T01', name: 'Trabajo', group: '5A MAM', subject: 'Energía', period: PERIOD, teacher: ADMIN, value: 1, createdAt: 'before', students: ['A1','A2'].map(id => ({ id, name: id, status: 'No entregó', points: 0 })) };
  const names = ['Tareas_Grupo','Control_Tareas','Entregas','Historial_Entregas'];
  const tables = [ [['header'], [task.id,'before',task.group,task.subject,task.name,1,JSON.stringify(task)]], [['header']], [['header'], ...task.students.map(a=>[task.id,task.group,task.subject,task.name,a.id,a.name,a.status,a.points,'before',ADMIN])], [['header']] ];
  const batches = [], sent = []; let failure = false, sendFailure = false, time = new Date('2026-09-22T03:00:00Z');
  const sheets = { spreadsheets: { values: { batchGet: async () => ({ data: { valueRanges: tables.map(values => ({ values: structuredClone(values) })) } }) }, batchUpdate: async ({requestBody}) => {
    if (failure) { failure = false; throw Error('write failed'); }
    batches.push(requestBody.requests);
    for (const r of requestBody.requests) {
      const op = r.appendCells || r.updateCells, index = r.appendCells ? op.sheetId : op.start.sheetId;
      const values = op.rows.map(row=>row.values.map(c=>c.userEnteredValue.stringValue ?? c.userEnteredValue.numberValue));
      if(r.appendCells) tables[index].push(...values); else tables[index][op.start.rowIndex] = values[0];
    }
  } } };
  const store = createTaskStore(async()=>({sheets,spreadsheetId:'test',ids:Object.fromEntries(names.map((n,i)=>[n,i]))}));
  const options = {store,adminNumber:ADMIN,now:()=>time,send:async(_,p)=>{if(sendFailure){sendFailure=false;throw Error('send failed');}sent.push(p);}};
  let flow = createSyncDeliveriesFlow(options);
  return { tables, batches, sent, store, task:()=>JSON.parse(tables[0][1][6]), edit:(i,status,points)=>{tables[2][i][6]=status;tables[2][i][7]=points;},
    run:(raw,phone=ADMIN)=>flow(phone,raw,'message'), button:action=>sent.findLast(p=>p.interactive).interactive.action.buttons.find(b=>b.reply.id.endsWith(action)).reply.id,
    fail:()=>{failure=true;},failSend:()=>{sendFailure=true;},expire:()=>{time=new Date(+time+600001);},restart:()=>{flow=createSyncDeliveriesFlow(options);} };
}
test('preview is read-only; confirmation imports edits atomically with recoverable prior values',async()=>{
  const f=fixture();f.edit(1,'Entregó','0,75');f.edit(2,'Sin revisar','');
  await f.run('sincronizar entregas');assert.equal(f.batches.length,0);assert.equal(f.task().students[0].points,0);
  const button=f.button('guardar');await f.run(button);
  assert.equal(f.batches.length,1);assert.equal(f.task().students[0].points,.75);assert.equal(f.task().students[1].points,null);
  assert.equal(JSON.parse(f.tables[3][1][4]).points,0);assert.equal(JSON.parse(f.tables[3][1][5]).points,.75);
  assert.equal(f.tables[2][1][7],.75);await f.run(button);assert.equal(f.batches.length,1);
  await f.run('sincronizar entregas');assert.match(f.sent.at(-1).text.body,/coinciden/);
});
test('cancel, expiry, restart and unauthorized use preserve manual edits',async()=>{
  for(const action of ['cancel','expire','restart']) {
    const f=fixture();f.edit(1,'Entregó',1);await f.run('sincronizar entregas');const button=f.button(action==='cancel'?'cancelar':'guardar');
    if(action==='expire')f.expire();if(action==='restart')f.restart();await f.run(button);
    assert.equal(f.batches.length,0);assert.equal(f.tables[2][1][7],1);
  }
  const f=fixture();await f.run('sincronizar entregas','5211111111111');assert.equal(f.batches.length,0);assert.match(f.sent.at(-1).text.body,/exclusiva/);
});
test('invalid points, identity, states and duplicate rows block all changes',async()=>{
  for(const mutate of [f=>f.edit(2,'No entregó',1),f=>f.edit(2,'Entregó','abc'),f=>f.edit(2,'Entregó',''),f=>f.edit(2,'Sin revisar',0),f=>f.edit(2,'Otro',1),f=>{f.tables[2][2][4]='missing';},f=>{f.tables[2][2][0]='T999';},f=>{f.tables[2][2][1]='5B CM';},f=>{f.tables[2].push([...f.tables[2][1]]);}]) {
    const f=fixture();f.edit(1,'Entregó',1);mutate(f);await f.run('sincronizar entregas');assert.equal(f.batches.length,0);assert.match(f.sent.at(-1).text.body,/errores/);assert.ok(!f.sent.some(p=>p.interactive));
  }
});
test('edits after preview and failed writes never partially import',async()=>{
  for(const mode of ['sheet','internal','failure']) {
    const f=fixture();f.edit(1,'Entregó',1);await f.run('sincronizar entregas');const button=f.button('guardar');
    if(mode==='sheet')f.edit(1,'Entregó',.5);
    if(mode==='internal'){const task=f.task();task.students[1].points=.4;f.tables[0][1][6]=JSON.stringify(task);}
    if(mode==='failure')f.fail();await f.run(button);assert.equal(f.task().students[0].points,0);assert.equal(f.tables[3].length,1);
  }
});
test('control-only writes and unrelated grades preserve manual changes',async()=>{
  const f=fixture();f.edit(1,'Entregó',.75);
  await f.store.transact(db=>{db.controls[ADMIN]={phase:'idle'};db.history.push(['now',ADMIN,'','','','','command','id']);});
  assert.equal(f.tables[2][1][7],.75);
  await f.store.transact(db=>{db.sessions.T01.students[1].status='Entregó';db.sessions.T01.students[1].points=.5;});
  assert.equal(f.tables[2][1][7],.75);assert.equal(f.tables[2][2][7],.5);
  await f.run('sincronizar entregas');await f.run(f.button('guardar'));assert.equal(f.task().students[0].points,.75);
});
test('send failure after commit can be checked again without duplicate history',async()=>{
  const f=fixture();f.edit(1,'Entregó',1);await f.run('sincronizar entregas');const button=f.button('guardar');f.failSend();await f.run(button);
  assert.equal(f.task().students[0].points,1);const count=f.tables[3].length;
  await f.run('sincronizar entregas');assert.match(f.sent.at(-1).text.body,/coinciden/);assert.equal(f.tables[3].length,count);
});
test('only current-period owned tasks are imported; row names do not identify students',()=>{
  const f=fixture(),task=f.task();const db={sessions:{T01:task},deliveryRows:f.tables[2].slice(1)};
  db.deliveryRows[0][5]='different display name';db.deliveryRows[0][6]='Entregó';db.deliveryRows[0][7]=1;
  assert.equal(planDeliverySync(db,ADMIN).changes[0].studentId,'A1');
  task.period='old';assert.equal(planDeliverySync(db,ADMIN).changes.length,0);
});
