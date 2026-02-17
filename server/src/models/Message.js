// server/src/models/Message.js
// Message model with status tracking, reactions, and media support

const mongoose = require('mongoose');

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
        type: {
            type: String,
            enum: ['text', 'image', 'video', 'document'],
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
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient queries
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });

module.exports = mongoose.model('Message', messageSchema);
