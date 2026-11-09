import express from 'express';
import { createPayment, vnpayReturn } from './vnpay.controller.js';
import { verifyToken } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.post('/create_url', verifyToken, createPayment);
router.get('/vnpay_ipn', vnpayReturn); // VNPay calls this directly

export default router;
