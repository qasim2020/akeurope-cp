const axios = require('axios');
require('dotenv').config();

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const Donor = require('../models/Donor');
const Customer = require('../models/Customer');
const crypto = require('crypto');
const { slugToString } = require('../modules/helpers');

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
    vippsAgreementExpired,
    getVippsToken,
    validateAndFormatVippsNumber,
    getConfig,
} = require('../modules/vipps');
const { sendErrorToTelegram } = require('../modules/telegramBot');

exports.vippsWebhook = async (req, res) => {
    try {
        const event = req.body.name || req.body.eventType;
        const paymentId = req.body.reference;
        const agreementId = 123;

        switch (event) {
            case 'CREATED':
                await vippsPaymentCreated(req,res);
                break;

            case 'ABORTED':
                await vippsPaymentAborted(req,res);
                break;

            case 'EXPIRED':
                await vippsPaymentExpired(req,res);
                break;

            case 'CANCELLED':
                await vippsPaymentCancelled(req,res);
                break;

            case 'CAPTURED':
                await vippsPaymentCaptured(req,res);
                break;

            case 'REFUNDED':
                await vippsPaymentRefunded(req,res);
                break;

            case 'AUTHORIZED':
                await vippsPaymentAuthorized(req,res);
                break;

            case 'TERMINATED':
                await vippsPaymentTerminated(req,res);
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
        console.log(error.message || error.data || error || 'Unknown error - check server logs');
        sendErrorToTelegram(error.message || error.data || error || 'Unknown error - check server logs');
        res.status(200).send('Webhook received, but with errors');
    }
};

exports.vippsPaymentSuccessful = async (req, res) => {
    res.status(200).send('Payment received, thank you!');
};

const projects = [
    'gaza-orphans',
    'alfalah-student-scholarship-2025',
    'fidya-kaffarah',
    'zakat',
    'street-child',
    'palestinian-students-scholarship-program',
    'gaza-relief-fund',
];

exports.createVippsPaymentIntent = async (req, res) => {
    try {

        const { total, currency, project: slug } = req.body;
        if (!(process.env.ENV === 'test') && total < 10) throw new Error('Order cost can not be lower than 10 NOK.');
        if (currency != 'NOK') throw new Error('Vipps works for Norway only.');
        if (!projects.includes(slug)) throw new Error('Project is not listed.');

        let order = new Subscription({
            customerId: process.env.TEMP_CUSTOMER_ID,
            currency: 'NOK',
            total,
            totalAllTime: total,
            monthlySubscription: false,
            countryCode: 'NO',
            projectSlug: slug,
            status: 'draft',
        });

        await order.save();

        let data = JSON.stringify({
            amount: {
                currency: 'NOK',
                value: total * 100,
            },
            paymentMethod: {
                type: 'WALLET',
            },
            reference: order._id.toString(),
            returnUrl: `${process.env.CUSTOMER_PORTAL_URL}/login?token=1234`,
            userFlow: 'WEB_REDIRECT',
            profile: {
                scope: 'name phoneNumber email address',
            },
            paymentDescription: `${slugToString(order.projectSlug)} # ${order.orderNo}` || `Order - ${order.orderNo}`,
        });

        const token = await getVippsToken();
        const config = await getConfig(`${process.env.VIPPS_API_URL}/epayment/v1/payments`, data, token);
        const response = await axios.request(config);

        res.status(200).send(response.data.redirectUrl);

        // required for POSTMAN
        // res.status(200).send({
        //     token,
        //     url: response.data.redirectUrl,
        // });
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message);
    }
};

exports.createVippsSetupIntent = async (req, res) => {
    try {
        const { total, currency, project: slug } = req.body;
        if (!(process.env.ENV === 'test') && total < 10) throw new Error('Order cost can not be lower than 10 NOK.');
        if (currency != 'NOK') throw new Error('Vipps works for Norway only.');
        if (!projects.includes(slug)) throw new Error('Project is not listed.');

        let order = new Subscription({
            customerId: process.env.TEMP_CUSTOMER_ID,
            currency: 'NOK',
            total,
            totalAllTime: total,
            monthlySubscription: true,
            countryCode: 'NO',
            projectSlug: slug,
            status: 'draft',
        });

        await order.save();

        const payload = {
            pricing: {
                type: 'LEGACY',
                amount: order.total * 100,
                currency: 'NOK',
            },
            interval: {
                unit: 'MONTH',
                count: 1,
            },
            merchantRedirectUrl: process.env.CUSTOMER_PORTAL_URL,
            merchantAgreementUrl: process.env.CUSTOMER_PORTAL_URL,
            productName: `${slugToString(slug)} # ${order.orderNo}`,
            phoneNumber: process.env.ENV === 'test' ? validateAndFormatVippsNumber(process.env.VIPPS_TEST_NO) : null,
            scope: 'name phoneNumber email address',
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
