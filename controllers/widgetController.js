require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);

const path = require('path');
const fs = require('fs').promises;

const Country = require('../models/Country');
const Project = require('../models/Project');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Donor = require('../models/Donor');

const { calculateOrder, addPaymentsToOrder, formatOrderWidget, cleanOrder } = require('../modules/orders');
const { getOldestPaidEntries, makeProjectForWidgetOrder, makeEntriesForWidgetOrder } = require('../modules/ordersFetchEntries');
const { runQueriesOnOrder } = require('../modules/orderUpdates');
const {
    successfulOneTimePayment,
    successfulSubscriptionPayment,
    connectDonorInCustomer,
} = require('../modules/orderPostActions');

const { default: mongoose } = require('mongoose');
const { isValidEmail } = require('../modules/checkValidForm');
const { slugToCamelCase, slugToString, dynamicRound } = require('../modules/helpers');
const {
    createSubscriptionModule,
    createSetupIntentModule,
    createStripeInvoice,
    createOneTimeModule,
    createPaymentIntentModule,
} = require('../modules/stripe');

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
        const publicKey = process.env.STRIPE_PUBLIC_KEY;
        const portalUrl = process.env.CUSTOMER_PORTAL_URL;
        if (req.query.webflow) {
            res.render('overlays/overlayModal', {
                layout: false,
                data: {
                    project: {
                        name: req.query.name,
                        heading: req.query.heading,
                        cover: req.query.cover,
                        desc: req.query.description,
                        slug: req.params.slug,
                    },
                    countryCode: req.query.countryCode,
                    publicKey,
                    portalUrl,
                },
            });
            return;
        }
        const project = await Project.findOne({ slug: req.params.slug, status: 'active' }).lean();
        if (!project) throw new Error('Project not found');
        let donor = {};
        if (req.query.email) {
            const donorCheck = await Donor.findOne({ email: req.query.email }).lean();
            const customerProfile = await Customer.findOne({ email: req.query.email }).lean();
            if (donorCheck || customerProfile) {
                donor = {
                    email: donorCheck?.email || customerProfile.email,
                    firstName: donorCheck?.firstName,
                    lastName: donorCheck?.lastName,
                    countryCode: donorCheck?.countryCode,
                };
            }
        }
        res.render('overlays/paymentModal', {
            layout: false,
            data: {
                project,
                donor,
                publicKey,
                portalUrl,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(400).send(error);
    }
};

exports.scriptIframe = async (req, res) => {
    try {
        const overlayUrl = `${process.env.CUSTOMER_PORTAL_URL}/overlay/${req.params.slug}`;
        const scriptPath = path.join(__dirname, '..', 'static', 'scriptIframe.js');

        const file = await fs.readFile(scriptPath, 'utf8');
        const project = await Project.findOne({ slug: req.params.slug, status: 'active' }).lean();

        if (!project) throw new Error('Project not found!');

        const scriptContent = file
            .replaceAll('__OVERLAY_URL__', overlayUrl)
            .replaceAll('__PROJECT_SLUG__', project.slug)
            .replaceAll('__PROJECT_CAMEL_CASE__', slugToCamelCase(project.slug));

        res.setHeader('Content-Type', 'application/javascript');
        res.send(scriptContent);
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).send('Internal Server Error');
    }
};

exports.script = async (req, res) => {
    try {
        const overlayUrl = `${process.env.CUSTOMER_PORTAL_URL}/overlay/${req.params.slug}`;
        const scriptPath = path.join(__dirname, '..', 'static', 'script.js');

        const file = await fs.readFile(scriptPath, 'utf8');
        const project = await Project.findOne({ slug: req.params.slug, status: 'active' }).lean();

        if (!project) throw new Error('Project not found!');
        if (project.slug === 'gaza-orphans') {
            project.right = '-75px';
        } else {
            project.right = '-67px';
        }

        const scriptContent = file
            .replace('__OVERLAY_URL__', overlayUrl)
            .replace('__PROJECT_NAME__', project.name)
            .replace('__PROJECT_SLUG__', project.slug)
            .replace('__PROJECT_RIGHT__', project.right);

        res.setHeader('Content-Type', 'application/javascript');
        res.send(scriptContent);
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).send('Internal Server Error');
    }
};

exports.getCountryList = async (req, res) => {
    try {
        const { code } = req.params;
        const country = await Country.findOne({ code: code }).lean();
        const countries = await Country.find().lean().sort({ name: 1 });
        const sortedCountries = countries.sort((a, b) => a.currency.code.localeCompare(b.name, 'en'));
        res.json({
            country,
            countries: sortedCountries,
        });
    } catch (error) {
        console.error('Error processing product prices:', error);
        res.status(500).send('Failed to fetch products.');
    }
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

        const updatedProject = makeProjectForWidgetOrder(project, allEntries, 6, 1);

        let order = new Order({
            customerId: customer._id,
            currency: country.currency.code,
            projects: [updatedProject],
            monthlySubscription: true,
            countryCode: country.code,
        });

        await order.save();
        order = order.toObject();
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

        if (!['draft', 'cancelled', 'aborted', 'created', 'expired', 'rejected'].includes(order.status)) 
            throw new Error(`Order can not be edited in ${order.status} mode`);

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

            if (order.monthlySubscription) {
                req.query.months = 1;
                req.query.orderId = order._id;
                order = await runQueriesOnOrder(req, res, false);
            }
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

exports.renderOrderEntries = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();
        const project = await Project.findOne({ slug: req.params.slug }).lean();
        if (!order || !project) throw new Error('Order or project not found!');

        const formattedOrder = await formatOrderWidget(order);

        res.render('partials/widgetEntries', {
            layout: false,
            data: {
                order: formattedOrder,
                project,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(400).send('Server error. Could not fetch entries!');
    }
};

exports.renderNoOrderEntries = async (req, res) => {
    try {
        const project = await Project.findOne({ slug: req.params.slug }).lean();
        res.render('partials/widgetEntries', {
            layout: false,
            data: {
                project,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(400).send('Server error. Could not render entries.');
    }
};

exports.renderNoOrderTotal = async (req, res) => {
    try {
        res.render('partials/widgetNoOrderTotal', {
            layout: false,
            data: {},
        });
    } catch (error) {
        console.log(error);
        res.status(400).send('Server error. Could not render entries.');
    }
};

exports.createPaymentIntent = async (req, res) => {
    try {
        const { email: emailProvided, firstName, lastName, tel, organization, anonymous, countryCode } = req.body;
        const email = emailProvided.toLowerCase();
        if (!isValidEmail(email)) throw new Error('Email provided is invalid');

        const order = await Order.findOne({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();
        if (!order) throw new Error('Order not found');

        const amount = Math.max(100, Math.round(order.totalCost * 100));

        const projects = order.projects.map((proj) => slugToString(proj.slug)).join(', ');

        const description = `Order # ${order.orderNo} in ${projects}`;

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
        res.status(400).send(error.message || error || 'Server Error')
    }
};

exports.createOneTime = async (req, res) => {
    try {
        const { paymentMethodId, paymentIntentId, invoiceId, email: emailProvided } = req.body;

        const email = emailProvided?.toLowerCase();

        const donor = await Donor.findOne({ email }).lean();
        
        if (!donor) throw new Error('Donor not found.');

        const order = await Order.findOne({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();
        if (!order) throw new Error('Order not found!');

        if (!email) throw new Error('Email is required');

        const { updatedDonor, paymentIntent } = await createOneTimeModule(
            order,
            paymentMethodId,
            paymentIntentId,
            invoiceId,
            email,
        );

        const checkCustomer = await Customer.findOne({ email }).lean();

        const { customerId, dashboardLink, freshCustomer } = await connectDonorInCustomer(updatedDonor, checkCustomer);

        await cleanOrder(order._id);

        await Order.updateOne({ _id: order._id }, { status: 'paid' });

        res.json({
            success: true,
            paymentIntentId: paymentIntent.id,
            customerId,
            dashboardLink,
            monthly: false,
            amount: order.totalCost,
            currency: order.currency,
            orderNo: order.orderNo,
        });

        successfulOneTimePayment(order._id, freshCustomer);
    } catch (error) {
        console.error('Payment Error:', error);
        res.status(400).send(error.message || error || 'Server Error');
    }
};

exports.createSetupIntent = async (req, res) => {
    try {
        const { email: emailProvided, firstName, lastName, tel, organization, anonymous, countryCode } = req.body;

        const email = emailProvided.toLowerCase();

        if (!isValidEmail(email)) throw new Error('Email provided is invalid');

        const order = await Order.findOne({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();

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
        res.status(400).send(error.message || error || 'Server Error');
    }
};

exports.createSubscription = async (req, res) => {
    try {
        const { paymentMethodId, email: emailProvided } = req.body;

        const email = emailProvided.toLowerCase();

        const donor = await Donor.findOne({ email }).lean();
        if (!donor) throw new Error('Donor not found.');

        const order = await Order.findOne({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();
        if (!order) throw new Error('Order not found!');

        const amount = Math.max(100, Math.round(order.totalCostSingleMonth * 100));

        const description = `Order - ${order.orderNo}`;

        const { updatedDonor, subscription } = await createSubscriptionModule(paymentMethodId, donor, order, amount, description);

        let checkCustomer = await Customer.findOne({ email }).lean();

        const { customerId, dashboardLink, freshCustomer } = await connectDonorInCustomer(updatedDonor, checkCustomer);

        await cleanOrder(order._id);

        await Order.updateOne({ _id: order._id }, { status: 'paid' });

        res.json({
            success: true,
            subscriptionId: subscription.id,
            customerId,
            dashboardLink,
            monthly: true,
            amount: order.totalCostSingleMonth,
            currency: order.currency,
            orderNo: order.orderNo,
        });

        successfulSubscriptionPayment(order._id, freshCustomer);
    } catch (error) {
        console.error('Subscription Error:', error);
        res.status(400).send(error.message || error || 'Server Error');
    }
};

exports.linkOrderToCustomer = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();
        if (!order) throw new Error('Order not found');
        const customer = await Customer.findById(req.params.customerId).lean();
        if (!customer) throw new Error('Customer not found');
        await Order.updateOne({ _id: order._id }, { customerId: customer._id });
        res.status(200).send('Customer linked to order');
    } catch (error) {
        console.error('Link order to customer error:', error);
        res.status(400).send(error.message || error || 'Server Error');
    }
};
