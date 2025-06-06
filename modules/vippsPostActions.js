require('dotenv').config();
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');

const { saveLog } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { generateInvoice, saveFileRecord } = require('../modules/invoice');
const {
    sendEmailReceipt,
    sendThankYouMessage,
    sendThankYouEmail,
    sendThankYouForSponsoringBeneficiaryEmail,
    sendThankYouForSponsoringBeneficiaryMessage,
} = require('../modules/emails');
const { sendErrorToTelegram } = require('../modules/telegramBot');
const {
    getVippsOrderNUserInfo,
    updateDonorWithPayment,
    updateDonorWithCharge,
    getVippsChargeNUserInfo,
    updateDonorAgreement,
} = require('../modules/vippsModules');
const { cleanOrder } = require('../modules/orders');
const { vippsStatusMap } = require('../modules/helpers');
const { updateOrderMonthsVsVippsCharges } = require('../modules/orders');
const { removeUnorderedProducts } = require('../modules/productActions');


const connectDonorInCustomer = async (donor, checkCustomer) => {
    if (!checkCustomer || !(checkCustomer && checkCustomer.password)) {
        const newCustomer = await Customer.findOneAndUpdate(
            {
                email: donor.email.toLowerCase(),
            },
            {
                $set: {
                    name: `${donor.firstName} ${donor.lastName}`,
                    tel: donor.tel,
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

        checkCustomer = newCustomer;
    } else {
        const updateFields = {
            $set: {
                name: `${donor.firstName} ${donor.lastName}`,
                organization: 'Not Listed',
                tel: donor.tel,
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

        const newCustomer = await Customer.findOneAndUpdate({ email: donor.email?.toLowerCase() }, updateFields, {
            upsert: true,
            new: true,
            lean: true,
        });

        checkCustomer = newCustomer;
    }

    return checkCustomer;
};

const successfulOneTimePayment = async (orderId) => {
    try {
        let order = await Order.findById(orderId).lean();
        if (!order) {
            throw new Error('Order not found = strange');
        }
        if (order.status === 'paid') {
            throw new Error('Order already paid');
        }
        if (order.monthlySubscription) {
            throw new Error('This is a subscription payment, not a one-time payment');
        }
        await cleanOrder(orderId);
        const info = await getVippsOrderNUserInfo(orderId);
        const updatedDonor = await updateDonorWithPayment(info);
        let existingCustomer = await Customer.findOne({ email: updatedDonor?.email?.toLowerCase() }).lean();
        const customer = await connectDonorInCustomer(info.donor, existingCustomer);
        order = await Order.findOneAndUpdate(
            { _id: order._id },
            {
                customerId: customer._id,
                status: 'paid',
            },
            { lean: true, new: true },
        );
        await saveLog(
            logTemplates({
                type: 'successfulOneTimePayment',
                entity: order,
                actor: customer,
            }),
        );
        await sendThankYouForSponsoringBeneficiaryEmail(order, customer);
        await sendThankYouForSponsoringBeneficiaryMessage(updatedDonor.tel);
    } catch (error) {
        console.log(error);
        sendErrorToTelegram(error.message);
    }
};


const successfulOneTimePaymentProducts = async (orderId) => {
    try {
        let order = await Subscription.findById(orderId).lean();
        if (!order) {
            throw new Error('Order not found = strange');
        }
        // if (order.status === 'paid') {
        //     throw new Error('Order already paid');
        // }
        if (order.monthlySubscription) {
            throw new Error('This is a subscription payment, not a one-time payment');
        }
        await removeUnorderedProducts(orderId);
        const info = await getVippsOrderNUserInfo(orderId);
        const updatedDonor = await updateDonorWithPayment(info);
        let existingCustomer = await Customer.findOne({ email: updatedDonor?.email?.toLowerCase() }).lean();
        const customer = await connectDonorInCustomer(info.donor, existingCustomer);
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
                type: 'successfulOneTimePayment',
                entity: order,
                actor: customer,
            }),
        );
        await sendEmailReceipt(order, customer);
        await sendThankYouMessage(updatedDonor.tel);
    } catch (error) {
        console.log(error);
        sendErrorToTelegram(error.message);
    }
};

const successfulSubscriptionPayment = async (orderId) => {
    try {
        let order = await Order.findById(orderId).lean();
        if (!order) {
            throw new Error('Order not found');
        }
        if (!order.monthlySubscription) {
            throw new Error('This is a one-time payment, not a monthly subscription');
        }
        const info = await getVippsChargeNUserInfo(orderId);
        const { isNewPayment, donor: updatedDonor } = await updateDonorWithCharge(info);
        if (!isNewPayment) {
            throw new Error('Payment is already captured = strange');
        }
        let existingCustomer = await Customer.findOne({ email: updatedDonor?.email?.toLowerCase() }).lean();
        const customer = await connectDonorInCustomer(info.donor, existingCustomer);

        await updateOrderMonthsVsVippsCharges(order._id);

        order = await Order.findOneAndUpdate(
            { _id: order._id },
            {
                customerId: customer._id,
                status: 'paid',
            },
            { lean: true, new: true },
        );

        await updateDonorAgreement(order._id);
        
        order.customer = customer;
        await saveLog(
            logTemplates({
                type: 'successfulSubscriptionPayment',
                entity: order,
                actor: customer,
            }),
        );
        await sendThankYouForSponsoringBeneficiaryEmail(order, customer);
        await sendThankYouForSponsoringBeneficiaryMessage(updatedDonor.tel); 
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
        if (order.status === 'paid') {
            throw new Error('Order already paid');
        }
        if (order.monthlySubscription) {
            throw new Error('This is a subscription payment, not a one-time payment');
        }
        const info = await getVippsOrderNUserInfo(orderId);
        const updatedDonor = await updateDonorWithPayment(info);
        let existingCustomer = await Customer.findOne({ email: updatedDonor?.email?.toLowerCase() }).lean();
        const customer = await connectDonorInCustomer(info.donor, existingCustomer);
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
        await sendThankYouMessage(updatedDonor.tel);
    } catch (error) {
        console.log(error);
        sendErrorToTelegram(error.message);
    }
};

const successfulSubscriptionPaymentOverlay = async (orderId) => {
    try {
        let order = await Subscription.findById(orderId).lean();
        if (!order) {
            throw new Error('Subscription Record not found');
        }
        if (!order.monthlySubscription) {
            throw new Error('This is a one-time payment, not a monthly subscription');
        }
        const info = await getVippsChargeNUserInfo(orderId);
        const { isNewPayment, donor: updatedDonor } = await updateDonorWithCharge(info);
        if (!isNewPayment) {
            throw new Error('Payment is already captured = strange');
        }
        let existingCustomer = await Customer.findOne({ email: updatedDonor?.email?.toLowerCase() }).lean();
        const customer = await connectDonorInCustomer(info.donor, existingCustomer);
        order = await Subscription.findOneAndUpdate(
            { _id: order._id },
            {
                customerId: customer._id,
                status: 'paid',
            },
            { lean: true, new: true },
        );
        await updateDonorAgreement(order._id);
        order.customer = customer;
        await saveLog(
            logTemplates({
                type: 'successfulSubscriptionPaymentOverlay',
                entity: order,
                actor: customer,
            }),
        );
        await sendThankYouEmail(order, customer);
        await sendThankYouMessage(updatedDonor.tel);
    } catch (error) {
        console.log(error);
        sendErrorToTelegram(JSON.stringify(error));
    }
};

module.exports = {
    successfulOneTimePayment,
    successfulSubscriptionPayment,
    successfulOneTimePaymentOverlay,
    successfulOneTimePaymentProducts,
    successfulSubscriptionPaymentOverlay,
    connectDonorInCustomer,
};
