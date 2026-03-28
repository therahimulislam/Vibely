// server/src/routes/reminderRoutes.js
// Reminder routes

const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', reminderController.getReminders);
router.post('/', reminderController.createReminder);
router.delete('/:id', reminderController.deleteReminder);

module.exports = router;
