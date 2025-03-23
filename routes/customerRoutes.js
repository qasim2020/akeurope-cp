const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/mw-data");
const customersController = require('../controllers/customerController');
const stripeController = require('../controllers/stripeController');

router.get('/getEditCustomerModal/:customerId', authenticate, authorize("editSelf"), allProjects, customersController.editModal);
router.post("/customer/update", authenticate, authorize("editSelf"), customersController.updateCustomer);

router.get("/customer/:customerId", authenticate, authorize("viewSelf"), allProjects, customersController.customer);
router.get("/getCustomerData/:customerId", authenticate, authorize("viewSelf"), customersController.getCustomerData);
router.get("/getCustomerLogs/:customerId", authenticate, authorize("viewSelf"), customersController.getLogs);

router.get('/manage-subscription', authenticate, authorize("viewSelf"), stripeController.customerPortal);
router.get('/manage-subscription-from-order/:orderId', authenticate, authorize("viewSelf"), stripeController.customerPortal);
router.get('/show-stripe-receipt/:invoiceId', authenticate, authorize('viewSelf'), stripeController.stripeReceipt);

module.exports = router;