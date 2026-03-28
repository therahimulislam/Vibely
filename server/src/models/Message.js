// server/src/models/Message.js
// Message model with status tracking, reactions, and media support

const mongoose = require('mongoose');

const pollOptionSchema = new mongoose.Schema(
    {
        optionId: {
            type: String,
            required: true,
        },
        text: {
            type: String,
            required: true,
            trim: true,
        },
        votes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
    },
    { _id: false }
);

const messageSchema = new mongoose.Schema(
    {
        chatId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Chat',
            required: true,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        text: {
            type: String,
            trim: true,
            default: '',
        },
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            default: null,
        },
        type: {
            type: String,
            enum: ['text', 'image', 'video', 'audio', 'document', 'poll'],
            default: 'text',
        },
        fileUrl: {
            type: String,
            default: '',
        },
        fileName: {
            type: String,
            default: '',
        },
        fileSize: {
            type: Number,
            default: 0,
        },
        publicId: {
            type: String,
            default: '',
        },
        mediaResourceType: {
            type: String,
            default: '',
        },
        deletedFor: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        status: {
            type: String,
            enum: ['sent', 'delivered', 'seen'],
            default: 'sent',
        },
        starredBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        reactions: [
            {
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                emoji: String,
            },
        ],
        isEdited: {
            type: Boolean,
            default: false,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        poll: {
            question: {
                type: String,
                trim: true,
                default: '',
            },
            options: {
                type: [pollOptionSchema],
                default: [],
            },
        },
        forwardedFrom: {
            messageId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Message',
                default: null,
            },
            senderName: {
                type: String,
                trim: true,
                default: '',
            },
        },
        viewOnce: {
            enabled: {
                type: Boolean,
                default: false,
            },
            durationSeconds: {
                type: Number,
                default: 10,
            },
            views: {
                type: [{
                    userId: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: 'User',
                    },
                    viewedAt: {
                        type: Date,
                        default: Date.now,
                    },
                }],
                default: [],
            },
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
        pinnedAt: {
            type: Date,
            default: null,
        },
        pinnedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient queries
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ chatId: 1, isPinned: 1, pinnedAt: -1 });
messageSchema.index({ senderId: 1 });

module.exports = mongoose.model('Message', messageSchema);
