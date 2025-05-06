const express = require('express');
const router = express.Router();
const widgetController = require('../controllers/widgetController');
const productController = require('../controllers/productController');
const { authenticate, authorize } = require('../modules/auth');
const { notifyTelegram } = require('../modules/telegramBot');

router.get('/product-new-order/:slug', productController.createNewOrder);
router.post('/product-update-order/:orderId/:slug', productController.updateOrder);
router.get('/product-render-entries/:orderId/:slug', productController.renderOrderEntries);
router.post('/product-payment-intent/:orderId/:slug', notifyTelegram, productController.createPaymentIntent);
router.post('/product-one-time/:orderId/:slug', notifyTelegram, productController.createOneTime);
router.post('/product-order-customer/:orderId/:customerId', notifyTelegram, productController.linkOrderToCustomer);

module.exports = router;