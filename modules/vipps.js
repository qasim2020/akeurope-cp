require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');

function generateRandomString(length = 32) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';
    return Array.from(crypto.randomFillSync(new Uint8Array(length)))
        .map((byte) => chars[byte % chars.length])
        .join('');
}

async function getVippsToken() {
    try {
        const response = await axios.post(
            `${process.env.VIPPS_API_URL}/accesstoken/get`,
            {},
            {
                headers: {
                    'Content-Type': 'application/json',
                    client_id: process.env.VIPPS_CLIENT_ID,
                    client_secret: process.env.VIPPS_CLIENT_SECRET,
                    'Ocp-Apim-Subscription-Key': process.env.VIPPS_SUBSCRIPTION_KEY_PRIMARY,
                    'Merchant-Serial-Number': process.env.VIPPS_MSN,
                },
            },
        );
        return response.data.access_token;
    } catch (error) {
        console.log(error);
        throw new Error('Could not get vipps token');
    }
}

function validateAndFormatVippsNumber(input) {
    let cleaned = input.replace(/\D+/g, ''); // Remove all non-numeric characters

    if (input.startsWith('+47') || input.startsWith('47')) {
        cleaned = cleaned.replace(/^47/, ''); // Remove leading 47 if already present
    }

    if (cleaned.length === 8 && /^[49]/.test(cleaned)) {
        cleaned = '47' + cleaned; // Ensure it starts with 47
    }

    let regex = /^47[49]\d{7}$/; // Must start with 47, followed by 4 or 9, then 7 more digits

    return regex.test(cleaned) ? cleaned : false;
}

const authVippsWebhook = (req, res, next) => {
    const headers = req.headers;
    const receivedSignature = headers['authorization'];

    if (!receivedSignature) {
        return res.status(401).send('Missing Vipps signature');
    }

    const secret = process.env.VIPPS_WEBHOOK_SECRET;
    const method = req.method;
    const pathAndQuery = req.originalUrl;
    const xMsDate = headers['x-ms-date'];
    const xMsContentSha256 = headers['x-ms-content-sha256'];
    const host = headers['host'];

    const expectedSignedString = `${method}\n` + `${pathAndQuery}\n` + `${xMsDate};${host};${xMsContentSha256}`;

    const computedSignature = crypto.createHmac('sha256', secret).update(expectedSignedString).digest('base64');

    const expectedAuth = `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${computedSignature}`;
    const receivedSignatureValue = receivedSignature.trim();

    if (expectedAuth === receivedSignatureValue) {
        console.log('Webhook authenticated successfully');
        return next();
    } else {
        console.log('Invalid Vipps signature');
        return res.status(401).send('Unauthorized');
    }
};

const getConfig = async (url, payload, token) => {
    const idempotencyKey = uuidv4();

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': process.env.VIPPS_SUBSCRIPTION_KEY_PRIMARY,
            'Merchant-Serial-Number': process.env.VIPPS_MSN,
            'Idempotency-Key': idempotencyKey,
            'Vipps-System-Name': 'partner',
            'Vipps-System-Version': '1.0.0',
            'Vipps-System-Plugin-Name': 'partner-portal',
            'Vipps-System-Plugin-Version': '1.0.0',
            Cookie: 'fpc=AjRCPJ45oFNNilsI1xXCSK9_jNOOAwAAAPNiaN8OAAAA; stsservicecookie=estsfd; x-ms-gateway-slice=estsfd',
        },
        data: payload,
    };

    return config;
};
const vippsGetHeader = (token) => {
    return {
        headers: {
            Authorization: `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': process.env.VIPPS_SUBSCRIPTION_KEY_PRIMARY,
            'Merchant-Serial-Number': process.env.VIPPS_MSN,
        },
    };
};

const getVippsOneTimePaymentDetails = async (reference) => {
    
    return response.data;
};

const getVippsUserDetails = async (sub) => {
    return response.data;
};

const getUserInfo = async (sub) => {
    const token = await getVippsToken();
    const headers = await vippsGetHeader(token);
    const user = await axios.get(`${process.env.VIPPS_API_URL}/vipps-userinfo-api/userinfo/${sub}`, headers);
    console.log(user); 
}

const saveUserInfo = async (body) => {
    console.log('save user info now');
    const token = await getVippsToken();
    const headers = await vippsGetHeader(token);
    const order = await axios.get(`${process.env.VIPPS_API_URL}/epayment/v1/payments/${body.reference}`, headers);
    const sub = order?.data?.profile?.sub;
    console.log(sub);
    // const user = await axios.get(`${process.env.VIPPS_API_URL}/vipps-userinfo-api/${sub}`, headers);
    // console.log(user);
};

const vippsPaymentCreated = async (req, res) => {
    console.log(`Payment created: ${JSON.stringify(req.body, 0, 2)}`);
    // Implement your logic, e.g., update database
};

const deleteVippsOrder = async (orderId) => {
    const sub = await Subscription.deleteOne({ _id: orderId });
    const order = await Order.deleteOne({ _id: orderId });
    console.log(sub, order);
};

const vippsPaymentAborted = async (req, res) => {
    console.log(`Payment aborted: ${req.body.reference}`);
    deleteVippsOrder(req.body.reference);
};

const vippsPaymentExpired = async (req, res) => {
    console.log(`Payment expired: ${JSON.stringify(req.body, 0, 2)}`);
    // Implement logic
    deleteVippsOrder(req.body.reference);
};

const vippsPaymentCancelled = async (req, res) => {
    console.log(`Payment cancelled: ${JSON.stringify(req.body, 0, 2)}`);
    deleteVippsOrder(req.body.reference);
};

const vippsPaymentCaptured = async (req, res) => {
    console.log(`Payment captured: ${JSON.stringify(req.body, 0, 2)}`);
    // Implement logic
};

const vippsPaymentRefunded = async (req, res) => {
    console.log(`Payment refunded: ${JSON.stringify(req.body, 0, 2)}`);
    // Implement logic
};

const vippsPaymentAuthorized = async (req, res) => {
    console.log(`Payment authorized: ${JSON.stringify(req.body, 0, 2)}`);
    await saveUserInfo(req.body);
    // Implement logic
};

const vippsPaymentTerminated = async (req, res) => {
    console.log(`Payment terminated: ${JSON.stringify(req.body, 0, 2)}`);
    // Implement logic
};

const vippsAgreementActivated = async (agreementId) => {
    console.log(`Agreement activated: ${agreementId}`);
};

const vippsAgreementRejected = async (agreementId) => {
    console.log(`Agreement rejected: ${agreementId}`);
};

const vippsAgreementStopped = async (agreementId) => {
    console.log(`Agreement stopped: ${agreementId}`);
};

const vippsAgreementExpired = async (agreementId) => {
    console.log(`Agreement expired: ${agreementId}`);
};

module.exports = {
    authVippsWebhook,
    vippsPaymentCreated,
    vippsPaymentAborted,
    vippsPaymentExpired,
    vippsPaymentCancelled,
    vippsPaymentCaptured,
    vippsPaymentRefunded,
    vippsPaymentAuthorized,
    vippsPaymentTerminated,
    vippsAgreementActivated,
    vippsAgreementRejected,
    vippsAgreementStopped,
    vippsAgreementExpired,
    validateAndFormatVippsNumber,
    getVippsToken,
    getConfig,
    getUserInfo,
};
