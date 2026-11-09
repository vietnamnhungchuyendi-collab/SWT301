import express from 'express';
import { getConversations, getMessages, sendMessage, markMessagesAsRead } from '../controllers/chatController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/conversations', verifyToken, getConversations);
router.get('/messages/:projectId', verifyToken, getMessages);
router.post('/messages', verifyToken, sendMessage);
router.put('/read/:projectId', verifyToken, markMessagesAsRead);

export default router;
