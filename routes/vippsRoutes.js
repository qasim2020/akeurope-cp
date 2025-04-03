const express = require('express');
const router = express.Router();
const vippsController = require('../controllers/vippsController');
const { notifyTelegram } = require('../modules/telegramBot');
const { authVippsWebhook } = require('../modules/vippsModules');

router.post('/create-vipps-payment-intent', notifyTelegram, vippsController.createVippsPaymentIntent);
router.get('/poll-vipps-payment-intent/:orderId', vippsController.pollVippsPaymentIntent);
router.post('/create-vipps-setup-intent', vippsController.createVippsSetupIntent);
router.get('/vipps-payment-status/:orderId', vippsController.vippsPaymentStatus);
router.get('/vipps-payment-status-data/:orderId', vippsController.vippsPaymentStatusData);
router.post('/vipps-webhook', authVippsWebhook, notifyTelegram, vippsController.vippsWebhook);

module.exports = router;