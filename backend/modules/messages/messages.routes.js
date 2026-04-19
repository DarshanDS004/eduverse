/**
 * EduVerse — Messages Routes
 * modules/messages/messages.routes.js
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('./messages.controller');
const { protect } = require('../auth/auth.middleware');

// All message routes require auth
router.use(protect);

router.get('/rooms',               controller.getRooms);
router.post('/rooms',              controller.createRoom);
router.get('/rooms/:id/messages',  controller.getMessages);
router.post('/rooms/:id/messages', controller.sendMessage);
router.patch('/rooms/:id/read',    controller.markRead);

module.exports = router;