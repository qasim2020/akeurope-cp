require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);

const createStripeInvoice = async (order, amount, description, customer) => {
    const invoice = await stripe.invoices.create({
        number: order.orderNo,
        customer: customer.id,
        collection_method: 'charge_automatically',
        auto_advance: false,
        currency: order.currency.toLowerCase(),
    });
    
    await stripe.invoiceItems.create({
        customer: customer.id,
        amount,
        currency: order.currency.toLowerCase(),
        description,
        invoice: invoice.id,
    });
    
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    
    const paymentIntent = await stripe.paymentIntents.retrieve(finalizedInvoice.payment_intent);
    
    return {
        paymentIntent, 
        invoice,
    };

}

module.exports = {
    createStripeInvoice,
}