const { generateSearchQuery } = require('../modules/generateSearchQuery');
const { createDynamicModel } = require('../models/createDynamicModel');

const Order = require('../models/Order');
const Project = require('../models/Project');
const mongoose = require('mongoose');
const { errorMonitor } = require('connect-mongo');
const moment = require('moment');
const { generatePagination } = require('../modules/generatePagination');

const validateQuery = async (req, res) => {
    const orderId = req.query.orderId;
    const projectSlug = req.params.slug;
    const order = await Order.findById(req.query.orderId).lean();
    const projectInOrder = order.projects.find((project) => project.slug === projectSlug);
    if (!projectInOrder) {
        return true;
    }
    if (req.query.subscriptions && req.query.subscriptions != 'empty' && !req.query.entryId) {
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
                        // 'projects.entries.totalCost': { $gt: 0 },
                        // status: 'paid',
                    },
                },
                {
                    $addFields: {
                        projectExpiry: {
                            $add: [
                                '$createdAt',
                                {
                                    $multiply: ['$projects.months', 30 * 24 * 60 * 60 * 1000],
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
                        selectedSubscriptions: '$projects.entries.selectedSubscriptions',
                        costs: '$projects.entries.costs',
                        orderNo: '$orderNo',
                        expiry: '$projectExpiry',
                    },
                },
                { $sort: { lastPaid: 1 } },
            ]);

            if (orders.length > 0) {
                const validSubscriptions = subscriptions.filter((subscription) => {
                    const alreadySelected = orders.some(
                        (order) => order.selectedSubscriptions.includes(subscription) && new Date(order.expiry) > new Date(),
                    );
                    if (alreadySelected) return false;
                    const costObject = entry.costs.find((field) => field.fieldName === subscription);
                    if (costObject.totalCost > 0) {
                        return true;
                    }
                    return false;
                });
                excludedEntries.push({
                    entryId: entry.entryId,
                    validSubscriptions: validSubscriptions,
                });
            }
        }

        req.query.excludedEntries = excludedEntries;
    }

    if (req.query.subscriptions && req.query.subscriptions != 'empty' && req.query.entryId) {
        const subscriptions = req.query.subscriptions.split(',');
        const entryId = new mongoose.Types.ObjectId(req.query.entryId);

        const orders = await Order.aggregate([
            { $unwind: '$projects' },
            { $unwind: '$projects.entries' },
            {
                $match: {
                    _id: { $ne: order._id },
                    'projects.entries.entryId': entryId,
                    // 'projects.entries.totalCost': { $gt: 0 },
                    // status: 'paid',
                },
            },
            {
                $addFields: {
                    projectExpiry: {
                        $add: [
                            '$createdAt',
                            {
                                $multiply: ['$projects.months', 30 * 24 * 60 * 60 * 1000],
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
                req.query.subscriptions = subscriptions
                    .filter((subscription) => {
                        return !(order.selectedSubscriptions.includes(subscription) && new Date(order.expiry) > new Date());
                    })
                    .join(',');
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
                // 'projects.entries.totalCost': { $gt: 0 },
                // status: 'paid',
            },
        },
        {
            $addFields: {
                projectExpiry: {
                    $add: [
                        '$createdAt',
                        {
                            $multiply: ['$projects.months', 30 * 24 * 60 * 60 * 1000],
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
                selectedSubscriptions: '$projects.entries.selectedSubscriptions',
                costs: '$projects.entries.costs',
                orderNo: '$orderNo',
                expiry: '$projectExpiry',
                status: '$status',
            },
        },
        { $sort: { lastPaid: 1 } },
    ]);

    const lastPaid = lastPaidOrders.length > 0 ? lastPaidOrders : null;

    return lastPaid;
};

const getNonFullySubscribedEntries = async (orderId, project, alreadySelectedEntries, searchQuery) => {
    const subscriptionFields = project.fields.filter((field) => field.subscription === true).map((field) => field.name);

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
        const requiredSubscriptions = subscriptionFields.filter((field) => entry[field] && entry[field] > 0);

        if (requiredSubscriptions.length === 0) {
            continue;
        }

        const currentDate = new Date();

        const orders = await Order.find({
            _id: { $ne: orderId },
            'projects.entries.entryId': entry._id,
            // 'projects.entries.totalCost': { $gt: 0 },
            // status: 'paid',
        }).lean();

        let isFullySubscribed = false;
        let activeSubscriptions = [];
        let costArray = [];
        let tempReturnDoc = [];

        for (const order of orders) {
            let orderExpired = false;

            const projectInOrder = order.projects.find((temp) => temp.slug === project.slug);

            if (!projectInOrder) {
                throw new Error('project not found something is wrong');
            }

            const expirationDate = new Date(order.createdAt);
            expirationDate.setMonth(expirationDate.getMonth() + projectInOrder.months + 1);
            if (expirationDate <= currentDate) {
                orderExpired = true;
                break;
            }

            const projectEntries = projectInOrder.entries.filter(
                (projEntry) => projEntry.entryId.toString() === entry._id.toString(),
            );
            if (projectEntries.length === 0) break;

            for (const projEntry of projectEntries) {
                for (const sub of requiredSubscriptions) {
                    const cost = projEntry.costs.find((field) => field.fieldName === sub);
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
                    if (requiredSubscriptions.every((reqSub) => activeSubscriptions.includes(reqSub))) {
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

const getOldestPaidEntries = async (req, project, pickDraft = true) => {
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

    const alreadySelectedEntries = alreadySelectedEntriesResult[0]?.entryIds || [];

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

    if (!pickDraft) {
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

    const { nonFullySubscribed: lastIncompleteOrders, fullySubscribed: lastOrders } = await getNonFullySubscribedEntries(
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
        const pickFromHalfPaid = selectCount - countNotPaid >= countHalfPaid ? countHalfPaid : selectCount - countNotPaid;
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
            const shuffledOrders = lastIncompleteOrders.sort(() => Math.random() - 0.5);
            entriesWithHalfPayments = shuffledOrders.slice(0, pickFromHalfPaid).map((payments) => {
                return {
                    ...payments.entry,
                    oldOrders: payments.oldOrders,
                };
            });
        }
        if (pickFromPaid > 0) {
            const shuffledOrders = lastOrders.sort(() => Math.random() - 0.5);
            entriesWithPayments = shuffledOrders.slice(0, pickFromPaid).map((payments) => {
                return {
                    ...payments.entry,
                    oldOrders: payments.oldOrders,
                };
            });
        }
        entriesToPay = [...entriesWithOutPayments, ...entriesWithHalfPayments, ...entriesWithPayments];
    }

    return {
        project,
        allEntries: entriesToPay,
    };
};

const makeSubscriptionArrayForOrder = (project, entry) => {
    const subArray = project.fields
        .filter((field) => {
            const isSubscriptionValid = field.subscription && entry[field.name];

            if (!entry.oldOrders || !isSubscriptionValid) {
                return isSubscriptionValid;
            }

            const isAlreadyOrdered = entry.oldOrders.some((order) => {
                return (
                    order.selectedSubscriptions &&
                    order.selectedSubscriptions.includes(field.name) &&
                    new Date(order.expiry) > new Date()
                );
            });

            return isSubscriptionValid && isAlreadyOrdered == false;
        })
        .map((field) => field.name);
    return subArray;
};

const makeEntriesForWidgetOrder = (allEntries, selectEntries = 1) => {
    const entriesArray = allEntries.map((entry) => {
        const entryInOrder = {
            entryId: entry._id,
            selectedSubscriptions: selectEntries > 0 ? makeSubscriptionArrayForOrder(project, entry) : [],
        };
        selectEntries--;
        return entryInOrder;
    });
    return entriesArray;
};

const makeProjectForWidgetOrder = (project, allEntries, months = 12, selectEntries = 1) => {
    const output = {
        slug: project.slug,
        months,
        entries: allEntries.map((entry) => {
            const entryInOrder = {
                entryId: entry._id,
                selectedSubscriptions: selectEntries > 0 ? makeSubscriptionArrayForOrder(project, entry) : [],
            };
            selectEntries--;
            return entryInOrder;
        }),
    };

    return output;
};

const makeProjectForOrder = (project, allEntries, months = 12) => {
    return {
        slug: project.slug,
        months,
        entries: allEntries.map((entry) => {
            return {
                entryId: entry._id,
                selectedSubscriptions: project.fields
                    .filter((field) => {
                        const isSubscriptionValid = field.subscription && entry[field.name];

                        if (!entry.oldOrders || !isSubscriptionValid) {
                            return isSubscriptionValid;
                        }

                        const isAlreadyOrdered = entry.oldOrders.some((order) => {
                            return (
                                order.selectedSubscriptions &&
                                order.selectedSubscriptions.includes(field.name) &&
                                new Date(order.expiry) > new Date()
                            );
                        });

                        return isSubscriptionValid && isAlreadyOrdered == false;
                    })
                    .map((field) => field.name),
            };
        }),
    };
};

const getEntriesByCustomerId = async (req, customerId) => {

    const now = new Date();

    if (customerId && typeof customerId === 'string' && mongoose.isValidObjectId(customerId)) {
        customerId = new mongoose.Types.ObjectId(customerId);
    }

    const orders = await Order.aggregate([
        {
            $match: {
                customerId: customerId,
                status: 'paid',
            },
        },
        {
            $addFields: {
                maxMonths: { $max: '$projects.months' },
            },
        },
        {
            $addFields: {
                expirationDate: {
                    $dateAdd: {
                        startDate: {
                            $dateAdd: {
                                startDate: '$createdAt',
                                unit: 'month',
                                amount: '$maxMonths',
                            },
                        },
                        unit: 'day',
                        amount: 2, 
                    },
                },
            },
        },

        {
            $match: {
                expirationDate: { $gt: new Date() },
            },
        },
    ]);

    const validEntriesByProject = orders.flatMap((order) =>
        order.projects.flatMap((project) =>
            project.entries.map((entry) => ( entry.totalCost > 0 ? {
                projectSlug: project.slug,
                entryId: entry.entryId,
                orderNo: order.orderNo,
                createdAt: order.createdAt,
                orderId: order._id,
                expiry: !order.monthlySubscription
                    ? new Date(new Date(order.createdAt).getTime() + project.months * 30 * 24 * 60 * 60 * 1000)
                    : null,
                renewalDate: order.monthlySubscription
                    ? new Date(new Date(order.createdAt).getTime() + project.months * 30 * 24 * 60 * 60 * 1000)
                    : null,
            }: null)).filter(entry => entry != null),
        ),
    );

    const paginate = (array, page, pageSize) => {
        const start = (page - 1) * pageSize;
        return array.slice(start, start + pageSize);
    };

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = validEntriesByProject.length;

    const totalPages = Math.ceil(total / limit);

    const paginatedEntriesByProject = paginate(validEntriesByProject, page, limit);
    
    const mergedEntriesByProject = await paginatedEntriesByProject.reduce(async (accPromise, entry) => {
        const acc = await accPromise;

        const projectIndex = acc.findIndex((p) => p.projectSlug === entry.projectSlug);
        if (projectIndex === -1) {
            const projectData = await Project.findOne({ slug: entry.projectSlug }).lean();
            const model = await createDynamicModel(entry.projectSlug);

            const entryData = await model.findById(entry.entryId).lean();

            acc.push({
                projectSlug: entry.projectSlug,
                project: projectData,
                model: model,
                entries: [
                    {
                        orderNo: entry.orderNo,
                        createdAt: entry.createdAt,
                        entryId: entry.entryId,
                        orderId: entry.orderId,
                        expiry: entry.expiry,
                        renewalDate: entry.renewalDate,
                        entry: entryData,
                    },
                ],
            });
        } else {
            const model = acc[projectIndex].model;
            const entryData = await model.findById(entry.entryId).lean();

            acc[projectIndex].entries.push({
                orderNo: entry.orderNo,
                createdAt: entry.createdAt,
                entryId: entry.entryId,
                orderId: entry.orderId,
                expiry: entry.expiry,
                renewalDate: entry.renewalDate,
                entry: entryData,
            });
        }

        return acc;
    }, Promise.resolve([]));

    const output = mergedEntriesByProject.map((project) => {
        const { model, ...cleanProject } = project;
        return cleanProject;
    });

    return {
        subscriptions: output,
        pagesArray: generatePagination(totalPages, page),
        currentPage: page,
        totalPages,
        totalEntries: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1,
    };
};

const paginateActiveSubscriptions = (req,entries) => {

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = entries.length;

    const totalPages = Math.ceil(total / limit);

    return {
        entries,
        pagesArray: generatePagination(totalPages, page),
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1,
    };

}

module.exports = {
    getOldestPaidEntries,
    makeProjectForOrder,
    makeProjectForWidgetOrder,
    makeEntriesForWidgetOrder,
    getPreviousOrdersForEntry,
    validateQuery,
    getEntriesByCustomerId,
    paginateActiveSubscriptions,
};
