require('dotenv').config();
const axios = require("axios");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function sendErrorToTelegram(errorObj) {
    let errorMessage = JSON.stringify(errorObj, null, 2); 

    if (errorMessage.length > 4000) {
        errorMessage = errorMessage.substring(0, 4000) + "... (truncated)";
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    return axios.post(url, {
        chat_id: TELEGRAM_CHAT_ID,
        text: `🚨 *Error Alert* 🚨\n\n\`\`\`${errorMessage}\`\`\``,
        parse_mode: "MarkdownV2" 
    }).catch(err => console.error("Failed to send Telegram message:", err));
}

module.exports = { sendErrorToTelegram };