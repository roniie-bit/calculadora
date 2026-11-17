import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('la detección local conserva señales emocionales y académicas normales', async () => {
  process.env.OPENAI_API_KEY ||= 'test-key';
  const { classifyEmotionalIntentLocally } = await import('../src/services/openAiService.js');
  assert.equal(classifyEmotionalIntentLocally('¿Cómo se calcula la hipotenusa?'), 'normal');
  assert.equal(classifyEmotionalIntentLocally('Me siento solo y no tengo con quién hablar'), 'emocional');
  assert.equal(classifyEmotionalIntentLocally('No quiero vivir'), 'riesgo');
});

test('la respuesta académica se envía antes del registro no crítico en Sheets', async () => {
  const source = await readFile(new URL('../src/services/messageHandler.js', import.meta.url), 'utf8');
  const send = source.indexOf('await whatsappService.sendMessage(phone, TextMessage(aiResponse, phone))');
  const log = source.indexOf('void appendConversation(["BOT-IA"');
  assert.ok(send >= 0 && log > send);
});

test('los comandos deterministas y saludos se resuelven antes del tutor IA', async () => {
  const source = await readFile(new URL('../src/services/messageHandler.js', import.meta.url), 'utf8');
  const ai = source.indexOf('return this.handleAIMessage(text, phone)');
  assert.ok(ai >= 0);
  assert.ok(source.indexOf('await handleAssistanceFlow(') < ai);
  assert.ok(source.indexOf('if (gradesFlow.detect(text))') < ai);
  assert.ok(source.indexOf('text.includes("ubicacion")') < ai);
  assert.ok(source.indexOf('[!. ]*$/i.test(') < ai);
  assert.equal(source.includes('await classifyEmotionalIntent(text)'), false);
});
