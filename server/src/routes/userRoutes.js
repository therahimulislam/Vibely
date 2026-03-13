// server/src/routes/userRoutes.js
// User routes

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);

router.get('/', userController.getUsers);
router.get('/contacts/list', userController.getContacts);
router.post('/contacts/:id', userController.addContact);
router.delete('/contacts/:id', userController.removeContact);
router.get('/:id', userController.getUserById);
router.put('/profile', upload.single('avatar'), userController.updateProfile);

module.exports = router;
