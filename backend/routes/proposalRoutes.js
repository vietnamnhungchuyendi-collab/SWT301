import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { verifyToken } from '../middleware/authMiddleware.js';
import { 
  getProposals, 
  patchProposalStatus, 
  postAcceptProposal, 
  getSingleProposal,
  updateProposal,
  deleteProposal 
} from '../controllers/proposalController.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

const router = express.Router();

router.use(verifyToken);

router.get('/', getProposals);
router.get('/:id', getSingleProposal);
router.put('/:id', upload.single('attachment'), updateProposal);
router.delete('/:id', deleteProposal);
router.patch('/:id/status', patchProposalStatus);
router.post('/:id/accept', postAcceptProposal);

export default router;
