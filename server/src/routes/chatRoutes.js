// server/src/routes/chatRoutes.js
// Chat routes

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', chatController.getChats);
router.post('/create', chatController.createChat);
router.post('/group', chatController.createGroupChat);
router.patch('/:id/pin', chatController.togglePinChat);

module.exports = router;
