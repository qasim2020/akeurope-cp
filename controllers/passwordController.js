const emailConfig = require('../config/emailConfig');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const Customer = require('../models/Customer');
const { isValidEmail } = require('../modules/checkValidForm');
const { validateExpressRequest } = require('twilio/lib/webhooks/webhooks');
const authController = require('../controllers/authController');

const getPasswordToken = async (customer) => {
    const moment = require('moment');

    if (customer.resetPasswordToken && customer.resetPasswordExpires > Date.now()) {
        const duration = moment.duration(customer.resetPasswordExpires - Date.now());
        const hours = Math.floor(duration.asHours());
        const minutes = Math.floor(duration.minutes());

        return {
            token: customer.resetPasswordToken,
            expiry: `${hours} hour(s) and ${minutes} minute(s)`
        };
    } else {
        const token = crypto.randomBytes(20).toString('hex');
        customer.resetPasswordToken = token;
        customer.resetPasswordExpires = Date.now() + 3600000; 

        await customer.save();

        const duration = moment.duration(customer.resetPasswordExpires - Date.now());
        const hours = Math.floor(duration.asHours());
        const minutes = Math.floor(duration.minutes());

        return {
            token: token,
            expiry: `${hours} hour(s) and ${minutes} minute(s)`
        };
    }
}

exports.forgotPassword = async (req, res) => {
    const { email: emailProvided } = req.body;

    const email = emailProvided.toLowerCase();

    if (!isValidEmail(email)) {
        res.status(400).send(`${email} is an invalid email.`);
        return false;
    }

    let customer = await Customer.findOne({ email });

    if (!customer) {
        res.status(400).send(`User with ${email} not found`);
        return false;
    }

    customer = await Customer.findOne({ email: email, password: {$exists: true}});
    
    if (!customer) {
        await authController.sendRegistrationLink(req,res);
        return;
    }

    const { token, expiry } = await getPasswordToken(customer);

    let transporter = nodemailer.createTransport(emailConfig);

    const templatePath = path.join(__dirname, '../views/emails/passwordReset.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const mailOptions = {
        from: `"Alkhidmat Europe" <${process.env.EMAIL_USER}>`,
        to: customer.email,
        subject: 'Password Reset',
        html: compiledTemplate({
            name: customer.name,
            expiry,
            resetLink: `${process.env.CUSTOMER_PORTAL_URL}/reset/${token}`,
        }),
    };

    // Send the email
    transporter.sendMail(mailOptions, async (err) => {
        if (err) {
            return res.status(400).send(err);
        }
        res.status(200).send('Email sent successfully. Check your inbox.');
    });
};

exports.resetPassword = async (req, res) => {
    const { password, confirmPassword } = req.body;

    // Check if passwords match
    if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match');
    }

    try {
        const customer = await Customer.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!customer) {
            return res.status(400).send('Password reset token is invalid or has expired.');
        }

        customer.password = password;
        customer.resetPasswordToken = undefined; // Clear reset token
        customer.resetPasswordExpires = undefined; // Clear token expiration
        await customer.save();

        res.status(200).send('Password changed.');
    } catch (error) {
        console.error('Error in resetPassword:', error);
        res.status(500).send(error);
    }
};

exports.resetPasswordForm = async (req, res) => {
    try {
        const customer = await Customer.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!customer) {
            return res
                .status(400)
                .render('error', { heading: 'Expired link', error: 'Password reset token is invalid or has expired.' });
        }

        res.render('reset-password', { token: req.params.token, email: customer.email });
    } catch (error) {
        console.error('Error in resetPasswordForm:', error);
        res.status(500).send('Server error');
    }
};
