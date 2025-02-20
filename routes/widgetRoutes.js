const express = require('express');
const router = express.Router();
const widgetController = require('../controllers/widgetController');
const { authenticate, authorize } = require('../modules/auth');
const { notifyTelegram } = require('../modules/telegramBot');

router.get('/widgets', authenticate, authorize('viewWidgets'), widgetController.widgets);
// router.get('/payment-widget.js', authenticate, authorize('viewWidgets'), widgetController.widget);
router.get('/script/:slug', widgetController.script);
router.get('/overlay/:slug', widgetController.overlay);
router.get('/get-country-list/:code', notifyTelegram, widgetController.getCountryList);
// router.get('/store-prices', notifyTelegram, widgetController.storePrices);
// router.get('/countries', notifyTelegram, widgetController.countries);
router.get('/widget-new-order/:slug', notifyTelegram, widgetController.createNewOrder);
router.post('/widget-update-order/:orderId/:slug', notifyTelegram, widgetController.updateOrder);
router.get('/widget-order/:orderId', notifyTelegram, widgetController.getOrderData);
router.get('/widget-render-entries/:orderId/:slug', notifyTelegram, widgetController.renderOrderEntries);
router.get('/widget-render-no-order-total', notifyTelegram, widgetController.renderNoOrderTotal);
router.get('/widget-render-no-order-entries/:slug', notifyTelegram, widgetController.renderNoOrderEntries);
router.post('/create-payment-intent/:orderId/:slug', notifyTelegram, widgetController.createPaymentIntent);
router.post('/create-setup-intent/:orderId/:slug', notifyTelegram, widgetController.createSetupIntent);
router.post('/create-subscription/:orderId/:slug', notifyTelegram, widgetController.createSubscription);
router.post('/create-one-time/:orderId/:slug', notifyTelegram, widgetController.createOneTime);
router.post('/widget-order-customer/:orderId/:customerId', notifyTelegram, widgetController.linkOrderToCustomer);

module.exports = router;