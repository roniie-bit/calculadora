// src/services/openAiService.js

import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

// Cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 12000,
  maxRetries: 0,
});

/**
 * Prompt del tutor académico del CETis 20.
 * El bot debe comportarse como un docente accesible, claro y respetuoso,
 * explicando temas de ciencias, matemáticas, química, física, biología,
 * formación para el trabajo, etc.
 */
const systemPrompt = `
Eres EDU-BOT IA, un tutor académico del CETis 20 (DGETI). 
Tu misión es ayudar a estudiantes de bachillerato con explicaciones claras, directas y muy fáciles de entender.
Si alguien te solicita quien te creo o quien te diseño, mencionar a los creadores los alumnos del 5to semestre de contabilidad grupo A del CETis 20, sus nombres son VAleria Garcia, Victor Esquivel, ANgeles Ventura y Ulises Flores.

Reglas estrictas:
1. Responde SIEMPRE en texto plano. NO uses JSON, NO uses código, NO devuelvas estructuras especiales.
2. Explica como un maestro del CETis 20: amable, claro, con ejemplos fáciles.
3. Si el alumno pregunta algo académico, explícalo de forma breve pero útil. Puedes profundizar si lo pide.
4. Si el alumno hace una pregunta muy corta o confusa, pídele aclaración amablemente.
5. No inventes datos fuera del ámbito escolar.
6. Puedes apoyar en: matemáticas, física, química, biología, ciencias experimentales, ética, orientación escolar, tareas generales y comprensión de temas.
7. Evita contenido sensible, médico, político o externo al ambiente escolar.
8. Da siempre respuestas útiles, educativas y listas para WhatsApp.

Tu estilo:
- Breve pero claro.
- Con ejemplos prácticos.
- Tono amigable de profesor que quiere que el alumno entienda.
- Sin tecnicismos innecesarios.
`;

export async function askAI(userMessage) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.4
    });

    const content = completion.choices[0].message.content;
    return content;

  } catch (error) {
    console.error("❌ Error en IA Educativa:", error);

    return (
      "Hubo un problema para procesar tu pregunta 🚧.\n" +
      "Intenta escribirla de otra forma o pregúntame algo más específico 😊."
    );
  }
}

/* ============================================================
   IA EMOCIONAL — Acompañamiento seguro para adolescentes
   ============================================================ */

export async function askAIEmotional(userMessage) {
  try {
    const promptSystem = `
Eres un acompañante académico-emocional para adolescentes del CETis 20.
Tu papel es escuchar, validar emociones y apoyar de manera segura, respetuosa y empática.

Reglas estrictas:
- NUNCA diagnostiques ni uses términos clínicos (ansiedad, depresión, trauma, crisis, terapia, psicólogo, etc.)
- NO des consejos médicos, psiquiátricos ni psicológicos.
- NO minimices lo que siente el alumno.
- NO digas "todo estará bien" ni frases que invaliden sentimientos.
- NO menciones medicamentos, tratamientos, terapias ni temas de salud mental.

Tu estilo:
- Cálido, humano y muy empático.
- Escucha más de lo que hablas.
- Haz preguntas suaves y abiertas.
- Enfócate en acompañar.
- Puedes ofrecer orientación escolar, organización, hábitos de estudio y estrategias para manejar presión escolar.
- Siempre usa un lenguaje seguro, afectuoso y apropiado para adolescentes.

Nunca olvides:
Tu rol es acompañar, no intervenir profesionalmente.
Si el alumno quiere seguir platicando, continúa apoyándolo con sensibilidad.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: promptSystem },
        { role: "user", content: userMessage }
      ]
    });

    return (
      completion.choices[0].message.content ||
      "Gracias por compartirlo conmigo 🫂. Estoy aquí para escucharte. Cuéntame un poco más cuando gustes."
    );

  } catch (err) {
    console.error("❌ Error en askAIEmotional:", err);
    return "Lo siento, tuve un problema procesando tu mensaje. ¿Puedes decirlo de nuevo? 💙";
  }
}

/* ============================================================
   CLASIFICADOR EMOCIONAL INTERNO
   - No responde al alumno.
   - Solo clasifica el mensaje para saber si debe entrar
     al módulo emocional y avisar al admin.
   - Devuelve únicamente:
     normal | emocional | riesgo
   ============================================================ */

function normalizeClassificationLabel(value = "") {
  const label = value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (label.includes("riesgo")) return "riesgo";
  if (label.includes("emocional")) return "emocional";
  return "normal";
}

export function classifyEmotionalIntentLocally(text = "") {
  const t = text
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const riskPatterns = [
    "no quiero vivir",
    "quiero desaparecer",
    "me quiero morir",
    "quisiera morirme",
    "hacerme daño",
    "lastimarme",
    "ya no quiero estar aqui",
    "ya no quiero estar aquí",
    "no vale la pena vivir",
    "terminar con todo",
    "me voy a hacer algo",
    "quiero hacerle daño",
    "voy a lastimar a alguien"
  ];

  const emotionalPatterns = [
    "me siento",
    "estoy triste",
    "estoy enojado",
    "estoy enojada",
    "estoy frustrado",
    "estoy frustrada",
    "me frustra",
    "me duele",
    "me preocupa",
    "me da miedo",
    "tengo miedo",
    "me siento mal",
    "me siento solo",
    "me siento sola",
    "nadie me entiende",
    "no tengo con quien hablar",
    "necesito hablar",
    "necesito desahogarme",
    "problemas en mi casa",
    "problemas con mis papas",
    "problemas con mis papás",
    "me pelee",
    "me peleé",
    "me hicieron sentir mal",
    "me rechazan",
    "se burlan de mi",
    "se burlan de mí",
    "no puedo mas",
    "no puedo más",
    "ya no puedo",
    "me siento presionado",
    "me siento presionada"
  ];

  if (riskPatterns.some((p) => t.includes(p))) return "riesgo";
  if (emotionalPatterns.some((p) => t.includes(p))) return "emocional";

  return "normal";
}

export async function classifyEmotionalIntent(userMessage) {
  try {
    const text = (userMessage || "").toString().trim();

    if (!text) return "normal";

    const classifierPrompt = `
Eres un clasificador interno de EDU-BOT para mensajes de estudiantes de bachillerato.

Tu tarea NO es responder al alumno.
Tu única tarea es clasificar el mensaje del alumno en una de estas 3 categorías:

1. normal
Usa esta categoría cuando el mensaje sea académico, administrativo, casual o una pregunta escolar normal.
Ejemplos:
- "Explícame la fotosíntesis"
- "¿Cuál es mi tarea?"
- "Qué es la tristeza en literatura"
- "Necesito ayuda con química"
- "Hola"

2. emocional
Usa esta categoría cuando el alumno exprese una situación personal o escolar que le cause tristeza, enojo, frustración, soledad, presión, rechazo, miedo, preocupación, conflicto familiar, conflicto con compañeros o necesidad de desahogo.
Ejemplos:
- "Me siento mal porque mis papás pelean mucho"
- "Estoy muy frustrado porque no puedo con la escuela"
- "Mis compañeros se burlan de mí"
- "Me siento triste desde hace días"
- "Me enojé mucho porque nadie me escucha"
- "Siento que no tengo con quién hablar"

3. riesgo
Usa esta categoría cuando el alumno mencione intención de hacerse daño, desaparecer, morir, no querer vivir, lastimar a alguien o una situación que requiera aviso inmediato a un adulto responsable.
Ejemplos:
- "No quiero vivir"
- "Quiero desaparecer"
- "Me quiero hacer daño"
- "Voy a lastimar a alguien"
- "Ya no quiero estar aquí"

Reglas estrictas:
- Responde con una sola palabra.
- No expliques.
- No uses signos.
- No uses JSON.
- Solo puedes responder: normal, emocional o riesgo.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: classifierPrompt },
        { role: "user", content: text }
      ]
    });

    const rawLabel = completion.choices[0].message.content || "normal";
    const label = normalizeClassificationLabel(rawLabel);

    return label;

  } catch (err) {
    console.error("❌ Error en classifyEmotionalIntent:", err);

    // Respaldo básico si falla la IA.
    return classifyEmotionalIntentLocally(userMessage);
  }
}

export async function extractHomeworkDetailsWithAI(
  userMessage,
  { today, weekday } = {}
) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
Eres el intérprete de tareas escolares de EDU-BOT.
Fecha actual en México: ${today} (${weekday}).

Extrae únicamente lo que el alumno expresó. No inventes datos.
Devuelve un objeto JSON con estas propiedades:
- status: "ready", "needs_date", "needs_description" o "needs_clarification"
- description: descripción breve de la tarea, sin la fecha ni palabras como "recuérdame"
- due_date: fecha en formato YYYY-MM-DD, o null
- clarification: pregunta breve para el alumno, o ""

Reglas:
- "hoy", "mañana", "en 3 días" y días de la semana se calculan desde la fecha actual de México.
- "el viernes" significa la próxima ocurrencia de ese día.
- Para expresiones como "primer viernes de noviembre" o "último viernes de noviembre", calcula el día exacto dentro del mes indicado. Nunca uses la fecha actual como fecha de entrega si el alumno mencionó otro mes.
- Si la fecha es ambigua, por ejemplo "fin de semana", "próxima semana" o "a fin de mes", usa needs_clarification.
- Si falta la fecha, usa needs_date.
- Si falta la tarea, usa needs_description.
- Si la tarea y la fecha están claras, usa ready.
- No devuelvas Markdown ni texto fuera del JSON.
        `,
      },
      { role: "user", content: userMessage },
    ],
  });

  return JSON.parse(completion.choices[0].message.content || "{}");
}

export default askAI;
