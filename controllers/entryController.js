const mongoose = require('mongoose');
const Project = require('../models/Project');
const Customer = require('../models/Customer');
const cloudinary = require('cloudinary').v2;
const moment = require('moment');
const { createDynamicModel } = require('../models/createDynamicModel');
const {
    projectEntries,
    fetchEntrySubscriptionsAndPayments,
    getPaidOrdersByEntryId,
    getOrdersByEntryId,
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
const File = require('../models/File');


exports.getData = async (req, res) => {
    try {
        const { entries, project, pagination } = await projectEntries(req, res);

        res.render('partials/showProject', {
            layout: false,
            data: {
                fields: project.fields,
                project,
                entries,
                layout: req.session.layout,
                pagination,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'An error occurred while fetching entries partial',
            details: error.message,
        });
    }
};

exports.entry = async (req, res) => {
    try {
        const project = await Project.findOne({
            slug: req.params.slug,
        }).lean();
        if (!project) throw new Error(`Project "${req.params.slug}" not found`);

        const DynamicModel = await createDynamicModel(project.slug);
        let entry = await DynamicModel.findOne({
            _id: req.params.entryId,
        }).lean();

        entry.currency = project.currency;

        const files = await File.find({ 'links.entityId': req.params.entryId, access: 'customers' }).lean();

        res.render('entry', {
            layout: 'dashboard',
            data: {
                userName: req.session.user.name,
                userRole:
                    req.session.user.role.charAt(0).toUpperCase() +
                    req.session.user.role.slice(1),
                activeMenu: 'orders',
                projects: req.allProjects,
                project,
                fields: project.fields,
                layout: req.session.layout,
                entry,
                files,
                role: req.userPermissions,
                logs: await visibleLogs(req, res),
                entryLogs: await entryLogs(req, res, req.session.user._id, project),
                sidebarCollapsed: req.session.sidebarCollapsed,
                customers: await Customer.find().lean(),
                payments: await getOrdersByEntryId(req),
            },
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error fetching entries',
            details: error.message,
        });
    }
};

exports.getSingleEntryData = async (req, res) => {
    try {
        const project = await Project.findOne({
            slug: req.params.slug,
        }).lean();
        if (!project) throw new Error(`Project "${req.params.slug}" not found`);

        const DynamicModel = await createDynamicModel(project.slug);
        let entry = await DynamicModel.findOne({
            _id: req.params.entryId,
        }).lean();

        entry = await fetchEntrySubscriptionsAndPayments(entry);

        res.render('partials/showEntry', {
            layout: false,
            data: {
                fields: project.fields,
                project,
                entry,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'An error occurred while fetching entries partial',
            details: error.message,
        });
    }
};

exports.getSingleEntryLogs = async (req, res) => {
    try {
        const project = await Project.findOne({
            slug: req.params.slug,
        }).lean();
        if (!project) throw new Error(`Project "${req.params.slug}" not found`);

        const DynamicModel = await createDynamicModel(project.slug);
        let entry = await DynamicModel.findOne({
            _id: req.params.entryId,
        }).lean();

        entry = await fetchEntrySubscriptionsAndPayments(entry);
        res.render('partials/showEntryLogs', {
            layout: false,
            data: {
                entryLogs: await entryLogs(req, res, req.session.user._id, project),
                project,
                entry,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error occured while fetching logs',
            details: error.message,
        });
    }
};

exports.getOrderProjects = async (req, res) => {
    try {
        const orderInDb = await Order.findOne({
            _id: req.params.orderId,
        }).lean();

        const order = await formatOrder(req, orderInDb);

        for (const project of order.projects) {
            project.detail = await Project.findOne({ slug: project.slug }).lean();
        };

        res.render('partials/showOrderEntries', {
            layout: false,
            data: {
                projects: order.projects ? order.projects : [],
                order,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error getting paginated order',
            details: error.message,
        });
    }
};

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
            };
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

exports.getPaginatedEntriesForLockedOrder = async (req,res) => {
    try {
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

        order.projects = [project];

        res.render('partials/components/paymentModalEntriesInLockedOrder', {
            layout: false,
            data: {
                order,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error getting paginated order',
            details: error.message,
        });
    } 
}

exports.getPaginatedEntriesForOrderPage = async (req, res) => {
    try {
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

        order.projects = [project];

        res.render('partials/showOrderEntries', {
            layout: false,
            data: {
                order,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error getting paginated order',
            details: error.message,
        });
    }
};
