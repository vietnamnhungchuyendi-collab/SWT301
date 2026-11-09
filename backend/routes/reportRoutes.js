import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';
import {
  getReports,
  getReportById,
  patchResolveReport,
  patchDismissReport,
  patchReviewReport,
  patchReopenReport,
  createReport,
  getMyReports,
  addEvidence,
  uploadEvidenceImages
} from '../controllers/reportController.js';

const router = express.Router();

// ========== Multer config for evidence images ==========
const evidenceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/evidence';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadEvidence = multer({
  storage: evidenceStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per image
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPG, PNG, GIF, WEBP)'));
    }
  }
});

/**
 * Report Routes
 * 
 * Standardized API contract:
 * 
 * PUBLIC (authenticated):
 *   POST   /api/v1/reports                              - Submit report
 *   GET    /api/v1/reports/my                           - Get my reports
 *   POST   /api/v1/reports/upload-evidence-images       - Upload evidence images, get back URLs
 *   POST   /api/v1/reports/:id/evidence                 - Add evidence record to report
 * 
 * ADMIN ONLY:
 *   GET    /api/v1/admin/reports               - List all reports
 *   GET    /api/v1/admin/reports/:id           - Report detail
 *   PATCH  /api/v1/admin/reports/:id/resolve   - Resolve
 *   PATCH  /api/v1/admin/reports/:id/dismiss   - Dismiss
 *   PATCH  /api/v1/admin/reports/:id/review    - Under review
 *   PATCH  /api/v1/admin/reports/:id/reopen    - Reopen
 */

// ========== PUBLIC (authenticated) ==========

// POST /api/v1/reports - Submit a new report
router.post('/', verifyToken, createReport);

// GET /api/v1/reports/my - Get current user's reports
router.get('/my', verifyToken, getMyReports);

// POST /api/v1/reports/upload-evidence-images - Upload multiple evidence images (before or after report creation)
router.post('/upload-evidence-images', verifyToken, uploadEvidence.array('images', 5), uploadEvidenceImages);

// POST /api/v1/reports/:id/evidence - Add evidence record
router.post('/:id/evidence', verifyToken, addEvidence);

// ========== ADMIN ONLY ==========

// GET /api/v1/admin/reports - List all reports
router.get('/', verifyToken, verifyAdmin, getReports);

// GET /api/v1/admin/reports/:id - Get report detail
router.get('/:id', verifyToken, verifyAdmin, getReportById);

// PATCH /api/v1/admin/reports/:id/resolve - Resolve report
router.patch('/:id/resolve', verifyToken, verifyAdmin, patchResolveReport);

// PATCH /api/v1/admin/reports/:id/dismiss - Dismiss report
router.patch('/:id/dismiss', verifyToken, verifyAdmin, patchDismissReport);

// PATCH /api/v1/admin/reports/:id/review - Mark as under review
router.patch('/:id/review', verifyToken, verifyAdmin, patchReviewReport);

// PATCH /api/v1/admin/reports/:id/reopen - Reopen report
router.patch('/:id/reopen', verifyToken, verifyAdmin, patchReopenReport);

export default router;