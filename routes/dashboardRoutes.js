const express = require('express');
const router = express.Router();
const { authenticate, authorize, isBoarded } = require('../modules/auth');
const dashboardController = require('../controllers/dashboardController');

router.get('/dashboard', authenticate, authorize("viewDashboard"), isBoarded, dashboardController.dashboard);

module.exports = router;