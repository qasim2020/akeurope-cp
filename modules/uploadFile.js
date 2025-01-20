const multer = require('multer');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

const uploadFile = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}_${file.originalname}`);
        },
    }),
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Only PDF files are allowed'));
        }
        cb(null, true);
    },
});

module.exports = { uploadFile };
