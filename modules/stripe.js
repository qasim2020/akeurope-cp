require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);
const Donor = require('../models/Donor');
const { validatePhoneNumber } = require('../modules/twilio');

const createStripeInvoice = async (order, amount, description, customer, products = []) => {
    const invoice = await stripe.invoices.create({
        number: `${Date.now()} - ${order.orderNo}`,
        customer: customer.id,
        collection_method: 'charge_automatically',
        auto_advance: false,
        currency: order.currency.toLowerCase(),
    });

    if (products.length > 0) {
        for (const product of products) {
            for (const variant of product.variants) {
                if (variant.orderedCost > 0) {
                    await stripe.invoiceItems.create({
                        customer: customer.id,
                        unit_amount: variant.price * 100,
                        currency: order.currency.toLowerCase(),
                        description: `${product.name} - ${variant.name}`,
                        quantity: variant.quantity,
                        invoice: invoice.id,
                    });
                }
            }
        }
    } else {
        await stripe.invoiceItems.create({
            customer: customer.id,
            amount,
            currency: order.currency.toLowerCase(),
            description,
            invoice: invoice.id,
        });
    }

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    const paymentIntent = await stripe.paymentIntents.retrieve(finalizedInvoice.payment_intent);

    return {
        paymentIntent,
        invoice,
    };
};

const createSetupIntentModule = async (order, email, firstName, lastName, phoneNumber, organization, anonymous, countryCode) => {

    const tel = await validatePhoneNumber(phoneNumber);

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

    let customers = await stripe.customers.list({ email: email });
    let customer = customers.data.find((c) => c.currency === order.currency.toLowerCase());

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

    const setupIntent = await stripe.setupIntents.create({
        payment_method_types: ['card'],
        metadata: { email: donor.email },
        customer: customer.id,
    });

    return setupIntent;
};

const createSubscriptionModule = async (paymentMethodId, donor, order, amount, description) => {
    let customers = await stripe.customers.list({ email: donor.email });

    let customer = customers.data.find((c) => c.currency === order.currency.toLowerCase() || !c.currency);

    if (!customer) {
        throw new Error('Customer not found - should be created in previous step!');
    } else {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
    }

    const price = await stripe.prices.create({
        unit_amount: amount,
        currency: order.currency,
        recurring: { interval: 'month' },
        product_data: {
            name: description,
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
        { email: donor.email },
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
    return { updatedDonor, subscription };
};

const createPaymentIntentModule = async (order, email, firstName, lastName, phoneNumber, organization, anonymous, countryCode) => {

    const tel = await validatePhoneNumber(phoneNumber);
    
    let customers = await stripe.customers.list({ email: email });
    let customer = customers.data.find((c) => c.currency === order.currency.toLowerCase());

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

    return customer;
};

const createOneTimeModule = async (order, paymentMethodId, paymentIntentId, invoiceId, email) => {
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

    return {
        updatedDonor,
        paymentIntent
    }
};

module.exports = {
    createStripeInvoice,
    createSetupIntentModule,
    createSubscriptionModule,
    createPaymentIntentModule,
    createOneTimeModule,
};
