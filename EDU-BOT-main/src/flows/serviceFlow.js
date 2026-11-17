// src/flows/serviceFlow.js

import whatsappService from "../services/whatsappService.js";
import { appendConversation } from "../services/googleSheetsService.js";
// Se asume que en un archivo de utilidades (por ejemplo, serviceMessages.js) tienes funciones
// que generan los mensajes para cada servicio. Por ejemplo:
import { 
  ConsultationMessage, 
  ConsultationButtonsMessage, 
  ConsultationInfoMessage,  
  UltrasoundMessage, 
  ColposcopiaMessage,
  ContactAdvisorButtonsMessage,
  NotNowMessage,
  AdvisorRequestAcceptedMessage,
  DifferentNoMessage,
  HilosTensoresMessage, // Función para enviar la imagen de Hilos Tensores
  HilosTensoresBookingButtonsMessage, // Botones para agendar cita
  HilosTensoresAdditionalButtonsMessage,
  MentonImageMessage, // Función para enviar la imagen de Proyección de Mentón
  MentonButtonsMessage, // Botones para agendar cita
  ConsultationAdditionalButtonsMessage,  // NUEVA función para enviar "¿Duele?" y "Agendar cita"
  OjerasMessage, // Función para enviar la imagen de Relleno de Ojeras
  AcrocordonesInfoMessage, // Función para enviar info de Acrocordones
  RinoStartButtonsMessage,
  RinoInfoMessage,
  RinoDueleButtonsMessage,
  RinoDueleMessage,
  RinoIndicacionButtonsMessage,
  RinoIndicacionMessage,
  ConsultationBookingButtonsMessage,
  FemLasserMessage 
} from "../utils/serviceMessages.js";

// Flujo para "Retiro de Verrugas"
export async function handleRetiroDeVerrugas(number, sendListFn) {
  // 1) Imagen del servicio
  const msg1 = ConsultationMessage(number);
  await whatsappService.sendMessage(number, msg1);
  await appendConversation(
    ["Bot", number,
     typeof msg1 === "string" ? msg1 : JSON.stringify(msg1),
     new Date().toISOString()]
  );

  // 2) Botones “¿Qué incluye? / Agendar cita”
  const msg2 = ConsultationButtonsMessage(number);
  await whatsappService.sendMessage(number, msg2);
  await appendConversation(
    ["Bot", number,
     typeof msg2 === "string" ? msg2 : JSON.stringify(msg2),
     new Date().toISOString()]
  );

  // 3) Lista de servicios AL FINAL (opcional)
  if (typeof sendListFn === "function") {
    await new Promise(r => setTimeout(r, 2000));   // pequeña pausa visual
    await sendListFn(number);                      // envía la lista
  }
}

// Flujo para "Rinomodelacion"
export async function handleRinomodelacion(number) {
  const msg1 = UltrasoundMessage(number);
  await whatsappService.sendMessage(number, msg1);
  await appendConversation(["Bot", number, JSON.stringify(msg1), new Date().toISOString()]);

  const msg2 = RinoStartButtonsMessage(number);
  await whatsappService.sendMessage(number, msg2);
  await appendConversation(["Bot", number, JSON.stringify(msg2), new Date().toISOString()]);
}

export async function handleInfoRinomodelacion(number) {
  const msg = RinoInfoMessage(number);
  await whatsappService.sendMessage(number, msg);
  await appendConversation(["Bot", number, JSON.stringify(msg), new Date().toISOString()]);

  const btn = RinoDueleButtonsMessage(number);
  await whatsappService.sendMessage(number, btn);
  await appendConversation(["Bot", number, JSON.stringify(btn), new Date().toISOString()]);
}

export async function handleDueleRinomodelacion(number) {
  const msg = RinoDueleMessage(number);
  await whatsappService.sendMessage(number, msg);
  await appendConversation(["Bot", number, JSON.stringify(msg), new Date().toISOString()]);

  // ⏳ Pausa de 1 segundo
  await new Promise(resolve => setTimeout(resolve, 1000));

  const btn = RinoIndicacionButtonsMessage(number);
  await whatsappService.sendMessage(number, btn);
  await appendConversation(["Bot", number, JSON.stringify(btn), new Date().toISOString()]);
}


export async function handleIndicacionRinomodelacion(number) {
  const msg = RinoIndicacionMessage(number);
  await whatsappService.sendMessage(number, msg);
  await appendConversation(["Bot", number, JSON.stringify(msg), new Date().toISOString()]);

  const citaBtn = ConsultationBookingButtonsMessage(number);
  await whatsappService.sendMessage(number, citaBtn);
  await appendConversation(["Bot", number, JSON.stringify(citaBtn), new Date().toISOString()]);
}

// Flujo para "Botox"
export async function handleBotox(number) {
  // Primero, responder a la pregunta del usuario
  const answer = "El Botox funciona bloqueando las señales nerviosas en los músculos, lo que reduce la contracción y atenúa las arrugas. Es un procedimiento rápido y seguro.";
  await whatsappService.sendMessage(number, answer);
  await appendConversation(["Bot", number, answer, new Date().toISOString()]);
  
  // Luego, enviar la imagen e información para Botox
  const msg1 = ColposcopiaMessage(number);
  await whatsappService.sendMessage(number, msg1);
  await appendConversation(["Bot", number, typeof msg1 === "string" ? msg1 : JSON.stringify(msg1), new Date().toISOString()]);
  const msg2 = ConsultationBookingButtonsMessage(number);
  await whatsappService.sendMessage(number, msg2);
  await appendConversation(["Bot", number, typeof msg2 === "string" ? msg2 : JSON.stringify(msg2), new Date().toISOString()]);
}

// Flujo para "Diseño de Labios"
export async function handleDisenoDeLabios(number) {
  // Primero, responde a la consulta del cliente
  const answer = "El Diseño de Labios con ácido hialurónico ayuda a realzar el volumen, definir el contorno y mejorar la hidratación de tus labios, ofreciendo resultados naturales sin cirugía.";
  await whatsappService.sendMessage(number, answer);
  await appendConversation(["Bot", number, answer, new Date().toISOString()]);
  
  // Luego, envía la imagen e información para Diseño de Labios
  const msg1 = FemLasserMessage(number);
  await whatsappService.sendMessage(number, msg1);
  await appendConversation(["Bot", number, typeof msg1 === "string" ? msg1 : JSON.stringify(msg1), new Date().toISOString()]);
  
  // Finalmente, envía botones para reservar cita u obtener más información
  const msg2 = ConsultationBookingButtonsMessage(number);
  await whatsappService.sendMessage(number, msg2);
  await appendConversation(["Bot", number, typeof msg2 === "string" ? msg2 : JSON.stringify(msg2), new Date().toISOString()]);
}

// Opcional: Flujo para "¿Qué incluye?" si se selecciona en algún botón
// src/flows/serviceFlow.js
export async function handleInfoConsulta(number, sendListFn) {
  // 1) Mensaje informativo
  const msg1 = ConsultationInfoMessage(number);
  await whatsappService.sendMessage(number, msg1);
  await appendConversation(["Bot", number,
    typeof msg1 === "string" ? msg1 : JSON.stringify(msg1),
    new Date().toISOString()]);

  // 2) Botones “¿Duele? / Agendar cita”
  const msg2 = ConsultationAdditionalButtonsMessage(number);
  await whatsappService.sendMessage(number, msg2);
  await appendConversation(["Bot", number,
    typeof msg2 === "string" ? msg2 : JSON.stringify(msg2),
    new Date().toISOString()]);

  // 3) ⬅️  NUEVO: lista de servicios al final
  if (typeof sendListFn === "function") {
    await new Promise(r => setTimeout(r, 2000));   // pequeña pausa
    await sendListFn(number);                      // envía la lista
  }
}


/**
 * Flujo para preguntar si el usuario quiere hablar con un asesor.
 */
export async function handleContactAdvisorFlow(number) {
  // 1. Envía la pregunta con botones
  const msg = ContactAdvisorButtonsMessage(number);
  await whatsappService.sendMessage(number, msg);
  await appendConversation(["Bot", number, typeof msg === "string" ? msg : JSON.stringify(msg), new Date().toISOString()]);
}

/**
 * Respuestas según la elección del usuario
 */
export async function handleAdvisorResponseFlow(number, choice, callbackSendMenu) {
  if (choice === "asesor_si") {
    // Mensaje que ya se está usando:
    const msg = AdvisorRequestAcceptedMessage(number);
    await whatsappService.sendMessage(number, msg);
    await appendConversation(["Bot", number, typeof msg === "string" ? msg : JSON.stringify(msg), new Date().toISOString()]);
    // 1) INVOCAR LA FUNCIÓN QUE ENVÍA EL MENÚ (sólo si está definida)
    if (typeof callbackSendMenu === "function") {
      await callbackSendMenu(number);
    }
  } else if (choice === "asesor_no") {
    // “No” => Reutilizamos el mensaje de “De momento no 🥹” u otro
    const msg = DifferentNoMessage(number);
    await whatsappService.sendMessage(number, msg);
    await appendConversation(["Bot", number, typeof msg === "string" ? msg : JSON.stringify(msg), new Date().toISOString()]);
    // 2) INVOCAR LA FUNCIÓN QUE ENVÍA EL MENÚ (sólo si está definida)
    if (typeof callbackSendMenu === "function") {
      await callbackSendMenu(number);
    }
  }
}

// Agrega esta función en serviceFlow.js
export async function handleDueleCountFlow(number) {
  // Envía primero una respuesta informativa sobre el dolor
  const infoText = "La Dra. Paz usa 2 tipos de anestesia tópica: en spray y en ungüento 🧴. El tratamiento no es totalmente indoloro 😣, y en general depende de cada paciente.";
  await whatsappService.sendMessage(number, infoText);
  await appendConversation(["Bot", number, infoText, new Date().toISOString()]);
  
  // Luego, envía el mensaje interactivo con opciones
  const question = "*¿Cuantos retiran en ese lapso de tiempo?*";
  const buttons = [
    { type: "reply", reply: { id: "cuantos", title: "¿Cuantos?" } },
    { type: "reply", reply: { id: "agendar-cita", title: "Agendar cita 📅" } }
  ];
  await whatsappService.sendInteractiveButtons(number, question, buttons);
  await appendConversation(["Bot", number, "Interactive: " + question + " Options: " + JSON.stringify(buttons), new Date().toISOString()]);
}

// Flujo para "Hilos Tensores"
export async function handleHilosTensores(number) {
  // 1) Responde a la consulta del cliente sobre los hilos tensores
  const answer = 
    "Los Hilos Tensores (Hilos de PDO) permiten lograr un efecto 'lifting' sin cirugía, " + 
    "ayudando a tensar la piel y estimular la producción de colágeno. Es un procedimiento " + 
    "rápido y mínimamente invasivo, ideal para mejorar la flacidez en el rostro.";
  
  await whatsappService.sendMessage(number, answer);
  await appendConversation(["Bot", number, answer, new Date().toISOString()]);

  // 2) Envía la imagen de los hilos tensores
  const msg1 = HilosTensoresMessage(number); // Esta función ya devuelve la imagen
  await whatsappService.sendMessage(number, msg1);
  await appendConversation(["Bot", number, typeof msg1 === "string" ? msg1 : JSON.stringify(msg1), new Date().toISOString()]);

  // 3) Botones para agendar una cita u obtener más información
  const msg2 = HilosTensoresBookingButtonsMessage(number); // Botones interactivos para agendar cita
  await whatsappService.sendMessage(number, msg2);
  await appendConversation(["Bot", number, typeof msg2 === "string" ? msg2 : JSON.stringify(msg2), new Date().toISOString()]);
}

// Flujo para "Proyección de Mentón"
export async function handleProyeccionMenton(number) {
  const answer = "La proyección de mentón con ácido hialurónico ayuda a definir y armonizar el perfil facial, sin necesidad de cirugía. 💉👱‍♀️";
  await whatsappService.sendMessage(number, answer);
  await appendConversation(["Bot", number, answer, new Date().toISOString()]);

  const msg1 = MentonImageMessage(number); // función del paso 2
  await whatsappService.sendMessage(number, msg1);
  await appendConversation(["Bot", number, typeof msg1 === "string" ? msg1 : JSON.stringify(msg1), new Date().toISOString()]);

  const msg2 = ConsultationBookingButtonsMessage(number);
  await whatsappService.sendMessage(number, msg2);
  await appendConversation(["Bot", number, typeof msg2 === "string" ? msg2 : JSON.stringify(msg2), new Date().toISOString()]);
}

export async function handleRellenoOjeras(number) {
  const infoText = "El tratamiento de ojeras con ácido hialurónico ayuda a mejorar la apariencia de hundimiento, pigmentación y fatiga. Es rápido, seguro y con resultados inmediatos.";
  await whatsappService.sendMessage(number, infoText);
  await appendConversation(["Bot", number, infoText, new Date().toISOString()]);

  const msg1 = OjerasMessage(number); // la imagen del procedimiento
  await whatsappService.sendMessage(number, msg1);
  await appendConversation(["Bot", number, typeof msg1 === "string" ? msg1 : JSON.stringify(msg1), new Date().toISOString()]);

  const msg2 = ConsultationBookingButtonsMessage(number); // botones para agendar
  await whatsappService.sendMessage(number, msg2);
  await appendConversation(["Bot", number, typeof msg2 === "string" ? msg2 : JSON.stringify(msg2), new Date().toISOString()]);
}
