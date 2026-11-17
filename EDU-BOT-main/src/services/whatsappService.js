// src/services/whatsappService.js
import sendToWhatsApp from "../services/httpRequest/sendToWhatsApp.js";

class WhatsAppService {
  // ----------------------------------------------------------------
  // Enviar un mensaje de texto simple o mensaje completo (si se pasa objeto)
  // ----------------------------------------------------------------
  async sendMessage(to, body, messageId) {
    let data;
    if (typeof body === 'object' && body.type) {
      // Se asume que "body" ya es un mensaje completo (por ejemplo, interactivo)
      data = body;
    } else {
      // Se envía un mensaje de texto simple
      data = {
        messaging_product: 'whatsapp',
        to,
        text: { body },
      };
    }

    return sendToWhatsApp(data);
  }

  // ----------------------------------------------------------------
  // Enviar botones interactivos (tipo 'button')
  // ----------------------------------------------------------------
  async sendInteractiveButtons(to, bodyText, buttons) {
    const data = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons,
        },
      },
    };

    await sendToWhatsApp(data);
  }

  // ----------------------------------------------------------------
  // Enviar media (imagen, audio, video o documento) usando LINK público
  // ----------------------------------------------------------------
  async sendMediaMessage(to, type, mediaUrl, caption) {
    const mediaObject = {};

    switch (type) {
      case 'image':
        mediaObject.image = { link: mediaUrl, caption };
        break;
      case 'audio':
        mediaObject.audio = { link: mediaUrl };
        break;
      case 'video':
        mediaObject.video = { link: mediaUrl, caption };
        break;
      case 'document':
        mediaObject.document = { link: mediaUrl, caption, filename: 'medpet-file.pdf' };
        break;
      default:
        throw new Error(`Not Supported Media Type: ${type}`);
    }

    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type,
      ...mediaObject,
    };

    await sendToWhatsApp(data);
  }

  // ----------------------------------------------------------------
  // Enviar media (imagen, audio, video o documento) usando MEDIA_ID
  // ----------------------------------------------------------------
  async sendMediaMessageById(to, type, mediaId, caption) {
    let mediaObject = {};
  
    switch (type) {
      case 'image':
        mediaObject.image = { id: mediaId, caption };
        break;
      case 'video':
        mediaObject.video = { id: mediaId, caption };
        break;
      case 'audio':
        mediaObject.audio = { id: mediaId };
        break;
      case 'document':
        mediaObject.document = { id: mediaId, caption };
        break;
      default:
        throw new Error(`Not Supported Media Type: ${type}`);
    }
  
    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type,
      ...mediaObject,
    };
  
    await sendToWhatsApp(data);
  }

  // ----------------------------------------------------------------
  // Marcar mensaje como leído
  // ----------------------------------------------------------------
  async markAsRead(messageId) {
    const data = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };

    await sendToWhatsApp(data);
  }

  // ----------------------------------------------------------------
  // Enviar contacto
  // ----------------------------------------------------------------
  async sendContactMessage(to, contact) {
    const data = {
      messaging_product: 'whatsapp',
      to,
      type: 'contacts',
      contacts: [contact],
    };

    await sendToWhatsApp(data);
  }

  // ----------------------------------------------------------------
  // Enviar ubicación
  // ----------------------------------------------------------------
  async sendLocationMessage(to, latitude, longitude, name, address) {
    const data = {
      messaging_product: 'whatsapp',
      to,
      type: 'location',
      location: {
        latitude,
        longitude,
        name,
        address
      }
    };
    
    await sendToWhatsApp(data);
  }
}

export default new WhatsAppService();
