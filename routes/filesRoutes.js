const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();
const { uploadFile } = require('../modules/uploadFile');
const { authenticate, authorize } = require('../modules/auth');
const fileController = require('../controllers/fileController');

// router.get('/files', authenticate, authorize('viewFiles'), fileController.files);
// router.get('/filesByEntity/:entityId', authenticate, authorize('viewFiles'), fileController.filesByEntity);
router.get('/filesByEntityRender/:entityId', authenticate, authorize('viewFiles'), fileController.renderEntityFiles);
router.get('/file/:fileId', authenticate, authorize('viewFiles'), fileController.file);
router.post('/uploadFileToEntry', authenticate, authorize('uploadFiles'), uploadFile.single('file'), fileController.uploadFileToEntry);
router.post('/fileUpdate/:fileId', authenticate, authorize('editFiles'), fileController.update);
router.post('/fileDelete/:fileId', authenticate, authorize('deleteFiles'), fileController.delete);

router.get('/getFileModal/:fileId', authenticate, authorize('editFiles'), fileController.getFileModal);

// router.get('/unlinkedFile/:fileName', authenticate, authorize('viewFiles'), fileController.unlinkedFile);
// router.get('/viewUnlinkedFile/:fileName', authenticate, authorize('viewFiles'), fileController.viewUnlinkedFile);

module.exports = router;
