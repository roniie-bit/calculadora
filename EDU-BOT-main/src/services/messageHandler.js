// ======================================================
// ✅ src/services/messageHandler.js
// ======================================================

import whatsappService from "./whatsappService.js";
import config from '../config/env.js';
import studentRepository from './studentService.js';
import sendToWhatsApp from './httpRequest/sendToWhatsApp.js';
import { samePhone } from '../utils/phone.js';
import { createRegistrationFlow, isStudentManagementCommand } from '../flows/studentRegistrationFlow.js';
import attendanceStore from './teacherAttendanceStore.js';
import {
  createTeacherAttendanceFlow,
  isTeacherAttendanceCommand
} from '../flows/teacherAttendanceFlow.js';
import taskStore from './teacherTaskStore.js';
import { createTeacherTaskFlow } from '../flows/teacherTaskFlow.js';
import { createMultiTaskFlow } from '../flows/multiTaskFlow.js';
import { createSyncDeliveriesFlow } from '../flows/syncDeliveriesFlow.js';
import examStore from './teacherExamStore.js';
import { createTeacherExamFlow } from '../flows/teacherExamFlow.js';
import reportStore from './gradeReportStore.js';
import { createGradeReportFlow } from '../flows/gradeReportFlow.js';
import { createAdminCommandsFlow } from '../flows/adminCommandsFlow.js';
import { createStudentRecordFlow } from '../flows/studentRecordFlow.js';
import { createStudentPhoneFlow } from '../flows/studentPhoneFlow.js';
import { createFirstAttendanceFlow } from '../flows/firstAttendanceFlow.js';
import {
  sendWelcomeMessageAndMenu,
  ListMessage,
  TextMessage,
  PrivacyNoticeMessage
} from "../util.js";

// Flujos
import { handleCalendarFlow } from "../flows/calendarFlow.js";
import { handleAssistanceFlow } from "../flows/assistanceFlow.js";
import { handleLocationFlow } from "../flows/locacionFlow.js";
import {
  marcarPendientesEnHoja3,
  enviarMensajesMasivos
} from "../flows/massMessageFlow.js";

import {
  handleAdminChatFlow,
  handleOngoingAdminChat
} from "../flows/adminChatFlow.js";

import { handleSurveyFlow } from "../flows/surveyFlow.js";
import { handleSncytSurveyFlow } from "../flows/sncytSurveyFlow.js";

// EXÁMENES
import { handlePhysicsExamFlow } from "../flows/physicsExamFlow.js";
import { handleMathExamFlow } from "../flows/mathExamFlow.js";
import { handleChemistryExamFlow } from "../flows/chemistryExamFlow.js";
import { handleHomeworkReminderResponse } from "../flows/homeworkReminderResponseFlow.js";

// TAREAS
import {
  homeworkFlow,
  homeworkStates,
  isHomeworkRegistrationRequest,
} from "../flows/homeworkFlow.js";

// EMOCIONAL
import {
  emotionalFlow,
  emotionalStates,
  startEmotionalFlow
} from "../flows/emotionalFlow.js";

// IA
import {
  askAI,
  classifyEmotionalIntentLocally
} from "../services/openAiService.js";

// GOOGLE SHEETS
import {
  appendConversation,
  appendStudentLocation,
  appendAssistance,
  getStudentGrade
} from "../services/googleSheetsService.js";

// CALIFICACIONES
import gradesFlow from "../flows/gradesFlow.js";

// BORRADO DE DATOS
import {
  detectDeleteDataTrigger,
  handleDeletePersonalDataFlow,
  deleteDataStates
} from "../flows/deletePersonalDataFlow.js";

class MessageHandler {
  constructor() {
    this.userStates = {};
    this.calendarState = {};
    this.adminNumber = config.ADMIN_NUMBER;
    this.firstAttendanceFlow = createFirstAttendanceFlow({ students: studentRepository, store: attendanceStore, adminNumber: this.adminNumber,
      send: (phone, payload) => sendToWhatsApp(payload, { throwOnError: true }) });
    this.studentPhoneFlow = createStudentPhoneFlow({
      repository: studentRepository, adminNumber: this.adminNumber,
      send: (phone, payload) => sendToWhatsApp(payload, { throwOnError: true })
    });
    this.studentRecordFlow = createStudentRecordFlow({
      students: studentRepository, taskStore, attendanceStore, examStore, adminNumber: this.adminNumber,
      send: (phone, payload) => sendToWhatsApp(payload, { throwOnError: true })
    });
    this.adminCommandsFlow = createAdminCommandsFlow({
      adminNumber: this.adminNumber,
      send: (phone, payload) => sendToWhatsApp(payload, { throwOnError: true })
    });
    this.multiTaskFlow = createMultiTaskFlow({ students: studentRepository, store: taskStore, adminNumber: this.adminNumber,
      send: (phone, payload) => sendToWhatsApp(payload, { throwOnError: true }) });
    this.syncDeliveriesFlow = createSyncDeliveriesFlow({ store: taskStore, adminNumber: this.adminNumber,
      send: (phone, payload) => sendToWhatsApp(payload, { throwOnError: true }) });
    this.teacherExamFlow = createTeacherExamFlow({
      store: examStore,
      students: studentRepository,
      adminNumber: this.adminNumber,
      send: (phone, payload) => sendToWhatsApp(payload, { throwOnError: true })
    });
    this.gradeReportFlow = createGradeReportFlow({
      students: studentRepository,
      taskStore,
      attendanceStore,
      examStore,
      reportStore,
      adminNumber: this.adminNumber,
      send: (phone, payload) => sendToWhatsApp(payload, { throwOnError: true })
    });
    this.teacherTaskFlow = createTeacherTaskFlow({
      store: taskStore,
      students: studentRepository,
      suspendOther: () => attendanceStore.transact(db => {
        const control = db.controls[this.adminNumber];
        if (control && !['idle', 'review'].includes(control.phase)) {
          const session = db.sessions[control.sessionId];
          if (session && session.status !== 'Finalizada') {
            session.status = 'Pausada';
            session.updatedAt = new Date().toISOString();
          }
          db.controls[this.adminNumber] = { phase: 'idle' };
        }
      }),
      send: (phone, payload) => sendToWhatsApp(payload, { throwOnError: true }),
      adminNumber: this.adminNumber
    });
    this.teacherAttendanceFlow = createTeacherAttendanceFlow({
      store: attendanceStore,
      students: studentRepository,
      send: (phone, payload) => sendToWhatsApp(payload, { throwOnError: true }),
      adminNumber: this.adminNumber
    });
    this.registrationFlow = createRegistrationFlow({
      repository: studentRepository,
      send: (phone, payload) => sendToWhatsApp(payload, { throwOnError: true }),
      adminNumber: this.adminNumber
    });

    this.adminChatState = {
      isChatting: false,
      targetNumber: null
    };
  }

  // ======================================================
  // WEBHOOK PRINCIPAL
  // ======================================================
  async handleIncomingMessage(message, from) {
    try {
      const phone =
        message.from || (from && typeof from === "object"
          ? from.wa_id
          : typeof from === "string"
          ? from
          : "DESCONOCIDO");

      const rawText = this.extractText(message);
      const text = rawText.trim().toLowerCase();

      // La prueba de la conferencia no debe mezclarse con datos escolares,
      // conversaciones ni clasificación emocional.
      if (await handleSncytSurveyFlow(message, phone, this.userStates)) return;

      if (await this.adminCommandsFlow(phone, rawText)) return;
      if (await handleHomeworkReminderResponse(message, phone)) return;

      if (
        samePhone(phone, this.adminNumber) &&
        /^registrar tarea(?:\s|$)/i.test(text)
      ) {
        if (await this.teacherTaskFlow(phone, rawText, message.id)) return;
      }

      if (
        samePhone(phone, this.adminNumber) &&
        isTeacherAttendanceCommand(rawText)
      ) {
        if (await this.teacherAttendanceFlow(phone, rawText, message.id)) return;
      }

      const homeworkInteraction =
        homeworkStates[phone] ||
        isHomeworkRegistrationRequest(rawText) ||
        ["tarea", "tareas", "mis tareas", "mis_tareas", "recordatorio", "recordatorios", "pendientes"].includes(text);

      if (homeworkInteraction) {
        return homeworkFlow(
          phone,
          text === "mis tareas" || text === "mis_tareas" ? "ver" : text
        );
      }

      void appendConversation(["Inicio", phone, text]);

      if (await this.studentPhoneFlow(phone, rawText, message.id)) return;
      if (await this.firstAttendanceFlow(phone, rawText, message.id)) return;
      if (await this.studentRecordFlow(phone, rawText)) return;
      if (isStudentManagementCommand(rawText) && await this.registrationFlow(phone, rawText, message.id)) return;
      if (await this.multiTaskFlow(phone, rawText, message.id)) return;
      if (await this.syncDeliveriesFlow(phone, rawText, message.id)) return;
      if (await this.teacherExamFlow(phone, rawText, message.id)) return;
      if (await this.gradeReportFlow(phone, rawText, message.id)) return;
      if (await this.teacherTaskFlow(phone, rawText, message.id)) return;
      if (await this.teacherAttendanceFlow(phone, rawText, message.id)) return;
      if (await this.registrationFlow(phone, rawText, message.id)) return;

      const ongoing = await handleOngoingAdminChat(
        message,
        phone,
        this.adminNumber,
        this.adminChatState
      );

      if (ongoing) return;

      return this.processMessage(message, phone, text);
    } catch (err) {
      console.error("❌ Error en handleIncomingMessage:", err);
    }
  }

  // ======================================================
  // EXTRAER TEXTO
  // ======================================================
  extractText(message) {
    if (!message) return "";

    if (message.type === "text") return message.text.body || "";

    if (message.type === "interactive") {
      const i = message.interactive;

      if (i.type === "button_reply") return i.button_reply.id || "";
      if (i.type === "list_reply")
        return i.list_reply.id || i.list_reply.title || "";
    }

    if (message.type === "button") {
      return (
        message.button?.payload ||
        message.button?.id ||
        message.button?.text ||
        ""
      );
    }

    return "";
  }

  // ======================================================
  // PROCESADOR PRINCIPAL
  // ======================================================
  async processMessage(message, phone, text) {
    console.log("📩 MENSAJE:", text);

    // ======================================================
    // CALIFICACIONES
    // ======================================================
    if (this.userStates[phone]?.waitingForGrade) {
      const initials = (text || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9ÁÉÍÓÚÑ]/g, "")

      if (!initials || initials.length < 4) {
        const warn =
          "❌ Formato no válido.\n\n" +
          "Envía solo tus *iniciales en MAYÚSCULAS*, comenzando por tus apellidos.\n\n" +
          "Ejemplo: *FHJS*";

        await whatsappService.sendMessage(phone, TextMessage(warn, phone));
        await appendConversation(["Bot", phone, warn]);
        return;
      }

      const result = await getStudentGrade(initials);

      if (!result) {
        const warn =
          "❌ No encontré tus iniciales en el registro.\n\n" +
          "Verifica que estén escritas correctamente en MAYÚSCULAS.\n" +
          "Ejemplo: *FHJS*";

        await whatsappService.sendMessage(phone, TextMessage(warn, phone));
        await appendConversation(["Bot", phone, warn]);

        delete this.userStates[phone].waitingForGrade;
        return;
      }

      const msg =
        `📘 *Resultado de calificaciones*\n\n` +
        `👤 Alumno: ${result.nombre}\n` +
        `🆔 Iniciales: ${result.folio}\n` +
        `📊 Calificación: ${result.calificacion}`;

      await whatsappService.sendMessage(phone, TextMessage(msg, phone));
      await appendConversation(["Bot", phone, msg]);

      delete this.userStates[phone].waitingForGrade;
      return;
    }

    // ======================================================
    // ADMIN CHAT
    // ======================================================
    if (
      await handleAdminChatFlow(
        message,
        phone,
        this.adminNumber,
        this.adminChatState
      )
    )
      return;

    // ======================================================
    // BORRAR DATOS
    // ======================================================
    if (detectDeleteDataTrigger(text) || deleteDataStates[phone]) {
      const handled = await handleDeletePersonalDataFlow(phone, text);
      if (handled) return;
    }

    // ======================================================
    // FLUJO EMOCIONAL ACTIVO
    // ======================================================
    if (emotionalStates[phone]) {
      return emotionalFlow(phone, text, message);
    }

    // ======================================================
    // ENTRADA EMOCIONAL EXPLÍCITA
    // ======================================================
    if (text.includes("emocional") || text.includes("apoyo emocional")) {
      return startEmotionalFlow(phone);
    }

    // Primero se resuelven las señales claras sin llamar a la IA.
    const localEmotionalLabel = classifyEmotionalIntentLocally(text);
    if (localEmotionalLabel === "emocional" || localEmotionalLabel === "riesgo") {
      void appendConversation([
        "EMOCIONAL-DETECTADO",
        phone,
        `${localEmotionalLabel}: ${text}`
      ]);
      return startEmotionalFlow(phone, text, localEmotionalLabel);
    }

    // ======================================================
    // SALUDO
    // ======================================================
    if (
      /^(?:hola|buenas(?:\s+(?:días|dias|tardes|noches))?|hey|holi|ola)[!. ]*$/i.test(
        text
      )
    ) {
      await this.sendFullWelcome(phone);
      await whatsappService.sendMessage(phone, PrivacyNoticeMessage(phone));
      return;
    }

    // ======================================================
    // MIS TAREAS
    // ======================================================
    if (text === "mis tareas" || text === "mis_tareas") {
      return homeworkFlow(phone, "ver");
    }

    // ======================================================
    // UBICACIÓN PARA ASISTENCIA
    // ======================================================
    if (this.userStates[phone]?.waitingForLocation) {
      if (message.type !== "location") {
        const warn =
          "📍 *Aún no recibo tu ubicación.*\n" +
          "Por favor envíala usando el botón de *Enviar ubicación*.";

        await whatsappService.sendMessage(phone, TextMessage(warn, phone));
        await appendConversation(["Bot", phone, warn]);
        return;
      }

      const { latitude, longitude } = message.location;

      await appendStudentLocation(phone, latitude, longitude);
      await appendAssistance(phone, "Sin nombre");

      const ok =
        "🟢 *Asistencia registrada correctamente*\n\n" +
        `📍 ${latitude}, ${longitude}`;

      await whatsappService.sendMessage(phone, TextMessage(ok, phone));
      await appendConversation(["Bot", phone, ok]);

      delete this.userStates[phone];
      return;
    }

    // ======================================================
    // ASISTENCIA
    // ======================================================
    if (await handleAssistanceFlow(message, phone, this.userStates)) return;

    // ======================================================
    // ENCUESTA
    // ======================================================
    if (await handleSurveyFlow(message, phone, this.userStates)) return;

    // ======================================================
    // EXAMEN FÍSICA
    // ======================================================
    if (await handlePhysicsExamFlow(message, phone, this.userStates)) return;

    // ======================================================
    // EXAMEN MATEMÁTICAS
    // ======================================================
    if (await handleMathExamFlow(message, phone, this.userStates)) return;

    // ======================================================
    // EXAMEN QUÍMICA
    // ======================================================
    if (await handleChemistryExamFlow(message, phone, this.userStates)) return;

    // ======================================================
    // TAREAS
    // ======================================================
    if (homeworkStates[phone]) {
      return homeworkFlow(phone, text);
    }

    const homeworkKeywords = ["tarea", "tareas", "recordatorio", "pendientes"];

    if (
      isHomeworkRegistrationRequest(rawText) ||
      homeworkKeywords.some((k) => text.startsWith(k))
    ) {
      return homeworkFlow(phone, text);
    }

    // ======================================================
    // CALIFICACIONES
    // ======================================================
    if (gradesFlow.detect(text)) {
      return gradesFlow.run(phone, this.userStates);
    }

    // ======================================================
    // UBICACIÓN PLANTEL
    // ======================================================
    if (
      text.includes("ubicacion") ||
      text.includes("ubicación") ||
      text.includes("plantel")
    ) {
      return handleLocationFlow(phone, message);
    }

    // ======================================================
    // MENSAJES MASIVOS
    // ======================================================
    if (
      text.includes("aviso") ||
      text.includes("masivo") ||
      text.includes("anuncio")
    ) {
      return this.handleMassMessageFlow(message, phone);
    }

    // ======================================================
    // VALIDACIÓN TEXTO
    // ======================================================
    if (!text || text.trim() === "") {
      const warn =
        "No pude identificar texto en tu mensaje. Intenta escribir tu pregunta.";

      await whatsappService.sendMessage(phone, TextMessage(warn, phone));
      await appendConversation(["Bot", phone, warn]);
      return;
    }

    // ======================================================
    // IA PARA TODO TEXTO LIBRE NO RECONOCIDO COMO COMANDO
    // ======================================================
    return this.handleAIMessage(text, phone);
  }

  // ======================================================
  // IA
  // ======================================================
  async handleAIMessage(text, phone) {
    try {
      console.log("🤖 Enviando a IA:", text);

      const aiResponseRaw = await askAI(text);

      console.log("🧠 Respuesta IA:", aiResponseRaw);

      const aiResponse =
        typeof aiResponseRaw === "string"
          ? aiResponseRaw
          : aiResponseRaw?.reply ||
            aiResponseRaw?.message ||
            "No pude generar una respuesta en este momento.";

      await whatsappService.sendMessage(phone, TextMessage(aiResponse, phone));
      void appendConversation(["BOT-IA", phone, aiResponse]);
    } catch (err) {
      console.error("❌ Error IA:", err);

      await whatsappService.sendMessage(
        phone,
        TextMessage("Ocurrió un error al consultar la IA.", phone)
      );
    }
  }

  // ======================================================
  // MENÚ
  // ======================================================
  async sendFullWelcome(phone) {
    const welcomeText =
      "🤖 ¡Holaaa! Soy Rut, tu asistente académico del CETis 20.\n\n" +
      "Estoy aquí para ayudarte con tus actividades escolares y mantenerte al tanto de tu información académica.\n\n" +
      "📚 ¿Qué puedo hacer por ti?\n\n" +
      "📌 Tareas y actividades\n" +
      "🎓 Asesorías académicas\n" +
      "📝 Exámenes\n" +
      "🗂️ Consulta de asistencias\n" +
      "📊 Consulta de puntos y registros\n" +
      "💬 Apoyo emocional\n" +
      "📍 Ubicación del plantel\n\n" +
      "🔎 ¿Quieres consultar tu registro?\n\n" +
      "Escribe mi registro seguido de tu folio para consultar tus tareas, puntos y asistencias.\n\n" +
      "Por ejemplo:\n" +
      "mi registro EDU-5AMAM-015\n\n" +
      "💬 ¿Qué necesitas hoy? Elige una opción del menú y comencemos. 👇";

    await whatsappService.sendMessage(phone, TextMessage(welcomeText, phone));

    const img = {
      messaging_product: "whatsapp",
      to: phone,
      type: "image",
      image: {
        link:
          "https://static.wixstatic.com/media/613bb7_9916174953444c199a9cf4b36323fd43~mv2.png"
      }
    };

    await whatsappService.sendMessage(phone, img);

    const menu = ListMessage(phone);
    await whatsappService.sendMessage(menu.to, menu);
  }

  // ======================================================
  // MASIVOS
  // ======================================================
  async handleMassMessageFlow(message, phone) {
    await marcarPendientesEnHoja3();
    await enviarMensajesMasivos();

    const r = "📢 *Aviso enviado correctamente.*";

    await whatsappService.sendMessage(phone, TextMessage(r, phone));

    const menu = sendWelcomeMessageAndMenu(phone);

    for (const m of menu) {
      await whatsappService.sendMessage(m.to, m);
    }

    return true;
  }
}

export default new MessageHandler();
