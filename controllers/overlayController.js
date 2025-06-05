require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);

const fs = require('fs').promises;
const path = require('path');

const Country = require('../models/Country');
const Subscription = require('../models/Subscription');
const Customer = require('../models/Customer');
const Donor = require('../models/Donor');
const {
    connectDonorInCustomer,
    successfulOneTimePaymentOverlay,
    successfulSubscriptionPaymentOverlay,
} = require('../modules/orderPostActions');
const { isValidEmail } = require('../modules/checkValidForm');
const { getCurrencyRates } = require('../modules/getCurrencyRates');
const { slugToString, roundToNearest } = require('../modules/helpers');
const {
    createSubscriptionModule,
    createSetupIntentModule,
    createStripeInvoice,
    createOneTimeModule,
    createPaymentIntentModule,
} = require('../modules/stripe');

exports.wScript = async (req, res) => {
    try {
        const countryCode = req.headers['cf-ipcountry'] || 'NO';
        const scriptPath = path.join(__dirname, '..', 'static', 'webflow.js');
        const file = await fs.readFile(scriptPath, 'utf8');
        const scriptContent = file
            .replaceAll('__CUSTOMER_PORTAL_URL__', process.env.CUSTOMER_PORTAL_URL)
            .replaceAll('__COUNTRY_CODE__', countryCode);
        res.setHeader('Content-Type', 'application/javascript');
        res.send(scriptContent);
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).send('Internal Server Error');
    }
};

async function getRandomProducts(project, code) {
    const baseCurrency = project.currency;
    const products = project.products;
    const randomSet = products[Math.floor(Math.random() * products.length)];

    const oneTime = randomSet.oneTime;
    const monthly = randomSet.monthly;

    const currencyRates = await getCurrencyRates(code);
    const currencyRate = parseFloat(currencyRates.rates[baseCurrency].toFixed(2));

    const productList = {
        oneTime: oneTime.map((amount) => roundToNearest(amount / currencyRate)),
        monthly: monthly.map((amount) => roundToNearest(amount / currencyRate)),
    };

    return productList;
}

async function getProductList(code, requestedProducts) {
    const filePath = path.join(__dirname, '../products.json');
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    const project = data[requestedProducts];
    if (!project) 
        throw new Error('Products not listed in json file');
    
    let productList;

    if (requestedProducts === 'random') {
        productList = await getRandomProducts(project, code);
    } else {
        throw new Error('Only random products can be accessed here.');
    }

    return productList;
}

exports.overlayProducts = async (req, res) => {
    try {
        if (!req.params.code) throw new Error('Country Code is required');
        const code = req.params.code;
        const country = await Country.findOne({ code: code }).lean();
        if (!country) throw new Error('Currency is not supported');
        const products = await getProductList(country.currency.code, req.params.products);
        res.status(200).json({
            products,
            country,
        });
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message);
    }
};

exports.overlayCountry = async (req, res) => {
    try {
        if (!req.params.code) throw new Error('Country Code is required');
        const country = await Country.findOne({ code: req.params.code }).lean();
        if (!country) throw new Error('Currency is not supported');
        res.status(200).json({
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

        if (amount < 100) {
            const minAmountInUserCurrency = (100 / currencyRate).toFixed(2);
            throw new Error(`Total cannot be lower than ${minAmountInUserCurrency} ${country.currency.code}`);
        }

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

exports.createSetupIntent = async (req, res) => {
    try {
        const { email: emailProvided, firstName, lastName, tel, organization, anonymous, countryCode } = req.body;
        const email = emailProvided.toLowerCase();

        if (!isValidEmail(email)) throw new Error('Email provided is invalid');

        const order = await Subscription.findOne({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();

        if (!order) throw new Error('Order not found');

        const setupIntent = await createSetupIntentModule(
            order,
            email,
            firstName,
            lastName,
            tel,
            organization,
            anonymous,
            countryCode,
        );

        res.json({ clientSecret: setupIntent.client_secret });
    } catch (error) {
        console.error('Error creating SetupIntent:', error);
        res.status(500).send(error.message || 'Server Error. Could not create setup intent.');
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

        const amount = Math.max(100, Math.round(order.total * 100));

        const description = `${slugToString(order.projectSlug)} # ${order.orderNo}`;

        const { updatedDonor, subscription } = await createSubscriptionModule(paymentMethodId, donor, order, amount, description);

        let checkCustomer = await Customer.findOne({ email }).lean();

        const { customerId, dashboardLink, freshCustomer } = await connectDonorInCustomer(updatedDonor, checkCustomer);

        await Subscription.updateOne({ _id: order._id }, { status: 'paid' });

        res.json({
            success: true,
            subscriptionId: subscription.id,
            customerId,
            dashboardLink,
            monthly: true,
            amount: order.total,
            currency: order.currency,
            orderNo: order.orderNo,
        });

        successfulSubscriptionPaymentOverlay(order._id, freshCustomer);
    } catch (error) {
        console.error('Subscription Error:', error);
        res.status(400).send(error.message || error || 'Server Error');
    }
};

exports.createPaymentIntent = async (req, res) => {
    try {
        const { email: emailProvided, firstName, lastName, tel, organization, anonymous, countryCode } = req.body;

        const email = emailProvided.toLowerCase();

        if (!isValidEmail(email)) throw new Error('Email provided is invalid');

        const order = await Subscription.findOne({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();

        if (!order) throw new Error('Order not found');

        const amount = Math.max(100, Math.round(order.total * 100));

        const description = `${slugToString(order.projectSlug)} # ${order.orderNo}`;

        const customer = await createPaymentIntentModule(
            order,
            email,
            firstName,
            lastName,
            tel,
            organization,
            anonymous,
            countryCode,
        );

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

        const { updatedDonor, paymentIntent } = await createOneTimeModule(
            order,
            paymentMethodId,
            paymentIntentId,
            invoiceId,
            email,
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
            amount: order.total,
            currency: order.currency,
            orderNo: order.orderNo,
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
