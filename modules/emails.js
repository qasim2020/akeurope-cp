const Customer = require('../models/Customer');
const File = require('../models/File');
const Project = require('../models/Project');
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const moment = require('moment');
const nodemailer = require('nodemailer');
const axios = require('axios');
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

const { getPaymentByOrderId, getLatestSubscriptionByOrderId } = require('../modules/orders');
const { saveLog } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { slugToString } = require('./helpers');

async function getFileWithToken(orderId, category) {
    let file = await File.findOne({ 'links.entityId': orderId, category }).sort({ createdAt: -1 });

    if (file) {
        const secretToken = crypto.randomBytes(32).toString('hex');
        file = await File.findOneAndUpdate({ _id: file._id }, { $set: { secretToken, public: true } }, { new: true });
    }

    return file ? { ...file.toObject(), url: `${process.env.CUSTOMER_PORTAL_URL}/file-download/${file.secretToken}` } : null;
}

const getStripeReceiptUrl = async (order) => {
    const stripeInfo = await getPaymentByOrderId(order._id);
    const invoice = await stripe.invoices.retrieve(stripeInfo.invoiceId);
    return {
        url: invoice.hosted_invoice_url
    };
};

const sendInvoiceAndReceiptToCustomer = async (order, customer) => {
    const invoice = await getFileWithToken(order._id, 'invoice');
    const receipt = await getFileWithToken(order._id, 'receipt') || await getStripeReceiptUrl(order);
    let portalUrl = '', newUser = false;

    if (!customer.password) {
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = moment().add(24, 'hours').toDate();
        await Customer.findOneAndUpdate(
            { _id: customer._id },
            { $set: { inviteToken, inviteExpires } },
            { new: true }
        );
        portalUrl = `${process.env.CUSTOMER_PORTAL_URL}/register/${inviteToken}`;
        newUser = true;
    } else {
        portalUrl = `${process.env.CUSTOMER_PORTAL_URL}/login`;
        newUser = false;
    }

    if (!invoice && !receipt) {
        throw new Error('Invoice and receipt both not found');
    }

    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const templatePath = path.join(__dirname, '../views/emails/invoice.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: customer.email,
        subject: `Invoice & Receipt from Akeurope - ${order.totalCost || order.total} ${order.currency}`,
        html: compiledTemplate({
            name: customer.name,
            invoiceNreceipt: true,
            invoiceUrl: invoice?.url,
            receiptUrl: receipt?.url,
            portalUrl,
            newUser,
        }),
    };

    try {
        await transporter.sendMail(mailOptions);
        await sendThankYouMessage(customer.tel, portalUrl);
        console.log('Invoice & receipt sent!');
        return true;
    } catch (err) {
        throw new Error(`Failed to send email: ${err.message}`);
    }
};

function formatPhoneNumber(phone) {
    phone = phone.replace(/[^\d+]/g, '');
    if (!phone.startsWith('+')) {
        phone = `+${phone}`;
    }
    return phone;
}

const sendThankYouMessage = async (phone, url) => {
    try {
        phone = formatPhoneNumber(phone);
        
        if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
            throw new Error('Invalid phone number format');
        }
        
        const message = `Jazak Allah for your donation to Alkhidmat Europe! View your payments here: ${url}`;

        const response = await client.messages.create({
            body: message,
            from: process.env.TWILIO_MESSAGING_SERVICE_SID,
            to: phone
        });
        
        if (response.errorCode) {
            console.error(`Failed to send message to ${phone}: ${response.errorMessage}`);
        } else {
            console.log('Thank you message sent to', phone);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

const sendInvoiceToCustomer = async (order, customer) => {
    throw new Error('not required ? ');

    const invoicesDirectory = '../invoices';
    let invoiceFilename = `order_no_${order.orderNo}.pdf`;

    order.stripeInfo = (await getPaymentByOrderId(order._id)) || (await getLatestSubscriptionByOrderId(order._id));

    if (order.stripeInfo) {
        invoiceFilename = `order_no_${order.orderNo}_invoice.pdf`;
    }

    const invoicePath = path.join(invoicesDirectory, invoiceFilename);

    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const templatePath = path.join(__dirname, '../views/emails/invoice.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: customer.email,
        subject: `Invoice from Akeurope - ${order.totalCost}`,
        html: compiledTemplate({
            name: customer.name,
        }),
        attachments: [
            {
                filename: invoiceFilename,
                path: invoicePath,
            },
        ],
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Invoice sent!');
        return true;
    } catch (err) {
        throw new Error(`Failed to send email: ${err.message}`);
    }
};

const sendStripeRenewelInvoiceToCustomer = async (order, customer) => {
    const invoice = await getFileWithToken(order._id, 'invoice');
    const receipt = await getFileWithToken(order._id, 'receipt');
    let portalUrl = '', newUser = false;

    if (!customer.password) {
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = moment().add(24, 'hours').toDate();
        await Customer.findOneAndUpdate(
            { _id: customer._id },
            { $set: { inviteToken, inviteExpires } },
            { new: true }
        );
        portalUrl = `${process.env.CUSTOMER_PORTAL_URL}/register/${inviteToken}`;
        newUser = true;
    } else {
        portalUrl = `${process.env.CUSTOMER_PORTAL_URL}/login`;
        newUser = false;
    }

    if (!invoice && !receipt) {
        throw new Error('Invoice and receipt both not found');
    }

    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const templatePath = path.join(__dirname, '../views/emails/invoiceRenewel.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: customer.email,
        subject: `Subscription Renewed Alkhidmat Europe - ${order.totalCostSingleMonth || order.total} ${order.currency} ${slugToString(order.projectSlug)}`,
        html: compiledTemplate({
            name: customer.name,
            invoiceNreceipt: true,
            invoiceUrl: invoice?.url,
            receiptUrl: receipt?.url,
            portalUrl,
            newUser,
        }),
    };

    try {
        await transporter.sendMail(mailOptions);
        await sendThankYouMessage(customer.tel, portalUrl);
        console.log('Invoice & receipt sent!');
        return true;
    } catch (err) {
        throw new Error(`Failed to send email: ${err.message}`);
    }
};

const sendReceiptToCustomer = async(order, customer) => {
    const receipt = await getFileWithToken(order._id, 'receipt');

    let portalUrl = '', newUser = false;

    if (!customer.password) {
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = moment().add(24, 'hours').toDate();
        await Customer.findOneAndUpdate(
            { _id: customer._id },
            { $set: { inviteToken, inviteExpires } },
            { new: true }
        );
        portalUrl = `${process.env.CUSTOMER_PORTAL_URL}/register/${inviteToken}`;
        newUser = true;
    } else {
        portalUrl = `${process.env.CUSTOMER_PORTAL_URL}/login`;
        newUser = false;
    }

    if (!receipt) {
        throw new Error('Receipt not found');
    }

    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const templatePath = path.join(__dirname, '../views/emails/invoice.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: customer.email,
        subject: `Payment Receipt from Alkhidmat Europe - ${order.totalCostSingleMonth || order.total} ${order.currency}`,
        html: compiledTemplate({
            name: customer.name,
            receiptOnly: true,
            receiptUrl: receipt?.url,
            portalUrl,
            newUser,
        }),
    };

    try {
        await transporter.sendMail(mailOptions);
        await sendThankYouMessage(customer.tel, portalUrl);
        console.log('Invoice & receipt sent!');
        return true;
    } catch (err) {
        throw new Error(`Failed to send email: ${err.message}`);
    } 
}

const sendCustomerInvite = async (customer) => {
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = moment().add(24, 'hours').toDate();

    await Customer.findOneAndUpdate({ _id: customer._id }, { inviteToken, inviteExpires });

    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const templatePath = path.join(__dirname, '../views/emails/customerInvite.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: customer.email,
        subject: 'Registration Link for Akeurope Partner Portal',
        html: compiledTemplate({
            name: customer.name,
            inviteLink: `${process.env.CUSTOMER_PORTAL_URL}/register/${inviteToken}`,
        }),
    };

    await transporter.sendMail(mailOptions);
    
    await Customer.findOneAndUpdate({ _id: customer._id }, { status: 'Email invite sent' });

    await saveLog(
        logTemplates({
            type: 'newCustomerDirectRegistrationStarted',
            entity: customer,
            actor: customer,
        }),
    );
    
};

module.exports = {
    sendInvoiceAndReceiptToCustomer,
    sendInvoiceToCustomer,
    sendReceiptToCustomer,
    sendCustomerInvite,
    sendStripeRenewelInvoiceToCustomer,
    sendThankYouMessage,
};
