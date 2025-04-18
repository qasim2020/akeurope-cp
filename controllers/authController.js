require('dotenv').config();

const Customer = require('../models/Customer');
const { saveLog } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getChanges } = require('../modules/getChanges');
const { sendCustomerInvite } = require('../modules/emails');
const { isValidEmail } = require('../modules/checkValidForm');

exports.login = async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;
        let customer = await Customer.findOne({ email: email.toLowerCase() });

        if (!customer) throw new Error(`User with email: ${email.toLowerCase()} was not found. Please register yourself by clicking on Register Now button.`)

        customer = await Customer.findOne({ email: email.toLowerCase(), password: {$exists: true} });

        if (!customer) throw new Error('You have not yet registered yourself. Please use Register Now button to see your payments. Your payments are safely linked with your email address.')

        const loginCondition = process.env.ENV === 'test'? 
            customer :
            customer && (await customer.comparePassword(password));
        if (loginCondition) {
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
            res.status(400).send('Your credentials are wrong! Please use forget password page to reset your password.');
        }
    } catch (error) {
        console.log(error);
        res.status(400).send(error.message || 'Server Error');
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
            address: customer.address,
            tel: customer.tel,
        });
    } catch (err) {
        res.status(500).send('Error during registration');
    }
};

exports.sendRegistrationLink = async (req, res) => {
    try {
        const { name, email: gotEmail } = req.body;

        const email = gotEmail.toLowerCase();
        
        const checkCustomer = await Customer.findOne({ email: email, password: { $exists: true } }).lean();

        if (checkCustomer) {
            return res
                .status(400)
                .send(
                    `An account with ${email} already exists. Try signing in with your email/ password or use Forgot-Password page to change your password`,
                );
        }
        
        if (!isValidEmail(email)) {
            return res.status(400).send(`${email} is an invalid email. If your email is correct and you are still getting this message, that means our email-validator is not working right - please inform us, jazak Allah.`);
        }

        const customer = await Customer.findOneAndUpdate(
            {
                email: email,
            },
            {
                $set: {
                    name,
                },
                $setOnInsert: {
                    email: email
                },
            },
            {
                new: true,
                upsert: true,
            }
        );

        const isNewToken = await sendCustomerInvite(customer);

        if (isNewToken) {
            res.status(200).send(
                `Registration email has been sent to ${customer.email}. Check Spam folders if not found in Inbox.`,
            );
        } else {
            res.status(200).send(
                `An email was sent previously with the registration link. But to be safe, same link has been re-sent to ${customer.email}. Please check in spam folders if not found in inbox folder of your mailbox.`,
            ); 
        }

    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
};

exports.registerCustomer = async (req, res) => {
    try {
        const { name, password, organization, address } = req.body;
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
                    password,
                    organization,
                    address,
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

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error(err);
        res.redirect('/login');
    });
};
