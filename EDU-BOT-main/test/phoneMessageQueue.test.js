import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enqueuePhoneMessage,
  clearPhoneMessageQueues,
} from '../src/services/phoneMessageQueue.js';

test.beforeEach(() => clearPhoneMessageQueues());

test('serializa mensajes del mismo teléfono conservando el orden', async () => {
  const events = [];

  const first = enqueuePhoneMessage('5211111111111', async () => {
    events.push('primero-inicio');
    await new Promise((resolve) => setTimeout(resolve, 20));
    events.push('primero-fin');
  });

  const second = enqueuePhoneMessage('5211111111111', async () => {
    events.push('segundo-inicio');
    events.push('segundo-fin');
  });

  await Promise.all([first, second]);
  assert.deepEqual(events, [
    'primero-inicio',
    'primero-fin',
    'segundo-inicio',
    'segundo-fin',
  ]);
});

test('no bloquea mensajes de teléfonos distintos', async () => {
  const events = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  const first = enqueuePhoneMessage('5211111111111', async () => {
    events.push('telefono-1');
    await firstGate;
  });

  const second = enqueuePhoneMessage('5222222222222', async () => {
    events.push('telefono-2');
  });

  await second;
  assert.deepEqual(events, ['telefono-1', 'telefono-2']);
  releaseFirst();
  await first;
});
