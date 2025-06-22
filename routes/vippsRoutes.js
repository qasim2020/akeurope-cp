const express = require('express');
const router = express.Router();
const vippsController = require('../controllers/vippsController');
const { notifyTelegram } = require('../modules/telegramBot');
const { authVippsWebhook } = require('../modules/vippsModules');

router.get('/vipps-token/:token', vippsController.getVippsToken);
router.post('/create-vipps-payment-intent', notifyTelegram, vippsController.createVippsPaymentIntent);
router.post('/create-vipps-payment-intent-widget', notifyTelegram, vippsController.createVippsPaymentIntentWidget);
router.post('/create-vipps-payment-intent-product', notifyTelegram, vippsController.createVippsPaymentIntentProduct);
router.get('/poll-vipps-payment-intent/:reference', vippsController.pollVippsPaymentIntent);
router.get('/poll-vipps-setup-intent/:orderId/:agreementId', vippsController.pollVippsSetupIntent);
router.post('/create-vipps-setup-intent', notifyTelegram, vippsController.createVippsSetupIntent);
router.post('/create-vipps-setup-intent-widget', notifyTelegram, vippsController.createVippsSetupIntentWidget);
router.get('/vipps-payment-status/:orderId', vippsController.vippsPaymentStatus);
router.get('/vipps-payment-status-data/:orderId', vippsController.vippsPaymentStatusData);
router.get('/vipps-setup-status/:orderId', vippsController.vippsSetupStatus);
router.get('/vipps-setup-status-data/:orderId', vippsController.vippsSetupStatusData);
router.post('/vipps-webhook', authVippsWebhook, vippsController.vippsWebhook);

module.exports = router;