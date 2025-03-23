const PDFDocument = require('pdfkit');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const moment = require('moment');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);
const Order = require('../models/Order');
const File = require('../models/File');
const Customer = require('../models/Customer');
const Project = require('../models/Project');
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const { Error } = require('mongoose');
const { getPaymentByOrderId, getLatestSubscriptionByOrderId } = require('../modules/orders');
const { formatDate, formatTime, expiresOn } = require('../modules/helpers');
const Subscription = require('../models/Subscription');

const downloadStripeReceipt = async (order, uploadedBy) => {
    const stripeInfo = (await getPaymentByOrderId(order._id)) || (await getLatestSubscriptionByOrderId(order._id));

    if (!stripeInfo) throw new Error('No stripe information found for order');

    const invoiceDir = path.join(__dirname, '../../invoices');

    if (!fs.existsSync(invoiceDir)) fs.mkdirSync(invoiceDir, { recursive: true });

    const month = moment(stripeInfo.currentPeriodStart || stripeInfo.created).format('MMMM');
    const year = moment(stripeInfo.currentPeriodStart || stripeInfo.created).format('YYYY');

    const receiptPath = path.join(invoiceDir, `order_no_${order.orderNo}_receipt_${month}_${year}.pdf`);

    if (stripeInfo.paymentIntentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(stripeInfo.paymentIntentId);
        if (paymentIntent.latest_charge) {
            const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
            if (charge.receipt_url) {
                console.log('Receipt URL:', charge.receipt_url);
                await generateColoredReceiptPDF(charge.receipt_url, receiptPath);
                const fileName = `Receipt - ${month} ${year}`;
                await saveFileRecord(order, receiptPath, 'receipt', uploadedBy, fileName);
            }
        }
    }
};

const downloadStripeInvoice = async (order, uploadedBy) => {
    const stripeInfo = await getPaymentByOrderId(order._id);
    if (!stripeInfo.invoiceId) throw new Error('Invoice not attached to the payment');

    const invoiceDir = path.join(__dirname, '../../invoices');
    if (!fs.existsSync(invoiceDir)) fs.mkdirSync(invoiceDir, { recursive: true });

    const month = moment(stripeInfo.currentPeriodStart || stripeInfo.created).format('MMMM');
    const year = moment(stripeInfo.currentPeriodStart || stripeInfo.created).format('YYYY');

    const invoicePath = path.join(invoiceDir, `order_no_${order.orderNo}_invoice_${month}_${year}_${Date.now()}.pdf`);

    const invoice = await stripe.invoices.retrieve(stripeInfo.invoiceId);

    await downloadPDF(invoice.invoice_pdf, invoicePath);
    const fileName = `Invoice - ${month} ${year}`;
    await saveFileRecord(order, invoicePath, 'invoice', uploadedBy, fileName);
};

const downloadStripeInvoiceAndReceipt = async (order, uploadedBy) => {
    const stripeInfo = (await getPaymentByOrderId(order._id)) || (await getLatestSubscriptionByOrderId(order._id));

    if (!stripeInfo) throw new Error('No stripe information found for order');

    const invoiceDir = path.join(__dirname, '../../invoices');
    if (!fs.existsSync(invoiceDir)) fs.mkdirSync(invoiceDir, { recursive: true });

    const month = moment(stripeInfo.currentPeriodStart || stripeInfo.created).format('MMMM');
    const year = moment(stripeInfo.currentPeriodStart || stripeInfo.created).format('YYYY');

    const invoicePath = path.join(invoiceDir, `order_no_${order.orderNo}_invoice_${month}_${year}_${Date.now()}.pdf`);
    const receiptPath = path.join(invoiceDir, `order_no_${order.orderNo}_receipt_${month}_${year}_${Date.now()}.pdf`);

    let invoice = null;

    if (stripeInfo.paymentIntentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(stripeInfo.paymentIntentId);
        if (paymentIntent.latest_charge) {
            const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
            if (charge && charge.invoice) {
                invoice = await stripe.invoices.retrieve(charge.invoice);
            } else {
                invoice = await stripe.invoices.retrieve(stripeInfo.invoiceId);
            }
        }
    } else if (stripeInfo.subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(stripeInfo.subscriptionId);
        if (subscription.latest_invoice) {
            invoice = await stripe.invoices.retrieve(subscription.latest_invoice);
        }
    }

    if (invoice) {
        const invoiceList = await stripe.invoices.list({
            customer: invoice.customer,
            limit: 1,
        });

        if (invoiceList.data.length > 0) {
            invoice = invoiceList.data[0];
        }

        if (invoice.invoice_pdf) {
            await downloadPDF(invoice.invoice_pdf, invoicePath);
            const fileName = `Invoice - ${month} ${year}`;
            await saveFileRecord(order, invoicePath, 'invoice', uploadedBy, fileName);
        }

        if (invoice.charge) {
            const charge = await stripe.charges.retrieve(invoice.charge);
            if (charge.receipt_url) {
                console.log('Downloading receipt from:', charge.receipt_url);
                await generateColoredReceiptPDF(charge.receipt_url, receiptPath);
                const fileName = `Receipt - ${month} ${year}`;
                await saveFileRecord(order, receiptPath, 'receipt', uploadedBy, fileName);
            }
        }
    }
};

const generateColoredReceiptPDF = async (url, filePath) => {
    const browser = await puppeteer.launch();

    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.emulateMediaType('screen');

    await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
    });

    await browser.close();

    console.log(`Downloaded: ${filePath}`);
};

const generateReceiptPDF = async (url, filePath) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.pdf({ path: filePath, format: 'A4' });
    await browser.close();
};

const downloadPDF = async (url, filePath) => {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            headers: { Accept: 'application/pdf' },
        });

        fs.writeFileSync(filePath, response.data, 'binary');
        console.log(`Downloaded: ${filePath}`);
    } catch (error) {
        console.error(`Error downloading PDF from ${url}:`, error.message);
    }
};

const getOrderInvoiceFromDir = async (orderId) => {
    const order = (await Order.findById(orderId).lean()) || (await Subscription.findById(orderId).lean());
    const fileName = `order_no_${order.orderNo}.pdf`;
    const dirName = path.join(__dirname, '../../invoices');
    const filePath = path.join(dirName, fileName);

    if (fs.existsSync(filePath)) {
        return filePath;
    } else {
        const newPath = await generateInvoice(order);
        return newPath;
    }
};

const saveFileRecord = async (order, filePath, category, uploadedBy, fileName) => {
    const relativePath = filePath.replace(/^.*invoices\//, 'invoices/');
    const stats = fs.statSync(filePath);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);
    const fileRecord = new File({
        links: [
            {
                entityId: order._id,
                entityType: 'order',
                entityUrl: `/order/${order._id}`,
            },
        ],
        category,
        access: ['customers'],
        name: fileName
            ? fileName
            : `${category === 'invoice' ? 'Invoice' : 'Receipt'} ${
                  order.monthlySubscription
                      ? ` for ${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}`
                      : ''
              }`,
        size: fileSizeInKB,
        path: relativePath,
        mimeType: 'application/pdf',
        uploadedBy,
    });

    await fileRecord.save();
};

const generateInvoiceOverlay = async (order) => {
    let invoicePath = '';

    if (order.monthlySubscription) {
        throw new Error('Cannot generate invoice for monthly subscription');
    }

    const invoiceDir = path.join(__dirname, '../../invoices');
    invoicePath = path.join(invoiceDir, `order_no_${order.orderNo}.pdf`);

    order.customer = order.customer ? order.customer : await Customer.findById(order.customerId).lean();

    await fs.ensureDir(invoiceDir);

    return new Promise((resolve, reject) => {
        try {
            const pageHeight = 720;
            const footerMargin = 30;

            const doc = new PDFDocument();

            const writeStream = fs.createWriteStream(invoicePath);

            doc.pipe(writeStream);

            // Add a company logo
            doc.image(path.join(__dirname, '../static/images/logo.png'), 50, 50, { width: 20 });

            // Add company name and details
            doc.fontSize(16).text('Alkhidmat Europe', 120, 50);
            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Address: ', 120, 70, { continued: true })
                .font('Helvetica')
                .text('Grønland 6, 0188, Oslo');

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Email: ', 120, 85, { continued: true })
                .font('Helvetica')
                .text('regnskap@akeurope.org | ', { continued: true })
                .font('Helvetica-Bold')
                .text('Phone: ', { continued: true })
                .font('Helvetica')
                .text('+47 40150015');

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Organization No: ', 120, 100, { continued: true })
                .font('Helvetica')
                .text('915487440');

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Case Manager: ', 120, 115, { continued: true })
                .font('Helvetica')
                .text('Muhammad Sadiq');

            // Draw a separator line
            doc.moveTo(50, 140).lineTo(560, 140).stroke();

            // Add invoice details
            doc.fontSize(16).text('Invoice', 50, 150);
            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Account Number: ', 50, 170, { continued: true })
                .font('Helvetica')
                .text('22702596711');

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Invoice Number: ', 50, 185, { continued: true })
                .font('Helvetica')
                .text(`${order.orderNo}`);

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Invoice Date: ', 50, 200, { continued: true })
                .font('Helvetica')
                .text(`${formatTime(order.createdAt)}`);

            doc.fontSize(16).text(`Billed To:`, 350, 150);
            doc.fontSize(12);
            doc.text(`${order.customer.name}`, 350, 170);
            doc.text(`${order.customer.email}`, 350, 185);

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Organization: ', 350, 200, { continued: true })
                .font('Helvetica')
                .text(`${order.customer.organization || 'Not Listed'}`);

            doc.fontSize(12).font('Helvetica-Bold').text('Address: ', 350, 215);

            doc.fontSize(12)
                .font('Helvetica')
                .text(`${order.customer.address || ''}`, 350, 230);

            const startY = 320;
            const endY = drawTableOverlay(doc, order.projectSlug, startY, order);

            doc.moveTo(50, endY + 40)
                .lineTo(560, endY + 40)
                .stroke();

            doc.fontSize(12)
                .font('Helvetica')
                .text('Total: ', 350, endY + 60, { continued: true })
                .font('Helvetica-Bold')
                .text(`${order.total} ${order.currency}`);

            let footerY = pageHeight - footerMargin - 30;

            doc.font('Helvetica');
            doc.fontSize(12).text('Thank you for your business!', 50, footerY, {
                align: 'center',
            });

            footerY += 20;

            doc.text('If you have any questions, feel free to contact us.', 50, footerY, {
                align: 'center',
            });

            footerY += 20;

            doc.fontSize(12).text('regnskap@akeurope.org | +47 40150015', 50, footerY, { align: 'center' });

            doc.end();

            writeStream.on('finish', () => {
                resolve(invoicePath);
            });

            writeStream.on('error', (err) => {
                console.error(`Error writing file: ${err.message}`);
                reject(err);
            });
        } catch (error) {
            console.error(`Error generating PDF: ${error.message}`);
            reject(error);
        }
    });
};

const drawTableOverlay = (doc, projectSlug, startY, order) => {
    let y = startY;
    doc.font('Helvetica-Bold');
    doc.fontSize(12).text('Project', 50, y);
    doc.text(`Total Cost (${order.currency})`, 350, y);

    doc.moveTo(50, y + 20)
        .lineTo(560, y + 20)
        .stroke();

    y += 14;

    doc.font('Helvetica');

    y += 20;
    const nameWidth = 150;
    doc.fontSize(12).text(project.detail.name, 50, y, { width: nameWidth, align: 'left' });
    doc.text(project.entries.length, 250, y);
    doc.text(project.months, 180, y);
    doc.text(project.totalCostAllMonths, 350, y);

    return y;
};

const generateInvoice = async (order) => {
    let invoicePath = '';

    if (order.monthlySubscription) {
        throw new Error('Cannot generate invoice for monthly subscription');
    }

    const invoiceDir = path.join(__dirname, '../../invoices');
    invoicePath = path.join(invoiceDir, `order_no_${order.orderNo}.pdf`);

    order.customer = order.customer ? order.customer : await Customer.findById(order.customerId).lean();
    order.projects = await Promise.all(
        order.projects.map(async (project) => {
            project.detail = project.detail ? project.detail : await Project.findOne({ slug: project.slug }).lean();
            return project;
        }),
    );

    await fs.ensureDir(invoiceDir);

    return new Promise((resolve, reject) => {
        try {
            const pageHeight = 720;
            const footerMargin = 30;

            const doc = new PDFDocument();

            const writeStream = fs.createWriteStream(invoicePath);

            doc.pipe(writeStream);

            // Add a company logo
            doc.image(path.join(__dirname, '../static/images/logo.png'), 50, 50, { width: 20 });

            // Add company name and details
            doc.fontSize(16).text('Alkhidmat Europe', 120, 50);
            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Address: ', 120, 70, { continued: true })
                .font('Helvetica')
                .text('Grønland 6, 0188, Oslo');

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Email: ', 120, 85, { continued: true })
                .font('Helvetica')
                .text('regnskap@akeurope.org | ', { continued: true })
                .font('Helvetica-Bold')
                .text('Phone: ', { continued: true })
                .font('Helvetica')
                .text('+47 40150015');

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Organization No: ', 120, 100, { continued: true })
                .font('Helvetica')
                .text('915487440');

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Case Manager: ', 120, 115, { continued: true })
                .font('Helvetica')
                .text('Muhammad Sadiq');

            // Draw a separator line
            doc.moveTo(50, 140).lineTo(560, 140).stroke();

            // Add invoice details
            doc.fontSize(16).text('Invoice', 50, 150);
            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Account Number: ', 50, 170, { continued: true })
                .font('Helvetica')
                .text('22702596711');

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Invoice Number: ', 50, 185, { continued: true })
                .font('Helvetica')
                .text(`${order.orderNo}`);

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Invoice Date: ', 50, 200, { continued: true })
                .font('Helvetica')
                .text(`${formatTime(order.createdAt)}`);

            if (order.monthlySubscription) {
                doc.fontSize(12)
                    .font('Helvetica-Bold')
                    .text('Renewel: ', 50, 215, { continued: true })
                    .font('Helvetica')
                    .text(`${expiresOn(order.createdAt, 1)}`);
            }

            // Add customer details
            doc.fontSize(16).text(`Billed To:`, 350, 150);
            doc.fontSize(12);
            doc.text(`${order.customer.name}`, 350, 170);
            doc.text(`${order.customer.email}`, 350, 185);

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Organization: ', 350, 200, { continued: true })
                .font('Helvetica')
                .text(`${order.customer.organization || 'Not Listed'}`);

            doc.fontSize(12).font('Helvetica-Bold').text('Address: ', 350, 215);

            doc.fontSize(12)
                .font('Helvetica')
                .text(`${order.customer.address || ''}`, 350, 230);

            const startY = 320;
            const endY = drawTable(doc, order.projects, startY, order);

            doc.moveTo(50, endY + 40)
                .lineTo(560, endY + 40)
                .stroke();

            doc.fontSize(12)
                .font('Helvetica')
                .text('Total: ', 350, endY + 60, { continued: true })
                .font('Helvetica-Bold')
                .text(`${order.totalCost} ${order.currency}`);

            let footerY = pageHeight - footerMargin - 30;

            doc.font('Helvetica');
            doc.fontSize(12).text('Thank you for your business!', 50, footerY, {
                align: 'center',
            });

            footerY += 20;

            doc.text('If you have any questions, feel free to contact us.', 50, footerY, {
                align: 'center',
            });

            footerY += 20;

            doc.fontSize(12).text('regnskap@akeurope.org | +47 40150015', 50, footerY, { align: 'center' });

            doc.end();

            writeStream.on('finish', () => {
                resolve(invoicePath);
            });

            writeStream.on('error', (err) => {
                console.error(`Error writing file: ${err.message}`);
                reject(err);
            });
        } catch (error) {
            console.error(`Error generating PDF: ${error.message}`);
            reject(error);
        }
    });
};

const drawTable = (doc, projects, startY, order) => {
    let y = startY;
    doc.font('Helvetica-Bold');
    doc.fontSize(12).text('Project', 50, y);
    doc.text('Beneficiaries', 250, y);
    doc.text('Months', 180, y);
    doc.text(`Total Cost (${order.currency})`, 350, y);

    doc.moveTo(50, y + 20)
        .lineTo(560, y + 20)
        .stroke();

    y += 14;

    doc.font('Helvetica');

    projects.forEach((project) => {
        y += 20;
        const nameWidth = 150;
        doc.fontSize(12).text(project.detail.name, 50, y, { width: nameWidth, align: 'left' });
        doc.text(project.entries.length, 250, y);
        doc.text(project.months, 180, y);
        doc.text(project.totalCostAllMonths, 350, y);
    });

    return y;
};

const deletePath = (filePath) => {
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log(`File deleted successfully: ${filePath}`);
            return true;
        } catch (err) {
            console.error(`Error deleting file: ${filePath}`, err);
            return false;
        }
    } else {
        console.log(`File does not exist: ${filePath}`);
        return false;
    }
};

const deleteInvoice = async (orderId) => {
    const order = await Order.findOne({ _id: orderId });
    if (!order) {
        throw new Error('Order does not exist');
    }
    const customer = await Customer.findOne({ _id: order.customerId });
    const invoiceDir = path.join(__dirname, '../../invoices');
    const invoicePath = path.join(invoiceDir, `order_no_${order.orderNo}.pdf`);
    return deletePath(invoicePath);
};

const saveExistingInvoiceInFileCollection = async (order, uploadedBy) => {
    const invoicePath = path.join(__dirname, `../../invoices/order_no_${order.orderNo}.pdf`);

    if (fs.existsSync(invoicePath)) {
        await saveFileRecord(order, invoicePath, 'invoice', uploadedBy);
    }
};

module.exports = {
    saveFileRecord,
    generateInvoice,
    deleteInvoice,
    deletePath,
    downloadStripeInvoiceAndReceipt,
    downloadStripeReceipt,
    downloadStripeInvoice,
    saveExistingInvoiceInFileCollection,
    getOrderInvoiceFromDir,
};
