require('dotenv').config();
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');

const { saveLog } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { downloadStripeInvoiceAndReceipt, downloadStripeReceipt, generateInvoice, saveFileRecord } = require('../modules/invoice');
const { sendInvoiceAndReceiptToCustomer, sendReceiptToCustomer } = require('../modules/emails');
const { sendErrorToTelegram } = require('../modules/telegramBot');

const connectDonorInCustomer = async (donor, checkCustomer) => {
    let dashboardLink;

    if (!checkCustomer || !(checkCustomer && checkCustomer.password)) {
        const newCustomer = await Customer.findOneAndUpdate(
            {
                email: donor.email.toLowerCase(),
            },
            {
                $set: {
                    name: `${donor.firstName} ${donor.lastName}`,
                    tel: donor.tel,
                    anonymous: donor.anonymous,
                    countryCode: donor.countryCode,
                },
                $setOnInsert: {
                    role: 'donor',
                },
            },
            { new: true, lean: true, upsert: true },
        );

        dashboardLink = `${process.env.CUSTOMER_PORTAL_URL}/register`;

        checkCustomer = newCustomer;
    } else {
        const updateFields = {
            $set: {
                name: `${donor.firstName} ${donor.lastName}`,
                organization: donor.organization,
                tel: donor.tel,
                anonymous: donor.anonymous,
                countryCode: donor.countryCode,
            },
            $setOnInsert: {
                role: 'donor',
            },
        };

        if (donor.organization) {
            updateFields.address = donor.address;
        }

        const newCustomer = await Customer.findOneAndUpdate({ email: donor.email }, updateFields, {
            upsert: true,
            new: true,
            lean: true,
        });

        dashboardLink = `${process.env.CUSTOMER_PORTAL_URL}`;

        checkCustomer = newCustomer;
    }

    return {
        customerId: checkCustomer._id,
        dashboardLink,
        freshCustomer: checkCustomer,
    };
};

const successfulOneTimePayment = async (orderId, customer) => {
    try {
        const order = await Order.findById(orderId).lean();
        if (!order) {
            throw new Error('Order not found, it might be a subscription');
        }
        if (order.monthlySubscription) {
            throw new Error('This is a subscription payment, not a one-time payment');
        }
        const uploadedBy = {
            actorType: 'customer',
            actorId: customer._id,
            actorUrl: `/customer/${customer._id}`,
        };
        order.customer = customer;
        const invoicePath = await generateInvoice(order);
        await saveFileRecord(order, invoicePath, 'invoice', uploadedBy);
        await downloadStripeReceipt(order, uploadedBy);
        await sendInvoiceAndReceiptToCustomer(order, customer);
        await saveLog(
            logTemplates({
                type: 'successfulOneTimePayment',
                entity: order,
                actor: customer,
            }),
        );
    } catch (error) {
        console.log(error);
        sendErrorToTelegram(error.message);
    }
};

const successfulSubscriptionPayment = async (orderId, customer) => {
    try {
        const order = await Order.findById(orderId).lean();
        if (!order) {
            throw new Error('Order not found, it might be a subscription');
        }
        if (!order.monthlySubscription) {
            throw new Error('This is a one-time payment, not a monthly subscription');
        }
        const uploadedBy = {
            actorType: 'customer',
            actorId: customer._id,
            actorUrl: `/customer/${customer._id}`,
        };
        order.customer = customer;
        await downloadStripeInvoiceAndReceipt(order, uploadedBy);
        await sendInvoiceAndReceiptToCustomer(order, customer);
        await saveLog(
            logTemplates({
                type: 'successfulSubscriptionPayment',
                entity: order,
                actor: customer,
            }),
        );
    } catch (error) {
        console.log(error);
        sendErrorToTelegram(JSON.stringify(error));
    }
};

const successfulOneTimePaymentOverlay = async (orderId, customer) => {
    try {
        console.log('post overlay one-time');
        const order = await Subscription.findById(orderId).lean();
        if (!order) {
            throw new Error('Order not found, it might be a subscription');
        }
        if (order.monthlySubscription) {
            throw new Error('This is a subscription payment, not a one-time payment');
        }
        const uploadedBy = {
            actorType: 'customer',
            actorId: customer._id,
            actorUrl: `/customer/${customer._id}`,
        };
        order.customer = customer;
        await downloadStripeReceipt(order, uploadedBy);
        await sendReceiptToCustomer(order, customer);
        await saveLog(
            logTemplates({
                type: 'successfulOneTimePaymentOverlay',
                entity: order,
                actor: customer,
            }),
        );
    } catch (error) {
        console.log(error);
        sendErrorToTelegram(error.message);
    }
};

const successfulSubscriptionPaymentOverlay = async (orderId, customer) => {
    try {
        const order = await Subscription.findById(orderId).lean();
        if (!order) {
            throw new Error('Subscription Record not found');
        }
        if (!order.monthlySubscription) {
            throw new Error('This is a one-time payment, not a monthly subscription');
        }
        const uploadedBy = {
            actorType: 'customer',
            actorId: customer._id,
            actorUrl: `/customer/${customer._id}`,
        };
        order.customer = customer;
        await downloadStripeInvoiceAndReceipt(order, uploadedBy);
        await sendInvoiceAndReceiptToCustomer(order, customer);
        await saveLog(
            logTemplates({
                type: 'successfulSubscriptionPaymentOverlay',
                entity: order,
                actor: customer,
            }),
        );
    } catch (error) {
        console.log(error);
        sendErrorToTelegram(JSON.stringify(error));
    }
};

module.exports = {
    successfulOneTimePayment,
    successfulSubscriptionPayment,
    successfulOneTimePaymentOverlay,
    successfulSubscriptionPaymentOverlay,
    connectDonorInCustomer,
};
