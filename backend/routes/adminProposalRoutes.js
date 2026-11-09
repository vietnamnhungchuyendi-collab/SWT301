import express from 'express';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';
import { getProposals, patchProposalStatus, postAcceptProposal } from '../controllers/proposalController.js';

const router = express.Router();

router.use(verifyToken, verifyAdmin);

router.get('/proposals', getProposals);
router.patch('/proposals/:id/status', patchProposalStatus);
router.post('/proposals/:id/accept', postAcceptProposal);

export default router;
