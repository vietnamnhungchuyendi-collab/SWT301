import express from 'express';
import { depositEscrow, getEscrowByProject } from './escrow.controller.js';
import { verifyToken } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);
router.post('/deposit', depositEscrow);
router.get('/:projectId', getEscrowByProject);

export default router;
