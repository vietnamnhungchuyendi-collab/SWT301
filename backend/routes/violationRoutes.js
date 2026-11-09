import express from 'express';
import {
  getViolations,
  getViolationDetails,
  resolveViolation,
  dismissViolation,
  createViolationReport
} from '../controllers/violationController.js';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Route for any authenticated user to submit a violation report
router.post('/', verifyToken, createViolationReport);

// Admin-only routes
router.use(verifyToken);
router.use(verifyAdmin);

router.get('/', getViolations);
router.get('/:id', getViolationDetails);
router.patch('/:id/resolve', resolveViolation);
router.patch('/:id/dismiss', dismissViolation);

export default router;
