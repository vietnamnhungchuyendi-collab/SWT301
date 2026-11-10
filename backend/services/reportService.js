import {
  fetchReports,
  getReportById,
  updateReportStatus,
  createReport,
  findDuplicateReport,
  getProjectOwner,
  getUserById,
  createEvidence,
  getEvidenceByReportId,
  getMyReports as getMyReportsRepo
} from '../repositories/reportRepository.js';
import { createModerationLog, getModerationHistory } from '../repositories/moderationRepository.js';
import { checkRateLimit, initRedis } from '../utils/redisClient.js';

/**
 * Report Service — Production Grade
 * 
 * Responsibilities:
 * - Ownership validation (server-side, never trust client)
 * - Redis-based rate limiting (with in-memory fallback)
 * - Duplicate detection with time window
 * - Moderation workflow with audit trail
 * - Evidence management
 * - Input sanitization & XSS prevention
 * - User notification on report status change
 */

const ALLOWED_ENTITY_TYPES = ['PROJECT', 'USER', 'REVIEW', 'ORDER', 'MESSAGE'];
const ALLOWED_VIOLATION_TYPES = [
  'FRAUD', 'HARASSMENT', 'SPAM', 'FAKE_PROFILE',
  'INAPPROPRIATE_CONTENT', 'COPYRIGHT', 'OTHER'
];
const ALLOWED_STATUS_TRANSITIONS = {
  'PENDING': ['UNDER_REVIEW', 'RESOLVED', 'DISMISSED'],
  'UNDER_REVIEW': ['RESOLVED', 'DISMISSED', 'PENDING'],
  'RESOLVED': ['PENDING'],
  'DISMISSED': ['PENDING']
};
const MAX_DESCRIPTION_LENGTH = 5000;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60; // seconds

// Init Redis on startup (non-blocking)
initRedis().catch(() => { });

/**
 * Sanitize description text (XSS prevention)
 */
const sanitizeDescription = (text) => {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();
  cleaned = cleaned.replace(/<[^>]*>/g, '');  // Strip HTML
  cleaned = cleaned.replace(/\s+/g, ' ');       // Normalize whitespace
  if (cleaned.length > MAX_DESCRIPTION_LENGTH) {
    cleaned = cleaned.substring(0, MAX_DESCRIPTION_LENGTH);
  }
  return cleaned;
};

const normalizeEntityType = (type) => {
  if (!type || typeof type !== 'string') return null;
  const normalized = type.trim().toUpperCase();
  return ALLOWED_ENTITY_TYPES.includes(normalized) ? normalized : null;
};

const normalizeViolationType = (type) => {
  if (!type || typeof type !== 'string') return 'OTHER';
  const normalized = type.trim().toUpperCase();
  return ALLOWED_VIOLATION_TYPES.includes(normalized) ? normalized : 'OTHER';
};

const parseMetadata = (metadata) => {
  if (!metadata) return null;
  try {
    return typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
  } catch {
    return null;
  }
};

// ============================================================================
// PUBLIC API
// ============================================================================

export const listReports = async (filters) => {
  return fetchReports(filters);
};

/**
 * Get detailed report with moderation history
 */
export const getReportDetails = async (reportId) => {
  const report = await getReportById(reportId);
  if (!report) {
    return { status: 404, error: 'Report not found.' };
  }

  const history = await getModerationHistory(reportId);
  const evidence = await getEvidenceByReportId(reportId);

  const enriched = {
    id: report.report_id,
    target: {
      type: report.entity_type,
      id: report.entity_id,
      title: report.entity_title || null,
      description: report.entity_description || null
    },
    owner: report.owner_id ? {
      id: report.owner_user_id,
      username: report.owner_name,
      email: report.owner_email,
      avatar: report.owner_avatar
    } : null,
    reporter: {
      id: report.reporter_user_id,
      username: report.reporter_name,
      email: report.reporter_email,
      avatar: report.reporter_avatar
    },
    violation: {
      type: report.violation_type || report.report_type,
      description: report.description
    },
    evidence: evidence.map(e => ({
      id: e.id,
      fileUrl: e.file_url,
      fileType: e.file_type,
      fileName: e.file_name,
      uploadedBy: e.uploaded_by,
      createdAt: e.created_at
    })),
    status: report.status,
    metadata: report.metadata ? parseMetadata(report.metadata) : null,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
    resolvedAt: report.resolved_at,
    contract_id: report.contract_id || null,
    total_amount: report.total_amount || null,
    escrow_status: report.escrow_status || null,
    project_deadline: report.project_deadline || null,
    project_status: report.project_status || null,
    freelancer_name: report.freelancer_name || null,
    submission_description: report.submission_description || null,
    submission_file_url: report.submission_file_url || null,
    submission_created_at: report.submission_created_at || null,
    history: history.map(h => ({
      id: h.id,
      admin: { id: h.admin_id, name: h.admin_name, avatar: h.admin_avatar },
      action: h.action,
      note: h.note,
      fromStatus: h.old_status,
      toStatus: h.new_status,
      timestamp: h.created_at
    }))
  };

  return { status: 200, data: enriched };
};



/**
 * Create new report — NEVER trusts client-provided ownerId
 */
export const createNewReport = async ({ reporterId, entityType, entityId, violationType, description }) => {
  // 1. Validate reporter
  if (!reporterId) {
    return { status: 401, error: 'Authentication required.' };
  }

  // 2. Rate limiting (Redis with in-memory fallback)
  const rateLimitResult = await checkRateLimit(
    `report:user:${reporterId}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW
  );
  if (!rateLimitResult.allowed) {
    return {
      status: 429,
      error: `Too many requests. Please wait ${rateLimitResult.resetIn} seconds before submitting again.`
    };
  }

  // 3. Validate entity type
  const normalizedType = normalizeEntityType(entityType);
  if (!normalizedType) {
    return { status: 400, error: `Invalid entity type. Allowed: ${ALLOWED_ENTITY_TYPES.join(', ')}` };
  }

  // 4. Validate entity ID
  const parsedEntityId = parseInt(entityId, 10);
  if (!parsedEntityId || parsedEntityId <= 0) {
    return { status: 400, error: 'Valid entity ID is required.' };
  }

  // 5. Normalize violation type
  const normalizedViolationType = normalizeViolationType(violationType);

  // 6. Sanitize description
  const sanitizedDescription = sanitizeDescription(description);
  if (!sanitizedDescription) {
    return { status: 400, error: 'Description is required and cannot be empty.' };
  }

  // 7. Self-report check
  if (normalizedType === 'USER' && parsedEntityId === Number(reporterId)) {
    return { status: 400, error: 'You cannot report yourself.' };
  }

  // 8. OWNERSHIP VALIDATION — never trust client
  let resolvedOwnerId = null;
  if (normalizedType === 'PROJECT') {
    const project = await getProjectOwner(parsedEntityId);
    if (!project) return { status: 404, error: 'Project not found.' };
    resolvedOwnerId = project.owner_id;
  } else if (normalizedType === 'USER') {
    const targetUser = await getUserById(parsedEntityId);
    if (!targetUser) return { status: 404, error: 'Target user not found.' };
    resolvedOwnerId = parsedEntityId; // Với tài khoản bị báo cáo, owner chính là target user
  }

  // 9. Duplicate detection
  const duplicate = await findDuplicateReport({
    reporterId,
    entityType: normalizedType,
    entityId: parsedEntityId,
    violationType: normalizedViolationType,
    withinDays: 7
  });

  if (duplicate) {
    return {
      status: 409,
      error: `You have already submitted a similar report for this ${normalizedType.toLowerCase()} within the last 7 days. Existing report status: ${duplicate.status}.`
    };
  }

  // 10. Create report
  const reportId = await createReport({
    reporterId,
    entityType: normalizedType,
    entityId: parsedEntityId,
    ownerId: resolvedOwnerId,
    violationType: normalizedViolationType,
    description: sanitizedDescription,
    metadata: null
  });

  return { status: 201, data: { reportId, status: 'PENDING' } };
};

// ============================================================================
// USER MY REPORTS
// ============================================================================

/**
 * Get reports submitted by the current user (no admin notes exposed)
 */
export const getMyReports = async (userId, filters = {}) => {
  if (!userId) {
    return { status: 401, error: 'Authentication required.' };
  }

  const result = await getMyReportsRepo(userId, filters);

  // Strip internal data - only return what user should see
  const safeReports = result.reports.map(r => ({
    id: r.report_id,
    target: {
      type: r.entity_type,
      id: r.entity_id,
      title: r.entity_title || null
    },
    violationType: r.violation_type || r.report_type,
    description: r.description,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));

  return {
    total: result.total,
    reports: safeReports
  };
};

// ============================================================================
// EVIDENCE
// ============================================================================

/**
 * Add evidence to a report
 */
export const addEvidence = async ({ reportId, userId, fileUrl, fileType, fileName, fileSize }) => {
  // Validate report exists
  const report = await getReportById(reportId);
  if (!report) {
    return { status: 404, error: 'Report not found.' };
  }

  // Only reporter or admin can add evidence
  const isReporter = Number(report.reporter_id) === Number(userId);
  // Admin check would be done at controller level via verifyAdmin
  if (!isReporter) {
    return { status: 403, error: 'Only the reporter or an admin can add evidence to this report.' };
  }

  // Validate file type
  const allowedTypes = ['IMAGE', 'DOCUMENT', 'URL', 'OTHER'];
  const normalizedType = (fileType || '').toUpperCase();
  if (!allowedTypes.includes(normalizedType)) {
    return { status: 400, error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}` };
  }

  // Validate URL
  if (!fileUrl || typeof fileUrl !== 'string' || fileUrl.trim().length === 0) {
    return { status: 400, error: 'File URL is required.' };
  }

  const evidenceId = await createEvidence({
    reportId,
    userId,
    fileUrl: fileUrl.trim(),
    fileType: normalizedType,
    fileName: fileName || null,
    fileSize: fileSize || null
  });

  return { status: 201, data: { id: evidenceId } };
};

// ============================================================================
// MODERATION WORKFLOW
// ============================================================================

const moderationAction = async (reportId, adminId, action, newStatus, note) => {
  const report = await getReportById(reportId);
  if (!report) return { status: 404, error: 'Report not found.' };

  const allowedNextStatuses = ALLOWED_STATUS_TRANSITIONS[report.status] || [];
  if (!allowedNextStatuses.includes(newStatus)) {
    return {
      status: 400,
      error: `Cannot transition from '${report.status}' to '${newStatus}'. Allowed: ${allowedNextStatuses.join(', ') || 'none'}`
    };
  }

  const updated = await updateReportStatus(reportId, newStatus);
  if (!updated) return { status: 500, error: 'Failed to update report status.' };

  // Create audit log
  await createModerationLog({
    reportId,
    adminId,
    action,
    note: note || null,
    oldStatus: report.status,
    newStatus
  });

  // Notify reporter (without exposing internal note)
  if (newStatus === 'RESOLVED' || newStatus === 'DISMISSED') {
    await notifyReporter(report.reporter_id, reportId, newStatus);
  }

  return { status: 200, data: { reportId, status: newStatus } };
};

export const resolveReport = async (reportId, adminId, action, note, decision) => {
  const reportDetails = await getReportById(reportId);
  if (!reportDetails) {
    return { status: 404, error: 'Report not found.' };
  }

  // Handle Escrow payment/refund decision if specified
  if (decision && (decision === 'PAY_FREELANCER' || decision === 'REFUND_EMPLOYER')) {
    const { sql, poolPromise } = await import('../config/db.js');
    const pool = await poolPromise;

    if (reportDetails.entity_type !== 'PROJECT') {
      return { status: 400, error: 'Escrow decisions can only be applied to PROJECT entities.' };
    }

    const projectId = reportDetails.entity_id;

    // Check if there is an active contract and funded escrow
    const escrowRes = await pool.request()
      .input('projectId', sql.Int, projectId)
      .query("SELECT * FROM EscrowAccounts WHERE project_id = @projectId AND status = 'FUNDED'");

    if (escrowRes.recordset.length === 0) {
      return { status: 400, error: 'No active funded escrow found for this project.' };
    }

    const escrow = escrowRes.recordset[0];
    const contractRes = await pool.request()
      .input('projectId', sql.Int, projectId)
      .query("SELECT * FROM contracts WHERE project_id = @projectId AND status <> 'COMPLETED' AND status <> 'CANCELLED'");

    if (contractRes.recordset.length === 0) {
      return { status: 400, error: 'No active or processing contract found for this project.' };
    }


    const contract = contractRes.recordset[0];
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      if (decision === 'PAY_FREELANCER') {
        // Approve payment: Release money to freelancer (95%) and platform (5%)
        await transaction.request()
          .input('escrowId', sql.Int, escrow.escrow_id)
          .query("UPDATE EscrowAccounts SET status = 'RELEASED' WHERE escrow_id = @escrowId");

        await transaction.request()
          .input('escrowIdTr', sql.Int, escrow.escrow_id)
          .input('amountTr', sql.Decimal(18, 2), escrow.amount)
          .query("INSERT INTO EscrowTransactions (escrow_id, amount, type, status) VALUES (@escrowIdTr, @amountTr, 'RELEASE', 'COMPLETED')");

        // Find or create Freelancer Wallet
        const walletRes = await transaction.request()
          .input('freelancerId', sql.Int, contract.freelancer_id)
          .query("SELECT wallet_id FROM Wallet WHERE user_id = @freelancerId");

        let walletId;
        if (walletRes.recordset.length === 0) {
          const newWalletRes = await transaction.request()
            .input('freelancerId', sql.Int, contract.freelancer_id)
            .query("INSERT INTO Wallet (user_id, balance, created_at, updated_at) VALUES (@freelancerId, 0, GETDATE(), GETDATE()); SELECT SCOPE_IDENTITY() as wallet_id;");
          walletId = newWalletRes.recordset[0].wallet_id;
        } else {
          walletId = walletRes.recordset[0].wallet_id;
        }

        const escrowAmountNum = Number(escrow.amount);
        const serviceFee = escrowAmountNum * 0.05;
        const releaseAmount = escrowAmountNum - serviceFee;

        // Add funds to Freelancer Wallet (95%)
        await transaction.request()
          .input('walletId', sql.Int, walletId)
          .input('amount', sql.Decimal(18, 2), releaseAmount)
          .query("UPDATE Wallet SET balance = balance + @amount, updated_at = GETDATE() WHERE wallet_id = @walletId");

        // Insert WalletTransaction record for Freelancer (95%)
        await transaction.request()
          .input('walletIdF', sql.Int, walletId)
          .input('amountF', sql.Decimal(18, 2), releaseAmount)
          .input('descF', sql.NVarChar(255), `Giải ngân phán quyết tranh chấp (đã trừ 5% phí): ${contract.contract_title}`)
          .query("INSERT INTO WalletTransaction (wallet_id, transaction_type, amount, description) VALUES (@walletIdF, 'ESCROW_RELEASE', @amountF, @descF)");

        // Insert WalletTransaction record for Platform Service Fee (5%)
        await transaction.request()
          .input('walletIdP', sql.Int, walletId)
          .input('feeAmountP', sql.Decimal(18, 2), serviceFee)
          .input('descFeeP', sql.NVarChar(255), `Phí dịch vụ phán quyết tranh chấp (5%): ${contract.contract_title}`)
          .query("INSERT INTO WalletTransaction (wallet_id, transaction_type, amount, description) VALUES (@walletIdP, 'SERVICE_FEE', @feeAmountP, @descFeeP)");

        // Update contract status to COMPLETED
        await transaction.request()
          .input('contractId', sql.Int, contract.contract_id)
          .query("UPDATE contracts SET status = 'COMPLETED', completed_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME() WHERE contract_id = @contractId");

        // Update project status to COMPLETED
        await transaction.request()
          .input('projectId', sql.Int, projectId)
          .query("UPDATE projects SET status = 'COMPLETED', updated_at = SYSUTCDATETIME() WHERE project_id = @projectId");

      } else if (decision === 'REFUND_EMPLOYER') {
        // Refund employer: Refund 100% money back to Employer wallet
        await transaction.request()
          .input('escrowId', sql.Int, escrow.escrow_id)
          .query("UPDATE EscrowAccounts SET status = 'REFUNDED' WHERE escrow_id = @escrowId");

        await transaction.request()
          .input('escrowIdTr', sql.Int, escrow.escrow_id)
          .input('amountTr', sql.Decimal(18, 2), escrow.amount)
          .query("INSERT INTO EscrowTransactions (escrow_id, amount, type, status) VALUES (@escrowIdTr, @amountTr, 'REFUND', 'COMPLETED')");

        // Find or create Employer Wallet
        const walletRes = await transaction.request()
          .input('employerId', sql.Int, contract.employer_id)
          .query("SELECT wallet_id FROM Wallet WHERE user_id = @employerId");

        let walletId;
        if (walletRes.recordset.length === 0) {
          const newWalletRes = await transaction.request()
            .input('employerId', sql.Int, contract.employer_id)
            .query("INSERT INTO Wallet (user_id, balance, created_at, updated_at) VALUES (@employerId, 0, GETDATE(), GETDATE()); SELECT SCOPE_IDENTITY() as wallet_id;");
          walletId = newWalletRes.recordset[0].wallet_id;
        } else {
          walletId = walletRes.recordset[0].wallet_id;
        }

        const escrowAmountNum = Number(escrow.amount);

        // Refund funds to Employer Wallet (100%)
        await transaction.request()
          .input('walletId', sql.Int, walletId)
          .input('amount', sql.Decimal(18, 2), escrowAmountNum)
          .query("UPDATE Wallet SET balance = balance + @amount, updated_at = GETDATE() WHERE wallet_id = @walletId");

        // Insert WalletTransaction record for Employer (100%)
        await transaction.request()
          .input('walletIdE', sql.Int, walletId)
          .input('amountE', sql.Decimal(18, 2), escrowAmountNum)
          .input('descE', sql.NVarChar(255), `Hoàn trả ký quỹ phán quyết tranh chấp: ${contract.contract_title}`)
          .query("INSERT INTO WalletTransaction (wallet_id, transaction_type, amount, description) VALUES (@walletIdE, 'ESCROW_REFUND', @amountE, @descE)");

        // Update contract status to CANCELED
        await transaction.request()
          .input('contractId', sql.Int, contract.contract_id)
          .query("UPDATE contracts SET status = 'CANCELED', completed_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME() WHERE contract_id = @contractId");

        // Update project status to CANCELED
        await transaction.request()
          .input('projectId', sql.Int, projectId)
          .query("UPDATE projects SET status = 'CANCELED', updated_at = SYSUTCDATETIME() WHERE project_id = @projectId");
      }

      await transaction.commit();


    } catch (err) {
      await transaction.rollback();
      console.error('Failed to process financial decision transaction:', err);
      return { status: 500, error: 'Failed to process financial decision.' };
    }
  }

  return moderationAction(reportId, adminId, 'RESOLVE', 'RESOLVED', note);
};


export const dismissReport = async (reportId, adminId, note) => {
  return moderationAction(reportId, adminId, 'DISMISS', 'DISMISSED', note);
};

export const reviewReport = async (reportId, adminId) => {
  return moderationAction(reportId, adminId, 'REVIEW', 'UNDER_REVIEW', 'Moved to under review');
};

export const reopenReport = async (reportId, adminId, note) => {
  return moderationAction(reportId, adminId, 'REOPEN', 'PENDING', note || 'Report reopened for review');
};

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Notify reporter when their report is resolved/dismissed
 * Internal admin notes are NOT exposed to the user
 */
const notifyReporter = async (reporterId, reportId, status) => {
  try {
    const { createNotification } = await import('../repositories/reportRepository.js');
    const message = status === 'RESOLVED'
      ? `Your report #${reportId} has been reviewed and resolved. Thank you for helping keep our community safe.`
      : `Your report #${reportId} has been reviewed. Our team determined that no action is needed at this time.`;

    await createNotification({
      userId: reporterId,
      title: 'Cập nhật báo cáo',
      message,
      type: 'REPORT'
    });
  } catch (err) {
    console.error('Failed to send notification:', err.message);
    // Non-blocking - notification failure should not break the flow
  }
};

// ============================================================================
// ADMIN LISTING
// ============================================================================

export const getAdminReportsList = async (filters, requesterId) => {
  const result = await fetchReports(filters);

  const enrichedReports = await Promise.all(result.reports.map(async (report) => {
    const history = await getModerationHistory(report.report_id);
    const evidence = await getEvidenceByReportId(report.report_id);

    return {
      id: report.report_id,
      target: {
        type: report.entity_type,
        id: report.entity_id,
        title: report.entity_title || null
      },
      owner: report.owner_id ? {
        id: report.owner_user_id,
        username: report.owner_name,
        email: report.owner_email,
        avatar: report.owner_avatar
      } : null,
      reporter: {
        id: report.reporter_user_id,
        username: report.reporter_name,
        email: report.reporter_email,
        avatar: report.reporter_avatar
      },
      violation: {
        type: report.violation_type || report.report_type,
        description: report.description
      },
      evidence: evidence.map(e => ({
        id: e.id,
        fileUrl: e.file_url,
        fileType: e.file_type,
        fileName: e.file_name,
        createdAt: e.created_at
      })),
      status: report.status,
      createdAt: report.created_at,
      updatedAt: report.updated_at,
      freelancer_name: report.freelancer_name || null,
      project_deadline: report.project_deadline || null,
      project_status: report.project_status || null,
      has_submission: report.has_submission === 1,
      has_dispute: report.has_dispute === 1,
      history: history.map(h => ({
        id: h.id,
        admin: { id: h.admin_id, name: h.admin_name },
        action: h.action,
        note: h.note,
        fromStatus: h.old_status,
        toStatus: h.new_status,
        timestamp: h.created_at
      }))
    };
  }));

  return { total: result.total, reports: enrichedReports };
};
