// server/src/controllers/chatController.js
// Chat controller - chat creation and retrieval

const Chat = require('../models/Chat');
const User = require('../models/User');
const Message = require('../models/Message');
const { sanitizeMessageForViewer } = require('../utils/messageVisibility');

const USER_PUBLIC_FIELDS = 'name username avatar isOnline lastSeen';
const MESSAGE_SENDER_FIELDS = 'name username avatar';
const LINK_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;
const areMutualContacts = (user, otherUserId) =>
    user.contacts?.some((id) => id.toString() === otherUserId.toString());
const chatPopulateQuery = [
    { path: 'participants', select: USER_PUBLIC_FIELDS },
    { path: 'groupAdmin', select: 'name username avatar' },
    { path: 'requestedBy', select: 'name username avatar' },
    { path: 'lastMessage' },
];

const populateChatQuery = (query) => chatPopulateQuery.reduce(
    (builder, populateConfig) => builder.populate(populateConfig),
    query
);
const sanitizeChatForViewer = (chat, userId) => {
    const plain = typeof chat?.toObject === 'function' ? chat.toObject({ depopulate: false }) : chat;
    if (!plain) return plain;

    return {
        ...plain,
        lastMessage: plain.lastMessage ? sanitizeMessageForViewer(plain.lastMessage, userId) : null,
    };
};

const ensureChatParticipant = async (chatId, userId) => {
    const chat = await Chat.findOne({
        _id: chatId,
        participants: userId,
    });

    if (!chat) {
        throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }

    return chat;
};

// GET /api/chats - Get all chats for current user
exports.getChats = async (req, res) => {
    try {
        const chats = await Chat.find({
            participants: req.userId,
            deletedBy: { $ne: req.userId },
            requestStatus: { $ne: 'rejected' },
        })
            .populate('participants', USER_PUBLIC_FIELDS)
            .populate('groupAdmin', 'name username avatar')
            .populate('requestedBy', 'name username avatar')
            .populate('lastMessage')
            .sort({ updatedAt: -1 });

        res.json({ chats: chats.map((chat) => sanitizeChatForViewer(chat, req.userId)) });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// POST /api/chats/saved - Create or return Saved Messages chat
exports.getSavedMessagesChat = async (req, res) => {
    try {
        let chat = await populateChatQuery(
            Chat.findOne({
                isSavedMessages: true,
                participants: { $size: 1, $all: [req.userId] },
            })
        );

        if (!chat) {
            chat = await Chat.create({
                participants: [req.userId],
                requestStatus: 'accepted',
                isSavedMessages: true,
            });

            chat = await populateChatQuery(Chat.findById(chat._id));
        }

        res.json({ chat: sanitizeChatForViewer(chat, req.userId) });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// GET /api/chats/:id/assets - Get shared assets for a chat
exports.getChatAssets = async (req, res) => {
    try {
        const { id: chatId } = req.params;
        const tab = `${req.query.tab || 'media'}`.toLowerCase();
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 60);

        await ensureChatParticipant(chatId, req.userId);

        const baseConditions = {
            chatId,
            isDeleted: { $ne: true },
            deletedFor: { $ne: req.userId },
            'viewOnce.enabled': { $ne: true },
        };

        const tabConditions = {
            media: { type: { $in: ['image', 'video'] } },
            docs: { type: 'document' },
            voice: { type: 'audio' },
            links: { text: LINK_PATTERN },
        };

        const conditions = {
            ...baseConditions,
            ...(tabConditions[tab] || tabConditions.media),
        };

        const [mediaCount, documentCount, voiceCount, linkCount, messages] = await Promise.all([
            Message.countDocuments({ ...baseConditions, type: { $in: ['image', 'video'] } }),
            Message.countDocuments({ ...baseConditions, type: 'document' }),
            Message.countDocuments({ ...baseConditions, type: 'audio' }),
            Message.countDocuments({ ...baseConditions, text: LINK_PATTERN }),
            Message.find(conditions)
                .sort({ createdAt: -1 })
                .limit(limit)
                .populate('senderId', MESSAGE_SENDER_FIELDS)
                .select('chatId senderId text type fileUrl fileName fileSize createdAt'),
        ]);

        const items = messages.map((message) => {
            const plain = message.toObject();
            const matchedLink = plain.text?.match(LINK_PATTERN)?.[0] || '';
            return {
                ...plain,
                primaryUrl: matchedLink
                    ? (/^https?:\/\//i.test(matchedLink) ? matchedLink : `https://${matchedLink}`)
                    : '',
            };
        });

        res.json({
            items,
            counts: {
                media: mediaCount,
                docs: documentCount,
                voice: voiceCount,
                links: linkCount,
            },
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
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
            return res.json({ chat: sanitizeChatForViewer(chat, req.userId), isNew: false });
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

        res.status(201).json({ chat: sanitizeChatForViewer(chat, req.userId), isNew: true });
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

        res.status(201).json({ chat: sanitizeChatForViewer(populatedChat, req.userId) });
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

// PATCH /api/chats/:id/archive - Toggle archive for current user
exports.toggleArchiveChat = async (req, res) => {
    try {
        const chat = await Chat.findById(req.params.id);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        if (!chat.participants.some((id) => id.toString() === req.userId.toString())) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const isArchived = chat.archivedBy?.some((id) => id.toString() === req.userId.toString());
        if (isArchived) {
            chat.archivedBy = chat.archivedBy.filter((id) => id.toString() !== req.userId.toString());
        } else {
            chat.archivedBy.push(req.userId);
        }

        await chat.save();
        res.json({ archived: !isArchived });
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
