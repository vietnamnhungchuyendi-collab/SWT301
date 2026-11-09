import express from 'express';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';
import {
  getReports,
  getReportById,
  patchResolveReport,
  patchDismissReport,
  patchReviewReport,
  patchReopenReport
} from '../controllers/reportController.js';

const router = express.Router();

/**
 * Admin Report Routes
 * Mounted at: /api/admin/reports
 * 
 * All routes require authentication + admin role
 */

router.use(verifyToken, verifyAdmin);

// GET /api/admin/reports - List all reports
router.get('/', getReports);

// GET /api/admin/reports/:id - Get report detail
router.get('/:id', getReportById);

// PATCH /api/admin/reports/:id/resolve - Resolve report
router.patch('/:id/resolve', patchResolveReport);

// PATCH /api/admin/reports/:id/dismiss - Dismiss report
router.patch('/:id/dismiss', patchDismissReport);

// PATCH /api/admin/reports/:id/review - Mark as under review
router.patch('/:id/review', patchReviewReport);

// PATCH /api/admin/reports/:id/reopen - Reopen report
router.patch('/:id/reopen', patchReopenReport);

export default router;