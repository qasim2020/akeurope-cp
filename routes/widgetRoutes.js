const express = require('express');
const router = express.Router();
const widgetController = require('../controllers/widgetController');
const { authenticate, authorize } = require('../modules/auth');

router.get('/widgets', authenticate, authorize('viewWidgets'), widgetController.widgets);
// router.get('/payment-widget.js', authenticate, authorize('viewWidgets'), widgetController.widget);
router.get('/script/:slug', widgetController.script);
router.get('/overlay/:slug', widgetController.overlay);
router.get('/get-country-list/:code', widgetController.getCountryList);
router.get('/store-prices', widgetController.storePrices);
router.get('/countries', widgetController.countries);
router.get('/widget-new-order/:slug', widgetController.createNewOrder);
router.post('/widget-update-order/:orderId/:slug', widgetController.updateOrder);
router.get('/widget-order/:orderId', widgetController.getOrderData);
router.get('/widget-render-entries/:orderId/:slug', widgetController.renderOrderEntries);
router.post('/create-payment-intent/:orderId/:slug', widgetController.createPaymentIntent);
router.post('/create-setup-intent/:orderId/:slug', widgetController.createSetupIntent);
router.post('/create-subscription/:orderId/:slug', widgetController.createSubscription);
router.post('/create-one-time/:orderId/:slug', widgetController.createOneTime);
router.post('/widget-order-customer/:orderId/:customerId', widgetController.linkOrderToCustomer);

module.exports = router;