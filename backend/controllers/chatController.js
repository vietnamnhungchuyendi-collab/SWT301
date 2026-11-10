import { sql, poolPromise } from '../config/db.js';

/**
 * Get all conversations for the logged-in user
 */
export const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;

    // 1. Fetch user role
    const userResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT role_default FROM users WHERE user_id = @userId');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin người dùng.' });
    }

    // Support role query parameter or fallback to database default
    const role = (req.query.role || userResult.recordset[0].role_default).toUpperCase();
    const conversations = [];

    if (role === 'EMPLOYER') {
      // Get all projects created by this Employer
      const projectsResult = await pool.request()
        .input('employerId', sql.Int, userId)
        .query('SELECT project_id, title FROM projects WHERE employer_id = @employerId');

      for (const project of projectsResult.recordset) {
        const projectId = project.project_id;
        const projectTitle = project.title;

        // Find all candidates who applied (1-1 candidates)
        const proposalsResult = await pool.request()
          .input('projectId', sql.Int, projectId)
          .query(`
            SELECT p.freelancer_id, u.full_name as freelancer_name, u.avatar_url, p.status, c.contract_id
            FROM proposals p
            JOIN users u ON p.freelancer_id = u.user_id
            LEFT JOIN contracts c ON p.project_id = c.project_id AND p.freelancer_id = c.freelancer_id
            WHERE p.project_id = @projectId
          `);

        for (const candidate of proposalsResult.recordset) {
          // Find last message
          const lastMsgResult = await pool.request()
            .input('projectId', sql.Int, projectId)
            .input('freelancerId', sql.Int, candidate.freelancer_id)
            .input('employerId', sql.Int, userId)
            .query(`
              SELECT TOP 1 message_content, sent_at, sender_id
              FROM messages
              WHERE project_id = @projectId 
                AND (
                  (sender_id = @employerId AND recipient_id = @freelancerId) OR
                  (sender_id = @freelancerId AND recipient_id = @employerId)
                )
              ORDER BY sent_at DESC
            `);

          const lastMsg = lastMsgResult.recordset[0] || null;

          // Find unread count
          const unreadResult = await pool.request()
            .input('projectId', sql.Int, projectId)
            .input('freelancerId', sql.Int, candidate.freelancer_id)
            .input('employerId', sql.Int, userId)
            .query(`
              SELECT COUNT(1) as unread_count
              FROM messages
              WHERE project_id = @projectId
                AND sender_id = @freelancerId
                AND recipient_id = @employerId
                AND is_read = 0
            `);
          const unreadCount = unreadResult.recordset[0]?.unread_count || 0;

          conversations.push({
            id: `direct-${projectId}-${candidate.freelancer_id}`,
            projectId,
            projectName: projectTitle,
            type: 'DIRECT',
            partnerId: candidate.freelancer_id,
            name: candidate.freelancer_name,
            avatarUrl: candidate.avatar_url,
            status: candidate.status,
            contractId: candidate.contract_id,
            lastMessage: lastMsg ? lastMsg.message_content : 'Chưa có tin nhắn nào',
            lastMessageTime: lastMsg ? lastMsg.sent_at : null,
            lastMessageSender: lastMsg ? lastMsg.sender_id : null,
            unreadCount
          });
        }

        // Check if there are active contracts to show a Group Chat option
        const activeContractsResult = await pool.request()
          .input('projectId', sql.Int, projectId)
          .query('SELECT COUNT(1) as active_count FROM contracts WHERE project_id = @projectId AND status = \'ACTIVE\'');

        if (activeContractsResult.recordset[0].active_count > 0) {
          // Find last group message
          const lastGroupMsgResult = await pool.request()
            .input('projectId', sql.Int, projectId)
            .query(`
              SELECT TOP 1 message_content, sent_at, sender_id
              FROM messages
              WHERE project_id = @projectId AND contract_id IS NULL AND recipient_id IS NULL
              ORDER BY sent_at DESC
            `);

          const lastGroupMsg = lastGroupMsgResult.recordset[0] || null;

          conversations.push({
            id: `group-${projectId}`,
            projectId,
            projectName: projectTitle,
            type: 'GROUP',
            name: `Nhóm: ${projectTitle}`,
            avatarUrl: null,
            lastMessage: lastGroupMsg ? lastGroupMsg.message_content : 'Chưa có tin nhắn nhóm nào',
            lastMessageTime: lastGroupMsg ? lastGroupMsg.sent_at : null,
            lastMessageSender: lastGroupMsg ? lastGroupMsg.sender_id : null,
            unreadCount: 0
          });
        }
      }
    } else {
      // USER IS A FREELANCER
      // Get all projects where this freelancer submitted a proposal
      const freelancerProposals = await pool.request()
        .input('freelancerId', sql.Int, userId)
        .query(`
          SELECT p.project_id, p.status as proposal_status, pr.title as project_title, pr.employer_id, u.full_name as employer_name, u.avatar_url, c.contract_id
          FROM proposals p
          JOIN projects pr ON p.project_id = pr.project_id
          JOIN users u ON pr.employer_id = u.user_id
          LEFT JOIN contracts c ON pr.project_id = c.project_id AND p.freelancer_id = c.freelancer_id
          WHERE p.freelancer_id = @freelancerId
        `);

      for (const proposal of freelancerProposals.recordset) {
        const projectId = proposal.project_id;
        const projectTitle = proposal.project_title;
        const employerId = proposal.employer_id;
        const employerName = proposal.employer_name;
        const employerAvatar = proposal.avatar_url;

        // Last 1-1 message with employer
        const lastMsgResult = await pool.request()
          .input('projectId', sql.Int, projectId)
          .input('freelancerId', sql.Int, userId)
          .input('employerId', sql.Int, employerId)
          .query(`
            SELECT TOP 1 message_content, sent_at, sender_id
            FROM messages
            WHERE project_id = @projectId 
              AND (
                (sender_id = @freelancerId AND recipient_id = @employerId) OR
                (sender_id = @employerId AND recipient_id = @freelancerId)
              )
            ORDER BY sent_at DESC
          `);

        const lastMsg = lastMsgResult.recordset[0] || null;

        // Option B: Only display to freelancer if Employer has messaged first OR proposal is accepted/shortlisted
        const isHiredOrShortlisted = proposal.proposal_status === 'ACCEPTED' || proposal.proposal_status === 'SHORTLISTED';
        if (!lastMsg && !isHiredOrShortlisted) {
          continue; // Skip this conversation
        }

        // Find unread count
        const unreadResult = await pool.request()
          .input('projectId', sql.Int, projectId)
          .input('freelancerId', sql.Int, userId)
          .input('employerId', sql.Int, employerId)
          .query(`
            SELECT COUNT(1) as unread_count
            FROM messages
            WHERE project_id = @projectId
              AND sender_id = @employerId
              AND recipient_id = @freelancerId
              AND is_read = 0
          `);
        const unreadCount = unreadResult.recordset[0]?.unread_count || 0;

        conversations.push({
          id: `direct-${projectId}-${userId}`,
          projectId,
          projectName: projectTitle,
          type: 'DIRECT',
          partnerId: employerId,
          name: employerName,
          avatarUrl: employerAvatar,
          contractId: proposal.contract_id,
          lastMessage: lastMsg ? lastMsg.message_content : 'Chưa có tin nhắn nào',
          lastMessageTime: lastMsg ? lastMsg.sent_at : null,
          lastMessageSender: lastMsg ? lastMsg.sender_id : null,
          unreadCount
        });

        // Group Chat if hired (active contract)
        const activeContractCheck = await pool.request()
          .input('projectId', sql.Int, projectId)
          .input('freelancerId', sql.Int, userId)
          .query('SELECT contract_id FROM contracts WHERE project_id = @projectId AND freelancer_id = @freelancerId AND status = \'ACTIVE\'');

        if (activeContractCheck.recordset.length > 0) {
          // Last group message
          const lastGroupMsgResult = await pool.request()
            .input('projectId', sql.Int, projectId)
            .query(`
              SELECT TOP 1 message_content, sent_at, sender_id
              FROM messages
              WHERE project_id = @projectId AND contract_id IS NULL AND recipient_id IS NULL
              ORDER BY sent_at DESC
            `);

          const lastGroupMsg = lastGroupMsgResult.recordset[0] || null;

          conversations.push({
            id: `group-${projectId}`,
            projectId,
            projectName: projectTitle,
            type: 'GROUP',
            name: `Nhóm: ${projectTitle}`,
            avatarUrl: null,
            lastMessage: lastGroupMsg ? lastGroupMsg.message_content : 'Chưa có tin nhắn nhóm nào',
            lastMessageTime: lastGroupMsg ? lastGroupMsg.sent_at : null,
            lastMessageSender: lastGroupMsg ? lastGroupMsg.sender_id : null,
            unreadCount: 0
          });
        }
      }
    }

    res.json({ success: true, conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách cuộc trò chuyện.' });
  }
};

/**
 * Get all messages for a specific conversation
 */
export const getMessages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { type, partnerId } = req.query; // type: 'DIRECT' or 'GROUP'
    const userId = req.user.id;

    if (!type) {
      return res.status(400).json({ message: 'Thiếu tham số type (DIRECT hoặc GROUP).' });
    }

    const pool = await poolPromise;
    let queryStr = '';
    const request = pool.request().input('projectId', sql.Int, projectId);

    if (type === 'GROUP') {
      // Fetch all group messages for this project
      queryStr = `
        SELECT m.*, u.full_name as sender_name, u.avatar_url as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.user_id
        WHERE m.project_id = @projectId AND m.contract_id IS NULL AND m.recipient_id IS NULL
        ORDER BY m.sent_at ASC
      `;
    } else {
      // 1-1 Direct message: filter by sender/recipient
      const otherUserId = parseInt(partnerId);
      if (!otherUserId) {
        return res.status(400).json({ message: 'Thiếu partnerId cho hội thoại 1-1.' });
      }

      request.input('userId', sql.Int, userId);
      request.input('otherUserId', sql.Int, otherUserId);

      queryStr = `
        SELECT m.*, u.full_name as sender_name, u.avatar_url as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.user_id
        WHERE m.project_id = @projectId
          AND (
            (m.sender_id = @userId AND m.recipient_id = @otherUserId) OR
            (m.sender_id = @otherUserId AND m.recipient_id = @userId)
          )
        ORDER BY m.sent_at ASC
      `;
    }

    const result = await request.query(queryStr);
    res.json({ success: true, messages: result.recordset });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy lịch sử tin nhắn.' });
  }
};

/**
 * Send a message (Fallback HTTP endpoint if socket is not connected)
 */
export const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { projectId, contractId, messageContent, messageType, recipientId } = req.body;

    if (!projectId || !messageContent) {
      return res.status(400).json({ message: 'Thiếu thông tin dự án hoặc nội dung tin nhắn.' });
    }

    const pool = await poolPromise;
    await pool.request()
      .input('projectId', sql.Int, projectId)
      .input('contractId', sql.Int, contractId || null)
      .input('senderId', sql.Int, senderId)
      .input('recipientId', sql.Int, recipientId || null)
      .input('messageContent', sql.NVarChar, messageContent)
      .input('messageType', sql.VarChar, messageType || 'TEXT')
      .input('isRead', sql.Bit, 0)
      .query(`
        INSERT INTO messages (project_id, contract_id, sender_id, recipient_id, message_content, message_type, is_read, sent_at)
        VALUES (@projectId, @contractId, @senderId, @recipientId, @messageContent, @messageType, @isRead, SYSUTCDATETIME())
      `);

    res.status(201).json({ success: true, message: 'Gửi tin nhắn thành công!' });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Lỗi server khi gửi tin nhắn.' });
  }
};

/**
 * Mark messages in a conversation as read
 */
export const markMessagesAsRead = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { partnerId } = req.body;
    const userId = req.user.id;

    if (!projectId) {
      return res.status(400).json({ message: 'Thiếu projectId.' });
    }

    const pool = await poolPromise;
    
    if (partnerId) {
      // Direct message: mark messages from partner to user as read
      await pool.request()
        .input('projectId', sql.Int, projectId)
        .input('partnerId', sql.Int, partnerId)
        .input('userId', sql.Int, userId)
        .query(`
          UPDATE messages
          SET is_read = 1
          WHERE project_id = @projectId
            AND sender_id = @partnerId
            AND recipient_id = @userId
            AND is_read = 0
        `);
    } else {
      // Group or general project messages
      await pool.request()
        .input('projectId', sql.Int, projectId)
        .input('userId', sql.Int, userId)
        .query(`
          UPDATE messages
          SET is_read = 1
          WHERE project_id = @projectId
            AND recipient_id = @userId
            AND is_read = 0
        `);
    }

    res.json({ success: true, message: 'Đã đánh dấu tin nhắn là đã đọc.' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Lỗi server khi đánh dấu tin nhắn đã đọc.' });
  }
};

