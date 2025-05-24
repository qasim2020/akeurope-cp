const mongoose = require('mongoose');
require('dotenv').config();
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const Donor = require('../models/Donor');
const VippsChargeRequest = require('../models/VippsChargeRequest');
const { getVippsSubscriptionsByOrderId } = require('../modules/vippsPartner');
const { createRecurringCharge } = require('../modules/vippsModules');
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
  const twentyEightDaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

  const query = {
    monthlySubscription: true,
    vippsAgreementId: { $exists: true },
    customerId: { $ne: process.env.TEMP_CUSTOMER_ID },
    createdAt: { $lt: twentyEightDaysAgo }
  };

  const orders = await Order.find(query).select('_id orderNo vippsAgreementId createdAt').lean();
  const subscriptions = await Subscription.find(query).select('_id orderNo vippsAgreementId createdAt').lean();
  const combined = [...orders, ...subscriptions].sort((a,b) => a.orderNo - b.orderNo);
  const combinedOrderNos = combined.map(order => order.orderNo);
  let message = [];
  message.push(`Found ${combined.length} orders on vipps-charges; ${combinedOrderNos.join(', ')}`);
  for (const order of combined) {
    const paidCharges = await getVippsSubscriptionsByOrderId(order.vippsAgreementId);
    const now = Date.now() + (28 * 24 * 60 * 60 * 1000);
    const created = new Date(order.createdAt).getTime();
    const diffInMs = now - created;
    const diffInDays = diffInMs / (28 * 24 * 60 * 60 * 1000);
    const requiredCharges = Math.floor(diffInDays);
    if (requiredCharges > paidCharges.length) {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const alreadyRequestedVipps = await VippsChargeRequest.findOne({
        orderId: order._id,
        createdAt: { $gte: threeDaysAgo }
      }).lean();
      if (alreadyRequestedVipps) {
        message.push(`${order.orderNo}: Charge response awaited from vipps. \nRequiredCharges = ${requiredCharges} | Paid Charges = ${paidCharges.length} \nChargeId: ${alreadyRequestedVipps.chargeId} \nRequested At: ${alreadyRequestedVipps.createdAt} `);
      } else {
        message.push(`Push the charge into live db`);
        // const chargeId = await createRecurringCharge(order._id);
        // if (chargeId) {
        //   message.push(`${order.orderNo}: New charge initiated ${order.orderNo} with vipps: \n ${chargeId}, \n vipps should send a webhook back after 2 days.`)
        // } else {
        //   message.push(`Unknown response: ${chargeId}`);
        // }
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

  // await fixMissedChargeCapture();
  await handleRecurringVippsPayments();
  // await remove600Children();
  // await resetGazaOrphanPricesTo600();

  // await Order.deleteMany({status: 'draft'});
  // await Subscription.deleteMany({status: 'draft'});

  setInterval(async () => {
    try {
      await handleRecurringVippsPayments();
    } catch (error) {
      console.error('Error handling expired vipps orders:', error);
    }
  }, 6 * 60 * 60 * 1000);
});

module.exports = connectDB;
