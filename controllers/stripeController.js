require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);

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
        res.status(500).send('Error creating portal session');
    }
};
