import * as recommendationService from '../services/recommendationService.js';

export const getProjectRecommendations = async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Mã dự án không hợp lệ.'
      });
    }

    const recommendations = await recommendationService.getRecommendations(projectId);

    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    if (error.message === 'PROJECT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy dự án.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi tạo đề xuất freelancer.'
    });
  }
};

export const getFreelancerRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const recommendations = await recommendationService.getProjectRecommendationsForFreelancer(userId);

    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error getting project recommendations for freelancer:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi tìm dự án phù hợp.'
    });
  }
};