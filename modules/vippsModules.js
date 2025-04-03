require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const Donor = require('../models/Donor');

const { saveLog } = require('./logAction');
const { logTemplates } = require('./logTemplates');
const { generateInvoice, saveFileRecord } = require('./invoice');
const { sendThankYouMailToCustomer } = require('./emails');
const { sendErrorToTelegram } = require('./telegramBot');

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

const vippsGetHeader = (token) => {
    return {
        headers: {
            Authorization: `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': process.env.VIPPS_SUBSCRIPTION_KEY_PRIMARY,
            'Merchant-Serial-Number': process.env.VIPPS_MSN,
        },
    };
};

async function getVippsPaymentStatus(orderId) {
    const token = await getVippsToken();
    const config = await vippsGetHeader(token);
    const url = `${process.env.VIPPS_API_URL}/epayment/v1/payments/${orderId}`;
    const response = await axios.get(url, config);
    if (response.status !== 200) {
        throw new Error('Error fetching payment status');
    };
    return response.data;
}

const getVippsUserInfo = async (orderId) => {
    const token = await getVippsToken();
    const headers = await vippsGetHeader(token);
    const order = await axios.get(`${process.env.VIPPS_API_URL}/epayment/v1/payments/${orderId}`, headers);
    const sub = order?.data?.profile?.sub;
    const response = await axios.get(`${process.env.VIPPS_API_URL}/vipps-userinfo-api/userinfo/${sub}`, headers);
    const user = response.data;
    const address = user.address;
    console.log(user);
    return {
        firstName: user.given_name,
        lastName: user.family_name,
        email: user.email,
        tel: user.phone_number,
        address: `${address.street_address}, ${address.postal_code}, ${address.region}, ${address.country}`,
        sub: user.sub,
        sid: user.sid,
    };
};

const updateDonorProfile = async (donor) => {
    const updatedDonor = await Donor.findOneAndUpdate(
        { email: donor.email?.toLowerCase() },
        {
            $set: {
                vippsCustomerId: donor.sid,
                vippsCustomerSub: donor.sub,
                firstName: donor.firstName,
                lastName: donor.lastName,
                tel: donor.tel,
                organization: 'Not Listed',
                anonymous: false,
                countryCode: 'NO',
                status: 'active',
                role: 'donor',
            },
            $setOnInsert: { email: donor.email?.toLowerCase() },
        },
        { upsert: true, new: true },
    ).lean();

    return updatedDonor;
}

const captureVippsPayment = async (orderId) => {
    const order = (await Order.findById(orderId).lean()) || (await Subscription.findById(orderId).lean());
    const amount = order.total || order.totalCostSingleMonth;
    const token = await getVippsToken();
    const url = `https://api.vipps.no/epayment/v1/payments/${orderId}/capture`;
    const payload = {
        modificationAmount: {
            currency: order.currency,
            value: amount * 100,
        },
    };
    const config = await getConfig(url, payload, token);
    const response = await axios.request(config);
    return response;
};

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

module.exports = {
    getVippsToken,
    getVippsUserInfo,
    getConfig,
    authVippsWebhook,
    validateAndFormatVippsNumber,
    generateRandomString,
    captureVippsPayment,
    updateDonorProfile,
    getVippsPaymentStatus,
};
