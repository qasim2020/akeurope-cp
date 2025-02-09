const express = require('express');
const router = express.Router();
const widgetController = require('../controllers/widgetController');
const { authenticate, authorize } = require('../modules/auth');

router.get('/widgets', authenticate, authorize('viewWidgets'), widgetController.widgets);
// router.get('/payment-widget.js', authenticate, authorize('viewWidgets'), widgetController.widget);
router.get('/script/:slug', widgetController.script);
router.get('/overlay/:slug', widgetController.overlay);
router.get('/get-prices/:code', widgetController.getPrices);
router.get('/store-prices', widgetController.storePrices);
router.post('/create-payment-intent', widgetController.createPaymentIntent);
router.get('/countries', widgetController.countries);
router.get('/widget-new-order/:slug', widgetController.createNewOrder);
router.post('/widget-update-order/:orderId/:slug', widgetController.updateOrder);
router.get('/widget-order/:orderId', widgetController.getOrderData);

module.exports = router;