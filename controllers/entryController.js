const mongoose = require('mongoose');
const Project = require('../models/Project');
const Customer = require('../models/Customer');
const cloudinary = require('cloudinary').v2;
const moment = require('moment');
const { createDynamicModel } = require('../models/createDynamicModel');
const {
    projectEntries,
    fetchEntrySubscriptionsAndPayments,
} = require('../modules/projectEntries');
const { saveLog, visibleLogs, entryLogs } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getChanges } = require('../modules/getChanges');
const {
    createDraftOrder,
    updateDraftOrder,
    getPendingOrderEntries,
    formatOrder,
} = require('../modules/orders');
const Order = require('../models/Order');

exports.getPaginatedEntriesForDraftOrder = async (req, res) => {
    try {
        if (!req.query.orderId) {
            const orderId = await createDraftOrder(req, res);
            req.query.orderId = orderId;
        } else {
            const checkOrder = await Order.findOne({
                _id: req.query.orderId,
                status: 'draft',
            });
            if (checkOrder) {
                await updateDraftOrder(req, res);
            } else {
                return res
                    .status(400)
                    .send('Order is locked!');
            }
        }

        const orderInDb = await Order.findOne({
            _id: req.query.orderId,
        }).lean();
        const order = await formatOrder(req, orderInDb);
        const project = order.projects.find(
            (project) => project.slug == req.params.slug,
        );
        if (project) {
            Object.assign(project, {
                detail: await Project.findOne({ slug: project.slug }).lean(),
            });
        }

        res.render('partials/components/paymentModalEntriesInDraftOrder', {
            layout: false,
            project,
            order,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error getting paginated order',
            details: error.message,
        });
    }
};
