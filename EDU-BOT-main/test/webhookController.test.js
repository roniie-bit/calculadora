import test from 'node:test';
import assert from 'node:assert/strict';
import { clearPhoneMessageQueues } from '../src/services/phoneMessageQueue.js';

test('responde 200 antes de procesar el mensaje', async () => {
  process.env.OPENAI_API_KEY ||= 'test-key';
  const [{ default: webhookController }, { default: messageHandler }] =
    await Promise.all([
      import('../src/controllers/webhookController.js'),
      import('../src/services/messageHandler.js'),
    ]);

  clearPhoneMessageQueues();
  const events = [];
  const original = messageHandler.handleIncomingMessage;

  messageHandler.handleIncomingMessage = async () => {
    events.push('procesamiento-inicio');
    await new Promise((resolve) => setTimeout(resolve, 10));
    events.push('procesamiento-fin');
  };

  try {
    webhookController.handleIncoming(
      {
        body: {
          entry: [{
            changes: [{
              value: {
                messages: [{ from: '5211111111111', type: 'text', text: { body: 'hola' } }],
                contacts: [{ wa_id: '5211111111111' }],
              },
            }],
          }],
        },
      },
      {
        sendStatus(code) {
          events.push(`respuesta-${code}`);
        },
      }
    );

    assert.deepEqual(events, ['respuesta-200']);
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.deepEqual(events, [
      'respuesta-200',
      'procesamiento-inicio',
      'procesamiento-fin',
    ]);
  } finally {
    messageHandler.handleIncomingMessage = original;
  }
});
