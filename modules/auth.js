const { roles, hasPermission } = require('../modules/roles');

const authenticate = (req, res, next) => {
  if (req.session.customer) {
    req.customer = req.session.customer;
    return next();
  }
  return res.status(404).render("error", {heading: "Unauthorized", error: "User is not logged in."});
};

const authorize = (permission) => {
  return (req, res, next) => {
    const customerRole = req.customer?.role;  

    if (!customerRole || !hasPermission(customerRole, permission)) {
      return res.status(401).send(`Unauthorized: ${customerRole} can't ${permission}`);
    }

    req.customerPermissions = roles[customerRole] || [];
    next(); 
  };
};

const isBoarded = (req,res) => {
  if (req.session.customer.isBoarded) {
    return next();
  }

  if (req.session.customer.isBoardingAtStep) {
    res.redirect(req.session.customer.isBoardingAtStep);
  }

  res.redirect('/onboardingStepOne');
}

module.exports = { authenticate, authorize, isBoarded };