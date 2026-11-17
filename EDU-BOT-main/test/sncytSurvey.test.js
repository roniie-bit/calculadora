import test from "node:test";
import assert from "node:assert/strict";
import {
  SNCYT_TEST_SESSION,
  SNCYT_HEADERS,
  SNCYT_QUESTIONS,
  buildSncytRow,
} from "../src/config/sncytSurvey.js";
import {
  createSncytSurveyFlow,
  isSncytSurveyTrigger,
} from "../src/flows/sncytSurveyFlow.js";
import { resolveSncytSheetConfig } from "../src/services/sncytSurveyStore.js";

const textMessage = (body) => ({
  type: "text",
  text: { body },
});

const completeAnswers = new Map([
  ["especialidad", "1"],
  ["semestre", "2"],
  ["transporte", "1"],
  ["tiempo_traslado", "4"],
  ["dificultad", "3"],
  ["responsabilidades", "2"],
  ["comunicacion", "1, 3, 5"],
  ["canal_academico", "1"],
  ["acceso", "2"],
  ["uso_ia", "3"],
]);

test("la encuesta de prueba contiene las diez preguntas y columnas esperadas", () => {
  assert.equal(SNCYT_QUESTIONS.length, 10);
  assert.equal(SNCYT_HEADERS.length, 19);
  assert.ok(
    SNCYT_QUESTIONS[0].options.includes("Electricidad"),
    "Electricidad debe conservarse para los grupos vigentes"
  );
  assert.deepEqual(SNCYT_QUESTIONS[1].options, ["1.º", "3.º", "5.º"]);
  assert.equal(SNCYT_QUESTIONS[6].multiple, true);
});

test("detecta los comandos de la encuesta", () => {
  assert.equal(isSncytSurveyTrigger("SNCyT26"), true);
  assert.equal(isSncytSurveyTrigger("SNCyT26DEMO"), true);
  assert.equal(isSncytSurveyTrigger("encuesta01"), false);
});

test("usa el libro temporal configurado para la encuesta", () => {
  assert.deepEqual(
    resolveSncytSheetConfig({
      SALES_SPREADSHEET_ID: "libro-temporal",
      SALES_KEY_FILE: "key4.json",
    }),
    {
      spreadsheetId: "libro-temporal",
      keyFile: "key4.json",
    }
  );

  assert.throws(
    () => resolveSncytSheetConfig({}),
    /SALES_SPREADSHEET_ID o SALES_KEY_FILE/
  );
});

test("convierte la selección múltiple en columnas 1 y 0", () => {
  const response = {
    id: "DEMO-1234ABCD",
    session: "Prueba",
    submittedAt: "2026-10-26T23:00:00.000Z",
    answers: {
      especialidad: "Inteligencia Artificial",
      semestre: "5.º",
      transporte: "Transporte público",
      tiempo_traslado: "Más de 60 minutos",
      dificultad: "Falta de tiempo",
      responsabilidades: "11 a 20 horas",
      comunicacion: ["WhatsApp", "Llamadas telefónicas"],
      canal_academico: "WhatsApp",
      acceso: "Internet o dispositivo compartido",
      uso_ia: "Verifico con fuentes o docente",
    },
  };

  const row = buildSncytRow(response);
  assert.equal(row.length, SNCYT_HEADERS.length);
  assert.deepEqual(row.slice(9, 16), [1, 0, 0, 1, 0, 0, 0]);
  assert.equal(row[16], "WhatsApp");
  assert.equal(row[18], "Verifico con fuentes o docente");
});

test("recorre las diez preguntas y guarda una respuesta sin teléfono", async () => {
  const phone = "5211111111111";
  const userStates = {};
  const sent = [];
  const saved = [];
  const handle = createSncytSurveyFlow({
    send: async (to, payload) => sent.push({ to, payload }),
    saveResponse: async (response) => {
      saved.push(response);
      return { id: response.id, sheetName: "SNCyT_2026" };
    },
    now: () => new Date("2026-10-26T23:00:00.000Z"),
    makeId: () => "DEMO-1234ABCD",
  });

  await handle(textMessage("SNCyT26"), phone, userStates);
  assert.equal(sent.length, 2);
  assert.match(sent[1].payload.text.body, /Pregunta 1 de 10/);
  assert.match(
    sent[1].payload.text.body,
    /\*¿Cuál es tu especialidad\?\*/
  );
  assert.match(sent[1].payload.text.body, /Electricidad/);

  for (const question of SNCYT_QUESTIONS) {
    await handle(
      textMessage(completeAnswers.get(question.id)),
      phone,
      userStates
    );
  }

  assert.equal(saved.length, 1);
  assert.equal(saved[0].session, SNCYT_TEST_SESSION);
  assert.equal(saved[0].submittedAt, "2026-10-26T23:00:00.000Z");
  assert.deepEqual(saved[0].answers.comunicacion, [
    "WhatsApp",
    "Mensajes de Facebook o Messenger",
    "SMS",
  ]);
  assert.equal(Object.hasOwn(saved[0], "phone"), false);
  assert.equal(userStates[phone].sncytDemo, undefined);
  assert.match(sent.at(-1).payload.text.body, /Respuesta de prueba registrada/);
});

test("rechaza una selección múltiple incompatible sin avanzar", async () => {
  const phone = "5212222222222";
  const userStates = {};
  const sent = [];
  const handle = createSncytSurveyFlow({
    send: async (to, payload) => sent.push({ to, payload }),
    saveResponse: async () => {
      throw new Error("No debe guardar todavía");
    },
    makeId: () => "DEMO-5678EFGH",
  });

  await handle(textMessage("SNCyT26"), phone, userStates);
  for (const question of SNCYT_QUESTIONS.slice(0, 6)) {
    await handle(
      textMessage(completeAnswers.get(question.id)),
      phone,
      userStates
    );
  }

  const stepBefore = userStates[phone].sncytDemo.step;
  await handle(textMessage("1, 7"), phone, userStates);
  assert.equal(userStates[phone].sncytDemo.step, stepBefore);
  assert.match(sent.at(-2).payload.text.body, /debe elegirse sola/);
  assert.match(sent.at(-1).payload.text.body, /Pregunta 7 de 10/);
});

test("permite reintentar cuando falla el guardado", async () => {
  const phone = "5213333333333";
  const userStates = {};
  const sent = [];
  let attempts = 0;
  let shouldSave = false;
  const handle = createSncytSurveyFlow({
    send: async (to, payload) => sent.push({ to, payload }),
    saveResponse: async (response) => {
      attempts += 1;
      if (!shouldSave) throw new Error("Sheets no disponible");
      return { id: response.id, sheetName: "SNCyT_2026" };
    },
    makeId: () => "DEMO-90ABCDEF",
  });

  await handle(textMessage("SNCyT26"), phone, userStates);
  for (const question of SNCYT_QUESTIONS) {
    await handle(
      textMessage(completeAnswers.get(question.id)),
      phone,
      userStates
    );
  }

  assert.equal(attempts, 1);
  assert.equal(userStates[phone].sncytDemo.step, "retry_save");
  shouldSave = true;
  await handle(textMessage("REINTENTAR"), phone, userStates);
  assert.equal(attempts, 2);
  assert.equal(userStates[phone].sncytDemo, undefined);
});
