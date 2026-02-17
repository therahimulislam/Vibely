// server/src/controllers/userController.js
// User controller - user search and profile management

const User = require('../models/User');
const { uploadAvatar } = require('../services/cloudinaryService');

// GET /api/users - Search users
exports.getUsers = async (req, res) => {
    try {
        const { search } = req.query;
        let query = { _id: { $ne: req.userId } };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        const users = await User.find(query)
            .select('name email avatar isOnline lastSeen')
            .limit(20)
            .sort({ name: 1 });

        res.json({ users });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// GET /api/users/:id - Get user profile
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('name email avatar isOnline lastSeen');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// PUT /api/users/profile - Update profile
exports.updateProfile = async (req, res) => {
    try {
        const updates = {};
        if (req.body.name) updates.name = req.body.name;

        // Handle avatar upload
        if (req.file) {
            const result = await uploadAvatar(req.file.path);
            updates.avatar = result.url;
        }

        const user = await User.findByIdAndUpdate(req.userId, updates, { new: true });
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
