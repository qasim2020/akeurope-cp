const Project = require("../models/Project");
const Order = require('../models/Order');
const Subscription = require("../models/Subscription");
const { getPaginatedOrders } = require('../modules/orders');
const { visibleLogs, updateLog } = require('../modules/logAction');

exports.dashboard = async (req, res) => {

    const { orders, pagination } = await getPaginatedOrders(req, res);
    const projects = await Project.find({status: 'active'}).lean();

    return res.render('dashboard', {
        layout: 'dashboard',
        data: {
            activeMenu: "dashboard",
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            orders,
            projects,
            pagination
        }
    });
};

exports.notifications = async (req,res) => {
    try {
        res.render('partials/notificationsDropdown', {
            layout: false,
            data: {
                logs: await visibleLogs(req,res)
            }
        })
    } catch (error) {
        console.log(error);
        res.status(400).send(error.toString());
    }
}

exports.clearNotification = async(req,res) => {
    try {
        await updateLog({ logId: req.params.logId, updates: { isReadByCustomer: true } });
        res.status(200).send("Log cleared");
    } catch(err) {
        console.log(err);
        res.status(400).send({
            success: false,
            message: err.message || "Failed to clear notification",
        });
    }
};
