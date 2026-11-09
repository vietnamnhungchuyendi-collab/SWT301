import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { 
  getContractById, 
  getActiveContracts,
  getContractByProjectId,
  submitWork, 
  getContractSubmissions, 
  approveSubmission, 
  requestRevision,
  createContractReview
} from '../controllers/contractController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Multer config for file submissions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
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

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // Support up to 50MB per file
});

router.use(verifyToken);

// Contract details
router.get('/', getActiveContracts);
router.get('/project/:projectId', getContractByProjectId);
router.get('/:contractId', getContractById);

// Submissions CRUD
router.post('/:contractId/submissions', upload.array('files', 5), submitWork);
router.get('/:contractId/submissions', getContractSubmissions);

// Approve / Request revision on submission
router.post('/submissions/:submissionId/approve', approveSubmission);
router.post('/submissions/:submissionId/revision', requestRevision);

// Review submission
router.post('/:contractId/review', createContractReview);

export default router;
