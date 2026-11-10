import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { verifyToken } from './middleware/authMiddleware.js';
import { approveContract } from './controllers/userController.js';

import projectRoutes from './routes/projectRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import bankAccountRoutes from './routes/bankAccountRoutes.js';
import vnpayRoutes from './modules/payment/vnpay.routes.js';
import transactionRoutes from './modules/transaction/transaction.routes.js';
import escrowRoutes from './modules/escrow/escrow.routes.js';
import withdrawalRoutes from './modules/withdrawal/withdrawal.routes.js';
import contractRoutes from './routes/contractRoutes.js';
import proposalRoutes from './routes/proposalRoutes.js';
import adminProposalRoutes from './routes/adminProposalRoutes.js';
import disputeRoutes from './routes/disputeRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import adminReportRoutes from './routes/adminReportRoutes.js';
// LEGACY: violationRoutes deprecated - use /api/v1/admin/reports instead
// import violationRoutes from './routes/violationRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import aiChatRoutes from './routes/aiChatRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import projectModerationRoutes from './routes/projectModerationRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';

import { sql, poolPromise } from './config/db.js';
import { initDb } from './utils/initDb.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP Server
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174', 'https://fjms.vercel.app'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Track active online users: Map of userId -> { socketId, lastSeen }
const activeUsers = new Map();

app.set('socketio', io);
app.set('activeUsers', activeUsers);


// CORS setup to allow client origins
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174', 'https://fjms.vercel.app'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Main Authentication routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.post('/api/contracts/:id/approve', verifyToken, approveContract);

app.use('/api/projects', projectRoutes);
app.use('/api/chat', chatRoutes);
app.use('/uploads', express.static('uploads'));
app.use('/api/wallet', walletRoutes);
app.use('/api/bank-account', bankAccountRoutes);

// Iteration 2 Routes
app.use('/api/payment/vnpay', vnpayRoutes);
app.use('/api/wallet/transactions', transactionRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/withdrawal', withdrawalRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/admin', adminProposalRoutes);
app.use('/api/disputes', disputeRoutes);
// API v1 - Report System
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/admin/reports', adminReportRoutes);

// Backward compatibility (will be removed in next major version)
app.use('/api/reports', reportRoutes);
app.use('/api/admin/reports', adminReportRoutes);

// LEGACY: /api/admin/violations is deprecated - removed
// app.use('/api/admin/violations', violationRoutes);
app.use('/api/admin/analytics', analyticsRoutes);
app.use('/api/ai', aiChatRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/admin/projects', projectModerationRoutes);
app.use('/api/invitations', invitationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    message: 'FJMS API server is running smoothly.'
  });
});



// Socket.io Real-time Event Handlers
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // Register user with socket session
  socket.on('register_user', (userId) => {
    if (!userId) return;
    socket.userId = Number(userId);
    activeUsers.set(socket.userId, {
      socketId: socket.id,
      lastSeen: new Date()
    });
    console.log(`👤 User registered: ${socket.userId} with socket ${socket.id}`);
    
    // Broadcast status change to everyone
    io.emit('user_status_change', {
      userId: socket.userId,
      status: 'ONLINE',
      lastSeen: new Date().toISOString()
    });
  });

  // Check online status of specific partner IDs
  socket.on('check_online_status', (partnerIds) => {
    if (!partnerIds || !Array.isArray(partnerIds)) return;
    const statuses = {};
    partnerIds.forEach(id => {
      const partnerIdNum = Number(id);
      const userSession = activeUsers.get(partnerIdNum);
      if (userSession && userSession.socketId) {
        statuses[partnerIdNum] = { status: 'ONLINE' };
      } else {
        statuses[partnerIdNum] = { 
          status: 'OFFLINE', 
          lastSeen: userSession ? userSession.lastSeen.toISOString() : new Date(Date.now() - 300000).toISOString() // default 5m ago
        };
      }
    });
    socket.emit('online_status_response', statuses);
  });

  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`👥 User ${socket.id} joined room: ${room}`);
  });

  socket.on('send_message', async (data) => {
    const { projectId, contractId, senderId, recipientId, messageContent, messageType, room } = data;
    try {
      let finalRecipientId = recipientId || null;
      
      // Fallback: If direct chat and recipientId is not provided, try to extract freelancerId from room name
      if (!finalRecipientId && room && room.startsWith('direct-')) {
        const parts = room.split('-');
        if (parts.length >= 3) {
          const freelancerId = parseInt(parts[2]);
          if (freelancerId) {
            if (Number(senderId) === Number(freelancerId)) {
              // Recipient must be the employer of this project
              const pool = await poolPromise;
              const projectRes = await pool.request()
                .input('projectId', sql.Int, projectId)
                .query('SELECT employer_id FROM projects WHERE project_id = @projectId');
              if (projectRes.recordset.length > 0) {
                finalRecipientId = projectRes.recordset[0].employer_id;
              }
            } else {
              finalRecipientId = freelancerId;
            }
          }
        }
      }

      const pool = await poolPromise;
      await pool.request()
        .input('projectId', sql.Int, projectId)
        .input('contractId', sql.Int, contractId || null)
        .input('senderId', sql.Int, senderId)
        .input('recipientId', sql.Int, finalRecipientId)
        .input('messageContent', sql.NVarChar, messageContent)
        .input('messageType', sql.VarChar, messageType || 'TEXT')
        .input('isRead', sql.Bit, 0)
        .query(`
          INSERT INTO messages (project_id, contract_id, sender_id, recipient_id, message_content, message_type, is_read, sent_at)
          VALUES (@projectId, @contractId, @senderId, @recipientId, @messageContent, @messageType, @isRead, SYSUTCDATETIME())
        `);

      // Broadcast to room members
      io.to(room).emit('receive_message', {
        project_id: projectId,
        contract_id: contractId || null,
        sender_id: senderId,
        recipient_id: finalRecipientId,
        message_content: messageContent,
        message_type: messageType || 'TEXT',
        is_read: false,
        sent_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Socket message save error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
    if (socket.userId) {
      const offlineTime = new Date();
      activeUsers.set(socket.userId, {
        socketId: null,
        lastSeen: offlineTime
      });
      
      io.emit('user_status_change', {
        userId: socket.userId,
        status: 'OFFLINE',
        lastSeen: offlineTime.toISOString()
      });
    }
  });
});

// Start listening and pre-warm db connection pool
server.listen(PORT, async () => {
  console.log(`============================================`);
  console.log(`🚀 FJMS Backend Server running on http://localhost:${PORT}`);
  console.log(`============================================`);
  
  try {
    // Warm up connection pool immediately on startup
    await poolPromise;
    // Initialize DB tables for Wallet Management
    await initDb();
  } catch (err) {
    console.error('❌ Failed to connect to SQL Server during server startup.');
  }
});
