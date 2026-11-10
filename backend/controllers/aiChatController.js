import * as aiChatService from '../services/aiChatService.js';

export const getSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const sessions = await aiChatService.getSessions(userId);
    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Error fetching AI chat sessions:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi lấy danh sách phiên chat.' });
  }
};

export const createSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const session = await aiChatService.createNewSession(userId);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error('Error creating AI chat session:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi tạo phiên chat mới.' });
  }
};

export const getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = parseInt(req.params.id, 10);

    if (isNaN(sessionId)) {
      return res.status(400).json({ success: false, message: 'Mã phiên chat không hợp lệ.' });
    }

    const messages = await aiChatService.getMessages(sessionId, userId);
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Error fetching AI chat messages:', error);
    if (error.message === 'SESSION_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiên chat.' });
    }
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi lấy tin nhắn.' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role || req.user.roleDefault || 'FREELANCER';
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ success: false, message: 'Thiếu sessionId hoặc nội dung tin nhắn.' });
    }

    const parsedSessionId = parseInt(sessionId, 10);
    if (isNaN(parsedSessionId)) {
      return res.status(400).json({ success: false, message: 'Mã phiên chat không hợp lệ.' });
    }

    const result = await aiChatService.processChatMessage(parsedSessionId, message, userId, userRole);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error processing AI chat message:', error);
    if (error.message === 'SESSION_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiên chat.' });
    }
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xử lý tin nhắn.' });
  }
};

export const deleteSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = parseInt(req.params.id, 10);

    if (isNaN(sessionId)) {
      return res.status(400).json({ success: false, message: 'Mã phiên chat không hợp lệ.' });
    }

    await aiChatService.deleteExistingSession(sessionId, userId);
    res.json({ success: true, message: 'Xóa phiên chat thành công.' });
  } catch (error) {
    console.error('Error deleting AI chat session:', error);
    if (error.message === 'SESSION_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiên chat.' });
    }
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xóa phiên chat.' });
  }
};