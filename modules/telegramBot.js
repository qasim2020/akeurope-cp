require('dotenv').config();
const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const sendErrorToTelegram = async function (errorObj) {
    let errorMessage = JSON.stringify(errorObj, null, 2);

    if (errorMessage.length > 4000) {
        errorMessage = errorMessage.substring(0, 4000) + '... (truncated)';
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    return axios
        .post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: `🚨 *Error Alert* 🚨\n\n\`\`\`${errorMessage}\`\`\``,
            parse_mode: 'MarkdownV2',
        })
        .catch((err) => console.error('Failed to send Telegram message:', err));
};

const notifyTelegram = async (req, res, next) => {
    if (Object.keys(req.body).length > 0) {
        axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: `\`\`\`URL-with-Body: \n ${req.originalUrl} ${JSON.stringify(req.body, 0, 2)}\`\`\``,
            parse_mode: 'MarkdownV2',
        }).catch((err) => console.error('Failed to send Telegram message:', err));
    } else {
        axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: `\`\`\`URL: ${req.originalUrl}\`\`\``,
            parse_mode: 'MarkdownV2',
        }).catch((err) => console.error('Failed to send Telegram message:', err));
    }

    next();
};

module.exports = { sendErrorToTelegram, notifyTelegram };
