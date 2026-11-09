import express from 'express';
import {
  getSessions,
  createSession,
  getMessages,
  sendMessage,
  deleteSession
} from '../controllers/aiChatController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/sessions', getSessions);
router.post('/sessions', createSession);
router.get('/sessions/:id/messages', getMessages);
router.post('/chat', sendMessage);
router.delete('/sessions/:id', deleteSession);

export default router;