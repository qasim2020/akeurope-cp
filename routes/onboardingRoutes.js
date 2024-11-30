const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const onboardingController = require('../controllers/onboardingController');

router.get('/steps/dashboard', authenticate, authorize("viewDashboard"), onboardingController.stepOnePage);
router.get('/steps/onboardingStepOne', authenticate, authorize("viewDashboard"), onboardingController.stepOnePage);
router.get('/steps/onboardingStepTwo/:slug', authenticate, authorize("viewDashboard"), onboardingController.stepTwoPage);
router.get('/steps/onboardingStepThree', authenticate, authorize("viewDashboard"), onboardingController.stepThreePage);
router.get('/steps/onboardingStepFour', authenticate, authorize("viewDashboard"), onboardingController.stepFourPage);

router.get('/onboardingStepOne', authenticate, authorize("viewDashboard"), onboardingController.stepOnePartial);
router.get('/onboardingStepTwo/:slug', authenticate, authorize("viewDashboard"), onboardingController.stepTwoPartial);
router.get('/onboardingStepThree', authenticate, authorize("viewDashboard"), onboardingController.stepThreePartial);
router.get('/onboardingStepFour', authenticate, authorize("viewDashboard"), onboardingController.stepFourPartial);

module.exports = router;