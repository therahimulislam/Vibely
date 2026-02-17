// server/src/controllers/chatController.js
// Chat controller - chat creation and retrieval

const Chat = require('../models/Chat');
const User = require('../models/User');

// GET /api/chats - Get all chats for current user
exports.getChats = async (req, res) => {
    try {
        const chats = await Chat.find({ participants: req.userId })
            .populate('participants', 'name email avatar isOnline lastSeen')
            .populate('lastMessage')
            .sort({ updatedAt: -1 });

        res.json({ chats });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// POST /api/chats/create - Create or get existing 1-on-1 chat
exports.createChat = async (req, res) => {
    try {
        const { participantId } = req.body;

        if (!participantId) {
            return res.status(400).json({ error: 'Participant ID is required' });
        }

        if (participantId === req.userId.toString()) {
            return res.status(400).json({ error: 'Cannot chat with yourself' });
        }

        // Check if participant exists
        const participant = await User.findById(participantId);
        if (!participant) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if chat already exists between these users
        let chat = await Chat.findOne({
            participants: { $all: [req.userId, participantId], $size: 2 },
        })
            .populate('participants', 'name email avatar isOnline lastSeen')
            .populate('lastMessage');

        if (chat) {
            return res.json({ chat, isNew: false });
        }

        // Create new chat
        chat = await Chat.create({
            participants: [req.userId, participantId],
        });

        chat = await Chat.findById(chat._id)
            .populate('participants', 'name email avatar isOnline lastSeen')
            .populate('lastMessage');

        res.status(201).json({ chat, isNew: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// POST /api/chats/group - Create a group chat
exports.createGroupChat = async (req, res) => {
    try {
        const { name, participants } = req.body;
        // participants is an array of userIds
        // We also need to add the current user (admin) to participants

        if (!name || !participants || participants.length < 2) {
            return res.status(400).json({ error: 'Group must have a name and at least 2 other members' });
        }

        const allParticipants = [...participants, req.userId];

        const chat = await Chat.create({
            isGroup: true,
            groupName: name,
            groupAdmin: req.userId,
            participants: allParticipants,
            // Group avatar can be handled via update later or default
        });

        const populatedChat = await Chat.findById(chat._id)
            .populate('participants', 'name email avatar isOnline lastSeen')
            .populate('groupAdmin', 'name email avatar');

        res.status(201).json({ chat: populatedChat });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// PATCH /api/chats/:id/pin - Toggle pin chat
exports.togglePinChat = async (req, res) => {
    try {
        const chat = await Chat.findById(req.params.id);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        const isPinned = chat.pinnedBy.includes(req.userId);
        if (isPinned) {
            chat.pinnedBy = chat.pinnedBy.filter((id) => id.toString() !== req.userId.toString());
        } else {
            chat.pinnedBy.push(req.userId);
        }

        await chat.save();
        res.json({ pinned: !isPinned });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
