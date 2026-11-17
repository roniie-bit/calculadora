import config from '../config/env.js';
import messageHandler from '../services/messageHandler.js';
import { enqueuePhoneMessage } from '../services/phoneMessageQueue.js';

class WebhookController {
  handleIncoming(req, res) {
    const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
    const senderInfo = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];

    // Meta requires a quick acknowledgement. Process the message afterward so
    // slow external APIs never hold the webhook response open.
    res.sendStatus(200);

    if (message) {
      const phone = message.from || senderInfo?.wa_id || "desconocido";
      enqueuePhoneMessage(phone, () =>
        messageHandler.handleIncomingMessage(message, senderInfo)
      ).catch((error) => {
        console.error("❌ Error procesando mensaje en segundo plano:", error);
      });
    }
  }

  verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.WEBHOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
      console.log('Webhook verified successfully!');
    } else {
      res.sendStatus(403);
    }
  }
}

export default new WebhookController();
