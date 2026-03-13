// server/src/services/cronService.js
// Cron jobs for retention policies

const cron = require('node-cron');
const Message = require('../models/Message');
const Status = require('../models/Status');
const { deleteImage } = require('./cloudinaryService');

const initCronJobs = () => {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
        console.log('⏳ Running retention cron job...');
        try {
            const now = new Date();

            const expiredStatuses = await Status.find({
                expiresAt: { $lt: now }
            });

            if (expiredStatuses.length > 0) {
                console.log(`Found ${expiredStatuses.length} expired statuses`);
                for (const status of expiredStatuses) {
                    if (status.publicId) {
                        await deleteImage(status.publicId, status.mediaResourceType || 'image');
                    }
                    await Status.findByIdAndDelete(status._id);
                }
            }

            // 1. Delete media (images/videos) older than 24 hours
            const mediaExpiration = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

            const mediaMessages = await Message.find({
                type: { $in: ['image', 'video'] },
                createdAt: { $lt: mediaExpiration },
            });

            if (mediaMessages.length > 0) {
                console.log(`Found ${mediaMessages.length} expired media messages`);
                for (const msg of mediaMessages) {
                    if (msg.publicId) {
                        await deleteImage(msg.publicId, msg.type === 'video' ? 'video' : 'image');
                    }
                    // We can either delete the message entirely or just clear the file
                    // Use case implies "stored in server for 24hrs", so we likely delete the message
                    await Message.findByIdAndDelete(msg._id);
                    // Or keep text? "Text message is stored for 7 days". 
                    // If it has text + image, maybe we should just clear image?
                    // But simpler interpretation: if it IS an image message, delete it.
                    // If it is 'text' type but happens to have attachments, that's different.
                    // Our model has 'type' which dictates the main content.
                }
            }

            // 2. Delete EVERYTHING older than 7 days (text, documents, etc)
            const globalExpiration = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

            const oldMessages = await Message.find({
                createdAt: { $lt: globalExpiration }
            });

            if (oldMessages.length > 0) {
                console.log(`Found ${oldMessages.length} expired old messages`);
                for (const msg of oldMessages) {
                    if (msg.publicId) {
                        await deleteImage(msg.publicId, msg.type === 'video' ? 'video' : 'image');
                    }
                    await Message.findByIdAndDelete(msg._id);
                }
            }

        } catch (error) {
            console.error('❌ Retention cron job error:', error);
        }
    });

    console.log('✅ Retention cron jobs initialized');
};

module.exports = { initCronJobs };
