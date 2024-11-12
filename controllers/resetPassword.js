const Customer = require('../models/Customer');

exports.resetPassword = async (req, res) => {
  const { password, confirmPassword } = req.body;

  // Check if passwords match
  if (password !== confirmPassword) {
    return res.status(400).send("Passwords do not match");
  }

  try {
    const customer = await Customer.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!customer) {
      return res.status(400).send("Password reset token is invalid or has expired.");
    }

    customer.password = password;
    customer.resetPasswordToken = undefined; // Clear reset token
    customer.resetPasswordExpires = undefined; // Clear token expiration
    await customer.save();

    res.status(200).send("Password changed.");
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).send(error);
  }
};
