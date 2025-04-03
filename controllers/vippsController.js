require('dotenv').config();
const axios = require('axios');
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
} = require('../modules/vippsWebhookHandler');
const { sendErrorToTelegram, notifyTelegram, sendTelegramMessage } = require('../modules/telegramBot');
const {
    getVippsToken,
    getConfig,
    validateAndFormatVippsNumber,
    getVippsPaymentStatus,
} = require('../modules/vippsModules');

const projects = [
    'gaza-orphans',
    'alfalah-student-scholarship-2025',
    'fidya-kaffarah',
    'zakat',
    'street-child',
    'palestinian-students-scholarship-program',
    'gaza-relief-fund',
];

const handleVippsEvent = async (event, paymentId) => {
    const order = (await Subscription.findById(paymentId).lean()) || (await Order.findById(paymentId).lean());
    switch (event) {
        case 'CREATED':
            if (order.status === 'draft') return;
            await vippsPaymentCreated(paymentId);
            break;

        case 'ABORTED':
            if (order.status === 'aborted') return;
            await vippsPaymentAborted(paymentId);
            break;

        case 'EXPIRED':
            if (order.status === 'aborted') return;
            await vippsPaymentExpired(paymentId);
            break;

        case 'CANCELLED':
            if (order.status === 'cancelled') return;
            await vippsPaymentCancelled(paymentId);
            break;

        case 'CAPTURED':
            if (order.status === 'paid') return;
            await vippsPaymentCaptured(paymentId);
            break;

        case 'REFUNDED':
            if (order.status === 'refunded') return;
            await vippsPaymentRefunded(paymentId);
            break;

        case 'AUTHORIZED':
            if (order.status === 'authorized' || order.status === 'paid') return;
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
};

exports.vippsWebhook = async (req, res) => {
    try {
        const event = req.body.name || req.body.eventType;
        const paymentId = req.body.reference;
        const agreementId = 123;
        await handleVippsEvent(event, paymentId);
        res.status(200).send('Webhook received');
    } catch (error) {
        console.log(error);
        sendErrorToTelegram(error.message || error.data || error || 'Unknown error - check server logs');
        res.status(200).send('Webhook received, but with errors');
    }
};

exports.pollVippsPaymentIntent = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        let order =
        (await Order.findOne({
            _id: orderId,
            createdAt: { $gte: twoHoursAgo },
        }).lean()) ||
        (await Subscription.findOne({
            _id: orderId,
            createdAt: { $gte: twoHoursAgo },
        }).lean()); 
        if (!order) throw new Error('Order not found or too old');
        order.dashboardLink = process.env.CUSTOMER_PORTAL_URL;
        const payment = await getVippsPaymentStatus(orderId);
        const event = payment.state;
        await handleVippsEvent(event, orderId);
        order =
        (await Order.findOne({
            _id: orderId,
            createdAt: { $gte: twoHoursAgo },
        }).lean()) ||
        (await Subscription.findOne({
            _id: orderId,
            createdAt: { $gte: twoHoursAgo },
        }).lean()); 
        order.dashboardLink = process.env.CUSTOMER_PORTAL_URL;
        res.status(200).send(order);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message || 'Server error - could not get vipps polling status');
    }
};

exports.vippsPaymentStatusData = async(req,res) => {
    try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        const order =
            (await Order.findOne({
                _id: req.params.orderId,
                createdAt: { $gte: twoHoursAgo },
            }).lean()) ||
            (await Subscription.findOne({
                _id: req.params.orderId,
                createdAt: { $gte: twoHoursAgo },
            }).lean());

        order.dashboardLink = process.env.CUSTOMER_PORTAL_URL;
        res.status(200).send(order);
    } catch (err) {
        console.log(err);
        res.status(500).send(err.message || 'Server error - could not get vipps order status');
    }
}

exports.vippsPaymentStatus = async (req, res) => {
    try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const order =
            (await Order.findOne({
                _id: req.params.orderId,
                createdAt: { $gte: twoHoursAgo },
            }).lean()) ||
            (await Subscription.findOne({
                _id: req.params.orderId,
                createdAt: { $gte: twoHoursAgo },
            }).lean());
        res.status(200).render('vippsOrderStatus', {
            layout: 'main',
            data: {
                order,
                darkMode: true,
            },
        });
    } catch (err) {
        console.log(err);
        res.status(500).send(err.message || 'Server error - could not get vipps order status');
    }
};

exports.createVippsPaymentIntent = async (req, res) => {
    try {
        // throw new Error('testing error to check error is handled');
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
            returnUrl: `${process.env.CUSTOMER_PORTAL_URL}/vipps-payment-status/${order._id}`,
            userFlow: 'WEB_REDIRECT',
            profile: {
                scope: 'name phoneNumber email address',
            },
            paymentDescription: `${slugToString(order.projectSlug)} # ${order.orderNo}` || `Order - ${order.orderNo}`,
        });
        const token = await getVippsToken();
        const config = await getConfig(`${process.env.VIPPS_API_URL}/epayment/v1/payments`, data, token);
        const response = await axios.request(config);
        res.status(200).send({
            redirectUrl: response.data.redirectUrl,
            orderId: order._id,
        });
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
