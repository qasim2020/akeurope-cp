const nodemailer = require('nodemailer');
const crypto = require('crypto');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const Customer = require('../models/Customer'); 
const { isValidEmail } = require("../modules/checkValidForm");

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!isValidEmail(email)) {
    res.status(400).send("Invalid email");
    return false;
  }

  // Find the user by email
  const customer = await Customer.findOne({ email });

  if (!customer) {
    res.status(400).send("User not found");
    return false;
  };

  // Generate a reset token
  const token = crypto.randomBytes(20).toString('hex');
  customer.resetPasswordToken = token;
  customer.resetPasswordExpires = Date.now() + 3600000; // 1-hour expiration
  
  let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true, 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
  });

  const templatePath = path.join(__dirname, '../views/emails/passwordReset.handlebars');
  const templateSource = await fs.readFile(templatePath, 'utf8');
  const compiledTemplate = handlebars.compile(templateSource);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: customer.email,
    subject: 'Password Reset',
    html: compiledTemplate({
      name: customer.name, 
      resetLink: `${process.env.CUSTOMER_PORTAL_URL}/reset/${token}`
    }),
  };

  // Send the email
  transporter.sendMail(mailOptions, async (err) => {
    if (err) {
        return res.status(400).send(err);
    }
    await customer.save();
    res.status(200).send("Email sent successfully. Check your inbox.");
  });
};
