// server/src/controllers/userController.js
// User controller - user search and profile management

const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const { uploadAvatar } = require('../services/cloudinaryService');
const fs = require('fs');

const sanitizeUsername = (value = '') => value.trim().toLowerCase();
const escapeRegex = (value = '') => `${value}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sanitizeUrl = (value = '') => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};
const sanitizeColor = (value = '') => {
    const trimmed = value.trim();
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : '#6f6bff';
};
const sanitizePreferredName = (value = '', fallback = '') => {
    const preferredName = `${value || ''}`.trim().slice(0, 60);
    const fallbackName = `${fallback || ''}`.trim().slice(0, 60);
    return preferredName || fallbackName;
};
const normalizeId = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value._id) return value._id.toString();
    if (value.userId) return normalizeId(value.userId);
    return value.toString?.() || '';
};
const hasContact = (currentUser, targetUserId) =>
    (currentUser?.contacts || []).some((entry) => normalizeId(entry) === `${targetUserId}`);
const getPreferredContactName = (currentUser, targetUserId, fallbackName = '') => {
    const profile = (currentUser?.contactProfiles || []).find((entry) => normalizeId(entry?.userId) === `${targetUserId}`);
    return sanitizePreferredName(profile?.preferredName, fallbackName);
};
const normalizeFolderPayload = (folders = []) => folders
    .filter(Boolean)
    .slice(0, 8)
    .map((folder, index) => ({
        folderId: `${folder.folderId || folder.id || `folder-${index + 1}`}`.trim().slice(0, 60),
        name: `${folder.name || ''}`.trim().slice(0, 24),
        color: sanitizeColor(`${folder.color || '#6f6bff'}`),
        chatIds: Array.from(new Set((folder.chatIds || []).filter(Boolean).map((id) => id.toString()))),
    }))
    .filter((folder) => folder.folderId && folder.name);
const normalizeChatNotificationPayload = (payload = {}) => {
    const mutedUntilValue = payload.mutedUntil ? new Date(payload.mutedUntil) : null;
    const mutedUntil = mutedUntilValue && !Number.isNaN(mutedUntilValue.getTime())
        ? mutedUntilValue
        : null;

    return {
        chatId: payload.chatId?.toString?.() || '',
        mutedUntil,
        mentionsOnly: !!payload.mentionsOnly,
        sound: payload.sound === 'silent' ? 'silent' : 'default',
        desktop: !!payload.desktop,
    };
};
const normalizeChatDraftPayload = (payload = {}) => ({
    chatId: payload.chatId?.toString?.() || '',
    text: `${payload.text || ''}`.slice(0, 4000),
});
const cleanupTempFile = (filePath) => {
    if (filePath) {
        fs.unlink(filePath, () => { });
    }
};

const formatPublicUser = (user, currentUser) => ({
    _id: user._id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    bio: user.bio || '',
    socialLinks: {
        website: user.socialLinks?.website || '',
        instagram: user.socialLinks?.instagram || '',
        x: user.socialLinks?.x || '',
    },
    isOnline: user.isOnline,
    lastSeen: user.lastSeen,
    isContact: hasContact(currentUser, user._id),
    preferredName: hasContact(currentUser, user._id)
        ? getPreferredContactName(currentUser, user._id, user.name)
        : '',
    displayName: hasContact(currentUser, user._id)
        ? getPreferredContactName(currentUser, user._id, user.name)
        : user.name,
});

// GET /api/users - Search users
exports.getUsers = async (req, res) => {
    try {
        const { search } = req.query;
        let query = { _id: { $ne: req.userId } };

        if (search) {
            const trimmedSearch = `${search}`.trim();
            const escapedSearch = escapeRegex(trimmedSearch);
            const normalizedUsername = sanitizeUsername(trimmedSearch);

            query.$or = [
                { username: { $regex: `^${escapeRegex(normalizedUsername)}`, $options: 'i' } },
                { name: { $regex: escapedSearch, $options: 'i' } },
            ];
        }

        const users = await User.find(query)
            .select('name username avatar isOnline lastSeen')
            .limit(20)
            .sort({ username: 1 });

        res.json({ users: users.map((user) => formatPublicUser(user, req.user)) });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getContacts = async (req, res) => {
    try {
        const user = await User.findById(req.userId).populate('contacts', 'name username avatar isOnline lastSeen');
        res.json({
            contacts: (user?.contacts || []).map((contact) => formatPublicUser(contact, user)),
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// GET /api/users/:id - Get user profile
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('name username avatar bio socialLinks isOnline lastSeen createdAt');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const mutualGroups = await Chat.find({
            isGroup: true,
            participants: { $all: [req.userId, user._id] },
        })
            .select('groupName groupAvatar participants')
            .limit(4);

        const sharedChatIds = await Chat.find({
            participants: { $all: [req.userId, user._id] },
        }).distinct('_id');

        const sharedMedia = sharedChatIds.length > 0
            ? await Message.find({
                chatId: { $in: sharedChatIds },
                type: { $in: ['image', 'video', 'audio', 'document'] },
                isDeleted: { $ne: true },
                'viewOnce.enabled': { $ne: true },
            })
                .sort({ createdAt: -1 })
                .limit(8)
                .select('type fileUrl fileName createdAt chatId')
            : [];

        res.json({
            user: {
                ...formatPublicUser(user, req.user),
                createdAt: user.createdAt,
                mutualGroups: mutualGroups.map((chat) => ({
                    _id: chat._id,
                    name: chat.groupName || 'Group Chat',
                    avatar: chat.groupAvatar || '',
                    memberCount: (chat.participants || []).length,
                })),
                sharedMedia,
            },
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// PUT /api/users/profile - Update profile
exports.updateProfile = async (req, res) => {
    try {
        const updates = {};
        if (req.body.name) updates.name = req.body.name;
        if (req.body.username) {
            const username = sanitizeUsername(req.body.username);
            const existing = await User.findOne({ username, _id: { $ne: req.userId } });
            if (existing) {
                return res.status(400).json({ error: 'Username is already taken' });
            }
            updates.username = username;
        }
        if (typeof req.body.bio === 'string') updates.bio = req.body.bio.trim().slice(0, 160);
        if (req.body.socialLinks) {
            const socialLinks = typeof req.body.socialLinks === 'string'
                ? JSON.parse(req.body.socialLinks)
                : req.body.socialLinks;

            updates.socialLinks = {
                website: sanitizeUrl(socialLinks?.website || ''),
                instagram: (socialLinks?.instagram || '').trim(),
                x: (socialLinks?.x || '').trim(),
            };
        }
        if (req.body.chatTheme) {
            updates['preferences.chatTheme'] = req.body.chatTheme;
        }

        // Handle avatar upload
        if (req.file) {
            const result = await uploadAvatar(req.file.path);
            updates.avatar = result.url;
        }

        const user = await User.findByIdAndUpdate(req.userId, updates, { new: true });
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    } finally {
        cleanupTempFile(req.file?.path);
    }
};

exports.addContact = async (req, res) => {
    try {
        if (req.params.id === req.userId.toString()) {
            return res.status(400).json({ error: 'Cannot add yourself as a contact' });
        }

        const contact = await User.findById(req.params.id);
        if (!contact) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = await User.findById(req.userId);
        updatedUser.contacts = Array.from(new Set([...(updatedUser.contacts || []).map((id) => id.toString()), contact._id.toString()]));

        const filteredProfiles = (updatedUser.contactProfiles || []).filter((entry) => normalizeId(entry?.userId) !== contact._id.toString());
        filteredProfiles.push({
            userId: contact._id,
            preferredName: sanitizePreferredName(req.body?.preferredName, contact.name),
            createdAt: new Date(),
        });
        updatedUser.contactProfiles = filteredProfiles;

        await updatedUser.save();
        res.json({ contact: formatPublicUser(contact, updatedUser), user: updatedUser });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.removeContact = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        user.contacts = (user.contacts || []).filter((entry) => normalizeId(entry) !== req.params.id.toString());
        user.contactProfiles = (user.contactProfiles || []).filter((entry) => normalizeId(entry?.userId) !== req.params.id.toString());
        await user.save();
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateChatFolders = async (req, res) => {
    try {
        const folders = normalizeFolderPayload(req.body.folders);
        const uniqueChatIds = Array.from(new Set(folders.flatMap((folder) => folder.chatIds)));

        if (uniqueChatIds.length > 0) {
            const accessibleChatCount = await Chat.countDocuments({
                _id: { $in: uniqueChatIds },
                participants: req.userId,
            });

            if (accessibleChatCount !== uniqueChatIds.length) {
                return res.status(400).json({ error: 'One or more selected chats are invalid' });
            }
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            { 'preferences.chatFolders': folders },
            { new: true }
        );

        res.json({
            chatFolders: user?.preferences?.chatFolders || [],
            user,
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateChatNotifications = async (req, res) => {
    try {
        const settings = normalizeChatNotificationPayload(req.body);
        if (!settings.chatId) {
            return res.status(400).json({ error: 'Chat ID is required' });
        }

        const chat = await Chat.findOne({
            _id: settings.chatId,
            participants: req.userId,
        });

        if (!chat) {
            return res.status(400).json({ error: 'Chat not found' });
        }

        if (!chat.isGroup) {
            settings.mentionsOnly = false;
        }

        const user = await User.findById(req.userId);
        const currentSettings = user?.preferences?.chatNotifications || [];
        const filteredSettings = currentSettings.filter((entry) => entry.chatId?.toString() !== settings.chatId);

        const shouldPersist =
            !!settings.mutedUntil ||
            settings.mentionsOnly ||
            settings.sound !== 'default' ||
            settings.desktop;

        user.preferences.chatNotifications = shouldPersist
            ? [...filteredSettings, settings]
            : filteredSettings;

        await user.save();

        res.json({
            chatNotification: user.preferences.chatNotifications.find((entry) => entry.chatId?.toString() === settings.chatId) || {
                chatId: settings.chatId,
                mutedUntil: null,
                mentionsOnly: false,
                sound: 'default',
                desktop: false,
            },
            user,
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateChatDraft = async (req, res) => {
    try {
        const draft = normalizeChatDraftPayload(req.body);
        if (!draft.chatId) {
            return res.status(400).json({ error: 'Chat ID is required' });
        }

        const chat = await Chat.findOne({
            _id: draft.chatId,
            participants: req.userId,
        });

        if (!chat) {
            return res.status(400).json({ error: 'Chat not found' });
        }

        const user = await User.findById(req.userId);
        const currentDrafts = user?.preferences?.chatDrafts || [];
        const filteredDrafts = currentDrafts.filter((entry) => entry.chatId?.toString() !== draft.chatId);

        user.preferences.chatDrafts = draft.text.trim()
            ? [
                ...filteredDrafts,
                {
                    chatId: draft.chatId,
                    text: draft.text,
                    updatedAt: new Date(),
                },
            ]
            : filteredDrafts;

        await user.save();

        res.json({
            chatDrafts: user.preferences.chatDrafts || [],
            user,
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
