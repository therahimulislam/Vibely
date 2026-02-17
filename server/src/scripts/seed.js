// server/src/scripts/seed.js
// Script to seed the database with test users and chats

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

const users = [
    {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        password: 'password123',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
        isVerified: true
    },
    {
        name: 'Bob Smith',
        email: 'bob@example.com',
        password: 'password123',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
        isVerified: true
    },
    {
        name: 'Carol White',
        email: 'carol@example.com',
        password: 'password123',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carol',
        isVerified: true
    }
];

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Chat.deleteMany({});
        await Message.deleteMany({});
        console.log('🗑️  Cleared database');

        // Create Users
        const createdUsers = [];
        for (const user of users) {
            // Hash password manually since we are using insertMany or save, 
            // but let's use the model to trigger pre-save hooks usually. 
            // Actually, for seeding, creating instances is safer for hooks.
            const newUser = new User(user);
            await newUser.save();
            createdUsers.push(newUser);
        }
        console.log(`👥 Created ${createdUsers.length} users`);

        // Create a chat between Alice and Bob
        const chat1 = await Chat.create({
            participants: [createdUsers[0]._id, createdUsers[1]._id],
            isGroup: false
        });

        // Create some messages
        const messages = [
            {
                chatId: chat1._id,
                senderId: createdUsers[0]._id, // Alice
                text: 'Hey Bob! checking out Vibely?',
                status: 'seen'
            },
            {
                chatId: chat1._id,
                senderId: createdUsers[1]._id, // Bob
                text: 'Yeah Alice! The glassmorphism UI is sick!',
                status: 'delivered'
            }
        ];

        await Message.insertMany(messages);

        // Update chat last message
        const lastMsg = await Message.findOne({ chatId: chat1._id }).sort({ createdAt: -1 });
        chat1.lastMessage = lastMsg._id;
        await chat1.save();

        console.log('💬 Created test chat with messages');
        console.log('✨ Database seeded successfully');
        process.exit();
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
};

seedData();
