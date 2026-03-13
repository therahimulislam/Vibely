// WhatsApp-style status model

const mongoose = require('mongoose');

const statusSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        text: {
            type: String,
            trim: true,
            default: '',
            maxlength: 500,
        },
        type: {
            type: String,
            enum: ['text', 'image', 'video'],
            default: 'text',
        },
        mediaUrl: {
            type: String,
            default: '',
        },
        publicId: {
            type: String,
            default: '',
        },
        mediaResourceType: {
            type: String,
            default: '',
        },
        background: {
            type: String,
            default: '#7c5cfc',
        },
        viewers: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    required: true,
                },
                viewedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

statusSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Status', statusSchema);
