import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOMEWORK_TEMPLATE_NAME,
  buildHomeworkReminderMessage,
  dateInMexico,
  homeworkReminderKind,
  isHomeworkDateBeforeToday,
  parseHomeworkDate,
  parseHomeworkReminderAnswer,
  shouldSendHomeworkReminder,
} from '../src/services/homeworkReminder.js';
import { revisarTareasPendientes } from '../src/services/homeworkScheduler.js';
import { createHomeworkReminderResponseFlow } from '../src/flows/homeworkReminderResponseFlow.js';

test('usa la fecha calendario de México y valida fechas reales', () => {
  assert.equal(
    dateInMexico(new Date('2026-10-27T05:59:00.000Z')),
    '2026-10-26'
  );
  assert.equal(
    dateInMexico(new Date('2026-10-27T06:00:00.000Z')),
    '2026-10-27'
  );
  assert.deepEqual(parseHomeworkDate('29/02/2028'), {
    year: 2028,
    month: 2,
    day: 29,
  });
  assert.equal(parseHomeworkDate('29/02/2027'), null);
  assert.equal(parseHomeworkDate('31/04/2026'), null);
  assert.equal(
    isHomeworkDateBeforeToday(
      '27/10/2026',
      new Date('2026-10-28T05:59:00.000Z')
    ),
    false
  );
  assert.equal(
    isHomeworkDateBeforeToday(
      '27/10/2026',
      new Date('2026-10-28T06:00:00.000Z')
    ),
    true
  );
});

test('calcula recordatorios por fecha y evita repetirlos el mismo día', () => {
  const now = new Date('2026-10-26T18:00:00.000Z');
  assert.equal(homeworkReminderKind('28/10/2026', now), 'two-days');
  assert.equal(homeworkReminderKind('27/10/2026', now), 'tomorrow');
  assert.equal(homeworkReminderKind('26/10/2026', now), 'today');
  assert.equal(homeworkReminderKind('25/10/2026', now), 'overdue');
  assert.equal(homeworkReminderKind('30/10/2026', now), null);

  assert.equal(
    shouldSendHomeworkReminder(
      { dueDate: '28/10/2026', lastReminder: '' },
      now
    ),
    true
  );
  assert.equal(
    shouldSendHomeworkReminder(
      { dueDate: '28/10/2026', lastReminder: '2026-10-26' },
      now
    ),
    false
  );
});

test('construye y envía una plantilla una sola vez para cada tarea debida', async () => {
  const now = new Date('2026-10-26T18:00:00.000Z');
  const tasks = [
    {
      rowIndex: 2,
      phone: '5211111111111',
      description: 'Reporte de química',
      dueDate: '28/10/2026',
      lastReminder: '',
    },
    {
      rowIndex: 3,
      phone: '5222222222222',
      description: 'Ejercicios',
      dueDate: '27/10/2026',
      lastReminder: '2026-10-26',
    },
    {
      rowIndex: 4,
      phone: '5233333333333',
      description: 'Tarea vencida',
      dueDate: '25/10/2026',
      lastReminder: '',
    },
  ];
  const sent = [];
  const marked = [];

  const result = await revisarTareasPendientes({
    now,
    loadTasks: async () => tasks,
    send: async (phone, payload) => {
      sent.push({ phone, payload });
      return { messages: [{ id: `wamid-${phone}` }] };
    },
    markSent: async (rowIndex, messageId, date) => {
      marked.push({ rowIndex, messageId, date });
      return true;
    },
  });

  assert.equal(result.sent, 2);
  assert.deepEqual(
    sent.map(({ phone }) => phone),
    ['5211111111111', '5233333333333']
  );
  assert.equal(sent[0].payload.type, 'template');
  assert.equal(sent[0].payload.template.name, HOMEWORK_TEMPLATE_NAME);
  assert.deepEqual(marked, [
    {
      rowIndex: 2,
      messageId: 'wamid-5211111111111',
      date: '2026-10-26',
    },
    {
      rowIndex: 4,
      messageId: 'wamid-5233333333333',
      date: '2026-10-26',
    },
  ]);
  assert.equal(
    buildHomeworkReminderMessage(tasks[0]).template.components[0]
      .parameters[0].text,
    'Reporte de química'
  );
  assert.equal(
    buildHomeworkReminderMessage({
      ...tasks[0],
      description: '  Reporte\n con\t espacios   ',
    }).template.components[0].parameters[0].text,
    'Reporte con espacios'
  );
});

test('las respuestas de plantilla actualizan la tarea y confirman al alumno', async () => {
  const task = {
    rowIndex: 7,
    description: 'Reporte de química',
  };
  const recorded = [];
  const sent = [];
  const flow = createHomeworkReminderResponseFlow({
    findById: async () => task,
    findOpenByPhone: async () => null,
    recordResponse: async (rowIndex, answer) => {
      recorded.push({ rowIndex, answer });
      return true;
    },
    send: async (phone, payload) => sent.push({ phone, payload }),
  });

  const handled = await flow(
    {
      context: { id: 'wamid-recordatorio' },
      interactive: {
        button_reply: { id: 'homework_done', title: 'Sí, ya la entregué' },
      },
    },
    '5211111111111'
  );

  assert.equal(handled, true);
  assert.deepEqual(recorded, [{ rowIndex: 7, answer: 'done' }]);
  assert.match(sent[0].payload.text.body, /marqué.*entregada/i);
  assert.equal(parseHomeworkReminderAnswer('No, sigue pendiente'), 'pending');
});

test('acepta la respuesta de botón de plantilla enviada por WhatsApp', async () => {
  const recorded = [];
  const sent = [];
  const flow = createHomeworkReminderResponseFlow({
    findById: async (id) => {
      assert.equal(id, 'wamid-template');
      return { rowIndex: 8, description: 'Leer capítulo 4' };
    },
    findOpenByPhone: async () => null,
    recordResponse: async (rowIndex, answer) => {
      recorded.push({ rowIndex, answer });
      return true;
    },
    send: async (phone, payload) => sent.push({ phone, payload }),
  });

  const handled = await flow(
    {
      type: 'button',
      context: { id: 'wamid-template' },
      button: { text: 'No, sigue pendiente', payload: 'no_sigue_pendiente' },
    },
    '5211111111111'
  );

  assert.equal(handled, true);
  assert.deepEqual(recorded, [{ rowIndex: 8, answer: 'pending' }]);
  assert.match(sent[0].payload.text.body, /sigue pendiente/i);
});

test('ignora botones ajenos y respuestas duplicadas que ya no tienen recordatorio abierto', async () => {
  const flow = createHomeworkReminderResponseFlow({
    findById: async () => null,
    findOpenByPhone: async () => null,
    recordResponse: async () => true,
    send: async () => {
      throw new Error('No debería enviar confirmación');
    },
  });

  assert.equal(
    await flow(
      { interactive: { button_reply: { id: 'otro', title: 'Otro botón' } } },
      '5211111111111'
    ),
    false
  );
  assert.equal(
    await flow(
      {
        context: { id: 'wamid-ya-procesado' },
        interactive: {
          button_reply: { id: 'homework_done', title: 'Sí, ya la entregué' },
        },
      },
      '5211111111111'
    ),
    true
  );
});
