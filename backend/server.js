import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import bankAccountRoutes from './routes/bankAccountRoutes.js';
import vnpayRoutes from './modules/payment/vnpay.routes.js';
import transactionRoutes from './modules/transaction/transaction.routes.js';
import escrowRoutes from './modules/escrow/escrow.routes.js';
import withdrawalRoutes from './modules/withdrawal/withdrawal.routes.js';
import { poolPromise } from './config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS setup to allow client origins
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Main Authentication & User routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// Wallet & Banking routes
if (walletRoutes) app.use('/api/wallet', walletRoutes);
if (bankAccountRoutes) app.use('/api/bank-account', bankAccountRoutes);

// Payment & VNPay routes
if (vnpayRoutes) app.use('/api/payment/vnpay', vnpayRoutes);
if (transactionRoutes) app.use('/api/wallet/transactions', transactionRoutes);
if (escrowRoutes) app.use('/api/escrow', escrowRoutes);
if (withdrawalRoutes) app.use('/api/withdrawal', withdrawalRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    message: 'FJMS API server is running smoothly.'
  });
});

// Start listening and pre-warm db connection pool
app.listen(PORT, async () => {
  console.log(`============================================`);
  console.log(`🚀 FJMS Backend Server running on http://localhost:${PORT}`);
  console.log(`============================================`);
  
  try {
    // Warm up connection pool immediately on startup
    await poolPromise;
  } catch (err) {
    console.error('❌ Failed to connect to SQL Server during server startup.');
  }
});
