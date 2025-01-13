const express = require('express');
const router = express.Router();
const { authenticate, authorize, isBoarded } = require('../modules/auth');
const customerController = require('../controllers/customerController');
const dashboardController = require('../controllers/dashboardController');

router.get('/dashboard', authenticate, authorize("viewDashboard"), (req,res) => res.redirect(`/customer/${req.session.user._id}`));
router.get('/customer/:customerId', authenticate, authorize("viewDashboard"), customerController.customer);
router.get('/getFreshNotifications', authenticate, authorize('viewDashboard'), dashboardController.notifications);
router.post("/clearNotification/:logId", authenticate, authorize("editNotifications"), dashboardController.clearNotification);

module.exports = router;