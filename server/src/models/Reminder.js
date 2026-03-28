// server/src/models/Reminder.js
// User reminders tied to specific messages

const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        messageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            required: true,
        },
        remindAt: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ['scheduled', 'triggered'],
            default: 'scheduled',
        },
        triggeredAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

reminderSchema.index({ userId: 1, status: 1, remindAt: 1 });
reminderSchema.index({ remindAt: 1, status: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
