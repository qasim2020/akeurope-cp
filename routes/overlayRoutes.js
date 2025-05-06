const express = require('express');
const router = express.Router();
const overlayController = require('../controllers/overlayController');
const { notifyTelegram } = require('../modules/telegramBot');

router.get('/script-webflow', overlayController.wScript);
router.get('/overlay-country/:code', overlayController.overlayCountry);
router.get('/overlay-products/:code/:products', overlayController.overlayProducts);

router.post('/overlay-create-order/:slug', overlayController.createNewOrder);
router.post('/overlay-delete-order/:orderId', overlayController.deleteOrder);
router.post('/overlay-setup-intent/:orderId/:slug', notifyTelegram, overlayController.createSetupIntent);
router.get('/overlay-order/:orderId', overlayController.getOrderData);
router.post('/overlay-subscription/:orderId/:slug', notifyTelegram, overlayController.createSubscription);
router.post('/overlay-payment-intent/:orderId/:slug', notifyTelegram, overlayController.createPaymentIntent);
router.post('/overlay-one-time/:orderId/:slug', notifyTelegram, overlayController.createOneTime);
router.post('/overlay-order-customer/:orderId/:customerId', notifyTelegram, overlayController.linkOrderToCustomer);

module.exports = router;