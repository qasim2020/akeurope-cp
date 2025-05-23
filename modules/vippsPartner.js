const Project = require('../models/Project');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Donor = require('../models/Donor');
const Subscription = require('../models/Subscription');
const VippsChargeRequest = require('../models/VippsChargeRequest');

const { createDynamicModel } = require('../models/createDynamicModel');
const { generatePagination, createPagination } = require('../modules/generatePagination');
const { getCurrencyRates } = require('./getCurrencyRates');
const { runQueriesOnOrder } = require('../modules/orderUpdates');
const { getOldestPaidEntries, makeProjectForOrder, getPreviousOrdersForEntry } = require('../modules/ordersFetchEntries');
const { saveLog } = require('./logAction');
const { logTemplates } = require('./logTemplates');
const { capitalizeFirstLetter } = require('./helpers');
const { fetchEntrySubscriptionsAndPayments } = require('./projectEntries');

const getVippsSubscriptionByOrderId = async (agreementId) => {
    try {
        const donor = await Donor.findOne(
            { 'vippsCharges.agreementId': agreementId },
            { vippsCharges: 1 }
        ).lean();
        if (donor?.vippsCharges?.length) {
            const matchedCharge = donor.vippsCharges.find(charge => charge.agreementId === agreementId);
            return matchedCharge || null;
        }
        return null;
    } catch (error) {
        console.error('Error fetching subscription:', error);
        return null;
    }
};

const getVippsSubscriptionsByOrderId = async (agreementId) => {
    try {
        const donor = await Donor.findOne(
            { 'vippsCharges.agreementId': agreementId },
            { vippsCharges: 1 }
        ).lean();
        if (donor?.vippsCharges?.length) {
            const matchedCharges = donor.vippsCharges.filter(charge => charge.agreementId === agreementId);
            return matchedCharges || [];
        }
        return [];
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        return null;
    }
};

const getVippsPaymentByOrderId = async (reference) => {
    try {
        const donor = await Donor.findOne(
            { 'vippsPayments.reference': reference },
            { vippsPayments: 1 }
        ).lean();
        
        if (donor && donor.vippsPayments?.length) {
            const matchedPayment = donor.vippsPayments.find(p => p.reference === reference);
            return matchedPayment || null;
        }
        return reference || null;
    } catch (error) {
        console.error('Error fetching payment:', error);
        return null;
    }
};

module.exports = {
    getVippsSubscriptionsByOrderId,
    getVippsSubscriptionByOrderId,
    getVippsPaymentByOrderId,
};
