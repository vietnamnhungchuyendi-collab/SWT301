import express from 'express';
import { 
  requestWithdrawal, 
  getMyWithdrawals, 
  getAllWithdrawals, 
  approveWithdrawal, 
  rejectWithdrawal 
} from './withdrawal.controller.js';
import { verifyToken } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

// User routes
router.post('/', requestWithdrawal);
router.get('/', getMyWithdrawals);

// Admin routes
router.get('/admin', getAllWithdrawals);
router.post('/admin/approve/:id', approveWithdrawal);
router.post('/admin/reject/:id', rejectWithdrawal);

export default router;
