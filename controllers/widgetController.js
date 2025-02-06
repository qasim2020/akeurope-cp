require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_TEST_KEY);
const path = require('path');
const fs = require('fs').promises;
const { getCurrencyRates } = require('../modules/getCurrencyRates');
const Country = require('../models/Country');
const { createDynamicModel } = require('../models/createDynamicModel');
const Project = require('../models/Project');

exports.widgets = async (req, res) => {
    try {
        res.render('widgets', {
            layout: 'dashboard',
        });
    } catch (err) {
        console.log(err);
        res.render('error', { heading: 'Server Error', error: 'Failed to fetch widgets' });
    }
};

exports.widget = async (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'public', 'payment-widget.js'));
};

exports.overlay = async (req, res) => {
    try {
        const project = await Project.findOne({slug: req.params.slug}).lean();

        if (!project) throw new Error('No project found');
    
        const DynamicModel = await createDynamicModel(req.params.slug);
        const entries = await DynamicModel.find().limit(10).lean();

        res.render('overlays/paymentModal', {
            layout: false,
            data: {
                entries
            }
        });   
        
    } catch (error) {
        console.log(error);
        res.send(error);
    }
};

exports.script = async (req, res) => {
    try {
        const overlayUrl = `${process.env.CUSTOMER_PORTAL_URL}/overlay/sweden-orphans?${new Date().getTime()}`;
        const scriptPath = path.join(__dirname, '..', 'static', 'script.js');

        console.log('Loading script from:', scriptPath);
        const file = await fs.readFile(scriptPath, 'utf8');

        const scriptContent = file.replace('__OVERLAY_URL__', overlayUrl);

        res.setHeader('Content-Type', 'application/javascript');
        res.send(scriptContent);
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).send('Internal Server Error');
    }
};

const dynamicRound = (value) => {
    let magnitude;

    if (value < 10) {
        magnitude = 1;
    } else if (value < 100) {
        magnitude = 10;
    } else if (value < 1000) {
        magnitude = 100;
    } else {
        magnitude = 1000;
    }

    return Math.ceil(value / magnitude) * magnitude;
};

exports.getPrices = async (req, res) => {
    try {
        const { code } = req.params;
        const country = await Country.findOne({ code: code }).lean();
        const countries = await Country.find().lean().sort({ name: 1 });
        const sortedCountries = countries.sort((a, b) => a.currency.code.localeCompare(b.name, 'en'));
        const baseCurrency = 'NOK';

        const data = await fs.readFile('products.json', 'utf8');
        const products = JSON.parse(data);

        const currencyRates = await getCurrencyRates(baseCurrency);
        const currency = country.currency.code;
        const conversionRate = currencyRates.rates[currency];

        if (!conversionRate) {
            return res.status(400).json({ error: 'Invalid or unsupported currency.' });
        }

        const monthly = [];
        const oneTime = [];

        for (const productId in products) {
            products[productId].prices.forEach((price) => {
                const convertedPrice = (price.price * conversionRate).toFixed(2);
                const priceObject = {
                    ...price,
                    amount: dynamicRound(convertedPrice),
                    currency: currency,
                };

                if (price.interval === 'one-time') {
                    oneTime.push(priceObject);
                } else {
                    monthly.push(priceObject);
                }
            });
        }

        res.json({
            monthly,
            oneTime,
            country,
            countries: sortedCountries,
        });
    } catch (error) {
        console.error('Error processing product prices:', error);
        res.status(500).send('Failed to fetch products.');
    }
};

exports.storePrices = async (req, res) => {
    try {
        const products = await stripe.products.list({
            limit: 50,
        });

        const productPriceMapping = {};

        for (const product of products.data) {
            const prices = await stripe.prices.list({
                product: product.id,
                limit: 10,
            });

            productPriceMapping[product.id] = {
                name: product.name,
                prices: prices.data.map((price) => ({
                    id: price.id,
                    price: price.unit_amount / 100,
                    currency: price.currency,
                    interval: price.recurring ? price.recurring.interval : 'one-time',
                })),
            };
        }

        await fs.writeFile('products.json', JSON.stringify(productPriceMapping, null, 2));
        console.log('Products saved successfully!');
        res.json(productPriceMapping);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

exports.createPaymentIntent = async (req, res) => {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 5000,
            currency: 'usd',
            payment_method_types: ['card'],
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: error.message });
    }
};

exports.countries = async (req, res) => {
    try {
        const countries = await Country.find().lean().sort({ name: 1 });
        res.json(countries);
    } catch (err) {
        res.status(500).json({ error: 'Unable to fetch countries' });
    }
};
