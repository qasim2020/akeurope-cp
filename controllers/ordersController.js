const fs = require('fs');
const path = require('path');

const User = require('../models/User');
const Customer = require('../models/Customer');
const Project = require('../models/Project');
const Order = require('../models/Order');
const File = require('../models/File');
const { saveLog, customerLogs, visibleLogs, orderLogs } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getChanges } = require('../modules/getChanges');
const {
    getPaginatedOrders,
    getSingleOrder,
    updateOrderStatus,
    getPaymentByOrderId,
    getSubscriptionByOrderId,
    addPaymentsToOrder,
    openOrderProjectWithEntries,
} = require('../modules/orders');
const { generateInvoice, deleteInvoice, sendInvoiceToCustomer } = require('../modules/invoice');
const { visibleProjectDateFields } = require('../modules/projectEntries');

exports.viewOrders = async (req, res) => {
    try {
        const projects = await Project.find({ status: 'active' }).lean();

        let visibleDateFields = [];

        if (!projects) {
            projects = [];
        } else {
            visibleDateFields = await visibleProjectDateFields(projects[0]);
        }
        
        const { orders, pagination } = await getPaginatedOrders(req, res);

        for (const order of orders) {
            order.stripeInfo = await getPaymentByOrderId(order._id) || await getSubscriptionByOrderId(order._id);
        };

        const customers = await Customer.find().lean();
        res.render('orders', {
            layout: 'dashboard',
            data: {
                layout: req.session.layout,
                userName: req.session.user.name,
                userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
                activeMenu: 'orders',
                projects,
                visibleDateFields,
                customer: req.session.user,
                role: req.userPermissions,
                logs: await visibleLogs(req, res),
                sidebarCollapsed: req.session.sidebarCollapsed,
                customers,
                orders,
                pagination,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Server Error',
            error: error,
        });
    }
};

exports.viewOrder = async (req, res) => {
    try {
        const projects = await Project.find({ status: 'active' }).lean();

        let visibleDateFields = [];

        if (!projects) {
            projects = [];
        } else {
            visibleDateFields = await visibleProjectDateFields(projects[0]);
        }

        const order = await getSingleOrder(req, res);

        order.stripeInfo = await getPaymentByOrderId(order._id) || await getSubscriptionByOrderId(order._id);

        const files = await File.find({
            'links.entityId': req.params.orderId,
            access: {
                $in: ['customer', 'customers'],
            },
        }).lean();

        for (const file of files) {
            if (file.uploadedBy?.actorType === 'user') {
                file.actorName = (await User.findById(file.uploadedBy?.actorId).lean()).name;
            }
            if (file.uploadedBy?.actorType === 'customer') {
                file.actorName = (await Customer.findById(file.uploadedBy?.actorId).lean()).name;
            }
        }

        res.render('order', {
            layout: 'dashboard',
            data: {
                userName: req.session.user.name,
                userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
                role: req.userPermissions,
                logs: await visibleLogs(req, res),
                projects,
                visibleDateFields,
                orderLogs: await orderLogs(req, res),
                activeMenu: 'orders',
                order,
                files,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Server Error',
            error: error,
        });
    }
};

exports.getOrdersData = async (req, res) => {
    try {
        const { orders, pagination } = await getPaginatedOrders(req, res);

        for (const order of orders) {
            order.stripeInfo = await getPaymentByOrderId(order._id) || await getSubscriptionByOrderId(order._id);
        };
        
        res.render('partials/showOrders', {
            layout: false,
            data: {
                orders,
                pagination,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Server Error',
            error: error,
        });
    }
};

exports.getEditOrderModal = async (req, res) => {
    try {
        const order = await getSingleOrder(req, res);
        const customers = await Customer.find().lean();

        const projects = await Project.find({ status: 'active' }).lean();

        let visibleDateFields = [];

        if (!projects) {
            projects = [];
        } else {
            visibleDateFields = await visibleProjectDateFields(projects[0]);
        }

        res.render('partials/emptyOrderModal', {
            layout: false,
            data: {
                order,
                customers,
                projects,
                visibleDateFields,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Server Error',
            error: error,
        });
    }
};

exports.getOrderTotalCost = async (req, res) => {
    try {
        const order = await getSingleOrder(req, res);
        res.render('partials/components/afterProjectCards', {
            layout: false,
            data: {
                order,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Server Error',
            error: error,
        });
    }
};

exports.orderStatusPendingPayment = async (req, res) => {
    try {
        req.body.status = 'pending payment';
        const order = await updateOrderStatus(req, res);
        if (!order) {
            throw new Error('No order found!');
        }
        res.status(200).render('partials/components/invoice-status', {
            layout: false,
            order,
            modal: true,
        });
    } catch (error) {
        console.log(error);
        res.status(404).send(error.toString());
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        await deleteInvoice(orderId);
        await Order.deleteOne({ _id: orderId });
        res.status(200).send('Order & Invoice deleted!');
    } catch (error) {
        console.log(error);
        res.status(404).send({
            error: error,
        });
    }
};

exports.emailInvoice = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.orderId, customerId: req.session.user._id }).lean();
        const customer = await req.session.user;
        await sendInvoiceToCustomer(order, customer);
        res.status(200).send('Email sent successfully!');
    } catch (error) {
        console.log(error);
        res.status(404).send(error);
    }
};

exports.uploadPaymentProof = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId).lean();
        if (!order) {
            return res.status(400).json({ message: 'No order found!' });
        }

        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const customer = req.session.user;

        if (!customer || !customer.email || !order || !order.orderNo || !order.totalCost) {
            return res.status(400).json({ message: 'Incomplete customer or order data' });
        }

        req.body.status = 'processing';

        await updateOrderStatus(req, res);

        const links = [
            {
                entityId: orderId,
                entityType: 'order',
                entityUrl: `/order/${orderId}`,
            },
            {
                entityId: req.session.user._id,
                entityType: 'customer',
                entityUrl: `/customer/${req.session.user._id}`,
            },
        ];

        const newFile = new File({
            links,
            category: 'paymentProof',
            access: ['customers'],
            name: file.filename,
            size: file.size / 1000,
            path: `/uploads/${file.filename}`,
            mimeType: file.mimetype,
            uploadedBy: {
                actorType: 'customer',
                actorId: req.session.user._id,
                actorUrl: `/customer/${req.session.user._id}`,
            },
        });

        await newFile.save();

        await saveLog(
            logTemplates({
                type: 'orderPaymentProofAdded',
                entity: order,
                actor: req.session.user,
            }),
        );

        res.json({ message: 'File saved' });
    } catch (error) {
        console.error('Error handling file upload:', error);

        if (req.file) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            message: 'Error saving file',
            error: error.message,
        });
    }
};

exports.getOrderLogs = async (req, res) => {
    try {
        res.render('partials/showOrderLogs', {
            layout: false,
            data: {
                order: { _id: req.params.orderId },
                orderLogs: await orderLogs(req, res),
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error occured while fetching logs',
            details: error.message,
        });
    }
};

exports.getOrderData = async (req, res) => {
    try {
        const order = await getSingleOrder(req, res);
        res.render('partials/showOrder', {
            layout: false,
            data: {
                order,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Server Error',
            error: error,
        });
    }
};

exports.getLockedOrderInModal = async (req, res) => {
    try {
        const order = await getSingleOrder(req, res);
        res.render('partials/components/paymentModalEntriesInLockedOrder', {
            layout: false,
            data: {
                order,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Could not fetch locked order modal',
            error: error,
        });
    }
};

exports.projectVisibleDateFields = async (req, res) => {
    try {
        const project = await Project.findOne({ slug: req.params.slug }).lean();
        const visibleDateFields = await visibleProjectDateFields(project);

        res.render('partials/projectVisibleDateFields', {
            layout: false,
            data: {
                visibleDateFields,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Could not fetch project visible fields',
            error: error,
        });
    }
};
