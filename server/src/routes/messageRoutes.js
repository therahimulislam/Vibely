// server/src/routes/messageRoutes.js
// Message routes

const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);

router.post('/scheduled', upload.single('media'), messageController.scheduleMessage);
router.get('/scheduled/:chatId', messageController.getScheduledMessages);
router.delete('/scheduled/:id', messageController.deleteScheduledMessage);
router.patch('/scheduled/:id', messageController.updateScheduledMessage);
router.get('/pins/:chatId', messageController.getPinnedMessages);
router.get('/:id/info', messageController.getMessageInfo);
router.get('/:chatId/search', messageController.searchMessages);
router.get('/:chatId', messageController.getMessages);
router.post('/poll', messageController.createPoll);
router.post('/poll/:id/vote', messageController.votePoll);
router.post('/send', upload.single('media'), messageController.sendMessage);
router.post('/:id/view-once/open', messageController.openViewOnceMessage);
router.post('/:id/forward', messageController.forwardMessage);
router.post('/:id/pin', messageController.togglePinMessage);
router.post('/:id/star', messageController.toggleStar);
router.patch('/seen', messageController.markAsSeen);
router.patch('/:id', messageController.editMessage);
router.delete('/:id', messageController.deleteMessage);
router.post('/:id/react', messageController.addReaction);

module.exports = router;
