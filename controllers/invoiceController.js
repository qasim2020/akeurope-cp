const path = require('path');
const fs = require('fs');
const { saveLog, customerLogs, visibleLogs } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getSingleOrder } = require('../modules/orders');
const { generateInvoice, deletePath } = require('../modules/invoice');

async function checkFileExists(invoicePath) {
    try {
        await fs.access(invoicePath, fs.constants.F_OK); 
        return true;
    } catch (err) {
        console.log(`File does not exist: ${invoicePath}`);
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

        order.projects = order.projects.filter(project => project.entriesCount != 0);

        const invoiceDir = path.join(__dirname, '../../invoices');

        const filename = `order_no_${order.orderNo}.pdf`;

        const invoicePath = path.join(
            invoiceDir,
            filename,
        );

        const invoiceExists = await checkFileExists(invoicePath);

        if (invoiceExists) {
            await deletePath(invoicePath);
            await generateInvoice(order);
        } else {
            await generateInvoice(order);
        };

        res.sendFile(invoicePath);
    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(404).render('error', { heading: 'Server Error', error });
    }
};
