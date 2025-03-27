require('dotenv').config();
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

function formatPhoneNumber(phone) {
    phone = phone.replace(/[^\d+]/g, '');
    if (!phone.startsWith('+')) {
        phone = `+${phone}`;
    }
    return phone;
}

async function validatePhoneNumber(tel) {
    const phoneNumber = formatPhoneNumber(tel);

    const response = await client.lookups.v2.phoneNumbers(phoneNumber).fetch({ type: ['carrier'] });

    if (!response || !response.valid) {
        throw new Error(`Invalid phone number: ${phoneNumber}`);
    }

    console.log('twilio - response', response);

    return response.phoneNumber;
}

module.exports = { validatePhoneNumber, formatPhoneNumber };