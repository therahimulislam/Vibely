// server/src/models/Chat.js
// Chat model for 1-on-1 conversations

const mongoose = require('mongoose');

const inviteLinkSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            trim: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        revokedAt: {
            type: Date,
            default: null,
        },
    },
    { _id: false }
);

const joinRequestSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        requestedAt: {
            type: Date,
            default: Date.now,
        },
        viaCode: {
            type: String,
            trim: true,
            default: '',
        },
    },
    { _id: false }
);

const chatSchema = new mongoose.Schema(
    {
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
        ],
        lastMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            default: null,
        },
        pinnedBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        archivedBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        groupName: {
            type: String,
            default: '',
        },
        isGroup: {
            type: Boolean,
            default: false,
        },
        isSavedMessages: {
            type: Boolean,
            default: false,
        },
        groupAvatar: {
            type: String,
            default: '',
        },
        groupAdmin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        unreadCount: {
            type: Map,
            of: Number,
            default: {},
        },
        deletedBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        requestStatus: {
            type: String,
            enum: ['pending', 'accepted', 'rejected'],
            default: 'accepted',
        },
        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        groupSettings: {
            adminOnlyMessages: {
                type: Boolean,
                default: false,
            },
            allowMemberMedia: {
                type: Boolean,
                default: true,
            },
            allowMemberPolls: {
                type: Boolean,
                default: true,
            },
            joinApprovalEnabled: {
                type: Boolean,
                default: false,
            },
            slowModeSeconds: {
                type: Number,
                default: 0,
            },
        },
        disappearingMessages: {
            enabled: {
                type: Boolean,
                default: false,
            },
            durationHours: {
                type: Number,
                default: 0,
            },
        },
        inviteLinks: {
            type: [inviteLinkSchema],
            default: [],
        },
        pendingJoinRequests: {
            type: [joinRequestSchema],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

// Index for fast participant lookups
chatSchema.index({ participants: 1 });
chatSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);
