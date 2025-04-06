require('dotenv').config();

const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const Customer = require('../models/Customer');
const Donor = require('../models/Donor');
const Project = require('../models/Project');
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);
const moment = require('moment');
const { calculateOrder, addPaymentsToOrder } = require('../modules/orders');
const { sendStripeRenewelInvoiceToCustomer } = require('../modules/emails');
const { downloadStripeInvoiceAndReceipt } = require('../modules/invoice');

const { saveLog } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { sendErrorToTelegram } = require('../modules/telegramBot');

async function createCustomerPortalSession(customerId, orderId) {
    let session;
    if (orderId) {
        session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${process.env.CUSTOMER_PORTAL_URL}/order/${orderId}`,
        });
    } else {
        session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: process.env.CUSTOMER_PORTAL_URL,
        });
    }

    return session.url;
}

async function getCustomerIdFromSubscription(subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription.customer;
}

async function getCustomerIdFromPaymentIntent(paymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent.customer;
}

exports.customerPortal = async (req, res) => {
    try {

        debugger;
        
        let customerId;

        if (req.query.subscriptionId) {
            customerId = await getCustomerIdFromSubscription(req.query.subscriptionId);
        } else if (req.query.paymentIntentId) {
            customerId = await getCustomerIdFromPaymentIntent(req.query.paymentIntentId);
        }

        if (!customerId) return res.status(404).send('Customer not found');

        const { orderId } = req.params;

        const portalUrl = await createCustomerPortalSession(customerId, orderId);

        res.redirect(portalUrl);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message);
    }
};

async function getOrderIdBySubscriptionId(subscriptionId) {
    const donor = await Donor.findOne({ 'subscriptions.subscriptionId': subscriptionId }, { 'subscriptions.$': 1 });

    if (!donor) return null;
    return donor.subscriptions[0]?.orderId || null;
}

async function checkIfPaymentExists(subscriptionId, paymentIntentId) {
    const donor = await Donor.findOne({ 'subscriptions.subscriptionId': subscriptionId }, { 'subscriptions.$': 1 });

    if (!donor || !donor.subscriptions.length) return false;

    return donor.subscriptions.some((sub) => {
        return sub.paymentIntentId === paymentIntentId;
    });
}

async function fetchSubscriptionDetails(subscriptionId) {
    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ['latest_invoice.payment_intent', 'items.data.price'],
        });

        return {
            subscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            price: subscription.items.data[0]?.price.unit_amount || null,
            currency: subscription.items.data[0]?.price.currency || null,
            interval: subscription.items.data[0]?.price.recurring?.interval || null,
            paymentIntentId: subscription.latest_invoice?.payment_intent?.id || null,
            paymentStatus: subscription.latest_invoice?.payment_intent?.status || null,
            paymentMethodId: subscription.latest_invoice?.payment_intent?.payment_method || null,
            paymentMethodType: subscription.latest_invoice?.payment_intent?.payment_method_types?.[0] || null,
        };
    } catch (error) {
        console.log(error);
        throw new Error(error.message);
    }
}

async function addSubscriptionToDonor(orderId, subscriptionId) {
    const donor = await Donor.findOne({ 'subscriptions.orderId': orderId });
    if (donor) {
        const subscription = await fetchSubscriptionDetails(subscriptionId);
        subscription.orderId = orderId;
        await Donor.updateOne({ _id: donor._id }, { $push: { subscriptions: subscription } });
    } else {
        throw new Error('Donor do not exist, while updating stripe subscription');
    }
}

async function countSubscriptions(orderId) {
    const donor = await Donor.findOne({ 'subscriptions.orderId': orderId }).lean();
    const subscriptions = donor.subscriptions.filter((sub) => sub.orderId.toString() === orderId.toString());
    return subscriptions.length;
}

async function sumSubscriptions(orderId) {
    const donor = await Donor.findOne({ 'subscriptions.orderId': orderId }).lean();
    const subscriptions = donor.subscriptions.filter((sub) => sub.orderId.toString() === orderId.toString());
    const totalAmount = subscriptions.reduce((sum, sub) => sum + (sub.price / 100), 0);
    return totalAmount;
}

const renewSubscriptionRecordInDb = async(orderId, subscriptionId) => {
    const checkOrder = await Subscription.findById(orderId).lean();
    if (!checkOrder) throw new Error('Subscription Record not found');
    await addSubscriptionToDonor(orderId, subscriptionId);
    const total = await sumSubscriptions(orderId);
    const order = await Subscription.findOneAndUpdate(
        { _id: orderId },
        { $set: { 'totalAllTime': total } },
        { new: true, lean: true },
    );
    if (!order) throw new Error('Failed to update the order with total amount');
}

const renewOrderInDb = async (orderId, subscriptionId) => {
    const checkOrder = await Order.findById(orderId).lean();
    if (!checkOrder) throw new Error('Order not found');
    await addSubscriptionToDonor(orderId, subscriptionId);
    const months = await countSubscriptions(orderId);
    const order = await Order.findOneAndUpdate(
        { _id: orderId, 'projects.slug': { $exists: true } },
        {
            $set: {
                'projects.$.months': months,
                status: 'paid',
            },
        },
        { new: true, lean: true },
    );
    if (!order) throw new Error('Failed to update the order with months = should not happen');
    const calculatedOrder = await calculateOrder(order);
    await addPaymentsToOrder(calculatedOrder);
};

async function renewOverlayOrder(req, event) {
    const invoice = event.data.object;
    const subscriptionId = invoice.subscription;

    if (!subscriptionId) throw new Error('Subscription Id not in the hook');

    const orderId = await getOrderIdBySubscriptionId(subscriptionId);

    if (!orderId) throw new Error('No order found for subscription: ', subscriptionId);

    let order = await Subscription.findById(orderId).lean();

    if (!order) throw new Error('Order not found in Subscription Record');

    const stripePaymentIntentId = invoice.payment_intent;

    if (!stripePaymentIntentId) throw new Error('Payment intent Id is required to renew subscription');

    const isAlreadyPaid = await checkIfPaymentExists(subscriptionId, stripePaymentIntentId);

    if (isAlreadyPaid) {
        console.log('Payment already recorded, skipping renewal: ', stripePaymentIntentId);
        return;
    }

    await renewSubscriptionRecordInDb(orderId, subscriptionId);

    const customer = await Customer.findById(order.customerId).lean();

    await downloadStripeInvoiceAndReceipt(order, {
        actorType: 'customer',
        actorId: customer._id,
        actorUrl: `/customer/${customer._id}`,
    });

    await sendStripeRenewelInvoiceToCustomer(order, customer);

    await saveLog(
        logTemplates({
            type: 'subscriptionOverlayRenewed',
            entity: order,
            actor: customer,
        }),
    );
}

async function renewWidgetOrder(req, event) {
    try {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        if (!subscriptionId) throw new Error('Subscription Id not in the hook');

        const orderId = await getOrderIdBySubscriptionId(subscriptionId);

        if (!orderId) throw new Error('No order found for subscription:', subscriptionId);

        let order = await Order.findById(orderId).lean();

        if (!order) {
            await renewOverlayOrder(req, event);
            return true;
        }

        const stripePaymentIntentId = invoice.payment_intent;

        if (!stripePaymentIntentId) throw new Error('Payment intent Id is required to renew subscription');

        const isAlreadyPaid = await checkIfPaymentExists(subscriptionId, stripePaymentIntentId);

        if (isAlreadyPaid) {
            console.log('Payment already recorded, skipping renewal:', stripePaymentIntentId);
            return;
        }

        await renewOrderInDb(orderId, subscriptionId);

        const customer = await Customer.findById(order.customerId).lean();

        await downloadStripeInvoiceAndReceipt(order, {
            actorType: 'customer',
            actorId: customer._id,
            actorUrl: `/customer/${customer._id}`,
        });

        await sendStripeRenewelInvoiceToCustomer(order, customer);

        await saveLog(
            logTemplates({
                type: 'subscriptionRenewed',
                entity: order,
                actor: customer,
            }),
        );
    } catch (error) {
        console.error(error);
        sendErrorToTelegram(error.message);
    }
}

exports.renewOrder = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return res.json({ received: true });
    }

    if (event.type === 'invoice.payment_succeeded') {
        await renewWidgetOrder(req, event);
    }

    res.json({ received: true });
};

exports.stripeReceipt = async (req,res) => {
    try {
        const invoice = await stripe.invoices.retrieve(req.params.invoiceId);
        if (!invoice) throw new Error('No invoice found in stripe');
        res.redirect(invoice.hosted_invoice_url);
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message || 'Could not re direct to stripe page');
    }
}
