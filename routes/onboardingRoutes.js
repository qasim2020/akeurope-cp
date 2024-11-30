const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const onboardingController = require('../controllers/onboardingController');

router.get('/onboarding/dashboard', authenticate, authorize("viewDashboard"), onboardingController.stepOnePage);
router.get('/onboarding/stepOne', authenticate, authorize("viewDashboard"), onboardingController.stepOnePage);
router.get('/onboarding/stepTwo/:slug', authenticate, authorize("viewDashboard"), onboardingController.stepTwoPage);
router.get('/onboarding/stepThree', authenticate, authorize("viewDashboard"), onboardingController.stepThreePage);
router.get('/onboarding/stepFour', authenticate, authorize("viewDashboard"), onboardingController.stepFourPage);

router.get('/onboarding/partial/stepOne', authenticate, authorize("viewDashboard"), onboardingController.stepOnePartial);
router.get('/onboarding/partial/stepTwo/:slug', authenticate, authorize("viewDashboard"), onboardingController.stepTwoPartial);
router.get('/onboarding/partial/stepThree', authenticate, authorize("viewDashboard"), onboardingController.stepThreePartial);
router.get('/onboarding/partial/stepFour', authenticate, authorize("viewDashboard"), onboardingController.stepFourPartial);

module.exports = router;