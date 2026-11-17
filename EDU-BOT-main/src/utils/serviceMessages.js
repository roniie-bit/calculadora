// src/utils/serviceMessages.js

// Mensajes de texto simples
export function TextMessage(text, number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "text",
    text: {
      body: text
    }
  };
}

// Mensaje con botones interactivos (general)
export function ButtonsMessageWithText(text, buttons, number) {
  const btns = buttons.map(btnTitle => ({
    type: "reply",
    reply: {
      id: btnTitle.toLowerCase(), // se puede ajustar el id si se requiere otro valor
      title: btnTitle
    }
  }));
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text },
      action: { buttons: btns }
    }
  };
}

// Mensaje de imagen
export function ImageMessage(number, imageLink) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "image",
    image: {
      link: imageLink
    }
  };
}

// Mensaje de audio
export function AudioMessage(number, audioLink) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "audio",
    audio: { link: audioLink }
  };
}

// Mensaje de video
export function VideoMessage(number, videoLink, caption = "") {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "video",
    video: {
      link: videoLink,
      caption
    }
  };
}

// Mensaje de documento
export function DocumentMessage(number, documentLink, caption = "", filename = "document.pdf") {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "document",
    document: {
      link: documentLink,
      caption,
      filename
    }
  };
}

// Mensaje de ubicación
export function LocationMessage(number, latitude, longitude, name, address) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "location",
    location: {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      name,
      address
    }
  };
}

// Mensajes para flujo de servicios

// Retiro de Verrugas (consulta)
// Envía una imagen ilustrativa del servicio
export function ConsultationMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "image",
    image: {
      link: "https://static.wixstatic.com/media/613bb7_5dabf1025c274d15a2253ddf5d6062c3~mv2.jpeg/v1/fill/w_600,h_600,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/mzqns-en-cuello.jpeg"
    }
  };
}

// Botones interactivos antiguos (ya no se usan para Retiro de Verrugas)
export function ConsultationButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "*¿Qué incluye?* 🤔" },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "info",
              title: "¿Qué incluye? 🤔"
            }
          },
          {
            type: "reply",
            reply: {
              id: "agendar-cita",
              title: "Agendar cita 📅"
            }
          }
        ]
      }
    }
  };
}

// Mensaje informativo con el costo y detalles del servicio
export function ConsultationInfoMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "text",
    text: {
      body: "El costo para eliminar los mezquinos en el cuello es de 499 pesos por sesión de 25 minutos ⏱️💰.\n\nEn ese tiempo, eliminaremos todos los que sea posible 💼👍. 🩺"
    }
  };
}

// Botones para agendar cita (usado en otros flujos)
export function ConsultationBookingButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "*¿Te gustaría reservar una cita?*" },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "sí, por favor",
              title: "Sí, por favor🙌"
            }
          },
          {
            type: "reply",
            reply: {
              id: "no",
              title: "De momento no 🥹"
            }
          }
        ]
      }
    }
  };
}

// Flujo para Botox
export function ColposcopiaMessage(number) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: number,
    type: "image",
    image: {
      link: "https://static.wixstatic.com/media/613bb7_2e0e93b77a5a4aaaa7d60d887e26bf79~mv2.jpg/v1/fill/w_600,h_750,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/botox.jpg",
      caption:
        "✨ *Rejuvenece tu piel con BOTOX* 💉✨\n\n" +
        "✅ Atenúa líneas de expresión y arrugas.\n" +
        "✅ Resultados naturales y sin cirugía.\n" +
        "✅ Procedimiento seguro y realizado por especialistas.\n\n" +
        "💰 *Costo: $90 MXN por unidad de BOTOX* 💵\n\n" +
        "📅 ¡Reserva tu cita y luce una piel más joven y fresca!"
    }
  };
}

// Flujo para Diseño de Labios
export function FemLasserMessage(number) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: number,
    type: "image",
    image: {
      link: "https://static.wixstatic.com/media/613bb7_74f5042a17c745ed92879b4786e4a416~mv2.jpeg/v1/fill/w_600,h_600,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/41-labios.jpeg",
      caption:
        "💋 *Realza la belleza de tus labios con Ácido Hialurónico* 💉✨\n\n" +
        "✅ Aumenta el volumen y la hidratación.\n" +
        "✅ Define el contorno para una apariencia natural.\n" +
        "✅ Procedimiento rápido, seguro y sin cirugía.\n\n" +
        "💰 *Costo: $3,800 MXN* 💵\n\n" +
        "📅 *Agenda tu cita y luce unos labios irresistibles.*"
    }
  };
}

// Mensaje Not Now (De momento no 🥹)
export function NotNowMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "text",
    text: {
      body: "👩‍💻 Entiendo que quizás en este momento no estés buscando reservar una cita."
    }
  };
}

// Mensaje con botones adicionales después de Not Now
export function AdditionalButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "¿Hay algo más en lo que pueda ayudarte o alguna pregunta específica que tengas sobre nuestros servicios? 👨‍🔬" },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: "hablar_asesor", title: "Hablar con un asesor" }
          },
          {
            type: "reply",
            reply: { id: "regresar_menu", title: "Regresar al menú" }
          }
        ]
      }
    }
  };
}

// Mensaje adicional (por ejemplo, cuando se consulta más información)
export function AdditionalMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "¿Requiere más información?" },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: "si", title: "Si🙌🏻" }
          }
        ]
      }
    }
  };
}

// Mensaje con botones para menú principal
export function ButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "*Dinos ¿Cómo te podemos ayudar?*" },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: "servicios", title: "Servicios" }
          },
          {
            type: "reply",
            reply: { id: "agendar-cita", title: "Agendar cita 📅" }
          },
          {
            type: "reply",
            reply: { id: "ubicacion", title: "Ubicación 📍" }
          }
        ]
      }
    }
  };
}

// Mensaje de lista interactiva para el menú de servicios
export function ListMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: "Conoce nuestra variedad de servicios especializados:" },
      footer: { text: "Click en el menu" },
      action: {
        button: "Menu",
        sections: [
          {
            title: "Servicios",
            rows: [
              { id: "retiro-de-verrugas", title: "Retiro de Verrugas 🌸", description: "" },
              { id: "rinomodelacion", title: "Rinomodelacion 👃🏻", description: "" },
              { id: "botox", title: "Botox 💉", description: "" },
              { id: "diseño-de-labios", title: "Diseño de Labios 👄", description: "" }
            ]
          },
          {
            title: "Centro de atención",
            rows: [
              { id: "ubicacion", title: "Ubicación 📍", description: "" },
              { id: "agendar-cita", title: "Agendar cita 📅", description: "" }
            ]
          }
        ]
      }
    }
  };
}

// Mensaje para preguntar el nombre completo
export function AskFullNameMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "¿Cuál es su nombre completo?" },
      action: { buttons: [] }
    }
  };
}

// Mensaje con botones para cita (por ejemplo, cuando se envían horarios)
export function AppointmentButtonsMessage(number) {
  return {
    from: "whatsapp:+14155238886",
    to: `whatsapp:${number}`,
    type: "template",
    template: {
      namespace: "commerce",
      element_name: "button",
      content: {
        text: "En un momento le enviamos los horarios disponibles. ⏳",
        buttons: [
          { type: "reply", reply: { button: "Ok👌🏻", message: "Ok👌🏻" } },
          { type: "reply", reply: { button: "Regresar al menú", message: "Regresar al menú" } }
        ]
      }
    }
  };
}

// Mensaje interactivo adicional para el flujo de consulta, con opciones para preguntar si duele y para agendar cita.
export function ConsultationAdditionalButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "*¿Deseas saber si duele el procedimiento?*" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "duele", title: "¿Duele? 🤔" } },
          { type: "reply", reply: { id: "agendar-cita", title: "Agendar cita 📅" } }
        ]
      }
    }
  };
}

// Nueva función: Botones para el flujo de Retiro de Verrugas
export function RetiroVerrugasButtonsMessage(number) {
  const buttons = [
    { type: "reply", reply: { id: "info_cuello", title: "¿Qué incluye? en cuello" } },
    { type: "reply", reply: { id: "duele", title: "¿Duele? 🤔" } },
    { type: "reply", reply: { id: "cotizar_asesor", title: "Cotizar con un asesor" } }
  ];
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Elige una opción:" },
      action: { buttons }
    }
  };
}

// src/utils/serviceMessages.js

export function ContactAdvisorButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "¿Deseas comunicarte con un asesor?" },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "asesor_si",
              title: "Sí"
            }
          },
          {
            type: "reply",
            reply: {
              id: "asesor_no",
              title: "No"
            }
          }
        ]
      }
    }
  };
}

// Creamos uno nuevo para “Sí”:
export function AdvisorRequestAcceptedMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "text",
    text: {
      body: "¡Tu solicitud ha sido enviada! *Un asesor se comunicará contigo pronto* para realizar su cotización."
    }
  };
}

// src/utils/serviceMessages.js

export function DifferentNoMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "text",
    text: {
      body: "👩‍💻 ¡Entendido! Si necesitas más información o deseas explorar otros servicios, vuelve a consultar el menú."
    }
  };
}

// Flujo para "Hilos Tensores"
export function HilosTensoresMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "image",
    image: {
      link: "https://static.wixstatic.com/media/613bb7_58105aac77114e609cf053c408db3399~mv2.jpeg/v1/fill/w_600,h_600,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/WhatsApp%20Image%202025-04-03%20at%209_24_47%20PM.jpeg",
      caption:
        "✨ *Hilos Tensores (PDO) - El lifting sin cirugía* ✨\n\n" +
        "✅ Mejora la firmeza y elasticidad de la piel.\n" +
        "✅ Estimula la producción de colágeno.\n" +
        "✅ Procedimiento rápido y mínimamente invasivo.\n\n" +
        "💰 *Costo: $8,000 MXN* 💵\n\n" +
        "📅 ¡Agenda tu cita y luce una piel más firme y joven!"
    }
  };
}

// Botones para agendar cita o más información
export function HilosTensoresBookingButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "*¿Te gustaría reservar una cita para Hilos Tensores?*" },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "sí, por favor",
              title: "Sí, por favor 🙌"
            }
          },
          {
            type: "reply",
            reply: {
              id: "no",
              title: "De momento no 🥹"
            }
          }
        ]
      }
    }
  };
}

// Botones interactivos adicionales para Hilos Tensores
export function HilosTensoresAdditionalButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "*¿Te gustaría saber más sobre el procedimiento?*" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "duele", title: "¿Duele? 🤔" } },
          { type: "reply", reply: { id: "agendar-cita", title: "Agendar cita 📅" } }
        ]
      }
    }
  };
}

// Imagen de Proyección de Mentón
export function MentonImageMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "image",
    image: {
      link: "https://static.wixstatic.com/media/613bb7_ec28c045ad8642da9f4e6cbcc8389bc7~mv2.png/v1/fill/w_600,h_600,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/613bb7_ec28c045ad8642da9f4e6cbcc8389bc7~mv2.png",
      caption: "💉 *Proyección de Mentón con Ácido Hialurónico* 💫\n\n✅ Mejora el perfil del rostro.\n✅ Procedimiento no invasivo.\n✅ Resultados inmediatos y naturales.\n\n💰 *Costo aproximado: $7,000 MXN* 💵"
    }
  };
}

// Botones para Proyección de Mentón
export function MentonButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "*¿Te gustaría reservar una cita?*" },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "sí, por favor",
              title: "Sí, por favor 🙌"
            }
          },
          {
            type: "reply",
            reply: {
              id: "no",
              title: "De momento no 🥹"
            }
          }
        ]
      }
    }
  };
}

// Flujo para Relleno de Ojeras
export function OjerasMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "image",
    image: {
      link: "https://static.wixstatic.com/media/613bb7_603608b6b8bc47f8b1887146b92153c2~mv2.png/v1/fill/w_600,h_600,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/59-ojeras.png",
      caption:
        "✨ *Relleno de Ojeras con Ácido Hialurónico* ✨\n\n" +
        "✅ Reduce la apariencia de ojeras profundas.\n" +
        "✅ Restaura volumen y frescura a tu mirada.\n" +
        "✅ Procedimiento seguro, rápido y sin cirugía.\n\n" +
        "💰 *Costo: $3,800 MXN* 💵\n\n" +
        "📅 ¡Agenda tu cita y luce una mirada más descansada!"
    }
  };
}

// Explicación breve de qué son los acrocordones en cuello
export function AcrocordonesInfoMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "text",
    text: {
      body:
        "🩺 *¿Qué son los acrocordones en cuello?*\n\n" +
        "Son pequeños crecimientos benignos de la piel, blandos y del color de tu tono cutáneo. " +
        "No representan un riesgo para tu salud, pero pueden resultar molestos o antiestéticos. " +
        "Con nuestro procedimiento los retiramos de forma rápida y segura ✅. " +
        "Más detalles en consulta médica ✅."
    }
  };
}

// Pregunta interactiva: ¿Qué son los acrocordones en cuello?
export function AcrocordonesQuestionButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "*¿Qué son los acrocordones en cuello?*" },
      action: {
        buttons: [
          {                                   // ➜ el usuario obtendrá la explicación
            type: "reply",
            reply: { id: "que_son", title: "¿Qué son?" }
          },
          {                                   // ➜ inicia directamente el flujo de agenda
            type: "reply",
            reply: { id: "agendar-cita", title: "Agendar cita 📅" }
          }
        ]
      }
    }
  };
}

// Imagen inicial de Rinomodelación
export function UltrasoundMessage(number) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: number,
    type: "image",
    image: {
      link: "https://static.wixstatic.com/media/613bb7_bb728b9d93d840f78e893f6a34b624d0~mv2.jpeg/v1/fill/w_600,h_600,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/rino1.jpeg",
      caption:
        "✨ *Rinomodelación sin cirugía* 👃💉\n\n" +
        "✅ Define y perfila tu nariz de manera segura.\n" +
        "✅ Resultados inmediatos y sin dolor.\n" +
        "✅ Procedimiento realizado por médico estético.\n\n" +
        "💰 *Costo: $3,800 MXN* 💵\n\n" +
        "📅 ¡Agenda tu cita hoy y mejora tu perfil sin cirugía!"
    }
  };
}

// Botones tras la imagen principal
export function RinoStartButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "*¿Quieres saber qué materiales se usan en el procedimiento?*" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "info_rino", title: "¿Qué incluye?" } },
          { type: "reply", reply: { id: "agendar-cita", title: "Agendar cita 📅" } }
        ]
      }
    }
  };
}

// Respuesta a “¿Qué incluye?”
export function RinoInfoMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "image",
    image: {
      link: "https://static.wixstatic.com/media/613bb7_7a9b7701adcf481dbfbe49352f5a824a~mv2.jpeg/v1/fill/w_600,h_600,al_c,q_80,enc_avif,quality_auto/WhatsApp%20Image%202025-04-15%20at%209_18_28%20PM.jpeg",
      caption:
        "🌟 El procedimiento se realiza con ácido hialurónico 😊\n" +
        "📦 Paquete sellado y seguro para ti\n" +
        "📅 Fecha de caducidad visible\n" +
        "🏥 Registro sanitario en regla\n\n" +
        "✨ Dos hologramas incluidos:\n" +
        "1️⃣ Para tu receta médica 📜\n" +
        "2️⃣ La doctora mantiene el otro 👩‍⚕️\n\n" +
        "¡Te garantizamos seguridad y calidad en cada paso! 👍💉💫"
    }
  };
}

// Botones tras info: ¿Duele?
export function RinoDueleButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "*¿Tienes dudas sobre si el procedimiento duele?*" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "duele_rino", title: "¿Duele?" } },
          { type: "reply", reply: { id: "agendar-cita", title: "Agendar cita 📅" } }
        ]
      }
    }
  };
}

// Respuesta a “¿Duele?”
export function RinoDueleMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "image",
    image: {
      link: "https://static.wixstatic.com/media/613bb7_25650eb8894f44ac8d4c19cd74636dd8~mv2.jpeg/v1/fill/w_600,h_750,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/WhatsApp%20Image%202025-04-15%20at%209_19_22%20PM%20(3).jpeg",
      caption:
        "💜 *Sabemos que es una preocupación común.*\n" +
        "🧴 Usamos anestesia en spray y en ungüento.\n" +
        "🤍 El tratamiento es tolerable, aunque depende de cada persona.\n" +
        "🙌 Muchos pacientes lo describen como *molestia leve* y rápida."
    }
  };
}

// Botones tras dolor: ¿Para quién está indicado?
export function RinoIndicacionButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "*¿Quieres saber si este procedimiento es adecuado para ti?*" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "indicacion_rino", title: "¿Para quién es? 👤" } }, // ✅ amigable y corto
          { type: "reply", reply: { id: "agendar-cita", title: "Agendar cita 📅" } }
        ]
      }
    }
  };
}

// Respuesta final: ¿Para quién está indicado?
export function RinoIndicacionMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "image",
    image: {
      link: "https://static.wixstatic.com/media/613bb7_c0cad605419747388ca1931ee9ae1ae6~mv2.jpeg/v1/fill/w_600,h_600,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/WhatsApp%20Image%202025-04-15%20at%209_19_22%20PM.jpeg",
      caption:
        "💡 *¿Para quién está indicada la rinomodelación?*\n\n" +
        "👉 Personas que desean:\n" +
        "✅ Perfilar su nariz sin cirugía\n" +
        "✅ Corregir pequeños detalles estéticos\n" +
        "✅ Realzar el rostro de manera segura\n" +
        "✅ Resultados inmediatos sin recuperación larga\n\n" +
        "❌ No recomendada para fracturas, desviaciones severas o problemas respiratorios funcionales."
    }
  };
}

/* =========================================================
   ⭐ BLOQUE NUEVO: MENSAJES ACADÉMICOS EDU-BOT
   (Aún no rompen nada, listos para usar en flujos nuevos)
========================================================= */

export function EduBotMotivationMessage(number) {
  return TextMessage(
    "💡 *Recordatorio rápido:*\n\n" +
      "No se trata de saberlo todo hoy, sino de avanzar un poco cada día. " +
      "Cada tarea que completas, cada clase a la que asistes y cada duda que resuelves, suma a tu futuro 📚✨.",
    number
  );
}

export function EduBotTaskHelpMessage(number) {
  return TextMessage(
    "📌 *Gestión de tareas*\n\n" +
      "Pronto podré ayudarte a registrar tus tareas, fechas de entrega y recordatorios.\n\n" +
      "Mientras tanto, puedes escribir algo como:\n" +
      `"Tarea de Física para el viernes" o "Recordar proyecto de Contabilidad" 📝`,
    number
  );
}

export function EduBotEmotionalSupportButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text:
          "🧠 *Acompañamiento emocional y motivacional*\n\n" +
          "Estudiar a veces puede ser pesado, cansado o frustrante.\n" +
          "¿Te gustaría recibir un consejo o un mensaje motivacional?"
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: "consejo", title: "Quiero un consejo 💬" }
          },
          {
            type: "reply",
            reply: { id: "regresar_menu", title: "Regresar al menú" }
          }
        ]
      }
    }
  };
}

export function EduBotTeacherContactButtonsMessage(number) {
  return {
    messaging_product: "whatsapp",
    to: number,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text:
          "👨‍🏫 *Contacto con docente*\n\n" +
          "Si tienes una duda específica sobre una materia, puedo ayudarte a enviar un mensaje al docente responsable."
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: "contactar_docente", title: "Escribir a mi docente ✉️" }
          },
          {
            type: "reply",
            reply: { id: "regresar_menu", title: "Regresar al menú" }
          }
        ]
      }
    }
  };
}
