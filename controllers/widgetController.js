require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_TEST_KEY);
const path = require('path');
const fs = require('fs').promises;
const { getCurrencyRates } = require('../modules/getCurrencyRates');
const Country = require('../models/Country');
const Project = require('../models/Project');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const { calculateOrder, addPaymentsToOrder, formatOrderWidget } = require('../modules/orders');
const { getOldestPaidEntries, makeProjectForOrder } = require('../modules/ordersFetchEntries');
const { runQueriesOnOrder } = require('../modules/orderUpdates');
const { projectEntries } = require('../modules/projectEntries');

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
        const project = await Project.findOne({ slug: req.params.slug }).lean();
        res.render('overlays/paymentModal', {
            layout: false,
            data: {
                project,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(400).send(error);
    }
};

exports.script = async (req, res) => {
    try {
        const overlayUrl = `${process.env.CUSTOMER_PORTAL_URL}/overlay/${req.params.slug}?${new Date().getTime()}`;
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

const unselectEntriesInOrder = async (req, order, project, count) => {
    req.query = {
        orderId: order._id,
        subscriptions: 'empty',
    };
    req.params = {
        slug: project.slug,
    };
    let updatedOrder;

    project.entries.reverse();

    for (const entry of project.entries) {
        if (count < 1) break;
        req.query.entryId = entry.entryId;
        updatedOrder = await runQueriesOnOrder(req, '', false);
        count--;
    }

    return updatedOrder;
};

exports.createNewOrder = async (req, res) => {
    try {
        const checkProject = await Project.findOne({
            slug: req.params.slug,
        }).lean();
        if (!checkProject) throw new Error(`Project "${req.params.slug}" not found`);

        if (!req.query.countryCode) throw new Error(`Currency is required!`);

        const country = await Country.findOne({ code: req.query.countryCode }).lean();

        if (!country.currency.code) throw new Error(`${code} is not supported!`);

        const customer = await Customer.findById(process.env.TEMP_CUSTOMER_ID).lean();

        if (!customer) throw new Error('Temporary customer not found!');

        req.query.currency = country.currency.code;
        req.query.select = 3;

        const { project, allEntries } = await getOldestPaidEntries(req, checkProject);

        if (allEntries.length === 0) {
            return res.render('partials/widgetNoFreeEntries', {
                layout: false,
            });
        }

        const updatedProject = makeProjectForOrder(project, allEntries, 1);

        let order = new Order({
            customerId: customer._id,
            currency: req.query.currency,
            projects: [updatedProject],
            monthlySubscription: true,
        });

        await order.save();
        order = order.toObject();

        if (allEntries.length < 3) {
            if (allEntries.length === 2) {
                order = await unselectEntriesInOrder(req, order, updatedProject, 1);
            }
        } else {
            order = await unselectEntriesInOrder(req, order, updatedProject, 2);
        }

        const calculatedOrder = await calculateOrder(order);
        await addPaymentsToOrder(calculatedOrder);

        const freshOrder = await Order.findById(order._id).lean();
        const formattedOrder = await formatOrderWidget(freshOrder);

        res.render('partials/widgetEntries', {
            layout: false,
            data: {
                order: formattedOrder,
                project: checkProject,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(400).send('Server error. Could not create new order!');
    }
};

exports.getOrderData = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId).lean();
        if (!order) throw new Error('Order not found!');
        const customerId = order.customerId;
        if (customerId.toString() !== process.env.TEMP_CUSTOMER_ID) throw new Error('Unauthorized request!');
        const formattedOrder = await formatOrderWidget(order);
        res.send(formattedOrder);
    } catch (error) {
        console.log(error);
        res.status(400).send('Server error. Could not get order data!');
    }
};

exports.updateOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId).lean();
        if (!order) throw new Error('Order not found!');
        const checkProject = await Project.findOne({
            slug: req.params.slug,
        }).lean();
        if (!checkProject) throw new Error(`Project "${req.params.slug}" not found`);
        if (req.query.addEntries) {
            const { project, allEntries } = await getOldestPaidEntries(req, checkProject);
            const updatedProject = makeProjectForOrder(project, allEntries, 1);
            const currentEntries = order.projects.flatMap((project) => project.entries);
            const entriesToAdd = updatedProject.entries;
            const newEntries = entriesToAdd
                .filter(
                    (entryToAdd) =>
                        !currentEntries.some(
                            (existingEntry) => existingEntry.entryId.toString() === entryToAdd.entryId.toString(),
                        ),
                )
                .slice(0, 3);
            const updatedOrder = await Order.findOneAndUpdate(
                { _id: order._id, 'projects.slug': checkProject.slug },
                {
                    $push: {
                        'projects.$.entries': { $each: newEntries },
                    },
                },
                {
                    lean: true,
                    new: true,
                },
            );
            const calculatedOrder = await calculateOrder(updatedOrder);
            await addPaymentsToOrder(calculatedOrder);
        }

        const freshOrder = await Order.findById(order._id).lean();
        const existingEntryIds = new Set(
            order.projects.flatMap((project) => project.entries.map((entry) => entry.entryId.toString())),
        );

        freshOrder.projects.forEach((project) => {
            project.entries = project.entries.filter((entry) => !existingEntryIds.has(entry.entryId.toString()));
        });
        const formattedOrder = await formatOrderWidget(freshOrder);

        res.render('partials/widgetEntriesUpdated', {
            layout: false,
            data: {
                order: formattedOrder,
                project: checkProject,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(400).send('Server error. Try refreshing your browser.');
    }
};
