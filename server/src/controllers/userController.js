// server/src/controllers/userController.js
// User controller - user search and profile management

const User = require('../models/User');
const { uploadAvatar } = require('../services/cloudinaryService');
const fs = require('fs');

const sanitizeUsername = (value = '') => value.trim().toLowerCase();
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
    isOnline: user.isOnline,
    lastSeen: user.lastSeen,
    isContact: currentUser.contacts?.some((contactId) => contactId.toString() === user._id.toString()) || false,
});

// GET /api/users - Search users
exports.getUsers = async (req, res) => {
    try {
        const { search } = req.query;
        let query = { _id: { $ne: req.userId } };

        if (search) {
            query.username = { $regex: `^${sanitizeUsername(search)}`, $options: 'i' };
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
        const user = await User.findById(req.params.id).select('name username avatar isOnline lastSeen');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user: formatPublicUser(user, req.user) });
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

        await User.findByIdAndUpdate(req.userId, { $addToSet: { contacts: contact._id } });
        const updatedUser = await User.findById(req.userId);
        res.json({ contact: formatPublicUser(contact, updatedUser) });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.removeContact = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, { $pull: { contacts: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
