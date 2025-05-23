const mongoose = require('mongoose');
require('dotenv').config();
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
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

  const orders = await Order.find(query).select('_id orderNo').lean();
  const subscriptions = await Subscription.find(query).select('_id orderNo').lean();
  const projOrderNos = orders.map(order => order.orderNo);
  const overlayOrderNos = subscriptions.map(order => order.orderNo);
  const combinedOrderNos = [...projOrderNos, ...overlayOrderNos];
  const combined = [...orders, ...subscriptions];
  console.log(combined);
  // await createRecurringCharge(combined[2]._id);
  // await vippsChargeCaptured(combined[0]._id);
  await sendTelegramMessage(`Found ${combined.length} orders on vipps-charges; ${combinedOrderNos.join(', ')}`);
  // for (const order of combined) {
  //   await createRecurringCharge(order._id);
  // }
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
