require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);

const path = require('path');
const fs = require('fs').promises;

const Country = require('../models/Country');
const Project = require('../models/Project');
const Subscription = require('../models/Subscription');
const Customer = require('../models/Customer');
const Donor = require('../models/Donor');

const { calculateOrder, addPaymentsToOrder, formatOrderWidget, cleanOrder } = require('../modules/orders');
const { getOldestPaidEntries, makeProjectForWidgetOrder, makeEntriesForWidgetOrder } = require('../modules/ordersFetchEntries');
const { runQueriesOnOrder } = require('../modules/orderUpdates');
const {
    successfulOneTimePaymentProducts,
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

const {
    makeProductOrder,
    calculateProductOrder,
    findProjectInFile,
    incrementVariantToProductOrder,
    decrementVariantToProductOrder,
    removeVariantInProductOrder,
    changeProductOrderCurrency,
    removeUnorderedProducts
} = require('../modules/productActions');

exports.createNewOrder = async (req, res) => {
    try {
        const { slug } = req.params;
        if (slug !== 'qurbani' && slug !== 'water-pakistan' && slug !== 'emergency-pak-flood-appeal-2025') 
            throw new Error(`Project "${slug}" not found`);

        if (!req.query.countryCode) throw new Error(`Currency is required!`);

        const country = await Country.findOne({ code: req.query.countryCode }).lean();

        if (!country.currency.code) throw new Error(`${code} is not supported!`);

        const customer = await Customer.findById(process.env.TEMP_CUSTOMER_ID).lean();

        if (!customer) throw new Error('Temporary customer not found!');

        const currency = country.currency.code;
        
        const order = await makeProductOrder(currency, country, slug);

        res.render('partials/productEntries', {
            layout: false,
            data: {
                order
            },
        });
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message || 'Server error. Could not create new order!');
    }
};

exports.updateOrder = async (req, res) => {
    try {
        let order = await Subscription.findOne({ _id: req.params.orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();

        if (!order) throw new Error('Order not found!');

        if (req.query.checkin) {
            await Subscription.updateOne({ _id: order._id }, { $set: { status: 'draft' } });
            return res.status(200).send('order is checked in');
        }

        if (order.status === 'draft' || order.status === 'pending payment') {
            if (req.query.deleteOrder) {
                await Subscription.deleteOne({ _id: order._id });
                return res.status(200).send('order deleted successfully');
            }
        }

        if (!['draft', 'cancelled', 'aborted', 'created', 'expired', 'rejected'].includes(order.status)) 
            throw new Error(`Order can not be edited in ${order.status} mode`);

        const checkProject = await findProjectInFile(req.params.slug);

        if (!checkProject) throw new Error(`Project "${req.params.slug}" not found`);

        if (req.query.incrementVariant) {
            const { variantId } = req.query;
            await incrementVariantToProductOrder(order._id, variantId);
            await calculateProductOrder(order._id);
            const freshOrder = await Subscription.findById(order._id).lean();
            let foundEntry;
            for (const product of freshOrder.products) {
                for (const variant of product.variants) {
                    if (variant.id === variantId) {
                        foundEntry = variant;
                    }
                }
            }

            if (!foundEntry) throw new Error('Variant not found.');

            res.render('partials/productVariant', {
                layout: false,
                order: freshOrder,
                variant: foundEntry,
            });
            
        }

        if (req.query.decrementVariant) {
            const { variantId } = req.query;
            await decrementVariantToProductOrder(order._id, variantId);
            await calculateProductOrder(order._id);
            const freshOrder = await Subscription.findById(order._id).lean();
            let foundEntry;
            for (const product of freshOrder.products) {
                for (const variant of product.variants) {
                    if (variant.id === variantId) {
                        foundEntry = variant;
                    }
                }
            }

            if (!foundEntry) throw new Error('Variant not found.');

            res.render('partials/productVariant', {
                layout: false,
                order: freshOrder,
                variant: foundEntry,
            });
        };

        if (req.query.removeVariant) {
            const { variantId } = req.query;
            await removeVariantInProductOrder(order._id, variantId);
            await calculateProductOrder(order._id);
            const freshOrder = await Subscription.findById(order._id).lean();
            let foundEntry;
            for (const product of freshOrder.products) {
                for (const variant of product.variants) {
                    if (variant.id === variantId) {
                        foundEntry = variant;
                    }
                }
            }

            if (!foundEntry) throw new Error('Variant not found.');

            res.render('partials/productVariant', {
                layout: false,
                order: freshOrder,
                variant: foundEntry,
            });
        };

        if (req.query.setCurrency) {
            const { setCurrency: currency } = req.query;
            await changeProductOrderCurrency(currency, order._id);
            await calculateProductOrder(order._id);
            res.status(200).send('currency changed');
        };

        if (req.query.checkout) {
            if (order.total === 0)
                throw new Error('order can not be checked out with 0 cost');

            order = await Subscription.findOneAndUpdate(
                { _id: order._id },
                { $set: { status: 'pending payment' } },
                { new: true, lean: true },
            );

            res.status(200).send('order is checked out');
        }
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message || 'Server error. Could not update order!');
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
        const order = await Subscription.findOne({ _id: req.params.orderId }).lean();
        const project = await findProjectInFile(req.params.slug);
        if (!order || !project) throw new Error('Order or project not found!');
        res.render('partials/productEntries', {
            layout: false,
            data: {
                order,
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
        const { orderId, slug } = req.params;
        const email = emailProvided.toLowerCase();
        if (!isValidEmail(email)) throw new Error('Email provided is invalid');

        const order = await Subscription.findOne({ _id: orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();
        if (!order) throw new Error('Order not found');

        const amount = Math.max(100, Math.round(order.total * 100));

        const project = await findProjectInFile(slug);

        if (!project) throw new Error('Project not found');

        const description = `Order # ${order.orderNo} in ${project}`;

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

        const { paymentIntent, invoice } = await createStripeInvoice(order, amount, description, customer, order.products);

        res.json({ clientSecret: paymentIntent.client_secret, invoiceId: invoice.id });
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message || error || 'Server Error')
    }
};

exports.createOneTime = async (req, res) => {
    try {
        const { paymentMethodId, paymentIntentId, invoiceId, email: emailProvided } = req.body;
        const { orderId, slug } = req.params;

        const email = emailProvided?.toLowerCase();

        const donor = await Donor.findOne({ email }).lean();
        
        if (!donor) throw new Error('Donor not found.');

        const order = await Subscription.findOne({ _id: orderId, customerId: process.env.TEMP_CUSTOMER_ID }).lean();
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

        await removeUnorderedProducts(orderId);

        await Subscription.updateOne({ _id: order._id }, { status: 'paid' });

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

        successfulOneTimePaymentProducts(order._id, freshCustomer);
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
