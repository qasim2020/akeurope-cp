const mongoose = require('mongoose');

const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const moment = require('moment');
const nodemailer = require('nodemailer');

const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const Customer = require('../models/Customer');
const Project = require('../models/Project');
const checkValidForm = require('../modules/checkValidForm');

const { saveLog, customerLogs, visibleLogs } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getChanges } = require('../modules/getChanges');
const { visibleProjectDateFields } = require('../modules/projectEntries');
const { getSubscriptionByOrderId, getPaymentByOrderId } = require('../modules/orders');
const { getEntriesByCustomerId } = require('../modules/ordersFetchEntries');

exports.getCustomerData = async (req, res) => {
    try {
        const customer = await Customer.findOne({
            _id: req.session.user._id,
        }).lean();

        res.render('partials/showCustomer', {
            layout: false,
            data: {
                customer,
                layout: req.session.layout,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'An error occurred while fetching customer partial',
            details: error.message,
        });
    }
};

exports.editModal = async (req, res) => {
    try {
        const customer = await Customer.findOne({
            _id: req.session.user._id,
        }).lean();

        res.render('partials/editCustomerModal', {
            layout: false,
            data: {
                layout: req.session.layout,
                projects: req.allProjects,
                customer,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error fetching entries',
            details: error.message,
        });
    }
};

exports.updateCustomer = async (req, res) => {
    try {
        const { name, organization, location } = req.body;

        let check = [];

        if (!checkValidForm.isValidName(name)) {
            check.push({
                elem: '.name',
                msg: 'Name contains only letters and spaces and is at least three characters long',
            });
        }

        if (check.length > 0) {
            res.status(400).send(check);
            return false;
        }

        const updatedFields = {
            name,
            organization,
            location,
        };

        const customer = await Customer.findById(req.session.user._id).lean();

        const changes = getChanges(customer, updatedFields);

        if (changes.length > 0) {
            await saveLog(
                logTemplates({
                    type: 'customerUpdated',
                    entity: customer,
                    actor: req.session.user,
                    changes: getChanges(customer, updatedFields),
                }),
            );

            await Customer.findByIdAndUpdate({ _id: req.session.user._id }, updatedFields);
        }

        res.status(200).send('Customer updated successfully!');
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error creating customer', error });
    }
};

exports.getLogs = async (req, res) => {
    res.render('partials/showCustomerLogs', {
        layout: false,
        data: {
            customerLogs: await customerLogs(req, res),
            customer: await Customer.findById(req.session.user._id).lean(),
        },
    });
};

exports.customer = async (req, res) => {
    try {
        if (req.params.customerId != req.session.user._id.toString()) {
            res.status(401).render('error', {
                heading: 'Unauthorized',
                error: 'You are not authorized to view this page',
            });
            return;
        }

        const customer = await Customer.findById(req.session.user._id).lean();

        const projects = await Project.find({ status: 'active' }).lean();
        
        let visibleDateFields = [];

        if (!projects) {
            projects = [];
        } else {
            visibleDateFields = await visibleProjectDateFields(projects[0]);
        }

        const orders = await Order.find({customerId: customer._id}).sort({orderNo: -1}).lean();

        for (const order of orders) {
            order.stripeInfo = await getPaymentByOrderId(order._id) || await getSubscriptionByOrderId(order._id);
        };

        const activeSubscriptions = await getEntriesByCustomerId(customer._id);

        const subscriptions = await Subscription.find({customerId: customer._id}).sort({orderNo: -1}).lean();

        for (const subscription of subscriptions) {
            subscription.stripeInfo = await getPaymentByOrderId(subscription._id) || await getSubscriptionByOrderId(subscription._id);
        };

        res.render('customer', {
            layout: 'dashboard',
            data: {
                layout: req.session.layout,
                userName: req.session.user.name,
                userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
                activeMenu: 'customers',
                projects,
                visibleDateFields,
                role: req.userPermissions,
                logs: await visibleLogs(req, res),
                customerLogs: await customerLogs(req, res),
                customer,
                sidebarCollapsed: req.session.sidebarCollapsed,
                customers: await Customer.find().lean(),
                orders,
                activeSubscriptions,
                subscriptions,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Server error',
            error,
        });
    }
};
