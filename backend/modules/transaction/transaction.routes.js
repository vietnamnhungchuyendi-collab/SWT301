import express from 'express';
import { getTransactions } from './transaction.controller.js';
import { verifyToken } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);
router.get('/', getTransactions);

export default router;
