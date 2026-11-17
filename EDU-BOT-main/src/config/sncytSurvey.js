export const SNCYT_TRIGGER = "SNCyT26";
export const SNCYT_SHEET = "SNCyT_2026";
export const SNCYT_TEST_SESSION = "Prueba";

const TRIGGER_SESSIONS = new Map([
  ["sncyt26", SNCYT_TEST_SESSION],
  ["sncyt26demo", SNCYT_TEST_SESSION],
  ["sncyt26am", "Mañana"],
  ["sncyt26pm", "Tarde"],
]);

export function getSncytTriggerSession(text = "") {
  return TRIGGER_SESSIONS.get(text.trim().toLowerCase()) || null;
}

export const SNCYT_HEADERS = [
  "ID_respuesta",
  "Sesion",
  "Fecha_hora",
  "Especialidad",
  "Semestre",
  "Transporte",
  "Tiempo_traslado",
  "Dificultad_principal",
  "Responsabilidades_semana",
  "Q7_WhatsApp",
  "Q7_Instagram",
  "Q7_Facebook",
  "Q7_Llamadas",
  "Q7_SMS",
  "Q7_Otro",
  "Q7_Ninguno",
  "Canal_preferido_academico",
  "Acceso_fuera_escuela",
  "Uso_IA",
];

export const SNCYT_QUESTIONS = [
  {
    id: "especialidad",
    title: "¿Cuál es tu especialidad?",
    options: [
      "Contabilidad",
      "Gestión e Innovación Turística",
      "Inteligencia Artificial",
      "Laboratorista Clínico",
      "Mantenimiento Automotriz",
      "Preparación de Alimentos y Bebidas",
      "Semiconductores y Microelectrónica",
      "Electricidad",
    ],
  },
  {
    id: "semestre",
    title: "¿Qué semestre cursas?",
    options: ["1.º", "3.º", "5.º"],
  },
  {
    id: "transporte",
    title: "¿Cómo llegas normalmente a la escuela?",
    options: [
      "Transporte público",
      "Auto o moto particular",
      "Caminando o bicicleta",
      "Otro",
    ],
  },
  {
    id: "tiempo_traslado",
    title: "¿Cuánto tardas de tu casa a la escuela?",
    options: [
      "Hasta 15 minutos",
      "16 a 30 minutos",
      "31 a 60 minutos",
      "Más de 60 minutos",
    ],
  },
  {
    id: "dificultad",
    title: "¿Qué te dificulta más cumplir una tarea?",
    options: [
      "Entender el tema",
      "Organizarme o recordar fechas",
      "Falta de tiempo",
      "Internet o dispositivo",
    ],
  },
  {
    id: "responsabilidades",
    title:
      "Además de estudiar, ¿cuántas horas semanales dedicas a trabajo, negocio familiar o cuidado de alguien?",
    options: ["Ninguna", "1 a 10 horas", "11 a 20 horas", "Más de 20 horas"],
  },
  {
    id: "comunicacion",
    title:
      "Sin contar lo que haces para la escuela, ¿qué medios usaste ayer para comunicarte con familiares o amigos?",
    instruction:
      "Puedes elegir varios. Responde con los números separados por coma; por ejemplo: 1, 3, 4.",
    multiple: true,
    options: [
      "WhatsApp",
      "Mensajes de Instagram",
      "Mensajes de Facebook o Messenger",
      "Llamadas telefónicas",
      "SMS",
      "Otro medio",
      "No me comuniqué con familiares o amigos",
    ],
  },
  {
    id: "canal_academico",
    title: "¿Dónde preferirías recibir acompañamiento académico?",
    options: ["WhatsApp", "Plataforma escolar", "Asesoría presencial"],
  },
  {
    id: "acceso",
    title: "¿Qué posibilidades tienes para hacer tareas fuera de la escuela?",
    options: [
      "Internet estable y dispositivo propio",
      "Internet o dispositivo compartido",
      "Solo datos móviles",
      "Acceso muy limitado",
    ],
  },
  {
    id: "uso_ia",
    title: "Cuando usas IA para estudiar, normalmente...",
    options: [
      "Verifico con fuentes o docente",
      "La uso si parece correcta",
      "No uso IA",
    ],
  },
];

const COMMUNICATION_COLUMNS = [
  ["WhatsApp", 9],
  ["Mensajes de Instagram", 10],
  ["Mensajes de Facebook o Messenger", 11],
  ["Llamadas telefónicas", 12],
  ["SMS", 13],
  ["Otro medio", 14],
  ["No me comuniqué con familiares o amigos", 15],
];

export function buildSncytRow(response) {
  const row = [
    response.id,
    response.session,
    response.submittedAt,
    response.answers.especialidad,
    response.answers.semestre,
    response.answers.transporte,
    response.answers.tiempo_traslado,
    response.answers.dificultad,
    response.answers.responsabilidades,
  ];

  const selectedCommunication = new Set(
    response.answers.comunicacion || []
  );
  for (const [label, columnIndex] of COMMUNICATION_COLUMNS) {
    row[columnIndex] = selectedCommunication.has(label) ? 1 : 0;
  }

  row[16] = response.answers.canal_academico;
  row[17] = response.answers.acceso;
  row[18] = response.answers.uso_ia;
  return row;
}
