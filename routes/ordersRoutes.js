const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const ordersController = require('../controllers/ordersController');
const { uploadPaymentProofMulter } = require('../modules/uploadPaymentProofMulter');
const { allProjects } = require('../modules/mw-data');

router.get('/orders/', authenticate, authorize('viewOrders'), allProjects, ordersController.viewOrders);
router.get('/getOrdersData/', authenticate, authorize('viewOrders'), allProjects, ordersController.getOrdersData);
router.get('/getEditOrderModal/:orderId', authenticate, authorize('viewOrders'), ordersController.getEditOrderModal);
router.get('/getOrderTotalCost/:orderId', authenticate, authorize('viewOrders'), allProjects, ordersController.getOrderTotalCost);
router.post(
    '/orderStatusPendingPayment/:orderId',
    authenticate,
    authorize('editOrders'),
    ordersController.orderStatusPendingPayment,
);
router.post(
    '/paymentProof/:orderId',
    authenticate,
    authorize('viewOrders'),
    uploadPaymentProofMulter.single('file'),
    ordersController.uploadPaymentProof,
);
router.get('/order/:orderId', authenticate, authorize('viewOrders'), ordersController.viewOrder);
router.get('/getOrderLogs/:orderId', authenticate, authorize('viewOrders'), ordersController.getOrderLogs);
router.get('/getOrderData/:orderId', authenticate, authorize('viewOrders'), ordersController.getOrderData);
router.get('/getLockedOrderInModal/:orderId', authenticate, authorize('viewOrders'), ordersController.getLockedOrderInModal);
router.get('/projectVisibleDateFields/:slug', authenticate, authorize('viewOrders'), ordersController.projectVisibleDateFields);
router.post('/emailInvoice/:orderId', authenticate, authorize('viewOrders'), ordersController.emailInvoice);

module.exports = router;
