const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { forgotPassword } = require('../controllers/forgotPassword');
const { resetPassword } = require('../controllers/resetPassword');
const { resetPasswordForm } = require('../controllers/resetPasswordForm');

router.get('/login', (req, res) => res.render('login'));
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.get('/forgot-password', (req, res) => res.render('forgot-password'));
router.post('/forgot-password', forgotPassword);
router.get('/reset/:token', resetPasswordForm);
router.post('/reset/:token', resetPassword);
router.get('/register/:token', authController.register);
router.post('/register/:token', authController.registerCustomer)

module.exports = router;