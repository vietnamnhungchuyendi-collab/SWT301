import * as reportService from '../services/reportService.js';

/**
 * Report Controller
 * 
 * Production-grade controller layer.
 * Responsibilities:
 * - Authentication verification (req.user)
 * - Request validation
 * - Response formatting
 * - Error handling
 * 
 * NEVER calls the database directly - delegates to service layer.
 */

/**
 * POST /reports
 * Submit a new report
 * 
 * Request body (standardized):
 * {
 *   entityType: "PROJECT" | "USER" | "REVIEW" | "ORDER" | "MESSAGE",
 *   entityId: number,
 *   violationType: "FRAUD" | "HARASSMENT" | "SPAM" | "FAKE_PROFILE" | "INAPPROPRIATE_CONTENT" | "COPYRIGHT" | "OTHER",
 *   description: string
 * }
 * 
 * NOT allowed: ownerId, projectId, target_user_id
 */
export const createReport = async (req, res) => {
  try {
    const reporterId = req.user?.id;
    const { entityType, entityId, violationType, description } = req.body;

    // Validate required fields
    if (!entityType) {
      return res.status(400).json({ message: 'entityType is required.' });
    }
    if (!entityId) {
      return res.status(400).json({ message: 'entityId is required.' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ message: 'description is required.' });
    }

    const result = await reportService.createNewReport({
      reporterId,
      entityType,
      entityId,
      violationType,
      description
    });

    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(201).json({
      success: true,
      report: {
        id: result.data.reportId,
        status: result.data.status,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating report:', error);
    return res.status(500).json({ message: 'Failed to submit report. Please try again.' });
  }
};

/**
 * GET /admin/reports
 * Admin: list reports with enriched context
 */
export const getReports = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      entity_type: req.query.entity_type,
      violation_type: req.query.violation_type,
      search: req.query.search,
      limit: Math.min(parseInt(req.query.limit, 10) || 25, 100),
      offset: parseInt(req.query.offset, 10) || 0
    };

    const result = await reportService.getAdminReportsList(filters, req.user?.id);

    return res.json({
      success: true,
      total: result.total,
      reports: result.reports
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return res.status(500).json({ message: 'Failed to fetch reports.' });
  }
};

/**
 * GET /admin/reports/:id
 * Admin: get detailed report with full context and history
 */
export const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await reportService.getReportDetails(id);

    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.json({
      success: true,
      report: result.data
    });
  } catch (error) {
    console.error('Error fetching report detail:', error);
    return res.status(500).json({ message: 'Failed to fetch report details.' });
  }
};

/**
 * PATCH /admin/reports/:id/resolve
 * Admin: resolve a report
 */
export const patchResolveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;
    const { note, action, decision } = req.body;

    const result = await reportService.resolveReport(id, adminId, action || 'RESOLVE', note, decision);

    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.json({
      success: true,
      data: {
        reportId: result.data.reportId,
        status: result.data.status
      }
    });
  } catch (error) {
    console.error('Error resolving report:', error);
    return res.status(500).json({ message: 'Failed to resolve report.' });
  }
};


/**
 * PATCH /admin/reports/:id/dismiss
 * Admin: dismiss a report
 */
export const patchDismissReport = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;
    const { note } = req.body;

    const result = await reportService.dismissReport(id, adminId, note);

    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.json({
      success: true,
      data: {
        reportId: result.data.reportId,
        status: result.data.status
      }
    });
  } catch (error) {
    console.error('Error dismissing report:', error);
    return res.status(500).json({ message: 'Failed to dismiss report.' });
  }
};

/**
 * PATCH /admin/reports/:id/review
 * Admin: put report under review
 */
export const patchReviewReport = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;

    const result = await reportService.reviewReport(id, adminId);

    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.json({
      success: true,
      data: {
        reportId: result.data.reportId,
        status: result.data.status
      }
    });
  } catch (error) {
    console.error('Error marking report as under review:', error);
    return res.status(500).json({ message: 'Failed to update report status.' });
  }
};

/**
 * GET /reports/my
 * Get current user's reports
 */
export const getMyReports = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { status, limit, offset } = req.query;

    const result = await reportService.getMyReports(userId, { status, limit, offset });

    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.json({
      success: true,
      total: result.total,
      reports: result.reports
    });
  } catch (error) {
    console.error('Error fetching my reports:', error);
    return res.status(500).json({ message: 'Failed to fetch your reports.' });
  }
};

/**
 * POST /reports/:id/evidence
 * Add evidence to a report
 */
export const addEvidence = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { fileUrl, fileType, fileName, fileSize } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ message: 'fileUrl is required.' });
    }
    if (!fileType) {
      return res.status(400).json({ message: 'fileType is required.' });
    }

    const result = await reportService.addEvidence({
      reportId: id,
      userId,
      fileUrl,
      fileType,
      fileName,
      fileSize
    });

    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.status(201).json({
      success: true,
      evidence: { id: result.data.id }
    });
  } catch (error) {
    console.error('Error adding evidence:', error);
    return res.status(500).json({ message: 'Failed to add evidence.' });
  }
};

/**
 * PATCH /admin/reports/:id/reopen
 * Admin: reopen a resolved/dismissed report
 */
export const patchReopenReport = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;
    const { note } = req.body;

    const result = await reportService.reopenReport(id, adminId, note);

    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.json({
      success: true,
      data: {
        reportId: result.data.reportId,
        status: result.data.status
      }
    });
  } catch (error) {
    console.error('Error reopening report:', error);
    return res.status(500).json({ message: 'Failed to reopen report.' });
  }
};

/**
 * POST /reports/upload-evidence-images
 * Upload evidence images and return their public URLs
 * Supports up to 5 images at once
 */
export const uploadEvidenceImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded.' });
    }

    // Build base URL for uploaded files
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    const uploadedImages = req.files.map(file => ({
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      url: `${baseUrl}/uploads/evidence/${file.filename}`
    }));

    return res.status(200).json({
      success: true,
      images: uploadedImages
    });
  } catch (error) {
    console.error('Error uploading evidence images:', error);
    return res.status(500).json({ message: 'Failed to upload images. Please try again.' });
  }
};