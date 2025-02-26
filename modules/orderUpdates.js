const Project = require('../models/Project');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { logTemplates } = require('../modules/logTemplates');
const { saveLog } = require('../modules/logAction');
const { getOldestPaidEntries, makeProjectForOrder, validateQuery } = require('../modules/ordersFetchEntries');
const { createDynamicModel } = require('../models/createDynamicModel');
const { camelCaseWithCommaToNormalString } = require('../modules/helpers');

const runQueriesOnOrder = async (req, res) => {
    await validateQuery(req, res);

    let order;
    const orderId = req.query.orderId;
    const projectSlug = req.params.slug;
    const checkProject = await Project.findOne({ slug: projectSlug }).lean();
    const existingOrder = await Order.findById(req.query.orderId).lean();

    if (existingOrder.status !== 'draft') return existingOrder;

    const existingCustomer = await Customer.findById(existingOrder.customerId).lean();

    if (req.query.monthlySubscription) {
        const updatedSubscription = req.query.monthlySubscription;
        order = await Order.findOneAndUpdate(
            { _id: orderId },
            { $set: { monthlySubscription: updatedSubscription } },
            { new: true, lean: true },
        );
    }

    if (req.query.countryCode) {
        const countryCode = req.query.countryCode;
        order = await Order.findOneAndUpdate({ _id: orderId }, { $set: { countryCode } }, { new: true, lean: true });
        if (saveLogs) {
            if (order.currency != existingOrder.currency) {
                await saveLog(
                    logTemplates({
                        type: 'orderCountryChanged',
                        entity: order,
                        changes: [
                            {
                                key: 'countryCode',
                                oldValue: existingOrder.countryCode,
                                newValue: countryCode,
                            },
                        ],
                        actor: req.session.user,
                    }),
                );
            }
        }
    }

    if (req.query.customerId) {
        const customerId = req.query.customerId;

        order = await Order.findOneAndUpdate({ _id: orderId }, { $set: { customerId: customerId } }, { new: true, lean: true });

        const newCustomer = await Customer.findById(order.customerId).lean();

        if (existingCustomer.email != newCustomer.email) {
            await saveLog(
                logTemplates({
                    type: 'customerRemovedFromOrder',
                    entity: existingCustomer,
                    order,
                    customer: existingCustomer,
                    actor: req.session.user,
                }),
            );

            await saveLog(
                logTemplates({
                    type: 'customerAddedToOrder',
                    entity: newCustomer,
                    order,
                    customer: newCustomer,
                    actor: req.session.user,
                }),
            );
        }
    }

    if (req.query.currency) {
        const currency = req.query.currency;
        order = await Order.findOneAndUpdate({ _id: orderId }, { $set: { currency: currency } }, { new: true, lean: true });
    }

    if (req.query.months > 0) {
        const updatedMonths = req.query.months;
        order = await Order.findOneAndUpdate(
            { _id: orderId, 'projects.slug': projectSlug },
            { $set: { 'projects.$.months': updatedMonths } },
            { new: true, lean: true },
        );
    }

    if (req.query.subscriptions && !req.query.entryId) {
        const subscriptions = req.query.subscriptions;
        const excludedEntries = req.query.excludedEntries;
        const excludedEntriesId = excludedEntries ? excludedEntries.map((entry) => entry.entryId) : [];
        if (subscriptions === 'empty') {
            order = await Order.findOneAndUpdate(
                { _id: orderId, 'projects.slug': projectSlug },
                {
                    $unset: {
                        'projects.$.entries.$[].selectedSubscriptions': '',
                    },
                },
                {
                    new: true,
                    lean: true,
                },
            );
        } else {
            const tempOrder = await Order.findOneAndUpdate(
                { _id: orderId, 'projects.slug': projectSlug },
                {
                    $set: {
                        'projects.$.entries.$[entry].selectedSubscriptions': subscriptions.split(','),
                    },
                },
                {
                    new: true,
                    lean: true,
                    arrayFilters: [
                        {
                            'entry.entryId': { $nin: excludedEntriesId },
                        },
                    ],
                },
            );

            for (const entry of excludedEntries) {
                order = await Order.findOneAndUpdate(
                    { _id: orderId, 'projects.slug': projectSlug },
                    {
                        $set: {
                            'projects.$.entries.$[entry].selectedSubscriptions': entry.validSubscriptions,
                        },
                    },
                    {
                        new: true,
                        lean: true,
                        arrayFilters: [
                            {
                                'entry.entryId': entry.entryId,
                            },
                        ],
                    },
                );
            }

            if (excludedEntries.length == 0) {
                order = tempOrder;
            }
        }
    }

    if (req.query.entryId && req.query.subscriptions) {
        const entryId = req.query.entryId;
        const subscriptions = req.query.subscriptions;
        if (subscriptions === 'empty') {
            order = await Order.findOneAndUpdate(
                { _id: orderId, 'projects.slug': projectSlug },
                {
                    $set: {
                        'projects.$.entries.$[entry].selectedSubscriptions': [],
                    },
                },
                {
                    arrayFilters: [{ 'entry.entryId': entryId }],
                    new: true,
                    lean: true,
                },
            );
        } else {
            const subscriptionsArray = subscriptions.split(',');
            order = await Order.findOneAndUpdate(
                { _id: orderId, 'projects.slug': projectSlug },
                {
                    $set: {
                        'projects.$.entries.$[entry].selectedSubscriptions': subscriptionsArray,
                    },
                },
                {
                    arrayFilters: [{ 'entry.entryId': entryId }],
                    new: true,
                    lean: true,
                },
            );
        }
    }

    if (req.query.addProject) {
        const { project, allEntries } = await getOldestPaidEntries(req, checkProject);

        await Order.updateOne(
            { _id: orderId, 'projects.slug': projectSlug },
            {
                $pull: { projects: { slug: projectSlug } },
            },
        );

        const updatedProject = await makeProjectForOrder(project, allEntries);

        order = await Order.findOneAndUpdate(
            { _id: orderId },
            {
                $push: { projects: updatedProject },
            },
            {
                new: true,
                lean: true,
            },
        );
    }

    if (req.query.replaceProject) {
        const { project, allEntries } = await getOldestPaidEntries(req, checkProject);
        const updatedProject = await makeProjectForOrder(project, allEntries);
        order = await Order.findOneAndUpdate(
            { _id: orderId, 'projects.slug': projectSlug },
            {
                $set: { 'projects.$': updatedProject },
            },
            {
                new: true,
                lean: true,
            },
        );
    }

    if (req.query.deleteProject) {
        order = await Order.findOneAndUpdate(
            { _id: orderId, 'projects.slug': projectSlug },
            {
                $pull: { projects: { slug: projectSlug } },
            },
            {
                new: true,
                lean: true,
            },
        );
    }

    return order;
};

module.exports = { runQueriesOnOrder };
