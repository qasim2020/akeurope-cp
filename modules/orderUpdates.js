const Project = require('../models/Project');
const Order = require('../models/Order');
const { logTemplates } = require('../modules/logTemplates');
const { saveLog } = require('../modules/logAction');
const {
    getOldestPaidEntries,
    makeProjectForOrder,
    validateQuery,
} = require('../modules/ordersFetchEntries');
const { createDynamicModel } = require('../models/createDynamicModel');
const { camelCaseWithCommaToNormalString } = require('../modules/helpers');

const runQueriesOnOrder = async (req, res) => {
    await validateQuery(req, res);
    let order;
    const orderId = req.query.orderId;
    const projectSlug = req.params.slug;
    const checkProject = await Project.findOne({ slug: projectSlug }).lean();
    const existingOrder = await Order.findById(req.query.orderId).lean();

    if (req.query.currency) {
        const currency = req.query.currency;
        order = await Order.findOneAndUpdate(
            { _id: orderId },
            { $set: { currency: currency } },
            { new: true, lean: true },
        );

        if (order.currency != existingOrder.currency) {
            await saveLog(
                logTemplates({
                    type: 'orderCurrencyChanged',
                    entity: order,
                    changes: [
                        {
                            key: 'currency',
                            oldValue: existingOrder.currency,
                            newValue: currency,
                        },
                    ],
                    actor: req.session.user,
                }),
            );
        }
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
        const excludedEntriesId = excludedEntries ? excludedEntries.map(
            (entry) => entry.entryId,
        ) : [];
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
                        'projects.$.entries.$[entry].selectedSubscriptions':
                            subscriptions.split(','),
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
                            'projects.$.entries.$[entry].selectedSubscriptions':
                                entry.validSubscriptions,
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

        await saveLog(
            logTemplates({
                type: 'orderColumnSubscriptionChanged',
                entity: order,
                order,
                project: checkProject,
                changes: [
                    {
                        key: 'Subscriptions',
                        newValue:
                            camelCaseWithCommaToNormalString(subscriptions),
                    },
                ],
                actor: req.session.user,
            }),
        );

        const project = existingOrder.projects.find(
            (p) => p.slug === projectSlug,
        );
        project.detail = checkProject;
        const model = await createDynamicModel(project.slug);
        for (const entryInOrder of project.entries) {
            const entry = await model.findById(entryInOrder.entryId).lean();
            await saveLog(
                logTemplates({
                    type: 'entrySubscriptionChanged',
                    entity: entry,
                    order,
                    project,
                    changes: [
                        {
                            key: 'Subscriptions',
                            oldValue: camelCaseWithCommaToNormalString(
                                entryInOrder.selectedSubscriptions.join(','),
                            ),
                            newValue:
                                camelCaseWithCommaToNormalString(subscriptions),
                        },
                    ],
                    actor: req.session.user,
                }),
            );
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
                        'projects.$.entries.$[entry].selectedSubscriptions':
                            subscriptionsArray,
                    },
                },
                {
                    arrayFilters: [{ 'entry.entryId': entryId }],
                    new: true,
                    lean: true,
                },
            );
        }

        const project = existingOrder.projects.find(
            (p) => p.slug === projectSlug,
        );
        project.detail = checkProject;
        if (project) {
            const entry = project.entries.find(
                (e) => e.entryId.toString() === entryId,
            );
            if (entry) {
                const existingSubscriptions =
                    entry.selectedSubscriptions.join(',');
                const model = await createDynamicModel(project.slug);
                const entryDetail = await model.findById(entry.entryId).lean();
                await saveLog(
                    logTemplates({
                        type: 'entrySubscriptionChanged',
                        entity: entryDetail,
                        order,
                        project,
                        changes: [
                            {
                                key: 'Subscriptions',
                                oldValue: camelCaseWithCommaToNormalString(
                                    existingSubscriptions,
                                ),
                                newValue:
                                    camelCaseWithCommaToNormalString(
                                        subscriptions,
                                    ),
                            },
                        ],
                        actor: req.session.user,
                    }),
                );
                await saveLog(
                    logTemplates({
                        type: 'orderEntrySubscriptionChanged',
                        entity: order,
                        entry: entryDetail,
                        project,
                        changes: [
                            {
                                key: 'Subscriptions',
                                oldValue: camelCaseWithCommaToNormalString(
                                    existingSubscriptions,
                                ),
                                newValue:
                                    camelCaseWithCommaToNormalString(
                                        subscriptions,
                                    ),
                            },
                        ],
                        actor: req.session.user,
                    }),
                );
            }
        }
    }

    if (req.query.addProject) {
        const { project, allEntries } = await getOldestPaidEntries(
            req,
            checkProject,
        );

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

        checkProject.selection = updatedProject;

        await saveLog(
            logTemplates({
                type: 'orderProjectSelection',
                entity: order,
                project: checkProject,
                actor: req.session.user,
            }),
        );

        updatedProject.detail = checkProject;
        const model = await createDynamicModel(project.slug);
        for (const entryInOrder of updatedProject.entries) {
            const entry = await model.findById(entryInOrder.entryId).lean();
            await saveLog(
                logTemplates({
                    type: 'entryAddedToOrder',
                    entity: entry,
                    order,
                    project: updatedProject,
                    actor: req.session.user,
                }),
            );
        }
    }

    if (req.query.replaceProject) {
        const { project, allEntries } = await getOldestPaidEntries(
            req,
            checkProject,
        );
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

        const newProject = await Project.findOne({
            slug: updatedProject.slug,
        }).lean();
        newProject.selection = updatedProject;
        await saveLog(
            logTemplates({
                type: 'orderProjectSelection',
                entity: order,
                project: newProject,
                actor: req.session.user,
            }),
        );

        updatedProject.detail = checkProject;
        const model = await createDynamicModel(project.slug);

        const oldProject = existingOrder.projects.find(
            (p) => p.slug === checkProject.slug,
        );
        oldProject.detail = checkProject;

        for (const entryInOrder of oldProject.entries) {
            const entry = await model.findById(entryInOrder.entryId).lean();
            await saveLog(
                logTemplates({
                    type: 'entryRemovedFromOrder',
                    entity: entry,
                    order,
                    project: oldProject,
                    actor: req.session.user,
                }),
            );
        }

        for (const entryInOrder of updatedProject.entries) {
            const entry = await model.findById(entryInOrder.entryId).lean();
            await saveLog(
                logTemplates({
                    type: 'entryAddedToOrder',
                    entity: entry,
                    order,
                    project: updatedProject,
                    actor: req.session.user,
                }),
            );
        }
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
        await saveLog(
            logTemplates({
                type: 'orderProjectRemoved',
                entity: order,
                order,
                project: checkProject,
                actor: req.session.user,
            }),
        );
        const oldProject = existingOrder.projects.find(
            (p) => p.slug === checkProject.slug,
        );
        oldProject.detail = checkProject;
        const model = await createDynamicModel(oldProject.slug);
        for (const entryInOrder of oldProject.entries) {
            const entry = await model.findById(entryInOrder.entryId).lean();
            await saveLog(
                logTemplates({
                    type: 'entryRemovedFromOrder',
                    entity: entry,
                    order,
                    project: oldProject,
                    actor: req.session.user,
                }),
            );
        }
    }

    return order;
};

module.exports = { runQueriesOnOrder };
