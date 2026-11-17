import whatsappService from "../services/whatsappService.js";
import { TextMessage } from "../util.js";
import {
  findHomeworkByReminderMessageId,
  findOpenHomeworkReminderByPhone,
  recordHomeworkReminderResponse,
} from "../services/homeworkService.js";
import { parseHomeworkReminderAnswer } from "../services/homeworkReminder.js";

export function createHomeworkReminderResponseFlow({
  findById = findHomeworkByReminderMessageId,
  findOpenByPhone = findOpenHomeworkReminderByPhone,
  recordResponse = recordHomeworkReminderResponse,
  send = (phone, payload) => whatsappService.sendMessage(phone, payload),
} = {}) {
  return async function handleHomeworkReminderResponse(message, phone) {
    const reply =
      message?.interactive?.button_reply ||
      message?.button;
    if (!reply) return false;

    const answer = parseHomeworkReminderAnswer(
      reply.id,
      reply.title,
      reply.payload,
      reply.text
    );
    if (!answer) return false;

    let task = await findById(
      message.context?.id || message.context?.message_id
    );
    if (!task) task = await findOpenByPhone(phone);
    if (!task) return true;

    const saved = await recordResponse(task.rowIndex, answer);
    if (!saved) {
      await send(
        phone,
        TextMessage(
          "No pude guardar tu respuesta. Intenta responder nuevamente en unos minutos.",
          phone
        )
      );
      return true;
    }

    const confirmation =
      answer === "done"
        ? `✅ Listo. Marqué “${task.description}” como entregada.`
        : `📌 Entendido. “${task.description}” sigue pendiente y volveré a recordártela.`;

    await send(phone, TextMessage(confirmation, phone));
    return true;
  };
}

export const handleHomeworkReminderResponse =
  createHomeworkReminderResponseFlow();
