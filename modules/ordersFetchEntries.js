const { generateSearchQuery } = require('../modules/generateSearchQuery');
const { createDynamicModel } = require('../models/createDynamicModel');

const Order = require('../models/Order');
const mongoose = require('mongoose');
const { errorMonitor } = require('connect-mongo');

const validateQuery = async (req, res) => {
    const orderId = req.query.orderId;
    const projectSlug = req.params.slug;
    const order = await Order.findById(req.query.orderId).lean();
    const projectInOrder = order.projects.find(
        (project) => project.slug === projectSlug,
    );
    if (!projectInOrder) {
        return true;
    }
    if (
        req.query.subscriptions &&
        req.query.subscriptions != 'empty' &&
        !req.query.entryId
    ) {
        const subscriptions = req.query.subscriptions.split(',');
        let excludedEntries = [];
        for (const entry of projectInOrder.entries) {
            const orders = await Order.aggregate([
                { $unwind: '$projects' },
                { $unwind: '$projects.entries' },
                {
                    $match: {
                        _id: { $ne: order._id },
                        'projects.entries.entryId': entry.entryId,
                        'projects.entries.totalCost': { $gt: 0 },
                        status: 'paid',
                    },
                },
                {
                    $addFields: {
                        projectExpiry: {
                            $add: [
                                '$createdAt',
                                {
                                    $multiply: [
                                        '$projects.months',
                                        30 * 24 * 60 * 60 * 1000,
                                    ],
                                },
                                30 * 24 * 60 * 60 * 1000,
                            ],
                        },
                    },
                },
                {
                    $project: {
                        _id: 1,
                        orderId: '$_id',
                        entryId: '$projects.entries.entryId',
                        lastPaid: '$createdAt',
                        selectedSubscriptions:
                            '$projects.entries.selectedSubscriptions',
                        costs: '$projects.entries.costs',
                        orderNo: '$orderNo',
                        expiry: '$projectExpiry',
                    },
                },
                { $sort: { lastPaid: 1 } },
            ]);

            if (orders.length > 0) {
                const validSubscriptions = subscriptions.filter(
                    (subscription) => {
                        const alreadySelected = orders.some(
                            (order) =>
                                order.selectedSubscriptions.includes(
                                    subscription,
                                ) && new Date(order.expiry) > new Date(),
                        );
                        if (alreadySelected) return false;
                        const costObject = entry.costs.find(
                            (field) => field.fieldName === subscription,
                        );
                        console.log(costObject.totalCost);
                        if (costObject.totalCost > 0) {
                            return true;
                        }
                        return false;
                    },
                );
                excludedEntries.push({
                    entryId: entry.entryId,
                    validSubscriptions: validSubscriptions,
                });
            }
        }

        req.query.excludedEntries = excludedEntries;
    }

    if (
        req.query.subscriptions &&
        req.query.subscriptions != 'empty' &&
        req.query.entryId
    ) {
        const subscriptions = req.query.subscriptions.split(',');
        const entryId = new mongoose.Types.ObjectId(req.query.entryId);

        const orders = await Order.aggregate([
            { $unwind: '$projects' },
            { $unwind: '$projects.entries' },
            {
                $match: {
                    _id: { $ne: order._id },
                    'projects.entries.entryId': entryId,
                    'projects.entries.totalCost': { $gt: 0 },
                    status: 'paid',
                },
            },
            {
                $addFields: {
                    projectExpiry: {
                        $add: [
                            '$createdAt',
                            {
                                $multiply: [
                                    '$projects.months',
                                    30 * 24 * 60 * 60 * 1000,
                                ],
                            },
                            30 * 24 * 60 * 60 * 1000,
                        ],
                    },
                },
            },
            {
                $group: {
                    _id: '$projects.entries.entryId',
                    lastPaid: { $first: '$createdAt' },
                    selectedSubscriptions: {
                        $first: '$projects.entries.selectedSubscriptions',
                    },
                    orderId: { $first: '$_id' },
                    expiry: { $first: '$projectExpiry' },
                },
            },
            { $sort: { lastPaid: 1 } },
        ]);
        if (orders.length > 0) {
            for (const order of orders) {
                const isAlreadyOrdered = subscriptions.some((subscription) => {
                    return (
                        order.selectedSubscriptions.includes(subscription) &&
                        new Date(order.expiry) > new Date()
                    );
                });
                if (isAlreadyOrdered)
                    throw new Error(
                        `Couldn't select ${entryId} for subscription as it is already subscribed!`,
                    );
            }
        }
    }

    return true;
};

const getPreviousOrdersForEntry = async (entryId, orderId) => {
    if (!orderId) {
        throw new Error('order id is required');
    }
    const lastPaidOrders = await Order.aggregate([
        { $unwind: '$projects' },
        { $unwind: '$projects.entries' },
        {
            $match: {
                _id: { $ne: orderId },
                'projects.entries.entryId': entryId,
                'projects.entries.totalCost': { $gt: 0 },
                status: 'paid',
            },
        },
        {
            $addFields: {
                projectExpiry: {
                    $add: [
                        '$createdAt',
                        {
                            $multiply: [
                                '$projects.months',
                                30 * 24 * 60 * 60 * 1000,
                            ],
                        },
                        30 * 24 * 60 * 60 * 1000,
                    ],
                },
            },
        },
        {
            $project: {
                _id: 1,
                orderId: '$_id',
                entryId: '$projects.entries.entryId',
                lastPaid: '$createdAt',
                selectedSubscriptions:
                    '$projects.entries.selectedSubscriptions',
                costs: '$projects.entries.costs',
                orderNo: '$orderNo',
                expiry: '$projectExpiry',
            },
        },
        { $sort: { lastPaid: 1 } },
    ]);

    const lastPaid = lastPaidOrders.length > 0 ? lastPaidOrders : null;

    return lastPaid;
};

const getNonFullySubscribedEntries = async (
    orderId,
    project,
    alreadySelectedEntries,
    searchQuery,
) => {
    const subscriptionFields = project.fields
        .filter((field) => field.subscription === true)
        .map((field) => field.name);

    const DynamicModel = await createDynamicModel(project.slug);

    const entries = await DynamicModel.find({
        _id: {
            $in: alreadySelectedEntries,
        },
        ...searchQuery,
    }).lean();

    const nonFullySubscribed = [];
    const fullySubscribed = [];

    for (const entry of entries) {
        const requiredSubscriptions = subscriptionFields.filter(
            (field) => entry[field] && entry[field] > 0,
        );

        if (requiredSubscriptions.length === 0) {
            continue;
        }

        const currentDate = new Date();

        const orders = await Order.find({
            _id: { $ne: orderId },
            'projects.entries.entryId': entry._id,
            'projects.entries.totalCost': { $gt: 0 },
            status: 'paid',
        }).lean();

        let isFullySubscribed = false;
        let activeSubscriptions = [];
        let costArray = [];
        let tempReturnDoc = [];

        for (const order of orders) {
            let orderExpired = false;

            const projectInOrder = order.projects.find(
                (temp) => temp.slug === project.slug,
            );

            if (!projectInOrder) {
                throw new Error('project not found something is wrong');
            }

            const expirationDate = new Date(order.createdAt);
            expirationDate.setMonth(
                expirationDate.getMonth() + projectInOrder.months + 1,
            );
            if (expirationDate <= currentDate) {
                orderExpired = true;
                break;
            }

            const projectEntries = projectInOrder.entries.filter(
                (projEntry) =>
                    projEntry.entryId.toString() === entry._id.toString(),
            );
            if (projectEntries.length === 0) break;

            if (order.orderNo == 266 || entry.name == 'Dustin Guzman') {
            }

            for (const projEntry of projectEntries) {
                for (const sub of requiredSubscriptions) {
                    const cost = projEntry.costs.find(
                        (field) => field.fieldName === sub,
                    );
                    if (cost.totalOrderedCost > 0) {
                        activeSubscriptions.push(sub);
                        costArray.push({
                            cost,
                            orderId: order._id,
                        });
                    } else {
                        continue;
                    }
                    tempReturnDoc.push({
                        orderId: order._id,
                        selectedSubscriptions: projEntry.selectedSubscriptions,
                        costs: projEntry.costs,
                        expiry: expirationDate,
                    });
                    if (
                        requiredSubscriptions.every((reqSub) =>
                            activeSubscriptions.includes(reqSub),
                        )
                    ) {
                        isFullySubscribed = true;
                        break;
                    }
                }
            }
            if (isFullySubscribed) break;

            if (orderExpired) break;
            if (isFullySubscribed) break;
        }

        if (!isFullySubscribed) {
            nonFullySubscribed.push({
                entry,
                entryId: entry._id,
                entryName: entry.name,
                activeSubscriptions,
                requiredSubscriptions,
                filteredCostArray: costArray,
                oldOrders: tempReturnDoc,
            });
        } else {
            fullySubscribed.push({
                entry,
                entryId: entry._id,
                entryName: entry.name,
                activeSubscriptions,
                requiredSubscriptions,
                filteredCostArray: costArray,
                oldOrders: tempReturnDoc,
            });
        }
    }

    return { nonFullySubscribed, fullySubscribed };
};

const getOldestPaidEntries = async (req, project) => {
    const DynamicModel = await createDynamicModel(project.slug);
    const collectionName = DynamicModel.collection.name;

    const { searchQuery, fieldFilters } = generateSearchQuery(req, project);
    const selectCount = parseInt(req.query.select) || 50;

    const alreadySelectedEntriesResult = await Order.aggregate([
        {
            $match: {
                _id: { $ne: req.query.orderId },
                'projects.slug': project.slug,
            },
        },
        {
            $unwind: '$projects',
        },
        {
            $unwind: '$projects.entries',
        },
        {
            $group: {
                _id: null,
                entryIds: { $addToSet: '$projects.entries.entryId' },
            },
        },
        {
            $project: {
                _id: 0,
                entryIds: 1,
            },
        },
    ]);

    const alreadySelectedEntries =
        alreadySelectedEntriesResult[0]?.entryIds || [];

    const countNotSelected = await DynamicModel.countDocuments({
        _id: { $nin: alreadySelectedEntries },
        ...searchQuery,
    });

    let entriesToPay = [];

    if (countNotSelected > selectCount) {
        entriesToPay = await DynamicModel.find({
            _id: { $nin: alreadySelectedEntries },
            ...searchQuery,
        })
            .limit(selectCount)
            .lean();
        return {
            project,
            allEntries: entriesToPay,
        };
    }

    const {
        nonFullySubscribed: lastIncompleteOrders,
        fullySubscribed: lastOrders,
    } = await getNonFullySubscribedEntries(
        req.query.orderId,
        project,
        alreadySelectedEntries,
        searchQuery,
    );

    let paidEntryIds = lastOrders.map((order) => order.entryId);
    let halfPaidEntryIds = lastIncompleteOrders.map((order) => order.entryId);

    const countHalfPaid = await DynamicModel.countDocuments({
        _id: { $in: halfPaidEntryIds },
        ...searchQuery,
    });

    const countNotPaid = countNotSelected;

    if (countNotPaid <= selectCount) {
        let entriesWithPayments = [];
        let entriesWithHalfPayments = [];
        let entriesWithOutPayments = [];
        const pickFromNotPaid = countNotPaid;
        const pickFromHalfPaid =
            selectCount - countNotPaid >= countHalfPaid
                ? countHalfPaid
                : selectCount - countNotPaid;
        const pickFromPaid = selectCount - (pickFromNotPaid + pickFromHalfPaid);
        if (pickFromNotPaid > 0) {
            entriesWithOutPayments = await DynamicModel.find({
                _id: { $nin: [...paidEntryIds, ...halfPaidEntryIds] },
                ...searchQuery,
            })
                .limit(pickFromNotPaid)
                .lean();
        }
        if (pickFromHalfPaid > 0) {
            entriesWithHalfPayments = lastIncompleteOrders
                .slice(0, pickFromHalfPaid)
                .map((payments) => {
                    return {
                        ...payments.entry,
                        oldOrders: payments.oldOrders,
                    };
                });
        }
        if (pickFromPaid > 0) {
            entriesWithPayments = lastOrders
                .slice(0, pickFromPaid)
                .map((payments) => {
                    return {
                        ...payments.entry,
                        oldOrders: payments.oldOrders,
                    };
                });
        }
        entriesToPay = [
            ...entriesWithOutPayments,
            ...entriesWithHalfPayments,
            ...entriesWithPayments,
        ];
    }

    return {
        project,
        allEntries: entriesToPay,
    };
};

const makeProjectForOrder = (project, allEntries) => {
    return {
        slug: project.slug,
        months: 12,
        entries: allEntries.map((entry) => {
            return {
                entryId: entry._id,
                selectedSubscriptions: project.fields
                    .filter((field) => {
                        const isSubscriptionValid =
                            field.subscription && entry[field.name];

                        if (!entry.oldOrders || !isSubscriptionValid) {
                            return isSubscriptionValid;
                        }

                        const isAlreadyOrdered = entry.oldOrders.some(
                            (order) => {
                                return (
                                    order.selectedSubscriptions &&
                                    order.selectedSubscriptions.includes(
                                        field.name,
                                    ) &&
                                    new Date(order.expiry) > new Date()
                                );
                            },
                        );

                        return isSubscriptionValid && isAlreadyOrdered == false;
                    })
                    .map((field) => field.name),
            };
        }),
    };
};

const orderIsValid = async (req, res) => {};

module.exports = {
    getOldestPaidEntries,
    makeProjectForOrder,
    getPreviousOrdersForEntry,
    validateQuery,
};
