import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOMEWORK_STATE_TTL_MS,
  cleanupExpiredHomeworkStates,
  homeworkStateCleanupTimer,
  homeworkStates,
  isHomeworkRegistrationRequest,
  isHomeworkStateExpired,
} from '../src/flows/homeworkFlow.js';

test('el estado de tareas vence después de 30 minutos de inactividad', () => {
  const now = Date.now();

  assert.equal(
    isHomeworkStateExpired(
      { lastActivity: now - HOMEWORK_STATE_TTL_MS + 1 },
      now
    ),
    false
  );
  assert.equal(
    isHomeworkStateExpired(
      { lastActivity: now - HOMEWORK_STATE_TTL_MS },
      now
    ),
    true
  );
  assert.equal(isHomeworkStateExpired({}, now), false);
});

test('la limpieza elimina solo conversaciones vencidas y no afecta a otros alumnos', () => {
  homeworkStateCleanupTimer.unref?.();
  const now = Date.now();

  for (const phone of Object.keys(homeworkStates)) delete homeworkStates[phone];
  homeworkStates.vencido = {
    step: 'askingDate',
    lastActivity: now - HOMEWORK_STATE_TTL_MS - 1,
  };
  homeworkStates.activo = {
    step: 'askingDescription',
    lastActivity: now - 1000,
  };

  assert.equal(cleanupExpiredHomeworkStates(now), 1);
  assert.equal(homeworkStates.vencido, undefined);
  assert.equal(homeworkStates.activo.step, 'askingDescription');
});

test('reconoce solicitudes de tarea escritas en lenguaje natural', () => {
  for (const text of [
    'Tarea de química para mañana',
    'Leer capítulo 4 el viernes',
    'Recuérdame entregar el reporte mañana',
    'Quiero recordar la exposición para el 30 de octubre',
  ]) {
    assert.equal(isHomeworkRegistrationRequest(text), true);
  }

  assert.equal(isHomeworkRegistrationRequest('tareas'), false);
  assert.equal(isHomeworkRegistrationRequest('tarea'), false);
  assert.equal(isHomeworkRegistrationRequest('mi registro EDU-5AMAM-001'), false);
});
