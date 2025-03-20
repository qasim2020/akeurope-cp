const axios = require('axios');
require('dotenv').config();

const { v4: uuidv4 } = require('uuid');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const Donor = require('../models/Donor');
const Customer = require('../models/Customer');
const crypto = require('crypto');

const {
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
    vippsAgreementExpired
} = require("../modules/vipps");


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

exports.vippsWebhook = async (req, res) => {
    try {
        const event = req.body.name || req.body.eventType;
        const paymentId = 123;
        const agreementId = 123;

        console.log({event});
        
        switch (event) {
            case 'CREATED':
                await vippsPaymentCreated(paymentId);
                break;

            case 'ABORTED':
                await vippsPaymentAborted(paymentId);
                break;

            case 'EXPIRED':
                await vippsPaymentExpired(paymentId);
                break;

            case 'CANCELLED':
                await vippsPaymentCancelled(paymentId);
                break;

            case 'CAPTURED':
                await vippsPaymentCaptured(paymentId);
                break;

            case 'REFUNDED':
                await vippsPaymentRefunded(paymentId);
                break;

            case 'AUTHORIZED':
                await vippsPaymentAuthorized(paymentId);
                break;

            case 'TERMINATED':
                await vippsPaymentTerminated(paymentId);
                break;

            case 'ACTIVATED':
                await vippsAgreementActivated(agreementId);
                break;

            case 'recurring.agreement-rejected.v1':
                await vippsAgreementRejected(agreementId);
                break;

            case 'recurring.agreement-stopped.v1':
                await vippsAgreementStopped(agreementId);
                break;

            case 'recurring.agreement-expired.v1':
                await vippsAgreementExpired(agreementId);
                break;

            default:
                console.log(`Unhandled event: ${event}`);
        }

        res.status(200).send('Webhook received');
    } catch (error) {
        console.log(error);
        res.status(200).send('Webhook received, but with errors');
    }
};

exports.vippsPaymentSuccessful = async (req, res) => {
    res.status(200).send('Payment received, thank you!');
};

exports.createVippsPaymentIntent = async (req, res) => {
    try {
        const { orderId, email } = req.params;
        const order = (await Order.findById(orderId).lean()) || (await Subscription.findById(orderId).lean());
        if (!order) throw new Error('Order/ Record Not Found!');
        const donor = (await Donor.findOne({ email }).lean()) || (await Customer.findOne({ email }).lean());
        if (!donor) throw new Error('Donor not found');
        const amount = order.total || order.totalCost;

        let data = JSON.stringify({
            amount: {
                currency: 'NOK',
                value: amount * 100,
            },
            paymentMethod: {
                type: 'WALLET',
            },
            customer: {
                phoneNumber: validateAndFormatVippsNumber(donor.tel),
            },
            reference: generateRandomString(32), // order._id.toString(),
            returnUrl: `${process.env.CUSTOMER_PORTAL_URL}/vipps-payment-successful`,
            userFlow: 'WEB_REDIRECT',
            paymentDescription: `Order - ${order.orderNo}` || `${slugToString(order.projectSlug)} # ${order.orderNo}`,
        });

        console.log(data);

        const token = await getVippsToken();
        const config = await getConfig(`${process.env.VIPPS_API_URL}/epayment/v1/payments`, data, token);
        const response = await axios.request(config);

        res.status(200).send({
            token,
            url: response.data.redirectUrl,
        });
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message);
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

exports.createVippsSetupIntent = async (req, res) => {
    try {
        const { orderId, email } = req.params;
        const order = (await Order.findById(orderId).lean()) || (await Subscription.findById(orderId).lean());
        if (!order) throw new Error('Order/ Record Not Found!');
        const donor = (await Donor.findOne({ email }).lean()) || (await Customer.findOne({ email }).lean());
        if (!donor) throw new Error('Donor not found');
        const amount = order.total || order.totalCost;

        const payload = {
            pricing: {
                type: 'LEGACY',
                amount: amount * 100,
                currency: order.currency,
            },
            interval: {
                unit: 'MONTH',
                count: 1,
            },
            merchantRedirectUrl: 'https://local.akeurope.org',
            merchantAgreementUrl: 'https://local.akeurope.org',
            phoneNumber: validateAndFormatVippsNumber(donor.tel),
            productName: `Order # ${order.orderNo}`,
            scope: 'name phoneNumber email',
            externalId: order._id.toString(),
        };

        const token = await getVippsToken();
        const config = await getConfig(`${process.env.VIPPS_API_URL}/recurring/v3/agreements`, payload, token);
        const response = await axios.request(config);
        res.status(200).send(response.data.vippsConfirmationUrl);
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message);
    }
};

async function getVippsPaymentStatus(orderId) {
    const token = await getVippsToken();
    const response = await axios.get(`${process.env.VIPPS_API_URL}/ecomm/v2/payments/${orderId}/details`, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': process.env.VIPPS_SUBSCRIPTION_KEY,
            'Idempotency-Key': idempotencyKey,
            'Merchant-Serial-Number': process.env.VIPPS_MSN,
        },
    });
    return response.data;
}

async function chargeVippsSubscription(agreementId, amount) {
    const token = await getVippsToken();
    const payload = {
        merchantSerialNumber: process.env.VIPPS_MSN,
        charge: {
            amount: amount * 100,
            currency: 'NOK',
            description: 'Monthly Donation',
        },
    };

    const response = await axios.post(`${process.env.VIPPS_API_URL}/recurring/v2/agreements/${agreementId}/charges`, payload, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': process.env.VIPPS_SUBSCRIPTION_KEY,
            'Content-Type': 'application/json',
        },
    });

    return response.data;
}
