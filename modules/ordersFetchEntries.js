const { generateSearchQuery } = require('../modules/generateSearchQuery');
const { createDynamicModel } = require('../models/createDynamicModel');

const Order = require('../models/Order');
const Subscription = require('../models/Subscription');

const getDateOfLastPayment = async (entryId) => {
    const lastPaidOrder = await Order.aggregate([
        { $unwind: '$projects' },
        { $unwind: '$projects.entries' },
        {
            $match: {
                'projects.entries.entryId': entryId,
                'projects.entries.totalCost': { $gt: 0 },
                status: 'paid',
            },
        },
        { $sort: { createdAt: 1 } },  
        {
            $group: {
                _id: '$projects.entries.entryId',
                lastPaid: { $first: '$createdAt' }, 
            },
        },
    ]);
    
    const lastPaid = lastPaidOrder.length > 0 ? lastPaidOrder[0].lastPaid : null;
    
    return lastPaid;
}

const getOldestPaidEntries = async (req, project) => {
    const DynamicModel = await createDynamicModel(project.slug);
    const { searchQuery, fieldFilters } = generateSearchQuery(req, project);
    const selectCount = parseInt(req.query.select) || 50;

    const lastOrders = await Order.aggregate([
        { $unwind: '$projects' },
        { $unwind: '$projects.entries' },
        {
            $match: {
                'projects.entries.totalCost': { $gt: 0 },
                status: 'paid',
            },
        },
        { $sort: { createdAt: 1 } },
        {
            $group: {
                _id: '$projects.entries.entryId',
                lastPaid: { $first: '$createdAt' },
            },
        },
    ]);

    let paidEntryIds = lastOrders.map((order) => order._id);

    const countNotPaid = await DynamicModel.countDocuments({
        _id: { $nin: paidEntryIds },
        ...searchQuery,
    });

    let entriesToPay = [];
    if (countNotPaid > selectCount) {
        entriesToPay = await DynamicModel.find({
            _id: { $nin: paidEntryIds },
            ...searchQuery,
        })
            .limit(selectCount)
            .lean();
    }


    if (countNotPaid <= selectCount) {
        let entriesWithPayments = [];
        let entriesWithOutPayments = [];
        const pickFromNotPaid = countNotPaid;
        const pickFromPaid = selectCount - pickFromNotPaid;
        entriesWithOutPayments = await DynamicModel.find({
            _id: { $nin: paidEntryIds },
            ...searchQuery,
        })
        .limit(pickFromNotPaid)
        .lean();
        if (pickFromPaid > 0) {
            paidEntryIds = paidEntryIds.slice(0,pickFromPaid);
            entriesWithPayments = await DynamicModel.find({
                _id: { $in: paidEntryIds },
                ...searchQuery,
            })
            .limit(pickFromPaid)
            .lean();
        }
        entriesToPay =  [...entriesWithOutPayments, ...entriesWithPayments];
    }

    return {
        project,
        allEntries: entriesToPay,
    };
};

const makeProjectForOrder = (project, allEntries) => {
    return {
        slug: project.slug,
        months: 1,
        entries: allEntries.map((entry) => {
            return {
                entryId: entry._id,
                selectedSubscriptions: project.fields
                    .filter(
                        (field) =>
                            field.subscription &&
                            entry[field.name] != undefined,
                    )
                    .map((field) => field.name),
            };
        }),
    };
};

module.exports = { getOldestPaidEntries, makeProjectForOrder, getDateOfLastPayment };
