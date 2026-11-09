import express from 'express';
import { getAdminAnalytics } from '../controllers/analyticsController.js';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);
router.use(verifyAdmin);

router.get('/', getAdminAnalytics);

export default router;