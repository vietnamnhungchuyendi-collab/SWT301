import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
  createInvitation,
  getFreelancerInvitations,
  respondToInvitation,
  draftAIInvitation
} from '../controllers/invitationController.js';

const router = express.Router();

router.use(verifyToken);

router.post('/invite', createInvitation);
router.get('/freelancer', getFreelancerInvitations);
router.put('/:id/respond', respondToInvitation);
router.post('/draft-ai', draftAIInvitation);

export default router;
