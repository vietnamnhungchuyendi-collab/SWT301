import express from 'express';
import { getBankAccount, createBankAccount, updateBankAccount } from '../controllers/bankAccountController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getBankAccount);
router.post('/', createBankAccount);
router.put('/:id', updateBankAccount);

export default router;
