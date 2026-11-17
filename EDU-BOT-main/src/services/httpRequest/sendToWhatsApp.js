import axios from "axios";
import config from '../../config/env.js';

const sendToWhatsApp = async (data, { throwOnError = false } = {}) => {
  const baseUrl = `https://graph.facebook.com/${config.API_VERSION}/${config.BUSINESS_PHONE}/messages`;
  const headers = {
    Authorization: `Bearer ${config.API_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios({
      method: 'POST',
      url: baseUrl,
      headers: headers,
      data,
      timeout: 15000,
    });

    return response.data; // ✅ Aquí estaba el error antes
  } catch (error) {
    console.error("❌ Error al enviar mensaje a WhatsApp:", error.response?.data || error.message);
    if (throwOnError) throw error;
  }
};

export default sendToWhatsApp;
