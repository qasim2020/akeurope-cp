const mongoose = require('mongoose');
require('dotenv').config();
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const Donor = require('../models/Donor');
const Customer = require('../models/Customer');
const VippsChargeRequest = require('../models/VippsChargeRequest');
const { getVippsSubscriptionsByOrderId } = require('../modules/vippsPartner');
const { createRecurringCharge, getVippsTriggerDates } = require('../modules/vippsModules');
const { vippsChargeCaptured } = require('../modules/vippsWebhookHandler');
const { sendErrorToTelegram, sendTelegramMessage } = require('../modules/telegramBot');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected!");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

async function handleRecurringVippsPayments() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const query = {
    monthlySubscription: true,
    vippsAgreementId: { $exists: true },
    customerId: { $ne: process.env.TEMP_CUSTOMER_ID },
    createdAt: { $lt: thirtyDaysAgo }
  };

  const orders = await Order.find(query).select('_id orderNo vippsAgreementId createdAt customerId').lean();
  const subscriptions = await Subscription.find(query).select('_id orderNo vippsAgreementId createdAt customerId').lean();
  const combined = [...orders, ...subscriptions].sort((a, b) => a.orderNo - b.orderNo);
  const combinedOrderNos = combined.map(order => order.orderNo);
  let message = [];
  message.push(`Found ${combined.length} orders on vipps-charges; ${combinedOrderNos.join(', ')}`);
  for (const order of combined) {

    const customer = await Customer.findById(order.customerId).lean();
    const donor = await Donor.findOne({ email: customer.email, 'vippsAgreements.id': order.vippsAgreementId }).lean();
    if (!donor) {
      message.push(`Donor agreement not found for;\ncustomer ${customer.email}\nvippsAgreementId ${order.vippsAgreementId}`);
      continue;
    }
    const agreement = donor.vippsAgreements.find((a) => a.id === order.vippsAgreementId);

    const paidCharges = await getVippsSubscriptionsByOrderId(order.vippsAgreementId);
    const calculatedChargeMonths = getVippsTriggerDates(order.createdAt);
    const requiredCharges = calculatedChargeMonths.length;

    if (agreement.status !== 'ACTIVE') {
      message.push(`${order.orderNo} x ${agreement.id}: Agreement cancelled. \nName = ${customer.name} \nEmail = ${donor.email} \ntel = ${customer.tel} \nRequiredCharges = ${requiredCharges} | Paid Charges = ${paidCharges.length}`);
      continue;
    }

    if (requiredCharges > paidCharges.length) {
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      const alreadyRequestedVipps = await VippsChargeRequest.findOne({
        orderId: order._id,
        createdAt: { $gte: sixDaysAgo }
      }).lean();
      if (alreadyRequestedVipps) {
        message.push(`${order.orderNo}: Charge response awaited from vipps. \nRequiredCharges = ${requiredCharges} | Paid Charges = ${paidCharges.length} \nChargeId: ${alreadyRequestedVipps.chargeId} \nRequested At: ${alreadyRequestedVipps.createdAt} `);
      } else {
        if (process.env.ENV === 'test') {
          message.push(`${order.orderNo}: Test environment - Not creating a charge \nRequiredCharges = ${requiredCharges} | Paid Charges = ${paidCharges.length}`);
        } else {
          const chargeId = await createRecurringCharge(order._id);
          if (chargeId) {
            message.push(`${order.orderNo}: New charge initiated ${order.orderNo} with vipps: \nRequiredCharges = ${requiredCharges} | Paid Charges = ${paidCharges.length} \nCharge Id: ${chargeId}, \nVipps should send a webhook back after 2 days.`)
          } else {
            message.push(`!!Charge not created! Check logs!!`);
          }
        }
      }
    } else {
      message.push(`${order.orderNo}: No action needed \nRequiredCharges = ${requiredCharges} | Paid Charges = ${paidCharges.length}`);
    }
  }

  console.log(message.join('\n\n'));
  await sendTelegramMessage(message.join('\n\n'));
}

async function fixMissedChargeCapture() {
  try {
    const orderId = "682d98bced3cf19692266b15";
    await vippsChargeCaptured(orderId);
  } catch (error) {
    console.log(error.message);
    sendErrorToTelegram(error.message);
  }
}

mongoose.connection.on('open', async () => {
  console.log('handle recurring payments started...');

  await handleRecurringVippsPayments();

  setInterval(async () => {
    try {
      await handleRecurringVippsPayments();
    } catch (error) {
      console.error('Error handling expired vipps orders:', error);
    }
  }, 6 * 60 * 60 * 1000);
});

module.exports = connectDB;
