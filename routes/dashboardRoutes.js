const express = require('express');
const router = express.Router();
const Project = require("../models/Project");
const { authenticate, authorize } = require('../modules/auth');

router.get('/dashboard', authenticate, authorize("viewDashboard"), async (req, res) => {
    const myProjects = await Promise.all(req.session.customer.projects.map(val => {
        console.log(val);
        return Project.findOne({slug: val, status: 'active'}).lean();
    }));
    return res.render('dashboard', {
        layout: 'dashboard',
        data: {
            activeMenu: "dashboard",
            userName: req.session.customer.name,
            userRole: req.session.customer.role.charAt(0).toUpperCase() + req.session.customer.role.slice(1),
            projects: myProjects.filter(val => val != null)
        }
    });
});

module.exports = router;