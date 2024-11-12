const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../modules/auth');

router.get('/dashboard', authenticate, authorize("viewDashboard"), (req, res) => {
    return res.render('dashboard', {
        layout: 'dashboard',
        data: {
            activeMenu: "dashboard",
            userName: req.session.customer.name,
            userRole: req.session.customer.role.charAt(0).toUpperCase() + req.session.customer.role.slice(1),
            projects: req.allProjects
        }
    });
});

module.exports = router;