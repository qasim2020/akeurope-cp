const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const ordersController = require('../controllers/ordersController');
const {
    uploadPaymentProofMulter,
} = require('../modules/uploadPaymentProofMulter');
const { allProjects } = require('../modules/mw-data');

router.get(
    '/orders/',
    authenticate,
    authorize('viewOrders'),
    allProjects,
    ordersController.viewOrders,
);
router.get(
    '/getOrdersData/',
    authenticate,
    authorize('viewOrders'),
    allProjects,
    ordersController.getOrdersData,
);
router.get(
    '/getEditOrderModal/:orderId',
    authenticate,
    authorize('viewOrders'),
    ordersController.getEditOrderModal,
);
router.get(
    '/getOrderTotalCost/:orderId',
    authenticate,
    authorize('viewOrders'),
    allProjects,
    ordersController.getOrderTotalCost,
);
// router.get('/checkout/:orderId', authenticate, authorize("editOrders"), allProjects, ordersController.checkout);
// router.get('/getPaymentModal/:orderId', authenticate, authorize("editOrders"), ordersController.getPaymentModal);
router.post(
    '/orderStatusPendingPayment/:orderId',
    authenticate,
    authorize('editOrders'),
    ordersController.orderStatusPendingPayment,
);
router.get(
    '/deleteOrder/:orderId',
    authenticate,
    authorize('deleteOrders'),
    ordersController.deleteOrder,
);
router.post(
    '/emailInvoice/:orderId',
    authenticate,
    authorize('viewOrders'),
    ordersController.emailInvoice,
);
router.post(
    '/paymentProof/:orderId',
    authenticate,
    authorize('viewOrders'),
    uploadPaymentProofMulter.single('file'),
    ordersController.uploadPaymentProof,
);

router.get(
    '/order/:orderId',
    authenticate,
    authorize('viewOrders'),
    ordersController.viewOrder,
);

module.exports = router;
