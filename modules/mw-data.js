const Project = require('../models/Project');
const Order = require('../models/Order');
const moment = require('moment');

const oneProject = async (req, res, next) => {
    let oneProject = await Project.findOne({ slug: req.params.slug }).lean();
    req.oneProject = oneProject;
    next();
};

const allProjects = async (req, res, next) => {
    let allProjects = await Project.find({ status: 'active' }).lean();
    req.allProjects = allProjects;
    next();
};

const checkEntryForPaidOrder = async (customerId, entryId) => {
    const order = await Order.findOne({
        customerId,
        'projects.entries.entryId': entryId,
        status: 'paid',
    });

    if (!order) {
        throw new Error ('Entry does not exist in any paid order');
    };

    for (const project of order.projects) {
        for (const entry of project.entries) {
            if (entry.entryId.toString() === entryId.toString()) {
                const projectExpirationDate = moment(order.createdAt).add(project.months, 'months');
                if (moment().isAfter(projectExpirationDate)) {
                    throw new Error ('Order has expired to view linked beneficiaries!');
                }
            }
        }
    }

    return order.customerId;
}

const entryExistsInPaidOrder = async (req, res, next) => {
    try {
        const entryId = req.params.entryId;

        if (!entryId) {
            throw new Error ('No entry id provided in request');
        }

        await checkEntryForPaidOrder(req.session.user._id, entryId);

        next();
    } catch (error) {
        console.log(error);
        return res.status(404).render("error", {heading: "Unauthorized", error: error});
    }
};

module.exports = { allProjects, oneProject, entryExistsInPaidOrder, checkEntryForPaidOrder };
