import * as analyticsService from '../services/analyticsService.js';

export const getAdminAnalytics = async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const filters = {};

    if (period) {
      if (!['month', 'quarter', 'year'].includes(period)) {
        return res.status(400).json({
          success: false,
          message: 'Giá trị period không hợp lệ. Chấp nhận: month, quarter, year.'
        });
      }
      filters.period = period;
    } else if (startDate || endDate) {
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp cả startDate và endDate.'
        });
      }
      filters.startDate = new Date(startDate);
      filters.endDate = new Date(endDate);
      if (isNaN(filters.startDate.getTime()) || isNaN(filters.endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Định dạng ngày không hợp lệ. Sử dụng YYYY-MM-DD.'
        });
      }
    }

    const data = await analyticsService.getAnalytics(filters);
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi lấy dữ liệu thống kê.'
    });
  }
};