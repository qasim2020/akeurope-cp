require('dotenv').config();

const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const { sendThankYouMessage } = require('./emails');
const { sendTelegramMessage } = require('./telegramBot');
const {
    successfulOneTimePayment,
    successfulOneTimePaymentOverlay,
    successfulSubscriptionPaymentOverlay,
} = require('./vippsPostActions');
const { captureVippsPayment, updateOrderWithCharge, updateDonorAgreement } = require('./vippsModules');

const vippsPaymentCreated = async (orderId) => {
    console.log(`Payment created: ${orderId}`);
    await Subscription.updateOne({ _id: orderId }, { status: 'draft' });
    await Order.updateOne({ _id: orderId }, { status: 'draft' });
};

const vippsPaymentAborted = async (orderId) => {
    console.log(`Payment aborted: ${orderId}`);
    const sub = await Subscription.updateOne({ _id: orderId }, { status: 'aborted' });
    const order = await Order.updateOne({ _id: orderId }, { status: 'aborted' });
};

const vippsPaymentExpired = async (orderId) => {
    console.log(`Payment expired: ${orderId}`);
    await Subscription.updateOne({ _id: orderId }, { status: 'aborted' });
    await Order.updateOne({ _id: orderId }, { status: 'aborted' });
};

const vippsPaymentCancelled = async (orderId) => {
    console.log(`Payment cancelled: ${orderId}`);
    await Subscription.updateOne({ _id: orderId }, { status: 'aborted' });
    await Order.updateOne({ _id: orderId }, { status: 'aborted' });
};

const vippsPaymentCaptured = async (orderId) => {
    console.log(`Payment captured: ${orderId}`);
    const order = (await Subscription.findById(orderId).lean()) || (await Order.findById(orderId).lean());
    if (order.projects?.length > 0) {
        await successfulOneTimePayment(orderId);
    } else {
        await successfulOneTimePaymentOverlay(orderId);
    }
};

const vippsPaymentRefunded = async (orderId) => {
    console.log(`Payment refunded: ${orderId}`);
    await Subscription.updateOne({ _id: orderId }, { status: 'refunded' });
    await Order.updateOne({ _id: orderId }, { status: 'refunded' });
};

const vippsPaymentAuthorized = async (orderId) => {
    console.log(`Payment authorized: ${orderId}`);
    await Subscription.updateOne({ _id: orderId }, { status: 'authorized' });
    await Order.updateOne({ _id: orderId }, { status: 'authorized' });
    await captureVippsPayment(orderId);
};

const vippsPaymentTerminated = async (orderId) => {
    console.log(`Payment terminated: ${orderId}`);
    await Subscription.updateOne({ _id: orderId }, { status: 'aborted' });
    await Order.updateOne({ _id: orderId }, { status: 'aborted' });
};

const vippsAgreementActivated = async (orderId) => {
    console.log(`Agreement activated: ${orderId}`);
    await updateDonorAgreement(orderId);
};

const vippsAgreementRejected = async (orderId) => {
    console.log(`Agreement rejected: ${orderId}`);
    await updateDonorAgreement(orderId);
};

const vippsAgreementStopped = async (orderId) => {
    console.log(`Agreement stopped: ${orderId}`);
    await updateDonorAgreement(orderId);
};

const vippsAgreementExpired = async (orderId) => {
    console.log(`Agreement expired: ${orderId}`);
    await updateDonorAgreement(orderId);
};

const vippsChargeReserved = async (orderId) => {
    console.log(`Charge reserved: ${orderId}`);
    await updateOrderWithCharge(orderId);
};

const vippsChargeCaptured = async (orderId) => {
    console.log(`Charge captured: ${orderId}`);
    const order = (await Subscription.findById(orderId).lean()) || (await Order.findById(orderId).lean());
    if (order.projects?.length > 0) {
        await successfulSubscriptionPayment(orderId);
    } else {
        await successfulSubscriptionPaymentOverlay(orderId);
    }
};

const vippsChargeCanceled = async (orderId) => {
    console.log(`Charge canceled: ${orderId}`);
    await updateOrderWithCharge(orderId);
};

const vippsChargeFailed = async (orderId) => {
    console.log(`Charge failed: ${orderId}`);
    await updateOrderWithCharge(orderId);
};

const vippsChargeCreationFailed = async (orderId) => {
    console.log(`Charge creation failed: ${orderId}`);
    await updateOrderWithCharge(orderId);
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
    vippsAgreementExpired,
    vippsChargeReserved,
    vippsChargeCaptured,
    vippsChargeCanceled,
    vippsChargeFailed,
    vippsChargeCreationFailed,
};
