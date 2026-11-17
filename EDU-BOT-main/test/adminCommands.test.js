import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAdminCommandsFlow, ADMIN_COMMAND_PAGES } from '../src/flows/adminCommandsFlow.js';

test('guía exclusiva del administrador en ambos formatos; aliases y texto normal', async () => {
  const sent = [];
  const flow = createAdminCommandsFlow({ adminNumber: '5219381949915', send: async (to, payload) => sent.push(payload) });
  for (const [phone, command] of [['5219381949915', ' COMANDOS '], ['529381949915', 'ayuda   admin'], ['5219381949915', 'mis comandos']]) {
    sent.length = 0;
    assert.equal(await flow(phone, command), true);
    assert.equal(sent.length, ADMIN_COMMAND_PAGES.length);
    assert.ok(sent.every(p => p.to === phone && p.text.body.length < 4096));
  }
  sent.length = 0;
  assert.equal(await flow('5219381800247', 'comandos'), true);
  assert.equal(sent.length, 1);
  assert.match(sent[0].text.body, /únicamente para el administrador/);
  assert.equal(await flow('529381949915', 'hola'), false);
});
test('guía se atiende antes de los estados activos, chat y servicios externos', async () => {
  const source = await readFile(new URL('../src/services/messageHandler.js', import.meta.url), 'utf8');
  const position = source.indexOf('await this.adminCommandsFlow(phone, rawText)');
  for (const marker of ['void appendConversation(["Inicio"', 'await this.teacherTaskFlow(', 'await this.teacherAttendanceFlow(', 'await this.registrationFlow(', 'const ongoing =']) assert.ok(position >= 0 && position < source.indexOf(marker));
});

test('gestión Dual se atiende antes de las revisiones docentes activas', async () => {
  const source = await readFile(new URL('../src/services/messageHandler.js', import.meta.url), 'utf8');
  const position = source.indexOf('if (isStudentManagementCommand(rawText)');
  assert.ok(position >= 0 && position < source.lastIndexOf('await this.teacherTaskFlow('));
  assert.ok(position < source.lastIndexOf('await this.teacherAttendanceFlow('));
});

test('las tareas personales se atienden antes de Sheets y la clasificación emocional', async () => {
  const source = await readFile(new URL('../src/services/messageHandler.js', import.meta.url), 'utf8');
  const position = source.indexOf('if (homeworkInteraction)');
  assert.ok(position >= 0);
  assert.ok(position < source.indexOf('void appendConversation(["Inicio"'));
  assert.ok(position < source.indexOf('return this.handleAIMessage(text, phone)'));
  assert.ok(position < source.indexOf('if (homeworkStates[phone])'));
  assert.ok(source.indexOf('await this.adminCommandsFlow(phone, rawText)') < position);
});

test('registrar tarea del docente se enruta a crear tarea antes del flujo personal', async () => {
  const source = await readFile(new URL('../src/services/messageHandler.js', import.meta.url), 'utf8');
  const aliasPosition = source.indexOf('/^registrar tarea');
  const personalPosition = source.indexOf('const homeworkInteraction');
  assert.ok(aliasPosition >= 0);
  assert.ok(aliasPosition < personalPosition);
  assert.ok(source.indexOf('await this.teacherTaskFlow(phone, rawText, message.id)') < personalPosition);
});

test('el pase de lista se atiende antes de Sheets y otros módulos generales', async () => {
  const source = await readFile(new URL('../src/services/messageHandler.js', import.meta.url), 'utf8');
  const position = source.indexOf('isTeacherAttendanceCommand(rawText)');
  assert.ok(position >= 0);
  assert.ok(position < source.indexOf('void appendConversation(["Inicio"'));
  assert.ok(position < source.indexOf('await this.teacherTaskFlow(phone, rawText, message.id)', position + 1));
  assert.ok(position < source.indexOf('return this.handleAIMessage(text, phone)'));
});
