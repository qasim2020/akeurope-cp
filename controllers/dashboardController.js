const Project = require("../models/Project");
const Order = require('../models/Order');
const Subscription = require("../models/Subscription");
const { getPaginatedOrders } = require('../modules/orders');

exports.dashboard = async (req, res) => {

    const { orders, pagination } = await getPaginatedOrders(req, res);
    const projects = await Project.find({status: 'active'}).lean();

    return res.render('dashboard', {
        layout: 'dashboard',
        data: {
            activeMenu: "dashboard",
            userName: req.session.customer.name,
            userRole: req.session.customer.role.charAt(0).toUpperCase() + req.session.customer.role.slice(1),
            orders,
            projects,
            pagination
        }
    });
};