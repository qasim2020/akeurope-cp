const Project = require('../models/Project');
const Customer = require('../models/Customer');
const Order = require('../models/Order');

const { createDynamicModel } = require('../models/createDynamicModel');
const { generatePagination } = require('../modules/generatePagination');
const { getCurrencyRates } = require('./getCurrencyRates');
const { runQueriesOnOrder } = require('../modules/orderUpdates');
const {
    getOldestPaidEntries,
    makeProjectForOrder,
    getPreviousOrdersForEntry,
} = require('../modules/ordersFetchEntries');
const { saveLog } = require('./logAction');
const { logTemplates } = require('./logTemplates');
const { capitalizeFirstLetter } = require('./helpers');

const createPagination = ({
    req,
    totalEntries,
    fieldFilters,
    filtersQuery,
    pageType,
}) => {
    const limit = parseInt(req.query.limit) || 10;
    const totalPages = Math.ceil(totalEntries / limit);
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || '_id';
    return {
        totalEntries,
        totalPages,
        currentPage: page,
        limit,
        startIndex: totalEntries == 0 ? 0 : skip + 1,
        endIndex: Math.min(skip + limit, totalEntries),
        pagesArray: generatePagination(totalPages, page),
        sort: {
            sortBy,
            order: req.query.orderBy == undefined ? 'asc' : req.query.orderBy,
        },
        search: req.query.search,
        filtersQuery,
        fieldFilters: fieldFilters == {} ? undefined : fieldFilters,
        showSearchBar: req.query.showSearchBar,
        showFilters: req.query.showFilters,
        pageType,
    };
};

const calculationOnProject = async (projectOrdered, requestedCurrencyRate) => {
    const projectOriginal = await Project.findOne({
        slug: projectOrdered.slug,
    }).lean();

    const DynamicModel = await createDynamicModel(projectOrdered.slug);

    const currencyRates = await getCurrencyRates(requestedCurrencyRate);
    const currencyRate = parseFloat(
        currencyRates.rates.get(projectOriginal.currency).toFixed(2),
    );

    let allEntries = await Promise.all(
        projectOrdered.entries.map((entry) =>
            DynamicModel.findById(entry.entryId).lean(),
        ),
    );

    allEntries = allEntries.filter((entry) => entry != null);

    allEntries.forEach((entry) => {
        const matchingOrderedEntry = projectOrdered.entries.find(
            (entryOrdered) =>
                entryOrdered.entryId.toString() === entry._id.toString(),
        );

        if (matchingOrderedEntry) {
            entry.selectedSubscriptions =
                matchingOrderedEntry.selectedSubscriptions || [];
        } else {
            entry.selectedSubscriptions = [];
        }

        projectOriginal.fields.forEach((field) => {
            if (field.subscription == true) {
                entry[field.name] = parseFloat(
                    (entry[field.name] / currencyRate).toFixed(2),
                );
            }
        });

        entry.totalOrderedCost = projectOriginal.fields.reduce(
            (total, field) => {
                if (
                    field.subscription == true &&
                    entry.selectedSubscriptions.includes(field.name)
                ) {
                    total = total + entry[field.name];
                }
                return parseFloat(total.toFixed(2));
            },
            0,
        );

        entry.totalCost = projectOriginal.fields.reduce((total, field) => {
            if (field.subscription == true) {
                total = total + entry[field.name];
            }
            return parseFloat(total.toFixed(2));
        }, 0);
    });

    let projectTotalSingleMonth = 0;
    let projectOrderedSingleMonth = 0;
    let totalSubscriptionCosts = [];

    projectOriginal.fields = projectOriginal.fields.map((field) => {
        if (field.subscription == true) {
            const colSum = allEntries.reduce((total, entry) => {
                total = total + entry[field.name];
                return total;
            }, 0);
            const totalCost = parseFloat(colSum.toFixed(2));
            projectTotalSingleMonth = projectTotalSingleMonth + colSum;
            Object.assign(field, { totalCost: totalCost });
        }

        if (field.subscription == true) {
            const colSum = allEntries.reduce((total, entry) => {
                if (entry.selectedSubscriptions.includes(field.name)) {
                    total = total + entry[field.name];
                }
                return total;
            }, 0);
            projectOrderedSingleMonth = projectOrderedSingleMonth + colSum;
            const totalCost = parseFloat(colSum.toFixed(2));
            Object.assign(field, {
                totalOrderedCost: totalCost,
            });
        }

        if (field.subscription == true) {
            totalSubscriptionCosts.push({
                name: field.name,
                actualName: field.actualName,
                totalCost: field.totalCost,
                totalOrderedCost: field.totalOrderedCost,
            });
        }

        return field;
    });

    projectOriginal.totalSubscriptionCosts = totalSubscriptionCosts;
    projectOriginal.months = parseFloat(projectOrdered.months.toFixed(2));
    projectOriginal.totalCost = parseFloat(projectTotalSingleMonth.toFixed(2));
    projectOriginal.totalOrderedCost = parseFloat(
        projectOrderedSingleMonth.toFixed(2),
    );
    projectOriginal.totalOrderedCostAllMonths = parseFloat(
        (projectOrderedSingleMonth * projectOrdered.months).toFixed(2),
    );
    projectOriginal.selectedCurrency = requestedCurrencyRate;

    return {
        project: projectOriginal,
        allEntries,
    };
};

const updateDraftOrder = async (req, res) => {
    const checkProject = await Project.findOne({
        slug: req.params.slug,
    }).lean();
    if (!checkProject)
        throw new Error(`Project "${req.params.slug}" not found`);

    const order = await runQueriesOnOrder(req, res);

    if (!order) {
        return true;
    }

    const checkOrder = await Order.findById(req.query.orderId).lean();
    const calculatedOrder = await calculateOrder(order);
    await addPaymentsToOrder(calculatedOrder);

    if (checkOrder.totalCost != calculatedOrder.totalCost) {
        await saveLog(
            logTemplates({
                type: 'orderTotalCostChanged',
                entity: order,
                changes: [
                    {
                        key: 'totalCost',
                        oldValue: `${checkOrder.totalCost} ${checkOrder.currency}`,
                        newValue: `${calculatedOrder.totalCost} ${calculatedOrder.currency}`,
                    },
                ],
                actor: req.session.user,
            }),
        );
    }

    return true;
};

const createDraftOrder = async (req, res) => {
    try {
        const checkProject = await Project.findOne({
            slug: req.params.slug,
        }).lean();
        if (!checkProject)
            throw new Error(`Project "${req.params.slug}" not found`);

        const { project, allEntries } = await getOldestPaidEntries(
            req,
            checkProject,
        );

        const updatedProject = makeProjectForOrder(project, allEntries);

        const order = new Order({
            customerId: req.session.user._id,
            currency: req.query.currency,
            projects: [updatedProject],
        });

        await order.save();

        await saveLog(
            logTemplates({
                type: 'orderCreated',
                entity: order,
                actor: req.session.user,
            }),
        );

        project.selection = updatedProject;

        await saveLog(
            logTemplates({
                type: 'orderProjectSelection',
                entity: order,
                project,
                actor: req.session.user,
            }),
        );

        updatedProject.detail = project;

        const model = await createDynamicModel(updatedProject.slug);
        for (const entryInOrder of updatedProject.entries) {
            const entry = await model.findById(entryInOrder.entryId).lean();
            await saveLog(
                logTemplates({
                    type: 'entryAddedToOrder',
                    entity: entry,
                    order,
                    project,
                    actor: req.session.user,
                }),
            );
        };

        const customer = await Customer.findById(order.customerId).lean();
        await saveLog(
            logTemplates({
                type: 'customerAddedToOrder',
                entity: customer,
                order,
                customer,
                actor: req.session.user,
            }),
        );

        const leanOrder = order.toObject();
        const calculatedOrder = await calculateOrder(leanOrder);
        await addPaymentsToOrder(calculatedOrder);

        return order._id;
    } catch (error) {
        console.error('Error saving order:', error);
        throw error;
    }
};

const getPaginatedOrders = async (req, res) => {
    const orders = await Order.find({customerId: req.session.user._id}).sort({ _id: -1 }).lean();

    const pagination = createPagination({
        req,
        totalEntries: orders.length,
        pageType: 'orders',
    });

    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const ordersPaginated = orders.slice(skip, skip + limit);

    for (const order of ordersPaginated) {
        order.customer = await Customer.findById(order.customerId).lean();
        order.projects = await Promise.all(
            order.projects.map((val) =>
                Project.findOne({ slug: val.slug })
                    .lean()
                    .then((projectDetails) =>
                        Object.assign(val, { details: projectDetails }),
                    ),
            ),
        );
    }

    return {
        orders: ordersPaginated,
        pagination,
    };
};

const countSubscribedEntries = (entries) => {
    return entries.filter((entry) => entry.selectedSubscriptions.length > 0)
        .length;
};

const calculateOrder = async (order) => {
    order.projects = await Promise.all(
        order.projects.map(async (val) => {
            const { project, allEntries } = await calculationOnProject(
                val,
                order.currency,
            );
            Object.assign(project, {
                select: countSubscribedEntries(allEntries),
                allEntries,
                entries: allEntries && allEntries.slice(0, 10),
                toggleState: 'hide',
            });
            return project;
        }),
    );
    order.totalCost = order.projects.reduce((total, project) => {
        return parseFloat(
            (total + project.totalOrderedCostAllMonths).toFixed(2),
        );
    }, 0);

    return order;
};

const formatOrder = async (req, order) => {
    order.customer = await Customer.findOne({
        _id: order.customerId,
    }).lean();

    order.customer.previousPayments = await Order.find({
        customerId: order.customerId,
        status: 'paid',
    });

    for (const project of order.projects) {
        const detail = await Project.findOne({ slug: project.slug }).lean();
        const entryModel = await createDynamicModel(project.slug);

        const pagination = createPagination({
            req,
            totalEntries: project.entries.length,
            pageType: 'payment-modal',
        });

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        project.entriesCount = countSubscribedEntries(project.entries);
        project.entries = project.entries.slice(skip, skip + limit);

        for (const entry of project.entries) {
            entry.detail = await entryModel
                .findOne({ _id: entry.entryId })
                .lean();
            entry.lastPaid = await getPreviousOrdersForEntry(
                entry.entryId,
                order._id,
            );
            if (entry.lastPaid) {
                for (const order of entry.lastPaid) {
                    entry.costs = entry.costs.map((cost) => {
                        if (
                            order.selectedSubscriptions &&
                            order.selectedSubscriptions.includes(cost.fieldName)
                        ) {
                            Object.assign(cost, {
                                prevOrder: order,
                            });
                            return cost;
                        }
                        return cost;
                    });
                }
            }
        }

        project.detail = detail;
        project.pagination = pagination;
        project.toggleState = req.query.toggleState || 'hide';
    }

    return order;
};

const getSingleOrder = async (req, res) => {
    const checkOrder = await Order.findOne({ _id: req.params.orderId, customerId: req.session.user._id }).lean();
    let order;
    if (!checkOrder) {
        throw new Error('Payment do not exist!');
    }
    if (checkOrder.totalCost == undefined) {
        const calculatedOrder = await calculateOrder(checkOrder);
        await addPaymentsToOrder(calculatedOrder);
        const orderInDb = await Order.findOne({
            _id: req.params.orderId,
        }).lean();
        order = await formatOrder(req, orderInDb);
    } else {
        order = await formatOrder(req, checkOrder);
    }
    order.customer = req.session.user;
    return order;
};

const updateOrderStatus = async (req, res) => {
    
    const orderId = req.params.orderId || req.query.orderId;
    const { status } = req.body;
    const checkOrder = await Order.findById(orderId).lean();

    if (checkOrder.totalCost == 0) {
        throw new Error('Invoice has no selected beneficiaries.')
    }

    const projectsWithZeroSubscriptions = checkOrder.projects.filter(project => project.totalCostSingleMonth == 0);

    if (projectsWithZeroSubscriptions.length > 0) {
        for (const project of projectsWithZeroSubscriptions) {
            await Order.updateOne(
                { _id: orderId, 'projects.slug': project.slug },
                {
                    $pull: { projects: { slug: project.slug } },
                },
            );
        }
    }

    const order = await Order.findOneAndUpdate(
        { _id: orderId },
        { $set: { status: status } },
        { new: true, lean: true },
    );
    
    if (checkOrder.status != order.status) {
        if (order.status == 'paid') {
            await saveLog(
                logTemplates({
                    type: 'orderStatusChangedToPaid',
                    entity: order,
                    actor: req.session.user,
                }),
            ); 
        } else {
            await saveLog(
                logTemplates({
                    type: 'orderStatusChanged',
                    entity: order,
                    changes: [
                        {
                            key: 'status',
                            oldValue: capitalizeFirstLetter(checkOrder.status),
                            newValue: capitalizeFirstLetter(order.status),
                        },
                    ],
                    actor: req.session.user,
                }),
            );
        };   
        for (const project of order.projects) {
            const model = await createDynamicModel(project.slug);
            project.detail = await Project.findOne({
                slug: project.slug,
            }).lean();
            for (const entryInOrder of project.entries) {
                const entry = await model.findById(entryInOrder.entryId).lean();
                await saveLog(
                    logTemplates({
                        type: 'entryOrderStatusChanged',
                        entity: entry,
                        order,
                        project,
                        actor: req.session.user,
                        color: order.status == 'paid' ? 'green' : 'blue',
                        changes: [
                            {
                                key: 'status',
                                oldValue: capitalizeFirstLetter(
                                    checkOrder.status,
                                ),
                                newValue: capitalizeFirstLetter(order.status),
                            },
                        ],
                    }),
                );
            }
        }
    }

    return order;
};

const addPaymentsToOrder = async (order) => {
    if (order.projects.length == 0) {
        await Order.updateOne(
            { _id: order._id },
            {
                $set: {
                    totalCost: order.totalCost,
                },
            },
        );
    };
    for (const project of order.projects) {
        const projectSlug = project.slug;
        const entries = project.allEntries;
        const fields = (await Project.findOne({ slug: projectSlug })).fields;
        if (!entries) {
            throw new Error('no entries received');
        }
        const cleanedEntries = entries.map((entry) => {
            const costs = [];
            fields.forEach((field) => {
                if (field.subscription == true) {
                    costs.push({
                        fieldName: field.name,
                        totalCost: entry[field.name],
                        totalOrderedCost: entry.selectedSubscriptions.includes(
                            field.name,
                        )
                            ? entry[field.name]
                            : 0,
                    });
                }
            });
            entry.costs = costs;
            return entry;
        });
        for (const entry of cleanedEntries) {
            const {
                _id: entryId,
                totalCost: totalCostAllSubscriptions,
                totalOrderedCost: totalCost,
                selectedSubscriptions,
                costs,
            } = entry;
            await Order.updateOne(
                { _id: order._id },
                {
                    $set: {
                        totalCost: order.totalCost,
                        'projects.$[project].totalCostSingleMonth':
                            project.totalOrderedCost,
                        'projects.$[project].totalSubscriptionCosts':
                            project.totalSubscriptionCosts,
                        'projects.$[project].totalCostAllMonths':
                            project.totalOrderedCostAllMonths,
                        'projects.$[project].months': project.months,
                        'projects.$[project].totalCost': project.totalCost,
                        'projects.$[project].entries.$[entry].totalCost':
                            totalCost,
                        'projects.$[project].entries.$[entry].totalCostAllSubscriptions':
                            totalCostAllSubscriptions,
                        'projects.$[project].entries.$[entry].selectedSubscriptions':
                            selectedSubscriptions,
                        'projects.$[project].entries.$[entry].costs': costs,
                    },
                },
                {
                    arrayFilters: [
                        { 'project.slug': projectSlug },
                        { 'entry.entryId': entryId },
                    ],
                },
            );
        }
    }
    return {
        message: 'Order payments added!',
    };
};

const openOrderProjectWithEntries = async (req, order) => {
    order.customer = await Customer.findOne({
        _id: order.customerId,
    }).lean();

    order.customer.previousPayments = await Order.find({
        customerId: order.customerId,
        status: 'paid',
    });

    for (const project of order.projects) {
        const detail = await Project.findOne({ slug: project.slug }).lean();
        const entryModel = await createDynamicModel(project.slug);

        const pagination = createPagination({
            req,
            totalEntries: project.entries.length,
            pageType: 'payment-modal',
        });

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        project.entries = project.entries.slice(skip, skip + limit);

        for (const entry of project.entries) {
            entry.detail = await entryModel
                .findOne({ _id: entry.entryId })
                .lean();
        }

        project.detail = detail;
        project.pagination = pagination;
        project.entriesCount = countSubscribedEntries(project.entries);
    }

    return order;
};

const getPendingOrderEntries = async (req, res) => {
    const orderId = req.params.orderId;
    const projectSlug = req.params.slug;
    const order = await Order.findById(orderId).lean();
    const project = order.projects.find(
        (project) => project.slug === projectSlug,
    );
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const pagination = createPagination({
        req,
        totalEntries: project.entries.length,
        pageType: 'payment-modal',
    });
    const entryModel = await createDynamicModel(projectSlug);
    project.entries = project.entries.slice(skip, skip + limit);
    for (const entry of project.entries) {
        entry.detail = await entryModel.findOne({ _id: entry.entryId }).lean();
    }
    project.detail = await Project.findOne({ slug: projectSlug }).lean();
    project.pagination = pagination;
    return {
        order,
        project,
    };
};

module.exports = {
    createDraftOrder,
    updateDraftOrder,
    getPaginatedOrders,
    getSingleOrder,
    updateOrderStatus,
    addPaymentsToOrder,
    openOrderProjectWithEntries,
    getPendingOrderEntries,
    formatOrder,
};
