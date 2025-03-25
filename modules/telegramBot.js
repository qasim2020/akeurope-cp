require('dotenv').config();
const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const sendErrorToTelegram = async function (errorObj) {
    let errorMessage;

    // Check if errorObj is an object, then stringify
    if (typeof errorObj === 'object' && errorObj !== null) {
        errorMessage = JSON.stringify(errorObj, null, 2);

        if (errorMessage.length > 4000) {
            errorMessage = errorMessage.substring(0, 4000) + '... (truncated)';
        }

        // Apply Markdown formatting if it's an object
        errorMessage = `🚨 *Error Alert* 🚨\n\n\`\`\`${errorMessage}\`\`\``;
    } else {
        // If it's not an object, just convert it to string and avoid Markdown
        errorMessage = `🚨 *Error Alert* 🚨\n\n*${String(errorObj)}*`;
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    return axios
        .post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: errorMessage,
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

const escapeMarkdown = (text) => {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
};

const notifyTelegramStripe = async (req, res, next) => {
    try {
        const rawBody = req.body.toString();
        const event = JSON.parse(rawBody);

        const message = `🔔 *Stripe Webhook Received*\n\n` +
            `🔹 *Url:* ${req.originalUrl}\n` +
            `🔹 *Type:* ${event.type}\n` +
            `🔹 *ID:* ${escapeMarkdown(event.id)}\n` +
            `🔹 *Created:* ${escapeMarkdown(new Date(event.created * 1000).toUTCString())}`;

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        });

        next();
    } catch (err) {
        console.error('Error in Stripe Webhook Middleware:', err);
        res.status(500).send('Error processing webhook');
    }
};

const sendTelegramMessage = async (message) => {
    try {
        const formattedMessage = `📢 *Notification*\n\n${message}`;

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: formattedMessage,
            parse_mode: 'Markdown'
        });
    } catch (err) {
        console.error('Error sending Telegram message:', err);
    }
};


module.exports = { sendErrorToTelegram, notifyTelegram, notifyTelegramStripe, sendTelegramMessage };