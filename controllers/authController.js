require('dotenv').config();

const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const moment = require('moment');
const nodemailer = require('nodemailer');

const Project = require('../models/Project');
const Customer = require('../models/Customer');
const { saveLog } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getChanges } = require('../modules/getChanges');

exports.login = async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;
        const customer = await Customer.findOne({ email, password: { $exists: true } });

        if (customer && (await customer.comparePassword(password))) {
            if (customer.status === 'blocked') {
                return res.status(400).send('Customer is blocked. Please contact akeurope team to resolve the issue.');
            }
            req.session.user = customer;
            if (rememberMe) {
                req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
            } else {
                req.session.cookie.maxAge = 1000 * 60 * 60 * 24;
            }
            res.status(200).send('login successful');
        } else {
            res.status(400).send('User not found or credentials are wrong!');
        }
    } catch (error) {
        console.log(error);
        res.status(400).send(error);
    }
};

exports.register = async (req, res) => {
    try {
        const customer = await Customer.findOne({
            inviteToken: req.params.token,
            inviteExpires: { $gt: new Date() },
        });

        if (!customer) {
            return res.render('registerDirect');
        }

        res.render('register', {
            name: customer.name,
            email: customer.email,
            token: customer.inviteToken,
        });
    } catch (err) {
        res.status(500).send('Error during registration');
    }
};

exports.sendRegistrationLink = async (req, res) => {
    try {
        const { name, email } = req.body;

        const customer = await Customer.findOne({ email: email, password: { $exists: true } }).lean();

        if (customer) {
            return res
                .status(400)
                .send(
                    'An account with this email already exists. Try signing in with your email/ password or use forgot password form to reset password',
                );
        }

        await Customer.deleteOne({ email });

        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = moment().add(24, 'hours').toDate();

        const newCustomer = new Customer({
            name,
            email,
            emailStatus: 'Email invite sent!',
            inviteToken: inviteToken,
            inviteExpires: inviteExpires,
        });

        let transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const templatePath = path.join(__dirname, '../views/emails/customerInvite.handlebars');
        const templateSource = await fs.readFile(templatePath, 'utf8');
        const compiledTemplate = handlebars.compile(templateSource);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: newCustomer.email,
            subject: 'Registration Link for Akeurope Partner Portal',
            html: compiledTemplate({
                name: newCustomer.name,
                inviteLink: `${process.env.CUSTOMER_PORTAL_URL}/register/${inviteToken}`,
            }),
        };

        transporter.sendMail(mailOptions, async (err) => {
            if (err) {
                return res.status(400).send(err);
            }
            await newCustomer.save();

            await saveLog(
                logTemplates({
                    type: 'newCustomerDirectRegistrationStarted',
                    entity: newCustomer,
                    actor: newCustomer,
                }),
            );

            res.status(200).send(
                `Registration email has been sent to ${newCustomer.email}. Check Spam folders if not found in Inbox.`,
            );
        });
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
};

exports.registerCustomer = async (req, res) => {
    try {

        const { name, password, organization, location } = req.body;
        const oldCustomer = await Customer.findOne({
            inviteToken: req.params.token,
            inviteExpires: { $gt: new Date() },
        }).lean();

        if (!oldCustomer) {
            return res.status(400).send('Invalid or expired token');
        }

        const newCustomer = await Customer.findOneAndUpdate(
            { _id: oldCustomer._id },
            {
                $set: {
                    name,
                    role: 'viewer',
                    password,
                    organization,
                    location,
                    status: 'active',
                    emailStatus: 'Self-invite Accepted',
                    inviteToken: null,
                    inviteExpires: null,
                },
            },
            { new: true, lean: true },
        );

        delete newCustomer.password;
        delete oldCustomer.password;
        delete newCustomer.inviteExpires;
        delete oldCustomer.inviteExpires;
        delete newCustomer.inviteToken;
        delete oldCustomer.inviteToken;

        const changes = getChanges(oldCustomer, newCustomer);

        await saveLog(
            logTemplates({
                type: 'customerUpdated',
                changes,
                entity: newCustomer,
                actor: newCustomer,
            }),
        );

        res.status(200).send('Customer updated successfully');
    } catch (err) {
        console.log(err);
        res.status(500).send('Error completing registration');
    }
};

exports.registerDirect = async (req, res) => {
    try {
        const { name, password, email } = req.body;

        const checkCustomer = await Customer.findOne({ email: email }).lean();

        if (checkCustomer) {
            return res.status(400).send('Customer with this email already exists!');
        }

        const customer = new Customer();
        customer.name = name;
        customer.email = email;
        customer.password = password;
        customer.role = 'partner';
        customer.emailStatus = 'Direct registration';
        customer.inviteToken = undefined;
        customer.inviteExpires = undefined;

        await customer.save();
        res.status(200).send('Customer registered successfully!');
    } catch (err) {
        console.log(err);
        res.status(500).send('Error completing registration');
    }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error(err);
        res.redirect('/login');
    });
};
