require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const Donor = require('../models/Donor');
const { slugToString } = require('../modules/helpers');

const { saveLog } = require('./logAction');
const { logTemplates } = require('./logTemplates');
const { generateInvoice, saveFileRecord } = require('./invoice');
const { sendThankYouMailToCustomer } = require('./emails');
const { sendErrorToTelegram, sendTelegramMessage } = require('./telegramBot');
const { vippsStatusMap } = require('../modules/helpers');

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

async function getVippsSetupStatus(agreementId) {
    const token = await getVippsToken();
    const config = await vippsGetHeader(token);
    const url = `${process.env.VIPPS_API_URL}/recurring/v3/agreements/${agreementId}`;
    const response = await axios.get(url, config);
    if (response.status !== 200) {
        throw new Error('Error fetching setup status');
    }
    return response.data;
}

async function getVippsPaymentStatus(reference) {
    const token = await getVippsToken();
    const config = await vippsGetHeader(token);
    const url = `${process.env.VIPPS_API_URL}/epayment/v1/payments/${reference}`;
    const response = await axios.get(url, config);
    if (response.status !== 200) {
        throw new Error('Error fetching payment status');
    }
    return response.data;
}

const getVippsLatestCharge = async (orderId) => {
    const token = await getVippsToken();
    const headers = await vippsGetHeader(token);
    const dbOrder = (await Order.findById(orderId).lean()) || (await Subscription.findById(orderId).lean());
    const responseAgreement = await axios.get(
        `${process.env.VIPPS_API_URL}/recurring/v3/agreements/${dbOrder.vippsAgreementId}`,
        headers,
    );

    const responseCharges = await axios.get(
        `${process.env.VIPPS_API_URL}/recurring/v3/agreements/${dbOrder.vippsAgreementId}/charges`,
        headers,
    );
    const charges = responseCharges.data;

    if (!Array.isArray(charges) || charges.length === 0) {
        throw new Error('No charges found for this agreement.');
    }

    charges.sort((a, b) => new Date(b.due) - new Date(a.due));

    return charges[0];
};

const getVippsChargeNUserInfo = async (orderId) => {
    const token = await getVippsToken();
    const headers = await vippsGetHeader(token);
    const dbOrder = (await Order.findById(orderId).lean()) || (await Subscription.findById(orderId).lean());
    const responseAgreement = await axios.get(
        `${process.env.VIPPS_API_URL}/recurring/v3/agreements/${dbOrder.vippsAgreementId}`,
        headers,
    );

    const responseCharges = await axios.get(
        `${process.env.VIPPS_API_URL}/recurring/v3/agreements/${dbOrder.vippsAgreementId}/charges`,
        headers,
    );
    const charges = responseCharges.data;

    if (!Array.isArray(charges) || charges.length === 0) {
        throw new Error('No charges found for this agreement.');
    }

    charges.sort((a, b) => new Date(b.due) - new Date(a.due));

    const latestCharge = charges[0];
    let donor;

    if (!responseAgreement.data?.userinfoUrl) {
        console.log(charges);
        throw new Error('No donor found! - should not happen.');
    } else {
        try {
            const responseUserInfo = await axios.get(responseAgreement.data.userinfoUrl, headers);
            const user = responseUserInfo.data;
            donor = {
                firstName: user.given_name,
                lastName: user.family_name,
                name: `${user.given_name} ${user.family_name}`,
                email: user.email,
                tel: `+${user.phone_number}`,
                address: `${address.street_address}, ${address.postal_code}, ${address.region}, ${address.country}`,
                sub: user.sub,
                sid: user.sid,
            };
        } catch (error) {
            if (error.response?.data?.title === 'Not a valid session') {
                await sendTelegramMessage(`This is a recurring vipps charge for order ${dbOrder.orderNo} - fetching donor information from local database. We can't fetch donor info after 168 hours of charge has been occured.`);
            } else {
                await sendErrorToTelegram(error.response?.data || error.message || error);
            }
            const donorLocalInfo = await Donor.findOne({ vippsCustomerSub: responseAgreement.data.sub }).lean();
            if (!donorLocalInfo) {
                throw new Error(`Donor not found for sub: ${responseAgreement.data.sub} - strange`);
            }
            donor = {
                firstName: donorLocalInfo.firstName,
                lastName: donorLocalInfo.lastName,
                name: `${donorLocalInfo.firstName} ${donorLocalInfo.lastName}`,
                email: donorLocalInfo.email,
                tel: donorLocalInfo.tel,
                address: donorLocalInfo.address,
                sub: responseAgreement.data.sub,
                sid: donorLocalInfo.vippsCustomerId
            };
        }
    }
    return {
        order: latestCharge,
        donor,
    };
};

const getOrderChargesInVipps = async (orderId) => {
    const order = (await Order.findById(orderId).lean()) || (await Subscription.findById(orderId).lean());
    const donor = await Donor.findOne({ 'vippsCharges.externalId': order._id.toString() }).lean();

    const matchedCharges = donor?.vippsCharges?.filter((charge) => charge.externalId === order._id.toString()) || [];

    return matchedCharges;
};

const updateOrderWithCharge = async (orderId) => {
    const prevChargesTillDate = await getOrderChargesInVipps(orderId);
    const latestCharge = await getVippsLatestCharge(orderId);
    existingCharge = prevChargesTillDate.find((charge) => {
        return JSON.stringify(charge.history) === JSON.stringify(latestCharge.history);
    });

    if (existingCharge) {
        throw new Error('Charge already exists in the database - should not happen');
    }

    const statusFromVipps = latestCharge?.status?.toUpperCase();

    if (!statusFromVipps) {
        throw new Error('Status not found in Vipps response = this is important');
    }

    const resolveStatus = (status) => {
        for (const [appStatus, vippsStatuses] of Object.entries(vippsStatusMap)) {
            if (Array.isArray(vippsStatuses) && vippsStatuses.includes(status)) return appStatus;
            if (vippsStatuses === status) return appStatus;
        }
        throw new Error(`Unknown status from Vipps: ${status}`);
    };

    const resolvedStatus = resolveStatus(statusFromVipps);
    let finalStatus = resolvedStatus;

    if (prevChargesTillDate.length > 0) {
        if (resolvedStatus === 'aborted' || resolvedStatus === 'draft') {
            finalStatus = 'expired';
        }
    }

    await Order.updateOne({ _id: orderId }, { status: finalStatus });
    await Subscription.updateOne({ _id: orderId }, { status: finalStatus });

    sendTelegramMessage(`Got from Vipps: ${statusFromVipps} → Order status set to: ${finalStatus}`);
};

const getVippsOrderNUserInfo = async (orderId) => {
    const dbOrder = (await Order.findById(orderId).lean()) || (await Subscription.findById(orderId).lean());
    const token = await getVippsToken();
    const headers = await vippsGetHeader(token);
    const order = await axios.get(`${process.env.VIPPS_API_URL}/epayment/v1/payments/${dbOrder.vippsReference}`, headers);
    const sub = order?.data?.profile?.sub;
    const response = await axios.get(`${process.env.VIPPS_API_URL}/vipps-userinfo-api/userinfo/${sub}`, headers);
    const user = response.data;
    const address = user.address;
    const donor = {
        firstName: user.given_name,
        lastName: user.family_name,
        name: `${user.given_name} ${user.family_name}`,
        email: user.email,
        tel: `+${user.phone_number}`,
        address: `${address.street_address}, ${address.postal_code}, ${address.region}, ${address.country}`,
        sub: user.sub,
        sid: user.sid,
    };
    return {
        order: order.data,
        donor,
    };
};

const getVippsUserInfo = async (orderId) => {
    const token = await getVippsToken();
    const headers = await vippsGetHeader(token);
    const order = await axios.get(`${process.env.VIPPS_API_URL}/epayment/v1/payments/${orderId}`, headers);
    const sub = order?.data?.profile?.sub;
    const response = await axios.get(`${process.env.VIPPS_API_URL}/vipps-userinfo-api/userinfo/${sub}`, headers);
    const user = response.data;
    const address = user.address;
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

const updateDonorWithCharge = async (info) => {
    const donor = info.donor;
    const payment = info.order;
    let newPayment = false;
    let updatedDonor = await Donor.findOneAndUpdate(
        { email: donor.email?.toLowerCase(), 'vippsCharges.transactionId': payment.transactionId },
        { $set: { 'vippsCharges.$': payment } },
        { new: true },
    ).lean();

    if (!updatedDonor) {
        newPayment = true;
        updatedDonor = await Donor.findOneAndUpdate(
            { email: donor.email?.toLowerCase() },
            {
                $set: {
                    vippsCustomerId: donor.sid,
                    vippsCustomerSub: donor.sub,
                    firstName: donor.firstName,
                    lastName: donor.lastName,
                    tel: donor.tel,
                    address: donor.address,
                    organization: 'Not Listed',
                    anonymous: false,
                    countryCode: 'NO',
                    status: 'active',
                    role: 'donor',
                },
                $setOnInsert: { email: donor.email?.toLowerCase() },
                $push: { vippsCharges: payment },
            },
            { upsert: true, new: true },
        ).lean();
    }

    return {
        donor: updatedDonor,
        isNewPayment: newPayment,
    };
};

const updateDonorWithPayment = async (info) => {
    const donor = info.donor;
    const payment = info.order;
    let updatedDonor = await Donor.findOneAndUpdate(
        { email: donor.email?.toLowerCase(), 'vippsPayments.reference': payment.reference },
        { $set: { 'vippsPayments.$': payment } },
        { new: true },
    ).lean();

    if (!updatedDonor) {
        updatedDonor = await Donor.findOneAndUpdate(
            { email: donor.email?.toLowerCase() },
            {
                $set: {
                    vippsCustomerId: donor.sid,
                    vippsCustomerSub: donor.sub,
                    firstName: donor.firstName,
                    lastName: donor.lastName,
                    tel: donor.tel,
                    address: donor.address,
                    organization: 'Not Listed',
                    anonymous: false,
                    countryCode: 'NO',
                    status: 'active',
                    role: 'donor',
                },
                $setOnInsert: { email: donor.email?.toLowerCase() },
                $push: { vippsPayments: payment },
            },
            { upsert: true, new: true },
        ).lean();
    }

    return updatedDonor;
};

const captureVippsPayment = async (orderId) => {
    const order = (await Order.findById(orderId).lean()) || (await Subscription.findById(orderId).lean());
    const amount = order.total || order.totalCost;
    const token = await getVippsToken();
    const url = `https://api.vipps.no/epayment/v1/payments/${order.vippsReference}/capture`;
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
    let cleaned = input.replace(/\D+/g, '');

    if (input.startsWith('+47') || input.startsWith('47')) {
        cleaned = cleaned.replace(/^47/, '');
    }

    if (cleaned.length === 8 && /^[49]/.test(cleaned)) {
        cleaned = '47' + cleaned;
    }

    let regex = /^47[49]\d{7}$/;

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
        return res
            .status(401)
            .send('Unauthorized: Some hooks are missing credentials but its ok as I am getting some that are valid.');
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

const updateDonorAgreement = async (orderId) => {
    const order = (await Order.findById(orderId).lean()) || (await Subscription.findById(orderId).lean());
    if (!order) {
        throw new Error('Order not found - likely deleted being too old');
    }
    const customerId = order.customerId;
    const customer = await Customer.findById(customerId).lean();
    const donor = await Donor.findOne({ email: customer.email?.toLowerCase() });
    const token = await getVippsToken();
    const headers = await vippsGetHeader(token);
    const agreement = await axios.get(`${process.env.VIPPS_API_URL}/recurring/v3/agreements/${order.vippsAgreementId}`, headers);
    donor.vippsAgreements = donor.vippsAgreements || [];
    const index = donor.vippsAgreements.findIndex((a) => a.id === agreement.data.id);
    if (index !== -1) {
        const existingAgreement = donor.vippsAgreements[index];
        const newAgreement = agreement.data;
        if (existingAgreement.status !== newAgreement.status) {
            donor.vippsAgreements[index] = newAgreement;
        } else {
            sendTelegramMessage(`Agreement ${newAgreement.id} with status ${newAgreement.status} already exists for order ${order.orderNo}`);
            return true;
        }
    } else {
        donor.vippsAgreements.push(agreement.data);
    }
    await donor.save();
    sendTelegramMessage(
        `Donor agreement updated: \n\n ${customer.name} \n ${donor.tel} \n ${customer.email} \n Status: ${agreement.data.status}`,
    );
    return true;
};

const createRecurringCharge = async (orderId) => {
    try {
        const order = (await Order.findById(orderId).lean()) || (await Subscription.findById(orderId).lean());
        if (!order) {
            throw new Error(`Order ${order.orderNo} not found - strange`);
        }
        if (!order.monthlySubscription) {
            throw new Error(`Order ${order.orderNo} is not monthly subscription - strange`);
        }
        if (!order.vippsAgreementId) {
            throw new Error(`Order ${order.orderNo} do not have a vipps agreement id - strange`);
        }
        const token = await getVippsToken();
        const amount = (order.total || order.totalCostSingleMonth) * 100;
        const due = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const payload = {
            amount,
            transactionType: "DIRECT_CAPTURE",
            description: `${slugToString(order.projects?.[0]?.slug) || 'Order'} # ${order.orderNo}`,
            due,
            retryDays: 5,
            type: "RECURRING",
            orderId: uuidv4(),
            externalId: order._id.toString(),
        };
        const url = `${process.env.VIPPS_API_URL}/recurring/v3/agreements/${order.vippsAgreementId}/charges`;
        const config = await getConfig(url, payload, token);
        const response = await axios.request(config);
        console.log(response.data);
    } catch (error) {
        if (error.response) {
            console.error('Vipps API Error:', error.response.status);
            console.error('Response body:', error.response.data);
            sendErrorToTelegram(error.response.data);
        } else if (error.request) {
            console.error('No response from Vipps:', error.request);
            sendErrorToTelegram(error.request);
        } else {
            console.error('Error setting up request:', error.message);
            sendErrorToTelegram(error.message);
        }
    }

};

const makeVippsReceipt = async (orderId, products) => {
    const order = (await Order.findById(orderId).lean()) || (await Subscription.findById(orderId).lean());

    const receipt = {
        orderLines: [],
        bottomLine: {
            currency: 'NOK',
            receiptNumber: order.orderNo,
        },
    };

    for (const product of products) {
        for (const variant of product.variants) {
            if (variant.orderedCost > 0) {
                const totalAmount = Math.round(variant.orderedCost * 100); // in øre
                const totalTaxAmount = Math.round(((variant.orderedCost * 25) / 125) * 100); // in øre

                receipt.orderLines.push({
                    name: `${product.name} - ${variant.name}`,
                    id: variant.id,
                    totalAmount,
                    taxPercentage: 25,
                });
            }
        }
    }

    return receipt;
};

module.exports = {
    getVippsToken,
    getVippsUserInfo,
    getConfig,
    authVippsWebhook,
    validateAndFormatVippsNumber,
    generateRandomString,
    captureVippsPayment,
    updateDonorWithPayment,
    updateDonorWithCharge,
    getVippsPaymentStatus,
    getVippsSetupStatus,
    getVippsOrderNUserInfo,
    getVippsChargeNUserInfo,
    updateDonorAgreement,
    updateOrderWithCharge,
    makeVippsReceipt,
    createRecurringCharge,
};
