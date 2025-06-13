const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();
const { uploadFile } = require('../modules/uploadFile');
const { authenticate, authorize } = require('../modules/auth');
const fileController = require('../controllers/fileController');

router.get('/file-download/:secretToken', fileController.fileDownloadPublic);
router.get('/file-open/:secretToken', fileController.fileOpenPublic);
router.get('/filesByEntityRender/:entityId', authenticate, authorize('viewFiles'), fileController.renderEntityFiles);
router.get('/file/:fileId', authenticate, authorize('viewFiles'), fileController.file);
router.post('/uploadFileToEntry', authenticate, authorize('uploadFiles'), uploadFile.single('file'), fileController.uploadFileToEntry);
router.get('/getFileModal/:fileId', authenticate, authorize('editFiles'), fileController.getFileModal);

module.exports = router;
