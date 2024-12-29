const multer = require('multer');
const fs = require('fs');
const path = require('path');

const paymentsDir = path.join(__dirname, '../../payments');
if (!fs.existsSync(paymentsDir)) {
    fs.mkdirSync(paymentsDir);
}

const uploadPaymentProofMulter = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, paymentsDir);
    },
    filename: (req, file, cb) => {
      // Use a temporary filename; we'll rename it after validations
      cb(null, `temp_${Date.now()}_${file.originalname}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only PNG, JPG, and PDF files are allowed'));
    }
    cb(null, true);
  },
});

module.exports = { uploadPaymentProofMulter };