const Project = require("../models/Project");
const Payment = require("../models/Payment");
const Subscription = require("../models/Subscription");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const { createDynamicModel } = require("../models/createDynamicModel");
const { generatePagination } = require("../modules/generatePagination");
const { generateSearchQuery } = require("../modules/generateSearchQuery");

const fetchEntrySubscriptionsAndPayments = async function(entry) {

    if (!entry) {
        return null;
    }

    const entryId = entry._id;
  
    const payments = await Payment.find({ entryId })
      .sort({ date: -1 }) 
      .lean();
  
    const subscription = await Subscription.find({ entryId }).lean();
  
    entry.payments = payments || null;
    entry.subscriptions = subscription || null;
    return entry;
    
}

const fetchEntryDetailsFromPaymentsAndSubscriptions = async function(entries) {
    const entryIds = entries.map((entry) => entry._id);
    const lastPayments = await Payment.aggregate([
        { $match: { entryId: { $in: entryIds } } },
        { $sort: { date: -1 } }, 
        {
            $group: {
                _id: "$entryId", 
                lastPaid: { $first: "$date" }, 
            },
        },
    ]);

    const subscriptions = await Subscription.find({ entryId: { $in: entryIds } }).lean();

    const lastPaymentsMap = Object.fromEntries(
        lastPayments.map(({ _id, lastPaid }) => [_id.toString(), lastPaid])
    );

    const subscriptionsMap = Object.fromEntries(
        subscriptions.map((sub) => [sub.entryId.toString(), sub])
    );

    entries.forEach((entry) => {
        entry.lastPaid = lastPaymentsMap[entry._id.toString()] || null;
        entry.subscriptions = subscriptionsMap[entry._id.toString()] || null;
    });

    return entries;
}

const projectEntries = async function(req, res) {
    const project = await Project.findOne({ slug: req.params.slug }).lean();
    if (!project) throw new Error(`Project "${req.params.slug}" not found`);

    const DynamicModel = await createDynamicModel(project.slug);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const sortBy = req.query.sortBy || '_id';
    const order = req.query.orderBy === 'desc' ? 1 : -1;
    const sortOptions = { [sortBy]: order };

    const { searchQuery, fieldFilters } = generateSearchQuery(req, project);

    const filtersQuery = new URLSearchParams(fieldFilters).toString();

    let entries = await DynamicModel.find(searchQuery)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    entries = await fetchEntryDetailsFromPaymentsAndSubscriptions(entries);

    const totalEntries = await DynamicModel.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalEntries / limit);

    return {
        entries, 
        project, 
        pagination: {
            totalEntries,
            totalPages,
            currentPage: page,
            limit,
            startIndex: totalEntries == 0 ? 0 : skip + 1,
            endIndex: Math.min(skip + limit, totalEntries),
            pagesArray: generatePagination(totalPages, page),
            sort: { 
              sortBy, 
              order: req.query.orderBy == undefined ? "asc" : req.query.orderBy
            },
            search: req.query.search,
            filtersQuery,
            fieldFilters: fieldFilters == {} ? undefined : fieldFilters,
            showSearchBar: req.query.showSearchBar,
            showFilters: req.query.showFilters
        }
    }
};

const getOrdersByEntryId = async (req, res) => {
    const orders = await Order.find({
        'projects.entries': {
            $elemMatch: {
                entryId: req.params.entryId,
                totalCost: { $ne: 0 },
            },
        },
    }).lean();

    for (const order of orders) {
        order.customer = await Customer.findById(order.customerId).lean();
        const project = order.projects.find((project) =>
            project.entries.find(
                (entry) => entry.entryId == req.params.entryId,
            ),
        );
        order.project = project;
        order.entry = project.entries.find(
            (entry) => entry.entryId == req.params.entryId,
        );
    }

    return orders;
};

const getPaidOrdersByEntryId = async (req, res) => {
    const orders = await Order.find({
        status: 'paid',
        'projects.entries': {
            $elemMatch: {
                entryId: req.params.entryId,
                totalCost: { $ne: 0 },
            },
        },
    }).lean();

    for (const order of orders) {
        order.customer = await Customer.findById(order.customerId).lean();
        const project = order.projects.find((project) =>
            project.entries.find(
                (entry) => entry.entryId == req.params.entryId,
            ),
        );
        order.project = project;
        order.entry = project.entries.find(
            (entry) => entry.entryId == req.params.entryId,
        );
    }

    return orders;
};

module.exports = {
    projectEntries,
    fetchEntrySubscriptionsAndPayments,
    getPaidOrdersByEntryId,
    getOrdersByEntryId,
};