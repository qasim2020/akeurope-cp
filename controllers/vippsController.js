require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const Donor = require('../models/Donor');
const Customer = require('../models/Customer');
const crypto = require('crypto');
const { slugToString, vippsStatusMap: statusMap } = require('../modules/helpers');

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
    vippsAgreementPending,
    vippsAgreementExpired,
    vippsChargeCanceled,
    vippsChargeCaptured,
    vippsChargeFailed,
    vippsChargeCreationFailed,
    vippsChargeReserved,
} = require('../modules/vippsWebhookHandler');

const { sendErrorToTelegram, notifyTelegram, sendTelegramMessage } = require('../modules/telegramBot');
const {
    getVippsToken,
    getConfig,
    validateAndFormatVippsNumber,
    getVippsPaymentStatus,
    getVippsSetupStatus,
    makeVippsReceipt,
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
    const agreementId = paymentId;
    switch (event) {
        case 'CREATED':
            if (order.status === 'draft') throw new Error(`Vipps Event: order already  ${order.status}`);
            await vippsPaymentCreated(paymentId);
            break;

        case 'ABORTED':
        case 'EXPIRED':
        case 'CANCELLED':
            if (order.status === 'aborted') throw new Error(`Vipps Event: order already  ${order.status}`);
            await vippsPaymentAborted(paymentId);
            break;

        case 'CAPTURED':
            if (order.status === 'paid') throw new Error(`Vipps Event: order already  ${order.status}`);
            await vippsPaymentCaptured(paymentId);
            break;

        case 'REFUNDED':
            if (order.status === 'refunded') throw new Error(`Vipps Event: order already  ${order.status}`);
            await vippsPaymentRefunded(paymentId);
            break;

        case 'AUTHORIZED':
            if (order.status === 'authorized' || order.status === 'paid')
                throw new Error(`Vipps Event: order already  ${order.status}`);
            await vippsPaymentAuthorized(paymentId);
            break;

        case 'TERMINATED':
            await vippsPaymentTerminated(paymentId);
            break;

        case 'PENDING':
            if (order.status === 'draft') throw new Error(`Vipps Event: order already  ${order.status}`);
            await vippsAgreementPending(agreementId);
            break;

        case 'recurring.agreement-activated.v1':
        case 'ACTIVATED':
        case 'ACTIVE':
            await vippsAgreementActivated(agreementId);
            break;

        case 'recurring.agreement-rejected.v1':
        case 'REJECTED':
            await vippsAgreementRejected(agreementId);
            break;

        case 'recurring.agreement-stopped.v1':
        case 'STOPPED':
            await vippsAgreementStopped(agreementId);
            break;

        case 'recurring.agreement-expired.v1':
        case 'EXPIRED':
            await vippsAgreementExpired(agreementId);
            break;

        case 'recurring.charge-reserved.v1':
            await vippsChargeReserved(agreementId);
            break;

        case 'recurring.charge-captured.v1':
            await vippsChargeCaptured(agreementId);
            break;

        case 'recurring.charge-canceled.v1':
            await vippsChargeCanceled(agreementId);
            break;

        case 'recurring.charge-failed.v1':
            await vippsChargeFailed(agreementId);
            break;

        case 'recurring.charge-creation-failed.v1':
            await vippsChargeCreationFailed(agreementId);
            break;

        default:
            console.log(`Unhandled event: ${event}`);
    }
};

exports.getVippsToken = async (req, res) => {
    try {
        const token = await getVippsToken();
        res.status(200).send(token);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message || 'Server error - could not get vipps token');
    }
};

exports.vippsWebhook = async (req, res) => {
    try {
        const event = req.body.name || req.body.eventType;
        let paymentId;
        if (req.body.reference) {
            const order =
                (await Order.findOne({ vippsReference: req.body.reference }).lean()) ||
                (await Subscription.findOne({ vippsReference: req.body.reference }).lean());
            if (!order) {
                const body = JSON.stringify(req.body, null, 2);
                throw new Error(`Order not found for reference: ${req.body.reference} - \n\n ${body}`);
            } 
            paymentId = order._id;
        } else if (req.body.agreementExternalId) {
            paymentId = req.body.agreementExternalId;
        } else if (req.body.chargeExternalId) {
            paymentId = req.body.chargeExternalId;
        }
        if (!paymentId) {
            console.log(req.body);
            throw new Error(`PaymentId was not found:- \n\n ${JSON.stringify(req.body, null, 2)}`);
        }
        await handleVippsEvent(event, paymentId);
        res.status(200).send('Webhook received');
    } catch (error) {
        console.log(error);
        sendErrorToTelegram(error.message || error.data || error || 'Unknown error - check server logs');
        res.status(200).send('Webhook received, but with errors');
    }
};

exports.vippsPaymentStatusData = async (req, res) => {
    try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const order =
            (await Order.findOne({ _id: req.params.orderId, createdAt: { $gte: twoHoursAgo } }).lean()) ||
            (await Subscription.findOne({ _id: req.params.orderId, createdAt: { $gte: twoHoursAgo } }).lean());
        order.dashboardLink = process.env.CUSTOMER_PORTAL_URL;
        res.status(200).send(order);
    } catch (err) {
        console.log(err);
        res.status(500).send(err.message || 'Server error - could not get vipps order status');
    }
};

exports.vippsSetupStatusData = async (req, res) => {
    try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const order =
            (await Order.findOne({ _id: req.params.orderId, createdAt: { $gte: twoHoursAgo } }).lean()) ||
            (await Subscription.findOne({ _id: req.params.orderId, createdAt: { $gte: twoHoursAgo } }).lean());
        if (!order) throw new Error('Order not found or too old - refresh browser and try again.');
        order.dashboardLink = process.env.CUSTOMER_PORTAL_URL;
        res.status(200).send(order);
    } catch (err) {
        console.log(err);
        res.status(500).send(err.message || 'Server error - could not get vipps order status');
    }
};

exports.vippsSetupStatus = async (req, res) => {
    try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const order =
            (await Order.findOne({ _id: req.params.orderId, createdAt: { $gte: twoHoursAgo } }).lean()) ||
            (await Subscription.findOne({ _id: req.params.orderId, createdAt: { $gte: twoHoursAgo } }).lean());
        res.status(200).render('vippsSetupStatus', {
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
        res.status(200).render('vippsPaymentStatus', {
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
        const { total, currency, project: slug } = req.body;
        if (!(process.env.ENV === 'test') && total < 10) throw new Error('Order cost can not be lower than 10 NOK.');
        if (currency != 'NOK') throw new Error('Vipps works for Norway only.');
        if (!projects.includes(slug)) throw new Error('Project is not listed.');
        const cloudflareIp = req.headers['cf-connecting-ip'];
        let order = new Subscription({
            customerId: process.env.TEMP_CUSTOMER_ID,
            currency: 'NOK',
            total,
            totalAllTime: total,
            monthlySubscription: false,
            countryCode: 'NO',
            projectSlug: slug,
            status: 'draft',
            cloudflareIp,
        });
        const reference = uuidv4();
        order.vippsReference = reference;
        await order.save();
        let data = JSON.stringify({
            amount: {
                currency: 'NOK',
                value: total * 100,
            },
            paymentMethod: {
                type: 'WALLET',
            },
            reference,
            returnUrl: `${process.env.CUSTOMER_PORTAL_URL}/vipps-payment-status/${order._id}`,
            userFlow: 'WEB_REDIRECT',
            profile: {
                scope: 'name phoneNumber email address',
            },
            paymentDescription: `${slugToString(order.projectSlug)} # ${order.orderNo}`,
        });
        const token = await getVippsToken();
        const config = await getConfig(`${process.env.VIPPS_API_URL}/epayment/v1/payments`, data, token);
        const response = await axios.request(config);
        res.status(200).send({
            redirectUrl: response.data.redirectUrl,
            reference,
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
        const cloudflareIp = req.headers['cf-connecting-ip'];
        let order = new Subscription({
            customerId: process.env.TEMP_CUSTOMER_ID,
            currency: 'NOK',
            total,
            totalAllTime: total,
            monthlySubscription: true,
            countryCode: 'NO',
            projectSlug: slug,
            cloudflareIp,
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
            merchantRedirectUrl: `${process.env.CUSTOMER_PORTAL_URL}/vipps-setup-status/${order._id}`,
            merchantAgreementUrl: `${process.env.CUSTOMER_PORTAL_URL}/vipps-setup-status/${order._id}`,
            productName: `${slugToString(slug)} # ${order.orderNo}`,
            phoneNumber: null,
            scope: 'name phoneNumber email address',
            externalId: order._id.toString(),
            initialCharge: {
                amount: order.total * 100,
                description: `${slugToString(slug)} # ${order.orderNo}`,
                transactionType: 'DIRECT_CAPTURE',
                orderId: order._id.toString(),
                externalId: order._id.toString(),
            },
        };
        const token = await getVippsToken();
        const config = await getConfig(`${process.env.VIPPS_API_URL}/recurring/v3/agreements`, payload, token);
        const response = await axios.request(config);
        await Subscription.findByIdAndUpdate(order._id, {
            vippsAgreementId: response.data.agreementId,
            status: 'draft',
        });
        res.status(200).send({
            redirectUrl: response.data.vippsConfirmationUrl,
            orderId: order._id,
            agreementId: response.data.agreementId,
        });
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message);
    }
};

exports.createVippsPaymentIntentWidget = async (req, res) => {
    try {
        const { orderId } = req.body;

        let order = await Order.findOne({ _id: orderId, customerId: process.env.TEMP_CUSTOMER_ID });

        if (!order) throw new Error('Order not found');

        if (order.currency != 'NOK') throw new Error('Vipps works for Norway only.');

        const amount = Math.max(100, Math.round(order.totalCost * 100));

        const projectNames = order.projects.map(proj => slugToString(proj.slug)).join(', ');

        const reference = uuidv4();
        order.vippsReference = reference;
        await order.save();

        let data = JSON.stringify({
            amount: {
                currency: 'NOK',
                value: amount,
            },
            paymentMethod: {
                type: 'WALLET',
            },
            reference,
            returnUrl: `${process.env.CUSTOMER_PORTAL_URL}/vipps-payment-status/${order._id}`,
            userFlow: 'WEB_REDIRECT',
            profile: {
                scope: 'name phoneNumber email address',
            },
            paymentDescription: `${projectNames} # ${order.orderNo}`,
        });
        const token = await getVippsToken();
        const config = await getConfig(`${process.env.VIPPS_API_URL}/epayment/v1/payments`, data, token);
        const response = await axios.request(config);

        res.status(200).send({
            redirectUrl: response.data.redirectUrl,
            reference,
        });
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message);
    }
};

exports.createVippsPaymentIntentProduct = async (req, res) => {
    try {
        const { orderId } = req.body;

        let order = await Subscription.findOne({ _id: orderId, customerId: process.env.TEMP_CUSTOMER_ID });

        if (!order) throw new Error('Order is deleted after 1 hour - please refresh the page and try again.');

        if (order.currency != 'NOK') throw new Error('Vipps works for Norway only.');

        const amount = Math.max(100, Math.round(order.total * 100));

        const reference = uuidv4();
        order.vippsReference = reference;
        
        await order.save();

        let data = JSON.stringify({
            amount: {
                currency: 'NOK',
                value: amount,
            },
            paymentMethod: {
                type: 'WALLET',
            },
            reference,
            returnUrl: `${process.env.CUSTOMER_PORTAL_URL}/vipps-payment-status/${order._id}`,
            userFlow: 'WEB_REDIRECT',
            profile: {
                scope: 'name phoneNumber email address',
            },
            paymentDescription: `Qurbani 2025`,
            receipt: await makeVippsReceipt(orderId, order.products)
        });
        const token = await getVippsToken();
        const config = await getConfig(`${process.env.VIPPS_API_URL}/epayment/v1/payments`, data, token);
        const response = await axios.request(config);

        res.status(200).send({
            redirectUrl: response.data.redirectUrl,
            reference,
        });
    } catch (error) {
        if (error.response) {
            console.error('Vipps API Error:', error.response.status);
            console.error('Response body:', error.response.data);
        } else if (error.request) {
            console.error('No response from Vipps:', error.request);
        } else {
            console.error('Error setting up request:', error.message);
        }
        res.status(400).send(error.message);
    }
};

exports.createVippsSetupIntentWidget = async (req, res) => {
    try {
        const { orderId } = req.body;

        let order = await Order.findOne({ _id: orderId, customerId: process.env.TEMP_CUSTOMER_ID });

        if (!order) throw new Error('Order not found');

        if (order.currency != 'NOK') throw new Error('Vipps works for Norway only.');

        const amount = Math.max(100, Math.round(order.totalCostSingleMonth * 100));

        const projectNames = order.projects.map(proj => slugToString(proj.slug)).join(', ');
 
        const payload = {
            pricing: {
                type: 'LEGACY',
                amount,
                currency: 'NOK',
            },
            interval: {
                unit: 'MONTH',
                count: 1,
            },
            merchantRedirectUrl: `${process.env.CUSTOMER_PORTAL_URL}/vipps-setup-status/${order._id}`,
            merchantAgreementUrl: `${process.env.CUSTOMER_PORTAL_URL}/vipps-setup-status/${order._id}`,
            productName: `${projectNames} # ${order.orderNo}`,
            phoneNumber: null,
            scope: 'name phoneNumber email address',
            externalId: order._id.toString(),
            initialCharge: {
                amount,
                description: `${slugToString(order.projects?.[0]?.slug) || 'Order'} # ${order.orderNo}`,
                transactionType: 'DIRECT_CAPTURE',
                orderId: uuidv4(),
                externalId: order._id.toString(),
            },
        };
        const token = await getVippsToken();
        const config = await getConfig(`${process.env.VIPPS_API_URL}/recurring/v3/agreements`, payload, token);
        const response = await axios.request(config);
        await Order.findByIdAndUpdate(order._id, {
            vippsAgreementId: response.data.agreementId,
            status: 'draft',
        });
        res.status(200).send({
            redirectUrl: response.data.vippsConfirmationUrl,
            orderId: order._id,
            agreementId: response.data.agreementId,
        });
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message);
    }
};

exports.pollVippsSetupIntent = async (req, res) => {
    try {
        const { orderId, agreementId } = req.params;
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        let order =
            (await Order.findOne({ _id: orderId, createdAt: { $gte: twoHoursAgo } }).lean()) ||
            (await Subscription.findOne({ _id: orderId, createdAt: { $gte: twoHoursAgo } }).lean());
        if (!order) throw new Error('Order not found or too old');
        const payment = await getVippsSetupStatus(agreementId);
        const event = payment.status;
        const mappedStatus = statusMap[order.status];
        if (Array.isArray(mappedStatus) ? !mappedStatus.includes(event) : mappedStatus !== event) {
            try {
                await handleVippsEvent(event, orderId);
            } catch (e) {
                console.log(e.message);
                sendErrorToTelegram(e.message);
            }
        } else {
            console.log(mappedStatus);
            console.log(statusMap[order.status]);
        }
        order =
            (await Order.findOne({ _id: orderId, createdAt: { $gte: twoHoursAgo } }).lean()) ||
            (await Subscription.findOne({ _id: orderId, createdAt: { $gte: twoHoursAgo } }).lean());
        order.dashboardLink = process.env.CUSTOMER_PORTAL_URL;
        res.status(200).send(order);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message || 'Server error - could not get vipps polling status');
    }
};

exports.pollVippsPaymentIntent = async (req, res) => {
    try {
        const reference = req.params.reference;
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        let order =
            (await Order.findOne({ vippsReference: reference, createdAt: { $gte: twoHoursAgo } },{
                status: 1,
                orderNo: 1,
                currency: 1,
                totalCost: 1,
                monthlySubscription: 1,
                'projects.slug': 1,
            }).lean()) ||
            (await Subscription.findOne({ vippsReference: reference, createdAt: { $gte: twoHoursAgo } }).lean());
        if (!order) throw new Error('Order not found or too old');
        const payment = await getVippsPaymentStatus(reference);
        const event = payment.state;

        const mappedStatus = statusMap[order.status];
        const testStatus = Array.isArray(mappedStatus) ? !mappedStatus.includes(event) : mappedStatus !== event;
        if (testStatus) {
            try {
                await handleVippsEvent(event, order._id);
            } catch (e) {
                console.log(mappedStatus);
                console.log(event);
                console.log(e.message);
                sendErrorToTelegram(e.message);
            }
        }

        order =
            (await Order.findOne( { vippsReference: reference, createdAt: { $gte: twoHoursAgo } },
                {
                    status: 1,
                    orderNo: 1,
                    currency: 1,
                    totalCost: 1,
                    monthlySubscription: 1,
                    'projects.slug': 1,
                }
            ).lean()) ||
            (await Subscription.findOne({ vippsReference: reference, createdAt: { $gte: twoHoursAgo } }).lean());
        order.dashboardLink = process.env.CUSTOMER_PORTAL_URL;
        res.status(200).send(order);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message || 'Server error - could not get vipps polling status');
    }
};
