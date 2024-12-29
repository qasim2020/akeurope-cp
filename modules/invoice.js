const PDFDocument = require('pdfkit');
const fs = require('fs-extra');
const path = require('path');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');

const generateInvoice = async (order) => {
    const invoiceDir = path.join(__dirname, '../../invoices');
    const invoicePath = path.join(
        invoiceDir,
        `${order.customer.email}_order_no_${order.orderNo}_order_total_${order.totalCost}.pdf`,
    );

    await fs.ensureDir(invoiceDir);

    return new Promise((resolve, reject) => {
        try {
            const pageHeight = 720; // A4 page height in points
            const footerMargin = 30; // Margin from the bottom for footer

            const doc = new PDFDocument();

            const writeStream = fs.createWriteStream(invoicePath);

            doc.pipe(writeStream);

            // Add a company logo
            doc.image(
                path.join(__dirname, '../static/images/logo.png'),
                50,
                50,
                { width: 20 },
            );

            // Add company name and details
            doc.fontSize(16).text('Alkhidmat Europe', 120, 50);
            doc.fontSize(12).text(
                'Address: 123 Business St, City, Country',
                120,
                70,
            );
            doc.text(
                'Email: payments@akeurope.org | Phone: +123456789',
                120,
                85,
            );

            // Draw a separator line
            doc.moveTo(50, 120).lineTo(550, 120).stroke();

            // Add invoice details
            doc.fontSize(16).text('Invoice', 50, 140);
            doc.fontSize(12).text(`Invoice Number: ${order.orderNo}`, 50, 160);
            doc.text(
                `Invoice Date: ${new Date(
                    order.createdAt,
                ).toLocaleDateString()}`,
                50,
                175,
            );

            // Add customer details
            doc.fontSize(16).text(`Billed To:`, 350, 140);
            doc.fontSize(12);
            doc.text(`${order.customer.name}`, 350, 160);
            doc.text(`${order.customer.email}`, 350, 175);
            doc.text(`${order.customer.organization || ''}`, 350, 190);

            // Draw the table starting from a Y position
            const startY = 250;
            const endY = drawTable(doc, order.projects, startY, order);

            // Draw a total price below the table
            doc.fontSize(12).text(
                `Total: ${order.totalCost} ${order.currency}`,
                350,
                endY + 30,
            );

            // Calculate the available space for the footer
            let footerY = pageHeight - footerMargin;

            // Add "Thank you for your business!" text at the bottom of the page
            doc.fontSize(12).text('Thank you for your business!', 50, footerY, {
                align: 'center',
            });

            // Move the y-position down a bit for the next line
            footerY += 15;

            // Add the second line of text with some margin
            doc.text(
                'If you have any questions, feel free to contact us.',
                50,
                footerY,
                {
                    align: 'center',
                },
            );

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

    // Table headers
    doc.fontSize(12).text('Project', 50, y);
    doc.text('Selected\nBeneficiaries', 250, y - 14);
    doc.text('Months', 180, y);
    doc.text(`Total Cost (${order.currency})`, 350, y);
    doc.moveTo(50, y + 20)
        .lineTo(550, y + 20)
        .stroke();

    y += 14;

    // Table rows
    projects.forEach((project) => {
        y += 20;
        doc.fontSize(12).text(project.detail.name, 50, y);
        doc.text(project.entriesCount, 250, y);
        doc.text(project.months, 180, y);
        doc.text(project.totalCostAllMonths, 350, y);
    });

    return y;
};

function deletePath(filePath) {
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
}

const deleteInvoice = async (orderId) => {
    const order = await Order.findOne({ _id: orderId });
    const customer = await Customer.findOne({ _id: order.customerId });
    const invoiceDir = path.join(__dirname, '../../invoices');
    const invoicePath = path.join(
        invoiceDir,
        `${customer.email}_order_no_${order.orderNo}_order_total_${order.totalCost}.pdf`,
    );
    return deletePath(invoicePath);
};

const sendInvoiceToCustomer = async(order, customer)=> {
    const invoicesDirectory = './invoices';
    const invoiceFilename = `${customer.email}_order_no_${order.orderNo}_order_total_${order.totalCost}.pdf`;
    const invoicePath = path.join(invoicesDirectory, invoiceFilename);

    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true, 
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
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
                path: invoicePath
            }
        ]
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Invoice sent!');
        return true;
    } catch (err) {
        throw new Error(`Failed to send email: ${err.message}`);
    }

}

module.exports = { generateInvoice, deleteInvoice, deletePath, sendInvoiceToCustomer };
