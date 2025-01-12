const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/mw-data");
const customersController = require('../controllers/customerController');

router.get('/getEditCustomerModal/:customerId', authenticate, authorize("editCustomers"), allProjects, customersController.editModal);
router.post("/customer/update/:customerId", authenticate, authorize("createCustomers"), customersController.updateCustomer);

router.get("/customer/:customerId", authenticate, authorize("viewCustomers"), allProjects, customersController.customer);
router.get("/getCustomerData/:customerId", authenticate, authorize("viewCustomers"), customersController.getCustomerData);
router.get("/getCustomerLogs/:customerId", authenticate, authorize("viewCustomers"), customersController.getLogs);

module.exports = router;