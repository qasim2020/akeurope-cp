require('dotenv').config();

const Customer = require('../models/Customer');

exports.login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    const customer = await Customer.findOne({ email });
  
    if (customer && (await customer.comparePassword(password))) {
      req.session.user = customer;
      if (rememberMe) {
        req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; 
      } else {
        req.session.cookie.maxAge = 1000 * 60 * 60 * 24; 
      }
      res.status(200).send("login successful");
    } else {
      res.status(400).send("User not found or credentials are wrong!");
    }
  } catch(error) {
    console.log(error);
    res.status(400).send(error);
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
      return res.render('registerDirect');
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

exports.registerDirect = async (req,res) => {
  try {
    const { name, password, email } = req.body;

    const checkCustomer = await Customer.findOne({email: email}).lean();

    if (checkCustomer) {
      return res.status(400).send('Customer with this email already exists!');
    }
    
    const customer = new Customer();
    customer.name = name;
    customer.email = email;
    customer.password = password;
    customer.role = 'viewer';
    customer.emailStatus = 'Direct registration';
    customer.inviteToken = undefined;
    customer.inviteExpires = undefined;

    await customer.save();
    res.status(200).send("Customer registered successfully!");
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