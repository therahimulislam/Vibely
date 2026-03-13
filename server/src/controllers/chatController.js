// server/src/controllers/chatController.js
// Chat controller - chat creation and retrieval

const Chat = require('../models/Chat');
const User = require('../models/User');

const USER_PUBLIC_FIELDS = 'name username avatar isOnline lastSeen';
const areMutualContacts = (user, otherUserId) =>
    user.contacts?.some((id) => id.toString() === otherUserId.toString());

// GET /api/chats - Get all chats for current user
exports.getChats = async (req, res) => {
    try {
        const chats = await Chat.find({
            participants: req.userId,
            deletedBy: { $ne: req.userId },
            requestStatus: { $ne: 'rejected' },
        })
            .populate('participants', USER_PUBLIC_FIELDS)
            .populate('requestedBy', 'name username avatar')
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
        const participant = await User.findById(participantId).select('contacts');
        if (!participant) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if chat already exists between these users
        let chat = await Chat.findOne({
            participants: { $all: [req.userId, participantId], $size: 2 },
        })
            .populate('participants', USER_PUBLIC_FIELDS)
            .populate('requestedBy', 'name username avatar')
            .populate('lastMessage');

        if (chat) {
            if (chat.deletedBy?.some((id) => id.toString() === req.userId.toString())) {
                chat.deletedBy = chat.deletedBy.filter((id) => id.toString() !== req.userId.toString());
                await chat.save();
                chat = await Chat.findById(chat._id)
                    .populate('participants', USER_PUBLIC_FIELDS)
                    .populate('requestedBy', 'name username avatar')
                    .populate('lastMessage');
            }
            if (chat.requestStatus === 'rejected') {
                chat.requestStatus = 'pending';
                chat.requestedBy = req.userId;
                await chat.save();
                chat = await Chat.findById(chat._id)
                    .populate('participants', USER_PUBLIC_FIELDS)
                    .populate('requestedBy', 'name username avatar')
                    .populate('lastMessage');
            }
            return res.json({ chat, isNew: false });
        }

        const requester = await User.findById(req.userId).select('contacts');
        const isMutual = areMutualContacts(requester, participantId) && areMutualContacts(participant, req.userId);

        // Create new chat
        chat = await Chat.create({
            participants: [req.userId, participantId],
            requestStatus: isMutual ? 'accepted' : 'pending',
            requestedBy: isMutual ? null : req.userId,
        });

        chat = await Chat.findById(chat._id)
            .populate('participants', USER_PUBLIC_FIELDS)
            .populate('requestedBy', 'name username avatar')
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

        if (!name || !participants || participants.length < 2) {
            return res.status(400).json({ error: 'Group must have a name and at least 2 other members' });
        }

        const uniqueParticipantIds = [...new Set(
            participants
                .filter(Boolean)
                .map((id) => id.toString())
                .filter((id) => id !== req.userId.toString())
        )];

        if (uniqueParticipantIds.length < 2) {
            return res.status(400).json({ error: 'Group must have at least 2 unique other members' });
        }

        const existingUsers = await User.countDocuments({ _id: { $in: uniqueParticipantIds } });
        if (existingUsers !== uniqueParticipantIds.length) {
            return res.status(400).json({ error: 'One or more selected users do not exist' });
        }

        const allParticipants = [...uniqueParticipantIds, req.userId];

        const chat = await Chat.create({
            isGroup: true,
            groupName: name,
            groupAdmin: req.userId,
            participants: allParticipants,
            requestStatus: 'accepted',
            // Group avatar can be handled via update later or default
        });

        const populatedChat = await Chat.findById(chat._id)
            .populate('participants', USER_PUBLIC_FIELDS)
            .populate('groupAdmin', 'name username avatar');

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

        if (!chat.participants.some((id) => id.toString() === req.userId.toString())) {
            return res.status(403).json({ error: 'Access denied' });
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
// DELETE /api/chats/:id - Delete chat for current user
exports.deleteChat = async (req, res) => {
    try {
        const chat = await Chat.findOne({
            _id: req.params.id,
            participants: req.userId,
        });

        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        await Chat.findByIdAndUpdate(
            req.params.id,
            { $addToSet: { deletedBy: req.userId } },
            { new: true }
        );

        res.json({ message: 'Chat deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// PUT /api/chats/group/add - Add user to group
exports.addToGroup = async (req, res) => {
    try {
        const { chatId, userId, username } = req.body;
        let idToAdd = userId;

        const existingChat = await Chat.findById(chatId);
        if (!existingChat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        if (!existingChat.isGroup) {
            return res.status(400).json({ error: 'Can only add members to group chats' });
        }

        if (!existingChat.participants.some((id) => id.toString() === req.userId.toString())) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (existingChat.groupAdmin?.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'Only the group admin can add members' });
        }

        if (!idToAdd && username) {
            const user = await User.findOne({ username: username.toLowerCase() });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            idToAdd = user._id;
        }

        if (!idToAdd) {
            return res.status(400).json({ error: 'User ID or username is required' });
        }

        if (existingChat.participants.some((id) => id.toString() === idToAdd.toString())) {
            return res.status(400).json({ error: 'User is already in the group' });
        }

        const chat = await Chat.findByIdAndUpdate(
            chatId,
            { $addToSet: { participants: idToAdd } },
            { new: true }
        )
            .populate('participants', USER_PUBLIC_FIELDS)
            .populate('groupAdmin', 'name username avatar');

        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        res.json({ chat });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.respondToChatRequest = async (req, res) => {
    try {
        const { action } = req.body;
        if (!['accept', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        const chat = await Chat.findOne({
            _id: req.params.id,
            participants: req.userId,
            isGroup: false,
        });

        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        if (chat.requestStatus !== 'pending') {
            return res.status(400).json({ error: 'Request is no longer pending' });
        }

        if (chat.requestedBy?.toString() === req.userId.toString()) {
            return res.status(403).json({ error: 'Cannot respond to your own request' });
        }

        chat.requestStatus = action === 'accept' ? 'accepted' : 'rejected';
        await chat.save();

        const populatedChat = await Chat.findById(chat._id)
            .populate('participants', USER_PUBLIC_FIELDS)
            .populate('requestedBy', 'name username avatar')
            .populate('lastMessage');

        res.json({ chat: populatedChat });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
