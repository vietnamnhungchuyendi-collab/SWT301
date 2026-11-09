import express from 'express';
import { getWalletBalance, getWallet, depositFunds } from '../controllers/walletController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getWallet);
router.get('/balance', getWalletBalance);
router.post('/deposit', depositFunds);

export default router;
