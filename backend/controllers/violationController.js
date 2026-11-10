import * as violationService from '../services/violationService.js';

export const getViolations = async (req, res) => {
  try {
    const { search, report_type, status, page = 1, limit = 10 } = req.query;

    const data = await violationService.getViolations({
      search,
      reportType: report_type,
      status,
      page,
      limit
    });

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching violations:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi lấy danh sách báo cáo vi phạm.'
    });
  }
};

export const getViolationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const violationId = parseInt(id, 10);
    if (isNaN(violationId)) {
      return res.status(400).json({
        success: false,
        message: 'Mã báo cáo vi phạm không hợp lệ.'
      });
    }

    const data = await violationService.getViolationDetails(violationId);
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching violation details:', error);
    if (error.message === 'VIOLATION_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy báo cáo vi phạm này.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi lấy chi tiết báo cáo vi phạm.'
    });
  }
};

export const resolveViolation = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const violationId = parseInt(id, 10);
    if (isNaN(violationId)) {
      return res.status(400).json({
        success: false,
        message: 'Mã báo cáo vi phạm không hợp lệ.'
      });
    }

    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'Hành động xử lý vi phạm là bắt buộc.'
      });
    }

    await violationService.resolveViolation(violationId, action);
    res.json({
      success: true,
      message: 'Xử lý báo cáo vi phạm thành công.'
    });
  } catch (error) {
    console.error('Error resolving violation:', error);
    if (error.message === 'VIOLATION_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy báo cáo vi phạm này.'
      });
    }
    if (error.message === 'VIOLATION_ALREADY_PROCESSED') {
      return res.status(400).json({
        success: false,
        message: 'Báo cáo vi phạm này đã được xử lý từ trước.'
      });
    }
    if (error.message === 'INVALID_ACTION') {
      return res.status(400).json({
        success: false,
        message: 'Hành động xử lý không hợp lệ.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi xử lý báo cáo vi phạm.'
    });
  }
};

export const dismissViolation = async (req, res) => {
  try {
    const { id } = req.params;
    const violationId = parseInt(id, 10);
    if (isNaN(violationId)) {
      return res.status(400).json({
        success: false,
        message: 'Mã báo cáo vi phạm không hợp lệ.'
      });
    }

    await violationService.dismissViolation(violationId);
    res.json({
      success: true,
      message: 'Bác bỏ báo cáo vi phạm thành công.'
    });
  } catch (error) {
    console.error('Error dismissing violation:', error);
    if (error.message === 'VIOLATION_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy báo cáo vi phạm này.'
      });
    }
    if (error.message === 'VIOLATION_ALREADY_PROCESSED') {
      return res.status(400).json({
        success: false,
        message: 'Báo cáo vi phạm này đã được xử lý từ trước.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi bác bỏ báo cáo vi phạm.'
    });
  }
};

export const createViolationReport = async (req, res) => {
  try {
    const reporterId = req.user.id;
    const { reportedUserId, projectId, messageId, reviewId, reportType, reason } = req.body;

    if (!reportedUserId || !reportType || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin báo cáo (người bị báo cáo, loại vi phạm và lý do).'
      });
    }

    await violationService.createViolationReport({
      reporterId,
      reportedUserId,
      projectId,
      messageId,
      reviewId,
      reportType,
      reason
    });

    res.status(201).json({
      success: true,
      message: 'Gửi báo cáo vi phạm thành công. Admin sẽ xem xét và xử lý.'
    });
  } catch (error) {
    console.error('Error creating violation report:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi gửi báo cáo vi phạm.'
    });
  }
};
