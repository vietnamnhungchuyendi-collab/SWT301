import express from 'express';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';
import { getDisputes, getDisputeById, patchResolveDispute, patchCloseDispute } from '../controllers/disputeController.js';

const router = express.Router();

router.use(verifyToken, verifyAdmin);

router.get('/', getDisputes);
router.get('/:id', getDisputeById);
router.patch('/:id/resolve', patchResolveDispute);
router.patch('/:id/close', patchCloseDispute);

export default router;
