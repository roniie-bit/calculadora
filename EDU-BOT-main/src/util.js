// src/util.js

export function GetTextUser(message) {
  let text = "";
  const typeMessage = message.type;

  if (typeMessage === "text") {
    text = message.text.body;
  } else if (typeMessage === "interactive") {
    const i = message.interactive;
    if (i.type === "button_reply") text = i.button_reply.id;   // 🔥 USAMOS ID, NO TITLE
    else if (i.type === "list_reply") text = i.list_reply.id;  // 🔥 USAMOS ID
  }
  return text;
}

export function ButtonsMessageWithText(text, buttons, number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text },
      action: {
        buttons: buttons.map((b) => ({
          type: "reply",
          reply: { id: b, title: b }
        }))
      }
    }
  };
}

export function TextMessage(text, number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "text",
    text: { body: text }
  };
}

export function ImageMessage(number, link) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "image",
    image: { link }
  };
}

/* --------------------------------------------
   NUEVO MENÚ PRINCIPAL (BOTONES)
--------------------------------------------- */
export function ButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "¿En qué puedo ayudarte? 🤖" },
      action: {
        buttons: [
          { id: "tareas_menu",  type: "reply", reply: { id: "tareas_menu",  title: "Tareas 📌" }},
          { id: "asesoria",     type: "reply", reply: { id: "asesoria",     title: "Asesoría 📘" }},
          { id: "mis_tareas",   type: "reply", reply: { id: "mis_tareas",   title: "Mis tareas 📋" }}  // 🔥 CORREGIDO
        ]
      }
    }
  };
}

/* --------------------------------------------
   LISTA PRINCIPAL (MENÚ WHATSAPP)
--------------------------------------------- */
export function ListMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: "Selecciona una opción 👇" },
      footer: { text: "EDU-BOT – Asistente Académico" },
      action: {
        button: "Menú",
        sections: [
          {
            title: "Apoyo académico",
            rows: [
              { id: "tareas_menu", title: "Registrar Tarea" },
              { id: "asesoria",    title: "Asesoría 📘" },
              { id: "mis_tareas",  title: "Mis tareas 📋" }   // 🔥 CORREGIDO
            ]
          },
          {
            title: "Servicios",
            rows: [
              { id: "registro_alumno", title: "Registrarme 📝" },
              { id: "asistencia", title: "Asistencia 🗂️" },
              { id: "ubicacion",  title: "Ubicación 📍" }
            ]
          }
        ]
      }
    }
  };
}

/* --------------------------------------------
   BIENVENIDA + MENÚ (sin imagen)
--------------------------------------------- */
export function sendWelcomeMessageAndMenu(number) {
  const welcome =
    "🤖 *¡Holaaa! Soy EDU-BOT*, tu asistente académico.\n\n" +
    "Para darte de alta en tu grupo, escribe *registrarme*.\n\n" +
    "Para consultar tus tareas, puntos y asistencias, escribe *mi registro* seguido de tu folio. Ejemplo: *mi registro EDU-5AMAM-015*.\n\n" +
    "Puedo ayudarte con tareas, asesorías, asistencia y más.\n\n" +
    "¿Qué necesitas hoy?";

  const welcomeMsg = TextMessage(welcome, number);

  const menu = ListMessage(number);

  return [welcomeMsg, menu];
}

/* --------------------------------------------
   ButtonMessage (compatibilidad)
--------------------------------------------- */
export function ButtonMessage(number, text, buttons) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text },
      action: {
        buttons: buttons.map(b => ({
          type: "reply",
          reply: { id: b.id, title: b.title }
        }))
      }
    }
  };
}

export function PrivacyNoticeMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "text",
    text: {
      body:
        "🔐 *Aviso de Privacidad*\n\n" +
        "Conoce cómo protegemos tus datos personales en el siguiente enlace:\n" +
        "https://uemstis.sep.gob.mx/index.php/quienes-somos/225-aviso-de-privacidad"
    }
  };
}
