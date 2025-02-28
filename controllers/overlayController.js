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
const { default: mongoose } = require('mongoose');
const { isValidEmail } = require('../modules/checkValidForm');
const { saveLog } = require('../modules/logAction');
const { getChanges } = require('../modules/getChanges');
const { logTemplates } = require('../modules/logTemplates');
const { getCurrencyRates } = require('../modules/getCurrencyRates');

exports.wScript = async (req, res) => {
    try {
        const scriptPath = path.join(__dirname, '..', 'static', 'webflow.js');
        const file = await fs.readFile(scriptPath, 'utf8');
        const scriptContent = file
            .replace('__CUSTOMER_PORTAL_URL__', process.env.CUSTOMER_PORTAL_URL);
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

        console.log({ amount, currencyRate });
        if (amount < 100) throw new Error('Total can not be lower than 100 NOK');

        let order = new Subscription({
            customerId: customer._id,
            currency: country.currency.code,
            total,
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

exports.updateOrder = async (req, res) => {
    try {
        let order = await Order.findById({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();

        if (!order) throw new Error('Order not found!');

        if (req.query.checkin) {
            order = await Order.findOneAndUpdate({ _id: order._id }, { $set: { status: 'draft' } }, { new: true, lean: true });
            return res.status(200).send('order is checked in');
        }

        if (order.status === 'draft' || order.status === 'pending payment') {
            if (req.query.deleteOrder) {
                await Order.deleteOne({ _id: order._id });
                return res.status(200).send('order deleted successfully');
            }
        }

        if (order.status !== 'draft') return res.status(404).send(`Order can not be edited in ${order.status} mode`);

        const checkProject = await Project.findOne({ slug: req.params.slug }).lean();

        if (!checkProject) throw new Error(`Project "${req.params.slug}" not found`);

        if (req.query.addEntries) {
            const currentEntries = order.projects.flatMap((project) => project.entries);
            req.query.orderId = new mongoose.Types.ObjectId();
            req.query.select = currentEntries.length + 3;

            const { project, allEntries } = await getOldestPaidEntries(req, checkProject);

            const newEntries = allEntries
                .filter((newEntry) => {
                    return !currentEntries.some((existingEntry) => existingEntry.entryId.toString() === newEntry._id.toString());
                })
                .slice(0, 3);

            const entriesForOrder = makeEntriesForWidgetOrder(newEntries, 0);
            const updatedOrder = await Order.findOneAndUpdate(
                { _id: order._id, 'projects.slug': checkProject.slug },
                {
                    $push: {
                        'projects.$.entries': { $each: entriesForOrder },
                    },
                },
                {
                    lean: true,
                    new: true,
                },
            );

            const calculatedOrder = await calculateOrder(updatedOrder);
            await addPaymentsToOrder(calculatedOrder);

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
        }

        if (req.query.subscriptions && req.query.entryId) {
            req.query = {
                orderId: order._id,
                entryId: req.query.entryId,
                subscriptions: req.query.subscriptions,
            };
            order = await runQueriesOnOrder(req, res, false);
            const calculatedOrder = await calculateOrder(order);
            await addPaymentsToOrder(calculatedOrder);
            const updatedOrder = await Order.findById(order._id).lean();
            const formattedOrder = await formatOrderWidget(updatedOrder);
            let foundEntry;
            for (const project of formattedOrder.projects) {
                for (const entry of project.entries) {
                    if (entry.entryId.toString() === req.query.entryId) {
                        foundEntry = entry;
                    }
                }
            }

            if (!foundEntry) throw new Error('Entry not found.');

            res.render('partials/widgetEntry', {
                layout: false,
                order: formattedOrder,
                entry: foundEntry,
            });
        }

        if (req.query.monthlySubscription) {
            req.query.orderId = order._id;
            order = await runQueriesOnOrder(req, res, false);
            res.status(200).send('subscription monthly or one time updated');
        }

        if (req.query.months) {
            if (req.query.months > 48) {
                req.query.months = 48;
            } else if (req.query.months < 1) {
                req.query.months = 1;
            }
            req.query.orderId = order._id;
            order = await runQueriesOnOrder(req, res, false);
            const calculatedOrder = await calculateOrder(order);
            await addPaymentsToOrder(calculatedOrder);
            res.status(200).send('months changed');
        }

        if (req.query.currency && req.query.countryCode) {
            req.query.orderId = order._id;
            order = await runQueriesOnOrder(req, res, false);
            const calculatedOrder = await calculateOrder(order);
            await addPaymentsToOrder(calculatedOrder);
            res.status(200).send('currency changed');
        }

        if (req.query.checkout) {
            if (order.totalCost === 0 || order.totalCostSingleMonth === 0)
                throw new Error('order can not be checked out with 0 cost');
            order = await Order.findOneAndUpdate(
                { _id: order._id },
                { $set: { status: 'pending payment' } },
                { new: true, lean: true },
            );
            const calculatedOrder = await calculateOrder(order);
            await addPaymentsToOrder(calculatedOrder);
            res.status(200).send('order is checked out');
        }
    } catch (error) {
        console.log(error);
        res.status(400).send('Server error. Try refreshing your browser.');
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

const connectDonorInCustomer = async function (donor, checkCustomer) {
    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    let dashboardLink;

    if (!checkCustomer || !(checkCustomer && checkCustomer.password)) {
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = moment().add(24, 'hours').toDate();
        const location = (await Country.findOne({ code: donor.countryCode }).lean()).name;

        const newCustomer = await Customer.findOneAndUpdate(
            {
                email: donor.email,
            },
            {
                $set: {
                    name: `${donor.firstName} ${donor.lastName}`,
                    role: 'donor',
                    location,
                    organization: donor.organization,
                    tel: donor.tel,
                    anonymous: donor.anonymous,
                    countryCode: donor.countryCode,
                    emailStatus: 'Email invite sent!',
                    inviteToken: inviteToken,
                    inviteExpires: inviteExpires,
                },
                $setOnInsert: { email: donor.email },
            },
            { new: true, lean: true, upsert: true },
        );

        const templatePath = path.join(__dirname, '../views/emails/donorInvite.handlebars');
        const templateSource = await fs.readFile(templatePath, 'utf8');
        const compiledTemplate = handlebars.compile(templateSource);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: newCustomer.email,
            subject: 'Registration Link for Akeurope Partner Portal',
            html: compiledTemplate({
                name: newCustomer.name,
                inviteLink: `${process.env.CUSTOMER_PORTAL_URL}/register/${inviteToken}`,
            }),
        };

        dashboardLink = `${process.env.CUSTOMER_PORTAL_URL}/register/${inviteToken}`;

        transporter.sendMail(mailOptions);

        if (!checkCustomer) {
            await saveLog(
                logTemplates({
                    type: 'newCustomerStartedSubscription',
                    entity: newCustomer,
                    actor: newCustomer,
                }),
            );
        }

        if (!(checkCustomer && checkCustomer.password)) {
            await saveLog(
                logTemplates({
                    type: 'sentEmailCustomerInvite',
                    entity: newCustomer,
                    actor: newCustomer,
                }),
            );
        }

        checkCustomer = newCustomer;
    } else {
        const newCustomer = await Customer.findOneAndUpdate(
            { email: donor.email },
            {
                name: `${donor.firstName} ${donor.lastName}`,
                role: 'donor',
                organization: donor.organization,
                tel: donor.tel,
                anonymous: donor.anonymous,
                countryCode: donor.countryCode,
            },
            {
                upsert: true,
                new: true,
                lean: true,
            },
        );

        const templatePath = path.join(__dirname, '../views/emails/donorSubscribed.handlebars');
        const templateSource = await fs.readFile(templatePath, 'utf8');
        const compiledTemplate = handlebars.compile(templateSource);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: newCustomer.email,
            subject: 'Login Link to Akeurope Partner Portal',
            html: compiledTemplate({
                name: newCustomer.name,
                inviteLink: `${process.env.CUSTOMER_PORTAL_URL}/login`,
            }),
        };

        dashboardLink = `${process.env.CUSTOMER_PORTAL_URL}`;

        transporter.sendMail(mailOptions);

        const changes = getChanges(checkCustomer, newCustomer);

        if (changes.length > 0) {
            await saveLog(
                logTemplates({
                    type: 'customerUpdated',
                    entity: newCustomer,
                    changes,
                    actor: newCustomer,
                }),
            );
        }

        checkCustomer = newCustomer;
    }

    return {
        customerId: checkCustomer._id,
        dashboardLink,
    };
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
            const customerDetails = await stripe.customers.retrieve(customer.id);

            if (!customerDetails.invoice_settings.default_payment_method) {
                await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });

                await stripe.customers.update(customer.id, {
                    invoice_settings: { default_payment_method: paymentMethodId },
                });
            }
        }

        const amount = Math.max(100, Math.round(order.total * 100));

        const price = await stripe.prices.create({
            unit_amount: amount,
            currency: order.currency,
            recurring: { interval: 'month' },
            product_data: {
                name: `Order - ${order.projectSlug} - ${order.orderNo}`,
            },
        });

        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: price.id }],
            payment_settings: { payment_method_types: ['card'] },
            expand: ['latest_invoice.payment_intent'],
        });

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

        const { customerId, dashboardLink } = await connectDonorInCustomer(updatedDonor, checkCustomer);

        await Subscription.updateOne({ _id: order._id }, { status: 'paid' });

        res.json({
            success: true,
            subscriptionId: subscription.id,
            customerId,
            dashboardLink,
            amount: `${order.total} ${order.currency}`,
            monthly: true,
        });
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
        const checkDonor = await Donor.findOne({ email }).lean();

        let donor;

        if (checkDonor) {
            donor = checkDonor;
        } else {
            donor = new Donor({
                firstName,
                lastName,
                tel,
                organization,
                anonymous,
                countryCode,
                status: 'active',
                role: 'donor',
            });
            await donor.save();
        }
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

        const checkDonor = await Donor.findOne({ email }).lean();

        let donor;

        if (checkDonor) {
            donor = checkDonor;
        } else {
            donor = new Donor({
                stripeCustomerId: customer.id,
                firstName,
                lastName,
                tel,
                organization,
                anonymous,
                countryCode,
                status: 'active',
                role: 'donor',
            });
            await donor.save();
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: order.currency,
            customer: customer.id,
            automatic_payment_methods: { enabled: true },
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.log(error);
        res.status(500).send('Server error. Error creating payment intent.');
    }
};

exports.createOneTime = async (req, res) => {
    try {
        const { paymentMethodId, paymentIntentId, email: emailProvided } = req.body;
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
                    },
                },
            },
            { new: true, lean: true },
        );

        const checkCustomer = await Customer.findOne({ email }).lean();

        const { customerId, dashboardLink } = await connectDonorInCustomer(updatedDonor, checkCustomer);

        await Subscription.updateOne({ _id: order._id }, { status: 'paid' });

        res.json({
            success: true,
            paymentIntentId: paymentIntent.id,
            customerId,
            dashboardLink,
            monthly: false,
            amount: `${order.total} ${order.currency}`,
        });
    } catch (error) {
        console.error('Payment Error:', error);
        res.status(400).send(error.message || error || 'Server Error');
        res.status(400).json('Server error. Could not create one-time!');
    }
};

exports.linkOrderToCustomer = async (req, res) => {
    try {
        const order = await Subscription.findOne({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();
        if (!order) throw new Error('Order not found');
        const customer = await Customer.findById(req.params.customerId).lean();
        if (!customer) throw new Error('Customer not found');
        await Subscription.updateOne({ _id: order._id }, { customerId: customer._id });
        await saveLog(
            logTemplates({
                type: 'customerAddedToOrder',
                entity: order,
                actor: customer,
                order,
                customer,
            }),
        );
        res.status(200).send('Customer linked to order');
    } catch (error) {
        console.error('Link order to customer error:', error);
        res.status(400).send(error.message || error || 'Server Error');
    }
};
