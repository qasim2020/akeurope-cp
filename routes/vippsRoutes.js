const express = require('express');
const router = express.Router();
const vippsController = require('../controllers/vippsController');
const { notifyTelegram } = require('../modules/telegramBot');
const {authVippsWebhook} = require('../modules/vipps');

router.post('/create-vipps-payment-intent/:orderId/:email', vippsController.createVippsPaymentIntent);
router.post('/create-vipps-setup-intent/:orderId/:email', vippsController.createVippsSetupIntent);
router.get('/vipps-payment-successful', vippsController.vippsPaymentSuccessful);

router.post('/vipps-webhook', authVippsWebhook, vippsController.vippsWebhook);

module.exports = router;