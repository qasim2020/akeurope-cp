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
const { sendTelegramMessage, sendErrorToTelegram } = require('./telegramBot');
const { formatPhoneNumber } = require('../modules/twilio');

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
        url: invoice.hosted_invoice_url,
    };
};

const getPortalUrl = async (customer) => {
    let portalUrl = '',
        newUser = false;
    if (!customer.password) {
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = moment().add(24, 'hours').toDate();
        await Customer.findOneAndUpdate({ _id: customer._id }, { $set: { inviteToken, inviteExpires } }, { new: true });
        portalUrl = `${process.env.CUSTOMER_PORTAL_URL}/register/${inviteToken}`;
        newUser = true;
    } else {
        portalUrl = `${process.env.CUSTOMER_PORTAL_URL}/login`;
        newUser = false;
    }
    return {
        portalUrl,
        newUser,
    };
};

const sendInvoiceAndReceiptToCustomer = async (order, customer) => {
    const invoice = await getFileWithToken(order._id, 'invoice');
    const receipt = (await getFileWithToken(order._id, 'receipt')) || (await getStripeReceiptUrl(order));
    const { portalUrl, newUser } = await getPortalUrl(customer);

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
        await sendTelegramMessage(`✅ *Invoice & Receipt Sent!*\n\n` + `🆔 *To:* ${customer.email}\n` + `📅 *Message:* invoice.handlebars`);
        console.log('Invoice & receipt sent!');
        return true;
    } catch (err) {
        console.log(`Failed to send email: ${err.message}`);
        sendErrorToTelegram(err.message);
        return true;
    }
};

const sendThankYouForSponsoringBeneficiaryMessage = async (phone) => {
    try {
        phone = formatPhoneNumber(phone);

        if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
            throw new Error('Invalid phone number format');
        }
        
        const message =
            `Thank you for supporting Alkhidmat Europe in sponsoring these beneficiaries.\n\n` +
            `You can stay updated on your beneficiaries by logging into our donor portal:\n\n` +
            `${process.env.CUSTOMER_PORTAL_URL}/login\n\n` +
            `Your generosity is making a lasting difference. We truly appreciate your continued support.`;

        const response = await client.messages.create({
            body: message,
            from: process.env.TWILIO_MESSAGING_SERVICE_SID,
            to: phone,
        });

        if (response.errorCode) {
            console.error(`Failed to send message to ${phone}: ${response.errorMessage}`);
            await sendErrorToTelegram(response.errorMessage);
        } else {
            console.log('Thank you message sent to', phone);
            await sendTelegramMessage(`✅ *Text Message Sent!*\n\n` + `🆔 *To:* ${phone}\n` + `📅 *Message:* ${message}`);
        }
    } catch (error) {
        console.error('Error sending message:', error);
        await sendErrorToTelegram(error.message || error);
    }
};

const sendThankYouForSponsoringBeneficiaryEmail = async (order, customer) => {
    const { portalUrl, newUser } = await getPortalUrl(customer);

    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const templatePath = path.join(__dirname, '../views/emails/thankYouBeneficiary.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: customer.email,
        subject: `Payment Received - ${order.totalCost || order.total} ${order.currency}`,
        html: compiledTemplate({
            name: customer.name,
            portalUrl,
            newUser,
        }),
    };

    try {
        await transporter.sendMail(mailOptions);
        await sendTelegramMessage(`✅ *Email Sent!*\n\n` + `🆔 *To:* ${customer.email}\n` + `📅 *Message:* thankYouBeneficiary.handlebars`);
        console.log('Thank you email sent!');
        return true;
    } catch (err) {
        console.log(`Failed to send email: ${err.message}`);
        sendErrorToTelegram(err.message);
        return true;
    } 
};

const sendThankYouMessage = async (phone) => {
    try {
        phone = formatPhoneNumber(phone);

        if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
            throw new Error('Invalid phone number format');
        }

        const message =
            `Thank you for your trust in Alkhidmat Europe.\n\n` +
            `You can view and manage your payments here:\n` +
            `${process.env.CUSTOMER_PORTAL_URL}/login\n\n` +
            `We sincerely appreciate your support.`;

        const response = await client.messages.create({
            body: message,
            from: process.env.TWILIO_MESSAGING_SERVICE_SID,
            to: phone,
        });

        if (response.errorCode) {
            console.error(`Failed to send message to ${phone}: ${response.errorMessage}`);
            await sendErrorToTelegram(response.errorMessage);
        } else {
            console.log('Thank you message sent to', phone);
            await sendTelegramMessage(`✅ *Text Message Sent!*\n\n` + `🆔 *To:* ${phone}\n` + `📅 *Message:* ${message}`);
        }
    } catch (error) {
        console.error('Error sending message:', error);
        await sendErrorToTelegram(error.message || error);
    }
};

const sendThankYouEmail = async (order, customer) => {
    const { portalUrl, newUser } = await getPortalUrl(customer);

    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const templatePath = path.join(__dirname, '../views/emails/thankYouEmail.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: customer.email,
        subject: `Payment Received - ${order.totalCost || order.total} ${order.currency}`,
        html: compiledTemplate({
            name: customer.name,
            portalUrl,
            newUser,
        }),
    };

    try {
        await transporter.sendMail(mailOptions);
        await sendTelegramMessage(`✅ *Email Sent!*\n\n` + `🆔 *To:* ${customer.email}\n` + `📅 *Message:* thankYouEmail.handlebars`);
        console.log('Thank you email sent!');
        return true;
    } catch (err) {
        console.log(`Failed to send email: ${err.message}`);
        sendErrorToTelegram(err.message);
        return true;
    } 
};

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
    let portalUrl = '',
        newUser = false;

    if (!customer.password) {
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = moment().add(24, 'hours').toDate();
        await Customer.findOneAndUpdate({ _id: customer._id }, { $set: { inviteToken, inviteExpires } }, { new: true });
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
        subject: `Subscription Renewed Alkhidmat Europe - ${order.totalCostSingleMonth || order.total} ${
            order.currency
        } ${slugToString(order.projectSlug)}`,
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
        await sendTelegramMessage(`✅ *Invoice & Receipt Sent!*\n\n` + `🆔 *To:* ${customer.email}\n` + `📅 *Message:* invoice.handlebars`);
        return true;
    } catch (err) {
        throw new Error(`Failed to send email: ${err.message}`);
    }
};

const sendReceiptToCustomer = async (order, customer) => {
    const receipt = await getFileWithToken(order._id, 'receipt');

    let portalUrl = '',
        newUser = false;

    if (!customer.password) {
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = moment().add(24, 'hours').toDate();
        await Customer.findOneAndUpdate({ _id: customer._id }, { $set: { inviteToken, inviteExpires } }, { new: true });
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
        await sendTelegramMessage(`✅ *Receipt Sent!*\n\n` + `🆔 *To:* ${customer.email}\n` + `📅 *Message:* invoice.handlebars`);
        return true;
    } catch (err) {
        throw new Error(`Failed to send email: ${err.message}`);
    }
};

const sendCustomerInvite = async (customer) => {

    let inviteToken = customer.inviteToken;
    let inviteExpires = customer.inviteExpires;
    let isNewToken = false;

    if (!inviteToken || !inviteExpires || inviteExpires < new Date()) {
        inviteToken = crypto.randomBytes(32).toString('hex');
        inviteExpires = moment().add(24, 'hours').toDate();
        isNewToken = true;

        await Customer.findOneAndUpdate(
            { _id: customer._id },
            { inviteToken, inviteExpires }
        );
    }

    const now = moment();
    const expiryTime = moment(inviteExpires);
    const duration = moment.duration(expiryTime.diff(now));

    const hours = Math.floor(duration.asHours());
    const minutes = Math.floor(duration.minutes());

    const expiry = `${hours} hour(s) and ${minutes} minute(s)`;

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
            expiry,
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

    return isNewToken;
};

module.exports = {
    sendInvoiceAndReceiptToCustomer,
    sendInvoiceToCustomer,
    sendReceiptToCustomer,
    sendCustomerInvite,
    sendStripeRenewelInvoiceToCustomer,
    sendThankYouForSponsoringBeneficiaryEmail,
    sendThankYouForSponsoringBeneficiaryMessage,
    sendThankYouMessage,
    sendThankYouEmail,
};
