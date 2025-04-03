require('dotenv').config();

const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const { sendThankYouMessage } = require('./emails');
const { sendTelegramMessage } = require('./telegramBot');
const { successfulOneTimePayment, successfulOneTimePaymentOverlay } = require('./vippsPostActions');
const { captureVippsPayment } = require('./vippsModules');

const vippsPaymentCreated = async (orderId) => {
    console.log(`Payment created: ${orderId}`);
    await Subscription.updateOne({_id: orderId}, {status: 'created'});
    await Order.updateOne({_id: orderId}, {status: 'created'});
};

const vippsPaymentAborted = async (orderId) => {
    console.log(`Payment aborted: ${orderId}`);
    const sub = await Subscription.updateOne({_id: orderId}, {status: 'aborted'});
    const order = await Order.updateOne({_id: orderId}, {status: 'aborted'});
};

const vippsPaymentExpired = async (orderId) => {
    console.log(`Payment expired: ${orderId}`);
    await Subscription.updateOne({_id: orderId}, {status: 'expired'});
    await Order.updateOne({_id: orderId}, {status: 'expired'});
};

const vippsPaymentCancelled = async (orderId) => {
    console.log(`Payment cancelled: ${orderId}`);
    await Subscription.updateOne({_id: orderId}, {status: 'cancelled'});
    await Order.updateOne({_id: orderId}, {status: 'cancelled'});
};

const vippsPaymentCaptured = async (orderId) => {
    console.log(`Payment captured: ${orderId}`);
    await successfulOneTimePaymentOverlay(orderId);
};

const vippsPaymentRefunded = async (orderId) => {
    console.log(`Payment refunded: ${orderId}`);
    await Subscription.updateOne({_id: orderId}, {status: 'refunded'});
    await Order.updateOne({_id: orderId}, {status: 'refunded'});
};

const vippsPaymentAuthorized = async (orderId) => {
    console.log(`Payment authorized: ${orderId}`);
    await Subscription.updateOne({_id: orderId}, {status: 'authorized'});
    await Order.updateOne({_id: orderId}, {status: 'authorized'});
    await captureVippsPayment(orderId);
};

const vippsPaymentTerminated = async (orderId) => {
    console.log(`Payment terminated: ${orderId}`);
    await Subscription.updateOne({_id: orderId}, {status: 'terminated'});
    await Order.updateOne({_id: orderId}, {status: 'terminated'});
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
};
