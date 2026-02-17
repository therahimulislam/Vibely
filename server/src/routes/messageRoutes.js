// server/src/routes/messageRoutes.js
// Message routes

const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);

router.get('/:chatId', messageController.getMessages);
router.post('/send', upload.single('media'), messageController.sendMessage);
router.patch('/seen', messageController.markAsSeen);
router.patch('/:id', messageController.editMessage);
router.delete('/:id', messageController.deleteMessage);
router.post('/:id/react', messageController.addReaction);

module.exports = router;
