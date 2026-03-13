// Status routes

const express = require('express');
const router = express.Router();
const statusController = require('../controllers/statusController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);

router.get('/', statusController.getStatuses);
router.post('/', upload.single('media'), statusController.createStatus);
router.patch('/:id/view', statusController.markStatusViewed);
router.delete('/:id', statusController.deleteStatus);

module.exports = router;
