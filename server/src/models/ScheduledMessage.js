// server/src/models/ScheduledMessage.js
// Scheduled messages that will be delivered by cron when due

const mongoose = require('mongoose');

const scheduledMessageSchema = new mongoose.Schema(
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
            enum: ['text', 'image', 'video', 'audio', 'document'],
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
        viewOnce: {
            enabled: {
                type: Boolean,
                default: false,
            },
            durationSeconds: {
                type: Number,
                default: 10,
            },
        },
        scheduledFor: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

scheduledMessageSchema.index({ senderId: 1, chatId: 1, scheduledFor: 1 });
scheduledMessageSchema.index({ scheduledFor: 1 });

module.exports = mongoose.model('ScheduledMessage', scheduledMessageSchema);
