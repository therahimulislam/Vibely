// server/src/routes/chatRoutes.js
// Chat routes

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);

router.get('/', chatController.getChats);
router.get('/invite/:code', chatController.getInviteInfo);
router.get('/:id/assets', chatController.getChatAssets);
router.post('/saved', chatController.getSavedMessagesChat);
router.post('/create', chatController.createChat);
router.post('/group', upload.single('groupAvatar'), chatController.createGroupChat);
router.post('/invite/:code/join', chatController.joinGroupViaInvite);
router.post('/:id/invite-links', chatController.createInviteLink);
router.put('/group/add', chatController.addToGroup);
router.patch('/:id/profile', upload.single('groupAvatar'), chatController.updateGroupProfile);
router.patch('/:id/group-settings', chatController.updateGroupSettings);
router.patch('/:id/members/:userId/role', chatController.updateGroupMemberRole);
router.patch('/:id/join-requests', chatController.reviewJoinRequest);
router.patch('/:id/request', chatController.respondToChatRequest);
router.patch('/:id/pin', chatController.togglePinChat);
router.patch('/:id/archive', chatController.toggleArchiveChat);
router.delete('/:id/members/:userId', chatController.removeFromGroup);
router.delete('/:id/invite-links/:code', chatController.revokeInviteLink);
router.delete('/:id', chatController.deleteChat);

module.exports = router;
