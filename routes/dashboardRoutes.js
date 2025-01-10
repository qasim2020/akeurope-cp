const express = require('express');
const router = express.Router();
const { authenticate, authorize, isBoarded } = require('../modules/auth');
const customerController = require('../controllers/customerController');

router.get('/dashboard', authenticate, authorize("viewDashboard"), (req,res) => res.redirect(`/customer/${req.session.customer._id}`));
router.get('/customer/:customerId', authenticate, authorize("viewDashboard"), customerController.customer);

module.exports = router;