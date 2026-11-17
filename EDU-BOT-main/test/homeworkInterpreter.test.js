import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatHomeworkDateFriendly,
  interpretHomeworkRequest,
} from '../src/services/homeworkInterpreter.js';

const NOW = new Date('2026-10-28T18:00:00.000Z');

test('interpreta tareas con fechas naturales comunes sin llamar a la IA', async () => {
  let aiCalls = 0;
  const aiExtractor = async () => {
    aiCalls += 1;
    return {};
  };

  const tomorrow = await interpretHomeworkRequest(
    'Tarea de química para mañana',
    { now: NOW, aiExtractor }
  );
  assert.deepEqual(tomorrow, {
    status: 'ready',
    description: 'química',
    dueDate: '2026-10-29',
  });

  const friday = await interpretHomeworkRequest(
    'Leer capítulo 4 el viernes',
    { now: NOW, aiExtractor }
  );
  assert.deepEqual(friday, {
    status: 'ready',
    description: 'Leer capítulo 4',
    dueDate: '2026-10-30',
  });

  const conversational = await interpretHomeworkRequest(
    'Quiero recordar la tarea de biología para mañana',
    { now: NOW, aiExtractor }
  );
  assert.deepEqual(conversational, {
    status: 'ready',
    description: 'biología',
    dueDate: '2026-10-29',
  });

  const explicit = await interpretHomeworkRequest(
    'Exposición de historia el 30 de octubre',
    { now: NOW, aiExtractor }
  );
  assert.deepEqual(explicit, {
    status: 'ready',
    description: 'Exposición de historia',
    dueDate: '2026-10-30',
  });

  const lastFriday = await interpretHomeworkRequest(
    'Preparar la exposición para el último viernes de noviembre',
    { now: NOW, aiExtractor }
  );
  assert.deepEqual(lastFriday, {
    status: 'ready',
    description: 'Preparar la exposición',
    dueDate: '2026-11-27',
  });

  assert.equal(aiCalls, 0);
});

test('acepta días relativos y explica fechas ambiguas o vencidas', async () => {
  const inThreeDays = await interpretHomeworkRequest(
    'Ejercicios para en 3 días',
    { now: NOW, aiExtractor: async () => ({}) }
  );
  assert.equal(inThreeDays.status, 'ready');
  assert.equal(inThreeDays.dueDate, '2026-10-31');
  assert.equal(inThreeDays.description, 'Ejercicios');

  const weekend = await interpretHomeworkRequest(
    'Tarea para el fin de semana',
    { now: NOW, aiExtractor: async () => ({}) }
  );
  assert.equal(weekend.status, 'needs_clarification');
  assert.match(weekend.clarification, /sábado o el domingo/i);

  const past = await interpretHomeworkRequest(
    'Reporte para el 20 de octubre',
    { now: NOW, aiExtractor: async () => ({}) }
  );
  assert.equal(past.status, 'invalid');
  assert.match(past.clarification, /ya pasó/i);
});

test('usa IA solo cuando la fecha no se entiende localmente y valida su respuesta', async () => {
  let receivedContext;
  const result = await interpretHomeworkRequest(
    'Organizar la exposición para antes de la feria de ciencias',
    {
      now: NOW,
      aiExtractor: async (_text, context) => {
        receivedContext = context;
        return {
          status: 'ready',
          description: 'Organizar la exposición',
          due_date: '2026-11-06',
          clarification: '',
        };
      },
    }
  );

  assert.equal(receivedContext.today, '2026-10-28');
  assert.match(receivedContext.weekday, /miércoles/i);
  assert.deepEqual(result, {
    status: 'ready',
    description: 'Organizar la exposición',
    dueDate: '2026-11-06',
  });
});

test('rechaza una fecha de IA que no coincide con el mes mencionado', async () => {
  const result = await interpretHomeworkRequest(
    'Preparar la exposición para el último viernes del ciclo de noviembre',
    {
      now: NOW,
      aiExtractor: async () => ({
        status: 'ready',
        description: 'Preparar la exposición',
        due_date: '2026-10-30',
        clarification: '',
      }),
    }
  );

  assert.equal(result.status, 'needs_clarification');
  assert.match(result.clarification, /fecha exacta/i);
});

test('si la IA falla conserva la descripción y solicita la fecha', async () => {
  const result = await interpretHomeworkRequest(
    'Reporte de biología',
    {
      now: NOW,
      aiExtractor: async () => {
        throw new Error('IA no disponible');
      },
    }
  );

  assert.equal(result.status, 'needs_date');
  assert.equal(result.description, 'Reporte de biología');
  assert.match(result.clarification, /mañana|viernes|dd/i);
});

test('presenta la fecha confirmada de forma amigable', () => {
  assert.equal(
    formatHomeworkDateFriendly('2026-10-30'),
    'Viernes, 30 de octubre de 2026'
  );
});
