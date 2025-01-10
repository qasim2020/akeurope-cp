const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/mw-data");
const entryController = require('../controllers/entryController');

router.get('/entry/:entryId/project/:slug', authenticate, authorize("viewEntry"), allProjects, entryController.entry);
router.get('/getEntryData/:slug', authenticate, authorize("viewEntry"), entryController.getData);

router.get('/getSingleEntryData/:entryId/project/:slug', authenticate, authorize("editEntry"), entryController.getSingleEntryData);
router.get('/getSingleEntryLogs/:entryId/project/:slug', authenticate, authorize("editEntry"), entryController.getSingleEntryLogs);

router.get('/getPaginatedEntriesForDraftOrder/:slug', authenticate, authorize('viewEntry'), entryController.getPaginatedEntriesForDraftOrder);
router.get('/getPaginatedEntriesForOrderPage/:slug', authenticate, authorize('viewEntry'), entryController.getPaginatedEntriesForOrderPage);
router.get('/getOrderProjects/:orderId', authenticate, authorize('viewEntry'), entryController.getOrderProjects);
module.exports = router;