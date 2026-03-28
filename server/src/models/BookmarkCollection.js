// server/src/models/BookmarkCollection.js
// Per-user bookmark collections for organizing important messages

const mongoose = require('mongoose');

const bookmarkItemSchema = new mongoose.Schema(
    {
        messageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            required: true,
        },
        addedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const bookmarkCollectionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 32,
        },
        color: {
            type: String,
            trim: true,
            default: '#6f6bff',
        },
        items: {
            type: [bookmarkItemSchema],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

bookmarkCollectionSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('BookmarkCollection', bookmarkCollectionSchema);
