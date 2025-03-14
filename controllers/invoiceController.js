const path = require('path');
const moment = require('moment');
const fs = require('fs');
const File = require('../models/File');
const { saveLog, customerLogs, visibleLogs } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getSingleOrder } = require('../modules/orders');
const { generateInvoice, deletePath, downloadStripeInvoiceAndReceipt, saveFileRecord } = require('../modules/invoice');
const { getLatestSubscriptionByOrderId, getPaymentByOrderId } = require('../modules/orders');

async function checkFileExists(filePath) {
    try {
        await fs.access(filePath, fs.constants.F_OK);
        return true;
    } catch (err) {
        console.log(`File does not exist: ${filePath}`);
        return false;
    }
}

exports.invoice = async (req, res) => {
    try {
        if (req.params.orderId == 'blank') {
            res.status(200).render('error', {
                message: 'Invoice will load after you select beneficiaries',
                success: true,
            });
            return;
        }

        const order = await getSingleOrder(req, res);

        if (!order) {
            res.status(200).render('error', {
                message: 'Order not yet created',
                success: true,
            });
            return;
        }

        if (order.projects.length == 0 || order.totalCost == 0) {
            res.status(200).render('error', {
                message: 'Invoice is created after you select beneficiaries',
                success: true,
            });
            return;
        }

        order.projects = order.projects.filter((project) => project.entriesCount != 0);

        let filename, filePath;
        const invoiceDir = path.join(__dirname, '../../invoices');

        order.stripeInfo = (await getPaymentByOrderId(order._id)) || (await getLatestSubscriptionByOrderId(order._id));

        if (order.stripeInfo && order.monthlySubscription) {
            const month = moment(order.createdAt).format('MMMM');
            const year = moment(order.createdAt).format('YYYY');
            const isReceipt = req.query.receipt === 'true';
            const filename = `order_no_${order.orderNo}_${
                isReceipt ? `receipt_${month}_${year}` : `invoice_${month}_${year}`
            }.pdf`;
            const filePath = path.join(invoiceDir, filename);

            if (!fs.existsSync(filePath)) {
                await downloadStripeInvoiceAndReceipt(order, {
                    actorType: 'customer',
                    actorId: req.session.user._id,
                    actorUrl: '/customer/' + req.session.user._id,
                });
            }

            return res.sendFile(filePath);
        }

        const file = await File.findOne({ 'links.entityId': order._id, category: 'invoice' })
            .sort({ createdAt: -1 }) 
            .lean();

        if (file) {
            filePath = path.join(__dirname, '../../', file.path);
            res.sendFile(filePath);
            return;
        } else {
            await generateInvoice(order);
            filename = `order_no_${order.orderNo}.pdf`;
            filePath = path.join(invoiceDir, filename);
            await saveFileRecord(order, filePath, 'invoice', {
                actorType: 'customer',
                actorId: order.customerId,
                actorUrl: `/customer/${order.customerId}`,
            });
            res.sendFile(filePath);
        }
    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(404).render('error', { heading: 'Server Error', error });
    }
};

exports.stripeInvoice = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId).lean();

        order.stripeInfo = (await getPaymentByOrderId(order._id)) || (await getLatestSubscriptionByOrderId(order._id));

        if (!order.stripeInfo) {
            return res.status(400).send('No Stripe payment found for this order');
        }

        const filename = `order_no_${order.orderNo}_invoice.pdf`;
        const filePath = path.join(invoiceDir, filename);

        if (!fs.existsSync(filePath)) {
            await downloadStripeInvoiceAndReceipt(order, {
                actorType: 'customer',
                actorId: req.session.user._id,
                actorUrl: '/customer/' + req.session.user._id,
            });
        }

        return res.sendFile(filePath);
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message || 'Server error. Could not get Stripe Invoice.');
    }
};

exports.stripeReceipt = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId).lean();

        order.stripeInfo = (await getPaymentByOrderId(order._id)) || (await getLatestSubscriptionByOrderId(order._id));

        if (!order.stripeInfo) {
            return res.status(400).send('No Stripe payment found for this order');
        }

        const filename = `order_no_${order.orderNo}_receipt.pdf`;
        const filePath = path.join(invoiceDir, filename);

        if (!fs.existsSync(filePath)) {
            await downloadStripeInvoiceAndReceipt(order, {
                actorType: 'customer',
                actorId: req.session.user._id,
                actorUrl: '/customer/' + req.session.user._id,
            });
        }

        return res.sendFile(filePath);
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message || 'Server error. Could not get Stripe Receipt.');
    }
};
