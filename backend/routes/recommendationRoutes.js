import express from 'express';
import { getProjectRecommendations, getFreelancerRecommendations } from '../controllers/recommendationController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/projects/:projectId/recommendations', getProjectRecommendations);
router.get('/freelancer/recommended-projects', getFreelancerRecommendations);

export default router;