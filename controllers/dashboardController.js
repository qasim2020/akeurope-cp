const Project = require("../models/Project");
const Order = require('../models/Order');
const Subscription = require("../models/Subscription");
const {createDynamicModel} = require("../models/createDynamicModel");

exports.dashboard = async (req, res) => {

    const orders = await Order.find({customerId: req.session.customer._id}).lean();
    const projects = await Project.find({status: 'active'}).lean();

    return res.render('dashboard', {
        layout: 'dashboard',
        data: {
            activeMenu: "dashboard",
            userName: req.session.customer.name,
            userRole: req.session.customer.role.charAt(0).toUpperCase() + req.session.customer.role.slice(1),
            orders,
            projects
        }
    });
};

