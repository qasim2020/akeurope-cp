const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const invoiceController = require('../controllers/invoiceController');

router.get('/invoice/:orderId', authenticate, authorize('viewOrders'), invoiceController.invoice);
router.get('/receipt/:orderId', authenticate, authorize('viewOrders'), (req, res) => {
    res.redirect(`/invoice/${req.params.orderId}?receipt=true`);
});
router.get('/invoice-stripe/:orderId', authenticate, authorize('viewOrders'), invoiceController.stripeReceipt);
router.get('/receipt-stripe/:orderId', authenticate, authorize('viewOrders'), invoiceController.stripeInvoice);

module.exports = router;