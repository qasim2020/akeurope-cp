const express = require('express');
const router = express.Router();
const { notifyTelegramStripe } = require('../modules/telegramBot');
const stripeController = require('../controllers/stripeController');

router.post('/', notifyTelegramStripe, stripeController.renewOrder);

module.exports = router;