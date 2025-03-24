require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const handlebars = require('handlebars');
const moment = require('moment');
const nodemailer = require('nodemailer');

const Country = require('../models/Country');
const Project = require('../models/Project');
const Subscription = require('../models/Subscription');
const Customer = require('../models/Customer');
const Donor = require('../models/Donor');

const { calculateOrder, addPaymentsToOrder, formatOrderWidget, cleanOrder } = require('../modules/orders');
const { getOldestPaidEntries, makeProjectForWidgetOrder, makeEntriesForWidgetOrder } = require('../modules/ordersFetchEntries');
const { runQueriesOnOrder } = require('../modules/orderUpdates');
const {
    connectDonorInCustomer,
    successfulOneTimePaymentOverlay,
    successfulSubscriptionPaymentOverlay,
} = require('../modules/orderPostActions');

const { default: mongoose } = require('mongoose');
const { isValidEmail } = require('../modules/checkValidForm');
const { saveLog } = require('../modules/logAction');

const { logTemplates } = require('../modules/logTemplates');
const { getCurrencyRates } = require('../modules/getCurrencyRates');
const { slugToString } = require('../modules/helpers');

exports.wScript = async (req, res) => {
    try {
        const scriptPath = path.join(__dirname, '..', 'static', 'webflow.js');
        const file = await fs.readFile(scriptPath, 'utf8');
        const scriptContent = file.replace('__CUSTOMER_PORTAL_URL__', process.env.CUSTOMER_PORTAL_URL);
        res.setHeader('Content-Type', 'application/javascript');
        res.send(scriptContent);
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).send('Internal Server Error');
    }
};

function roundToNearest(amount) {
    if (amount < 50) return 50;
    if (amount < 100) return 100;
    if (amount < 500) return 500;
    if (amount < 1000) return 1000;
    if (amount < 5000) return 5000;
    if (amount < 10000) return 10000;
    return Math.ceil(amount / 10000) * 10000;
}

async function getProductList(code) {
    const filePath = path.join(__dirname, '../products.json');
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);

    const randomSet = data[Math.floor(Math.random() * data.length)];

    const oneTime = randomSet.oneTime;
    const monthly = randomSet.monthly;

    const currencyRates = await getCurrencyRates(code);
    const currencyRate = parseFloat(currencyRates.rates['NOK'].toFixed(2));

    const productList = {
        oneTime: oneTime.map((amount) => roundToNearest(amount / currencyRate)),
        monthly: monthly.map((amount) => roundToNearest(amount / currencyRate)),
    };

    return productList;
}

exports.overlayProducts = async (req, res) => {
    try {
        if (!req.params.code) throw new Error('Country Code is required');
        const country = await Country.findOne({ code: req.params.code }).lean();
        if (!country) throw new Error('Currency is not supported');
        const products = await getProductList(country.currency.code);
        res.status(200).json({
            products,
            country,
        });
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message);
    }
};

exports.createNewOrder = async (req, res) => {
    try {
        if (!req.query.countryCode) throw new Error(`Currency is required!`);

        const country = await Country.findOne({ code: req.query.countryCode }).lean();

        if (!country.currency.code) throw new Error(`${code} is not supported!`);

        const customer = await Customer.findById(process.env.TEMP_CUSTOMER_ID).lean();

        if (!customer) throw new Error('Temporary customer not found!');

        const { total, countryCode, monthly } = req.query;
        const { slug } = req.params;

        if (!total || !countryCode || !monthly || !slug) throw new Error('Incomplete parameters to create order');

        const currencyRates = await getCurrencyRates(country.currency.code);
        const currencyRate = parseFloat(currencyRates.rates['NOK'].toFixed(2));
        const amount = total * currencyRate;

        if (amount < 100) throw new Error('Total can not be lower than 100 NOK');

        let order = new Subscription({
            customerId: customer._id,
            currency: country.currency.code,
            total,
            totalAllTime: total,
            monthlySubscription: monthly,
            countryCode: country.code,
            projectSlug: req.params.slug,
            status: 'pending payment',
        });

        await order.save();

        res.status(200).send(order);
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message);
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        let order = await Subscription.findById({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();
        if (!order) throw new Error('Order not found!');
        if (['processing', 'paid'].includes(order.status)) throw new Error('Order can not be edited');
        await Subscription.deleteOne({ _id: req.params.orderId });
        res.status(200).send('Order deleted');
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message);
    }
};

exports.getOrderData = async (req, res) => {
    try {
        const order = await Subscription.findById(req.params.orderId).lean();
        if (!order) throw new Error('Order not found!');
        const customerId = order.customerId;
        if (customerId.toString() !== process.env.TEMP_CUSTOMER_ID) throw new Error('Unauthorized request!');
        res.status(200).send(order);
    } catch (error) {
        console.log(error);
        res.status(400).send('Server error. Could not get order data!');
    }
};

exports.createSubscription = async (req, res) => {
    try {
        const { paymentMethodId, email: providedEmail } = req.body;
        const email = providedEmail.toLowerCase();

        const donor = await Donor.findOne({ email }).lean();
        if (!donor) throw new Error('Donor not found.');

        const order = await Subscription.findOne({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();
        if (!order) throw new Error('Order not found!');

        let customers = await stripe.customers.list({ email: donor.email });

        let customer = customers.data.find((c) => c.metadata.currency === order.currency);

        if (!customer) {
            customer = await stripe.customers.create({
                email: donor.email,
                name: `${donor.firstName} ${donor.lastName}`,
                phone: donor.tel,
                payment_method: paymentMethodId,
                invoice_settings: { default_payment_method: paymentMethodId },
                metadata: {
                    orderId: order._id.toString(),
                    orderNo: order.orderNo,
                    currency: order.currency,
                },
            });
        } else {
            await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
        }

        const amount = Math.max(100, Math.round(order.total * 100));

        const price = await stripe.prices.create({
            unit_amount: amount,
            currency: order.currency,
            recurring: { interval: 'month' },
            product_data: {
                name: `${slugToString(order.projectSlug)} # ${order.orderNo}`,
            },
        });

        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: price.id }],
            payment_settings: { payment_method_types: ['card'] },
            default_payment_method: paymentMethodId,
            expand: ['latest_invoice.payment_intent'],
        });

        const paymentIntent = subscription.latest_invoice.payment_intent;

        if (paymentIntent.status !== 'succeeded') {
            console.error('Payment failed:', paymentIntent.last_payment_error?.message);
            throw new Error(`Payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`);
        }

        const paymentMethod = await stripe.paymentMethods.retrieve(subscription.latest_invoice.payment_intent.payment_method);

        const updatedDonor = await Donor.findOneAndUpdate(
            { email },
            {
                stripeCustomerId: customer.id,
                $push: {
                    subscriptions: {
                        orderId: order._id,
                        subscriptionId: subscription.id,
                        status: subscription.status,
                        currentPeriodStart: new Date(subscription.current_period_start * 1000),
                        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                        price: subscription.items.data[0].price.unit_amount,
                        currency: subscription.items.data[0].price.currency,
                        interval: subscription.items.data[0].price.recurring.interval,
                        paymentIntentId: subscription.latest_invoice?.payment_intent?.id || null,
                        paymentStatus: subscription.latest_invoice?.payment_intent?.status || null,
                        paymentMethodId: subscription.latest_invoice?.payment_intent?.payment_method || null,
                        paymentMethodType: paymentMethod.type,
                    },
                },
            },
            { new: true, lean: true },
        );

        let checkCustomer = await Customer.findOne({ email }).lean();

        const { customerId, dashboardLink, freshCustomer } = await connectDonorInCustomer(updatedDonor, checkCustomer);

        await Subscription.updateOne({ _id: order._id }, { status: 'paid' });

        res.json({
            success: true,
            subscriptionId: subscription.id,
            customerId,
            dashboardLink,
            amount: `${order.total} ${order.currency}`,
            monthly: true,
        });

        successfulSubscriptionPaymentOverlay(order._id, freshCustomer);
    } catch (error) {
        console.error('Subscription Error:', error);
        res.status(400).send(error.message || error || 'Server Error');
    }
};

exports.createSetupIntent = async (req, res) => {
    try {
        const { email: emailProvided, firstName, lastName, tel, organization, anonymous, countryCode } = req.body;
        const email = emailProvided.toLowerCase();

        if (!isValidEmail(email)) throw new Error('Email provided is invalid');
        const donor = await Donor.findOneAndUpdate(
            { email },
            {
                $set: {
                    firstName,
                    lastName,
                    tel,
                    organization,
                    anonymous,
                    countryCode,
                    status: 'active',
                    role: 'donor',
                },
                $setOnInsert: { email },
            },
            { upsert: true, new: true },
        ).lean();

        const setupIntent = await stripe.setupIntents.create({
            payment_method_types: ['card'],
            metadata: { email: donor.email },
        });
        res.json({ clientSecret: setupIntent.client_secret });
    } catch (error) {
        console.error('Error creating SetupIntent:', error);
        res.status(500).send(error.message || 'Server Error. Could not create setup intent.');
    }
};

exports.createPaymentIntent = async (req, res) => {
    try {
        const { email, firstName, lastName, tel, organization, anonymous, countryCode } = req.body;

        if (!isValidEmail(email)) throw new Error('Email provided is invalid');

        const order = await Subscription.findOne({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();

        if (!order) throw new Error('Order not found');

        const amount = Math.max(1, Math.round(order.total * 100));

        let customers = await stripe.customers.list({ email: email });
        let customer = customers.data.find((c) => c.metadata.currency === order.currency);

        if (!customer) {
            customer = await stripe.customers.create({
                email: email,
                name: `${firstName} ${lastName}`,
                phone: tel,
                metadata: {
                    orderId: order._id.toString(),
                    orderNo: order.orderNo,
                    currency: order.currency,
                },
            });
        }

        await Donor.findOneAndUpdate(
            { email },
            {
                $set: {
                    stripeCustomerId: customer.id,
                    firstName,
                    lastName,
                    tel,
                    organization,
                    anonymous,
                    countryCode,
                    status: 'active',
                    role: 'donor',
                },
                $setOnInsert: { email },
            },
            { upsert: true, new: true },
        ).lean();

        const description = `${slugToString(order.projectSlug)} # ${order.orderNo}`;

        const { createStripeInvoice } = require('../modules/stripe');

        const { paymentIntent, invoice } = await createStripeInvoice(order, amount, description, customer);

        res.json({ clientSecret: paymentIntent.client_secret, invoiceId: invoice.id });
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message || 'Error creating payment intent');
    }
};

exports.createOneTime = async (req, res) => {
    try {
        const { paymentMethodId, paymentIntentId, invoiceId, email: emailProvided } = req.body;
        const email = emailProvided.toLowerCase();

        const donor = await Donor.findOne({ email }).lean();
        if (!donor) throw new Error('Donor not found.');

        const order = await Subscription.findOne({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();

        if (!order) throw new Error('Order not found!');

        if (!email) throw new Error('Email is required');

        let paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (!paymentIntent) {
            throw new Error('PaymentIntent not found');
        }

        if (paymentIntent.status !== 'succeeded') {
            throw new Error('Payment intent not completed successfully');
        }

        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

        const updatedDonor = await Donor.findOneAndUpdate(
            { email },
            {
                $push: {
                    payments: {
                        orderId: order._id,
                        paymentIntentId: paymentIntent.id,
                        status: paymentIntent.status,
                        amount: paymentIntent.amount / 100,
                        currency: paymentIntent.currency,
                        paymentMethodId: paymentMethodId,
                        paymentMethodType: paymentMethod.type,
                        created: new Date(paymentIntent.created * 1000),
                        invoiceId,
                    },
                },
            },
            { new: true, lean: true },
        );

        const checkCustomer = await Customer.findOne({ email }).lean();

        const { customerId, dashboardLink, freshCustomer } = await connectDonorInCustomer(updatedDonor, checkCustomer);

        await Subscription.updateOne({ _id: order._id }, { status: 'paid' });

        res.json({
            success: true,
            paymentIntentId: paymentIntent.id,
            customerId,
            dashboardLink,
            monthly: false,
            amount: `${order.total} ${order.currency}`,
        });

        successfulOneTimePaymentOverlay(order._id, freshCustomer);
    } catch (error) {
        console.error('Payment Error:', error);
        res.status(400).send(error.message || error || 'Server Error');
    }
};

exports.linkOrderToCustomer = async (req, res) => {
    try {
        const order = await Subscription.findOne({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();
        if (!order) throw new Error('Order not found');
        const customer = await Customer.findById(req.params.customerId).lean();
        if (!customer) throw new Error('Customer not found');
        await Subscription.updateOne({ _id: order._id }, { customerId: customer._id });
        res.status(200).send('Customer linked to order');
    } catch (error) {
        console.error('Link order to customer error:', error);
        res.status(400).send(error.message || error || 'Server Error');
    }
};
