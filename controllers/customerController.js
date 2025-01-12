const mongoose = require('mongoose');

const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const moment = require('moment');
const nodemailer = require('nodemailer');

const Customer = require('../models/Customer');
const Project = require('../models/Project');
const checkValidForm = require('../modules/checkValidForm');
const { saveLog, customerLogs, visibleLogs } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getChanges } = require('../modules/getChanges');
const Order = require('../models/Order');

exports.getCustomerData = async (req, res) => {
    try {
        const customer = await Customer.findOne({
            _id: req.params.customerId,
        }).lean();

        customer.projectsOpened = await Promise.all(
            customer.projects.map(async (val) => {
                return await Project.findOne({ slug: val }).lean();
            }),
        );

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
            _id: req.params.customerId,
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
        const { name, organization, location, projects } = req.body;

        let check = [];

        if (!checkValidForm.isValidName(name)) {
            check.push({
                elem: '.name',
                msg: 'Name contains only letters and spaces and is at least three characters long',
            });
        }

        await Promise.all(
            projects.map(async (slug) => {
                let project = await Project.findOne({ slug });
                if (!project) {
                    check.push({
                        elem: '.projects',
                        msg: `Project ${slug} was not foud!`,
                    });
                }
                if (project.status == 'inactive') {
                    check.push({
                        elem: '.projects',
                        msg: `Project ${slug} is not Active!`,
                    });
                }
            }),
        );

        const customer = await Customer.findById(req.params.customerId);

        if (!customer) {
            check.push({ msg: 'Customer not found.' });
        }

        if (check.length > 0) {
            res.status(400).send(check);
            return false;
        }

        const updatedFields = {
            name,
            organization,
            location,
            projects,
        };

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

            await Customer.findByIdAndUpdate(
                req.params.customerId,
                updatedFields,
            );
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
            customer: await Customer.findById(req.params.customerId).lean(),
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
        
        const customer = await Customer.findById(
            req.session.user._id,
        ).lean();

        customer.projectsOpened = await Promise.all(
            customer.projects.map(async (val) => {
                return await Project.findOne({ slug: val }).lean();
            }),
        );

        const orders = await Order.find({
            customerId: req.session.user._id,
        }).lean();

        console.log(req.allProjects);

        res.render('customer', {
            layout: 'dashboard',
            data: {
                layout: req.session.layout,
                userName: req.session.user.name,
                userRole:
                    req.session.user.role.charAt(0).toUpperCase() +
                    req.session.user.role.slice(1),
                activeMenu: 'customers',
                projects: await Project.find({status: 'active'}).lean(),
                role: req.customerPermissions,
                logs: await visibleLogs(req, res),
                customerLogs: await customerLogs(req, res),
                customer,
                sidebarCollapsed: req.session.sidebarCollapsed,
                customers: await Customer.find().lean(),
                orders,
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
