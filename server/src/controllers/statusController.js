// WhatsApp-style status controller

const fs = require('fs');
const Status = require('../models/Status');
const { uploadFile, deleteImage } = require('../services/cloudinaryService');
const { sanitizeInput } = require('../utils/helpers');

const STATUS_LIFETIME_MS = 24 * 60 * 60 * 1000;
const cleanupTempFile = (filePath) => {
    if (filePath) {
        fs.unlink(filePath, () => { });
    }
};

const emitStatusUpdate = async (req, ownerId) => {
    const io = req.app.get('io');
    if (!io) return;

    const User = Status.db.model('User');
    const owner = await User.findById(ownerId).select('contacts');
    if (!owner) return;

    const contactIds = (owner.contacts || []).map((id) => id.toString());
    const contacts = contactIds.length > 0
        ? await User.find({ _id: { $in: contactIds }, contacts: ownerId }).select('_id')
        : [];

    const recipients = new Set([ownerId.toString(), ...contacts.map((contact) => contact._id.toString())]);
    recipients.forEach((userId) => {
        io.to(`user:${userId}`).emit('status:updated', { userId: ownerId.toString() });
    });
};

const buildGroupedStatuses = (statuses, currentUserId) => {
    const currentUser = currentUserId.toString();
    const groups = new Map();

    statuses.forEach((status) => {
        const ownerId = status.userId._id.toString();
        const isViewed = ownerId === currentUser
            ? true
            : status.viewers.some((viewer) => viewer.userId.toString() === currentUser);

        const serialized = {
            _id: status._id,
            text: status.text,
            type: status.type,
            mediaUrl: status.mediaUrl,
            background: status.background,
            createdAt: status.createdAt,
            expiresAt: status.expiresAt,
            isViewed,
            viewersCount: status.viewers.length,
            viewers: ownerId === currentUser
                ? status.viewers.map((viewer) => ({
                    userId: viewer.userId?._id || viewer.userId,
                    name: viewer.userId?.name || 'Someone',
                    viewedAt: viewer.viewedAt,
                }))
                : [],
        };

        if (!groups.has(ownerId)) {
            groups.set(ownerId, {
                user: status.userId,
                items: [],
                latestAt: status.createdAt,
                hasUnviewed: false,
            });
        }

        const group = groups.get(ownerId);
        group.items.push(serialized);
        group.latestAt = new Date(group.latestAt) > new Date(status.createdAt) ? group.latestAt : status.createdAt;
        group.hasUnviewed = group.hasUnviewed || !isViewed;
    });

    return [...groups.values()].sort((a, b) => new Date(b.latestAt) - new Date(a.latestAt));
};

exports.getStatuses = async (req, res) => {
    try {
        const now = new Date();
        const currentUser = await Status.db.model('User').findById(req.userId).select('contacts');
        const visibleOwnerIds = (currentUser?.contacts || []).map((contactId) => contactId.toString());
        const statuses = await Status.find({
            expiresAt: { $gt: now },
            userId: { $in: [...visibleOwnerIds, req.userId] },
        })
            .populate('userId', 'name username avatar isOnline contacts')
            .populate('viewers.userId', 'name')
            .sort({ createdAt: 1 });

        const mutuallyVisibleStatuses = statuses.filter((status) => {
            if (status.userId._id.toString() === req.userId.toString()) return true;
            return (status.userId.contacts || []).some((contactId) => contactId.toString() === req.userId.toString());
        }).map((status) => {
            const plain = status.toObject();
            delete plain.userId.contacts;
            return plain;
        });

        const groupedStatuses = buildGroupedStatuses(mutuallyVisibleStatuses, req.userId);
        const myStatuses = groupedStatuses.find((group) => group.user._id.toString() === req.userId.toString()) || null;
        const contactsStatuses = groupedStatuses.filter((group) => group.user._id.toString() !== req.userId.toString());

        res.json({
            myStatuses,
            statuses: contactsStatuses,
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createStatus = async (req, res) => {
    try {
        const rawText = typeof req.body.text === 'string' ? req.body.text : '';
        const text = sanitizeInput(rawText).trim();
        const background = req.body.background || '#7c5cfc';
        let type = req.body.type || 'text';
        let mediaUrl = '';
        let publicId = '';
        let mediaResourceType = '';

        if (req.file) {
            const upload = await uploadFile(req.file.path, 'vibely/status', 'auto');
            mediaUrl = upload.url;
            publicId = upload.publicId;
            mediaResourceType = upload.resourceType;
            type = upload.resourceType === 'video' || req.file.mimetype.startsWith('video/')
                ? 'video'
                : 'image';
        }

        if (!text && !mediaUrl) {
            return res.status(400).json({ error: 'Status must contain text or media' });
        }

        const status = await Status.create({
            userId: req.userId,
            text,
            type,
            mediaUrl,
            publicId,
            mediaResourceType,
            background,
            expiresAt: new Date(Date.now() + STATUS_LIFETIME_MS),
        });

        const populated = await Status.findById(status._id)
            .populate('userId', 'name avatar isOnline')
            .populate('viewers.userId', 'name');

        await emitStatusUpdate(req, req.userId);

        res.status(201).json({ status: populated });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Server error' });
    } finally {
        cleanupTempFile(req.file?.path);
    }
};

exports.markStatusViewed = async (req, res) => {
    try {
        const status = await Status.findById(req.params.id);
        if (!status || status.expiresAt <= new Date()) {
            return res.status(404).json({ error: 'Status not found' });
        }

        const owner = await Status.db.model('User').findById(status.userId).select('contacts');
        const viewer = await Status.db.model('User').findById(req.userId).select('contacts');
        const canView = status.userId.toString() === req.userId.toString()
            || (
                owner?.contacts?.some((id) => id.toString() === req.userId.toString())
                && viewer?.contacts?.some((id) => id.toString() === status.userId.toString())
            );

        if (!canView) {
            return res.status(403).json({ error: 'Status is not available' });
        }

        if (status.userId.toString() !== req.userId.toString()) {
            const alreadyViewed = status.viewers.some((viewer) => viewer.userId.toString() === req.userId.toString());
            if (!alreadyViewed) {
                status.viewers.push({ userId: req.userId });
                await status.save();

                const populatedViewer = await status.populate('viewers.userId', 'name');
                const latestViewer = populatedViewer.viewers[populatedViewer.viewers.length - 1];
                const io = req.app.get('io');
                io?.to(`user:${status.userId.toString()}`).emit('status:viewed', {
                    statusId: status._id.toString(),
                    viewer: {
                        userId: latestViewer.userId?._id || latestViewer.userId,
                        name: latestViewer.userId?.name || 'Someone',
                        viewedAt: latestViewer.viewedAt,
                    },
                    viewersCount: populatedViewer.viewers.length,
                });
                await emitStatusUpdate(req, status.userId);
            }
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteStatus = async (req, res) => {
    try {
        const status = await Status.findOne({
            _id: req.params.id,
            userId: req.userId,
        });

        if (!status) {
            return res.status(404).json({ error: 'Status not found' });
        }

        if (status.publicId) {
            await deleteImage(status.publicId, status.mediaResourceType || 'image');
        }

        await Status.findByIdAndDelete(status._id);
        await emitStatusUpdate(req, req.userId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
