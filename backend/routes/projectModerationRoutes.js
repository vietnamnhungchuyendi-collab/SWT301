import express from 'express';
import {
  getPendingProjects,
  getProjectDetail,
  approveProject,
  rejectProject,
  getAllProjectsAdmin
} from '../controllers/projectModerationController.js';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require admin authentication
router.use(verifyToken);
router.use(verifyAdmin);

router.get('/pending', getPendingProjects);
router.get('/all', getAllProjectsAdmin);
router.get('/:id', getProjectDetail);
router.patch('/:id/approve', approveProject);
router.patch('/:id/reject', rejectProject);

export default router;