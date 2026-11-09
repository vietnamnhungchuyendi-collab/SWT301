import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { 
  createProject, 
  updateProject, 
  closeProject, 
  deleteProject,
  getProjects, 
  getProjectById, 
  getEmployerProjects,
  submitProposal,
  getCategories,
  getProjectProposals,
  updateProposalStatus
} from '../controllers/projectController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==========================================
// CẤU HÌNH MULTER UPLOAD FILE (Từ develop)
// ==========================================
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

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận các định dạng file .pdf, .jpg, .jpeg, .png'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // Giới hạn file 10MB
});


// ==========================================
// PUBLIC ROUTES (Không cần đăng nhập)
// ==========================================
router.get('/', getProjects);
router.get('/categories', getCategories); // Đặt trước /:id để Express tránh nhận diện nhầm endpoint
router.get('/:id', getProjectById);


// ==========================================
// PROTECTED ROUTES (Bắt buộc phải đăng nhập)
// ==========================================
router.use(verifyToken);

// Các API quản lý dự án của Employer (Từ HEAD/main)
router.post('/', upload.single('attachment'), createProject);
router.get('/my/employer-projects', getEmployerProjects);
router.put('/:id', upload.single('attachment'), updateProject);
router.put('/:id/close', closeProject);
router.delete('/:id', deleteProject);

// API nộp đề xuất ứng tuyển của Freelancer kèm file đính kèm (Từ develop)
router.post('/:projectId/proposals', upload.single('attachment'), submitProposal);

// API quản lý đề xuất của Employer
router.get('/:projectId/proposals', getProjectProposals);
router.put('/proposals/:proposalId/status', updateProposalStatus);

export default router;