const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/mw-data");
const entryController = require('../controllers/entryController');

router.get('/getPaginatedEntriesForDraftOrder/:slug', authenticate, authorize('viewEntry'), entryController.getPaginatedEntriesForDraftOrder);

module.exports = router;