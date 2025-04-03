require('dotenv').config();
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');

const { saveLog } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { generateInvoice, saveFileRecord } = require('../modules/invoice');
const { sendThankYouMessage, sendThankYouEmail } = require('../modules/emails');
const { sendErrorToTelegram } = require('../modules/telegramBot');
const { getVippsUserInfo, updateDonorProfile } = require('../modules/vippsModules');

const connectDonorInCustomer = async (donor, checkCustomer) => {
    let dashboardLink;

    if (!checkCustomer || !(checkCustomer && checkCustomer.password)) {
        const newCustomer = await Customer.findOneAndUpdate(
            {
                email: donor.email.toLowerCase(),
            },
            {
                $set: {
                    name: donor.name,
                    tel: donor.phoneNumber,
                    anonymous: 'false',
                    countryCode: 'NO',
                    address: donor.address,
                },
                $setOnInsert: {
                    role: 'donor',
                },
            },
            { new: true, lean: true, upsert: true },
        );

        dashboardLink = `${process.env.CUSTOMER_PORTAL_URL}`;

        checkCustomer = newCustomer;
    } else {
        const updateFields = {
            $set: {
                name: donor.name,
                organization: 'N/A',
                tel: donor.phoneNumber,
                anonymous: 'false',
                countryCode: 'NO',
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

    return checkCustomer;
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
        await saveLog(
            logTemplates({
                type: 'successfulOneTimePayment',
                entity: order,
                actor: customer,
            }),
        );
        await sendInvoiceAndReceiptToCustomer(order, customer);
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
        await saveLog(
            logTemplates({
                type: 'successfulSubscriptionPayment',
                entity: order,
                actor: customer,
            }),
        );
        await sendInvoiceAndReceiptToCustomer(order, customer);
    } catch (error) {
        console.log(error);
        sendErrorToTelegram(JSON.stringify(error));
    }
};

const successfulOneTimePaymentOverlay = async (orderId) => {
    try {
        let order = await Subscription.findById(orderId).lean();
        if (!order) {
            throw new Error('Order not found = strange');
        }
        if (order.monthlySubscription) {
            throw new Error('This is a subscription payment, not a one-time payment');
        }
        const donor = await getVippsUserInfo(orderId);
        const updatedDonor = await updateDonorProfile(donor);
        let existingCustomer = await Customer.findOne({ email: updatedDonor?.email?.toLowerCase() }).lean();
        const customer = await connectDonorInCustomer(donor, existingCustomer);
        order = await Subscription.findOneAndUpdate(
            { _id: order._id },
            {
                customerId: customer._id,
                status: 'paid',
            },
            { lean: true, new: true },
        );
        await saveLog(
            logTemplates({
                type: 'successfulOneTimePaymentOverlay',
                entity: order,
                actor: customer,
            }),
        );
        await sendThankYouEmail(order, customer);
        await sendThankYouMessage(updatedDonor.tel)
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
        await saveLog(
            logTemplates({
                type: 'successfulSubscriptionPaymentOverlay',
                entity: order,
                actor: customer,
            }),
        );
        await sendInvoiceAndReceiptToCustomer(order, customer);
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
