// server/src/routes/bookmarkRoutes.js
// Bookmark collection routes

const express = require('express');
const router = express.Router();
const bookmarkController = require('../controllers/bookmarkController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', bookmarkController.getCollections);
router.post('/', bookmarkController.createCollection);
router.patch('/:id', bookmarkController.updateCollection);
router.delete('/:id', bookmarkController.deleteCollection);
router.post('/:id/messages', bookmarkController.toggleCollectionMessage);

module.exports = router;
