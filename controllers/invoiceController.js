const path = require('path');
const fs = require('fs');
const { saveLog, customerLogs, visibleLogs } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getSingleOrder } = require('../modules/orders');
const { generateInvoice, deletePath } = require('../modules/invoice');

exports.getInvoice = async (req, res) => {
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

        const filename = `order_no_${order.orderNo}_order_total_${order.totalCost}.pdf`;

        const invoicePath = path.join(
            invoiceDir,
            filename,
        );

        const regex = new RegExp(
            `^${order.customer.email}_order_no_${order.orderNo}.*\\.pdf$`,
        );

        const getMatchingFiles = (directory, regex) => {
            try {
                const files = fs.readdirSync(directory);
                const matchingFiles = files.filter((file) => regex.test(file));
                return matchingFiles;
            } catch (err) {
                console.error('Error reading directory:', err);
                return [];
            }
        };

        const matchingFiles = getMatchingFiles(invoiceDir, regex);

        if (matchingFiles.length == 0) {
            await generateInvoice(order);
        } else {
            let createNewInvoice = false;
            for (const file of matchingFiles) {
                const regex = /_order_total_([\d.]+)/;

                const match = file.match(regex);

                if (match) {
                    const totalCost = parseFloat(match[1]);

                    if (totalCost !== order.totalCost) {
                        const foundFilePath = path.join(
                            invoiceDir,
                            file,
                        );
                        await deletePath(foundFilePath);
                        createNewInvoice = true;
                    } 
                }
            }
            if (createNewInvoice) {
                await generateInvoice(order);
            }
        }

        res.sendFile(invoicePath);
    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(404).render('error', { heading: 'Server Error', error });
    }
};
