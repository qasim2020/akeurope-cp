require('dotenv').config();

const Customer = require('../models/Customer');

exports.login = async (req, res) => {
  const { email, password, rememberMe } = req.body;
  const customer = await Customer.findOne({ email });
  console.log(customer);
  if (customer && (await customer.comparePassword(password))) {
    req.session.customer = customer;
    if (rememberMe) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; 
    } else {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24; 
    }
    res.status(200).send("login successful");
  } else {
    res.status(400).send("User not found or credentials are wrong!");
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.redirect('/login');
  });
};

exports.register = async (req,res) => {
  try {
    const customer = await Customer.findOne({
      inviteToken: req.params.token,
      inviteExpires: { $gt: new Date() }
    });

    if (!customer) {
      return res.status(400).render('error', { heading: "Link Expired!", error: 'Link is invalid or has expired. Please ask the admins to re-send you and invite email!' });
    }

    res.render('register', { name: customer.name, email: customer.email, token: customer.inviteToken });
  } catch (err) {
    res.status(500).send('Error during registration');
  }
}

exports.registerCustomer = async (req,res) => {
  try {
    const { name, password } = req.body;
    const customer = await Customer.findOne({
      inviteToken: req.params.token,
      inviteExpires: { $gt: new Date() }
    });

    if (!customer) {
      return res.status(400).send('Invalid or expired token');
    }

    customer.name = name;
    customer.password = password;
    customer.role = 'viewer';
    customer.emailStatus = 'Invite Accepted';
    customer.inviteToken = undefined;
    customer.inviteExpires = undefined;

    await customer.save();
    res.status(200).send("User updated successfully");
  } catch (err) {
    console.log(err);
    res.status(500).send('Error completing registration');
  }
}

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.redirect('/login');
  });
};