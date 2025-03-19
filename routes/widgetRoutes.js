const express = require('express');
const router = express.Router();
const widgetController = require('../controllers/widgetController');
const overlayController = require('../controllers/overlayController');
const { authenticate, authorize } = require('../modules/auth');
const { notifyTelegram } = require('../modules/telegramBot');

router.get('/widgets', authenticate, authorize('viewWidgets'), widgetController.widgets);

router.get('/script/:slug', widgetController.script);
router.get('/script-red-btn/:slug', widgetController.script);
router.get('/script-iframe/:slug', widgetController.scriptIframe);

router.get('/overlay/:slug', widgetController.overlay);
router.get('/get-country-list/:code', widgetController.getCountryList);
router.get('/widget-new-order/:slug', widgetController.createNewOrder);
router.post('/widget-update-order/:orderId/:slug', widgetController.updateOrder);
router.get('/widget-order/:orderId', widgetController.getOrderData);
router.get('/widget-render-entries/:orderId/:slug', widgetController.renderOrderEntries);
router.get('/widget-render-no-order-total', widgetController.renderNoOrderTotal);
router.get('/widget-render-no-order-entries/:slug', widgetController.renderNoOrderEntries);
router.post('/create-payment-intent/:orderId/:slug', notifyTelegram, widgetController.createPaymentIntent);
router.post('/create-setup-intent/:orderId/:slug', notifyTelegram, widgetController.createSetupIntent);
router.post('/create-subscription/:orderId/:slug', notifyTelegram, widgetController.createSubscription);
router.post('/create-one-time/:orderId/:slug', notifyTelegram, widgetController.createOneTime);
router.post('/widget-order-customer/:orderId/:customerId', notifyTelegram, widgetController.linkOrderToCustomer);

// router.get('/payment-widget.js', authenticate, authorize('viewWidgets'), widgetController.widget);
// router.get('/store-prices', notifyTelegram, widgetController.storePrices);
// router.get('/countries', notifyTelegram, widgetController.countries);

router.get('/script-webflow', overlayController.wScript);
router.get('/overlay-products/:code', overlayController.overlayProducts);

router.post('/overlay-create-order/:slug', overlayController.createNewOrder);
router.post('/overlay-delete-order/:orderId', overlayController.deleteOrder);
router.post('/overlay-setup-intent/:orderId/:slug', notifyTelegram, overlayController.createSetupIntent);
router.get('/overlay-order/:orderId', overlayController.getOrderData);
router.post('/overlay-subscription/:orderId/:slug', notifyTelegram, overlayController.createSubscription);
router.post('/overlay-payment-intent/:orderId/:slug', notifyTelegram, overlayController.createPaymentIntent);
router.post('/overlay-one-time/:orderId/:slug', notifyTelegram, overlayController.createOneTime);
router.post('/overlay-order-customer/:orderId/:customerId', notifyTelegram, overlayController.linkOrderToCustomer);

module.exports = router;