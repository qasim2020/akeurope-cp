const Customer = require('../models/Customer'); 

exports.resetPasswordForm = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }, 
    });

    if (!customer) {
      return res.status(400).render('error', { heading: "Expired link", error: 'Password reset token is invalid or has expired.' });
    }

    res.render('reset-password', { token: req.params.token });
  } catch (error) {
    console.error('Error in resetPasswordForm:', error);
    res.status(500).send('Server error');
  }
};