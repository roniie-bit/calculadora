import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttendanceStore } from '../src/services/teacherAttendanceStore.js';
import { createStudentRepository } from '../src/services/studentService.js';

const names = [
  'Listas_Docente',
  'Control_Lista',
  'Asistencias',
  'Historial_Lista',
];

test('una lectura colgada de asistencia libera la cola con un error controlado', async () => {
  let first = true;
  const sheets = {
    spreadsheets: {
      values: {
        batchGet: async () => {
          if (first) {
            first = false;
            return new Promise(() => {});
          }
          return {
            data: {
              valueRanges: names.map(() => ({ values: [] })),
            },
          };
        },
      },
      batchUpdate: async () => ({}),
    },
  };
  const store = createAttendanceStore(
    async () => ({
      sheets,
      spreadsheetId: 'test',
      ids: Object.fromEntries(names.map((name, i) => [name, i])),
    }),
    { requestTimeoutMs: 20 }
  );

  await assert.rejects(
    store.transact(() => ({ handled: true, messages: [] })),
    /Tiempo de espera agotado/
  );
  assert.deepEqual(
    await store.transact(() => ({ handled: true, messages: [] })),
    { handled: true, messages: [] }
  );
});

test('la lectura de alumnos tiene timeout', async () => {
  const repository = createStudentRepository(
    async () => ({
      sheets: {
        spreadsheets: {
          values: {
            get: async () => new Promise(() => {}),
          },
        },
      },
      spreadsheetId: 'test',
    }),
    { requestTimeoutMs: 20 }
  );

  await assert.rejects(repository.list(), /Tiempo de espera agotado/);
});
