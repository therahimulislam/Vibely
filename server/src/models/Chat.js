// server/src/models/Chat.js
// Chat model for 1-on-1 conversations

const mongoose = require('mongoose');

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
        groupName: {
            type: String,
            default: '',
        },
        isGroup: {
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
    },
    {
        timestamps: true,
    }
);

// Index for fast participant lookups
chatSchema.index({ participants: 1 });
chatSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);
