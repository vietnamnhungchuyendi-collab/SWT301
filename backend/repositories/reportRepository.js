import { sql, poolPromise } from '../config/db.js';

/**
 * Report Repository
 * 
 * Production-grade data access layer.
 * ONLY responsible for database operations - no business logic.
 */

const ALLOWED_ENTITY_TYPES = ['PROJECT', 'USER', 'REVIEW', 'ORDER', 'MESSAGE'];
const ALLOWED_STATUSES = ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'];
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

const toInt = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const toPositiveInt = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

const normalizeText = (value) => (value == null ? null : String(value).trim());

const buildListFilters = ({ status, entity_type, violation_type, search }) => {
  const clauses = [];
  const params = {};

  if (status && ALLOWED_STATUSES.includes(status.toUpperCase())) {
    clauses.push('vr.status = @status');
    params.status = { type: sql.VarChar(50), value: status.toUpperCase() };
  }

  if (entity_type && ALLOWED_ENTITY_TYPES.includes(entity_type.toUpperCase())) {
    clauses.push('vr.entity_type = @entityType');
    params.entityType = { type: sql.VarChar(50), value: entity_type.toUpperCase() };
  }

  if (violation_type) {
    clauses.push('vr.violation_type = @violationType');
    params.violationType = { type: sql.VarChar(100), value: violation_type.trim() };
  }

  if (search && typeof search === 'string' && search.trim()) {
    const searchPattern = `%${search.trim()}%`;
    clauses.push(`(
      rep.full_name LIKE @search OR 
      own.full_name LIKE @search OR 
      p.title LIKE @search OR 
      vr.description LIKE @search OR 
      vr.violation_type LIKE @search
    )`);
    params.search = { type: sql.NVarChar(255), value: searchPattern };
  }

  return {
    whereSql: clauses.length > 0 ? 'WHERE ' + clauses.join(' AND ') : '',
    params
  };
};

// ============================================================================
// CORE CRUD
// ============================================================================

export const fetchReports = async ({ status, entity_type, violation_type, search, limit = 25, offset = 0 }) => {
  const pool = await poolPromise;
  const { whereSql, params } = buildListFilters({ status, entity_type, violation_type, search });

  const safeLimit = Math.min(Math.max(toPositiveInt(limit) ?? 25, MIN_LIMIT), MAX_LIMIT);
  const safeOffset = toPositiveInt(offset) ?? 0;

  const countReq = pool.request();
  const listReq = pool.request();

  Object.entries(params).forEach(([name, { type, value }]) => {
    countReq.input(name, type, value);
    listReq.input(name, type, value);
  });

  listReq.input('limit', sql.Int, safeLimit);
  listReq.input('offset', sql.Int, safeOffset);

  const countQuery = `
    SELECT COUNT(1) AS total
    FROM violation_reports vr
    ${whereSql}
  `;

  const listQuery = `
    SELECT
      vr.report_id,
      vr.violation_type,
      vr.report_type,
      vr.status,
      vr.description,
      vr.reporter_id,
      vr.entity_type,
      vr.entity_id,
      vr.owner_id,
      vr.metadata,
      vr.created_at,
      vr.updated_at,
      vr.resolved_at,
      rep.user_id AS reporter_user_id,
      rep.full_name AS reporter_name,
      rep.email AS reporter_email,
      rep.avatar_url AS reporter_avatar,
      own.user_id AS owner_user_id,
      own.full_name AS owner_name,
      own.email AS owner_email,
      own.avatar_url AS owner_avatar,
      fl.full_name AS freelancer_name,
      p.deadline AS project_deadline,
      p.status AS project_status,
      CASE WHEN ws.submission_id IS NOT NULL THEN 1 ELSE 0 END AS has_submission,
      CASE WHEN d.dispute_id IS NOT NULL THEN 1 ELSE 0 END AS has_dispute,
      CASE 
        WHEN vr.entity_type = 'PROJECT' THEN p.title
        WHEN vr.entity_type = 'USER' THEN tgt.full_name
        ELSE NULL
      END AS entity_title
    FROM violation_reports vr
    LEFT JOIN users rep ON vr.reporter_id = rep.user_id
    LEFT JOIN users own ON vr.owner_id = own.user_id
    LEFT JOIN users tgt ON vr.entity_type = 'USER' AND vr.entity_id = tgt.user_id
    LEFT JOIN projects p ON vr.entity_type = 'PROJECT' AND vr.entity_id = p.project_id
    LEFT JOIN contracts c ON c.project_id = p.project_id
    LEFT JOIN users fl ON c.freelancer_id = fl.user_id
    LEFT JOIN (
      SELECT contract_id, MAX(submission_id) AS submission_id
      FROM work_submissions
      GROUP BY contract_id
    ) ws ON c.contract_id = ws.contract_id
    LEFT JOIN disputes d ON c.contract_id = d.contract_id
    ${whereSql}
    ORDER BY vr.created_at DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `;

  const [countResult, listResult] = await Promise.all([
    countReq.query(countQuery),
    listReq.query(listQuery)
  ]);

  return {
    total: countResult.recordset[0]?.total || 0,
    reports: listResult.recordset || []
  };
};


export const getReportById = async (reportId) => {
  const id = toInt(reportId);
  if (!id || id <= 0) return null;

  const pool = await poolPromise;
  const result = await pool.request()
    .input('reportId', sql.Int, id)
    .query(`
      SELECT
        vr.report_id,
        vr.violation_type,
        vr.report_type,
        vr.status,
        vr.description,
        vr.reporter_id,
        vr.entity_type,
        vr.entity_id,
        vr.owner_id,
        vr.metadata,
        vr.created_at,
        vr.updated_at,
        vr.resolved_at,
        rep.user_id AS reporter_user_id,
        rep.full_name AS reporter_name,
        rep.email AS reporter_email,
        rep.avatar_url AS reporter_avatar,
        own.user_id AS owner_user_id,
        own.full_name AS owner_name,
        own.email AS owner_email,
        own.avatar_url AS owner_avatar,
        c.contract_id,
        c.total_amount,
        p.deadline AS project_deadline,
        p.status AS project_status,
        fl.full_name AS freelancer_name,
        ws.description AS submission_description,
        ws.file_url AS submission_file_url,
        ws.submitted_at AS submission_created_at,
        ea.status AS escrow_status,
        CASE 
          WHEN vr.entity_type = 'PROJECT' THEN p.title
          WHEN vr.entity_type = 'USER' THEN tgt.full_name
          ELSE NULL
        END AS entity_title,
        CASE 
          WHEN vr.entity_type = 'PROJECT' THEN p.description
          ELSE NULL
        END AS entity_description
      FROM violation_reports vr
      LEFT JOIN users rep ON vr.reporter_id = rep.user_id
      LEFT JOIN users own ON vr.owner_id = own.user_id
      LEFT JOIN users tgt ON vr.entity_type = 'USER' AND vr.entity_id = tgt.user_id
      LEFT JOIN projects p ON vr.entity_type = 'PROJECT' AND vr.entity_id = p.project_id
      LEFT JOIN contracts c ON c.project_id = p.project_id
      LEFT JOIN users fl ON c.freelancer_id = fl.user_id
      LEFT JOIN EscrowAccounts ea ON ea.project_id = p.project_id
      LEFT JOIN (
        SELECT contract_id, description, file_url, submitted_at,
               ROW_NUMBER() OVER (PARTITION BY contract_id ORDER BY submitted_at DESC) as rn
        FROM work_submissions
      ) ws ON c.contract_id = ws.contract_id AND ws.rn = 1
      WHERE vr.report_id = @reportId
    `);

  return result.recordset[0] || null;
};



export const createReport = async ({ reporterId, entityType, entityId, ownerId, violationType, description, metadata }) => {
  const pool = await poolPromise;
  const metadataValue = normalizeText(metadata ? JSON.stringify(metadata) : null);
  const descValue = normalizeText(description);

  const result = await pool.request()
    .input('reporterId', sql.Int, reporterId)
    .input('entityType', sql.VarChar(50), entityType)
    .input('entityId', sql.Int, entityId ?? null)
    .input('ownerId', sql.Int, ownerId ?? null)
    .input('violationType', sql.VarChar(100), violationType || 'OTHER')
    .input('description', sql.NVarChar(sql.MAX), descValue)
    .input('metadata', sql.NVarChar(sql.MAX), metadataValue)
    .input('status', sql.VarChar(50), 'PENDING')
    .query(`
      INSERT INTO violation_reports (
        reporter_id, entity_type, entity_id, owner_id, violation_type, report_type,
        description, metadata, status, created_at, updated_at, reason
      )
      VALUES (
        @reporterId, @entityType, @entityId, @ownerId, @violationType, @violationType,
        @description, @metadata, @status, SYSUTCDATETIME(), SYSUTCDATETIME(), @description
      );
      SELECT SCOPE_IDENTITY() AS report_id;
    `);

  return result.recordset[0]?.report_id;
};

export const updateReportStatus = async (reportId, status) => {
  const id = toInt(reportId);
  if (!id || id <= 0) throw new Error('Invalid report id');

  const pool = await poolPromise;
  const result = await pool.request()
    .input('reportId', sql.Int, id)
    .input('status', sql.VarChar(50), status)
    .query(`
      UPDATE violation_reports
      SET status = @status,
          updated_at = SYSUTCDATETIME(),
          resolved_at = CASE WHEN @status IN ('RESOLVED', 'DISMISSED') THEN SYSUTCDATETIME() ELSE resolved_at END
      WHERE report_id = @reportId
    `);

  return result.rowsAffected[0] > 0;
};

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

export const findDuplicateReport = async ({ reporterId, entityType, entityId, violationType, withinDays = 7 }) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('reporterId', sql.Int, reporterId)
    .input('entityType', sql.VarChar(50), entityType)
    .input('entityId', sql.Int, entityId)
    .input('violationType', sql.VarChar(100), violationType)
    .input('withinDays', sql.Int, withinDays)
    .query(`
      SELECT TOP 1 report_id, status, created_at
      FROM violation_reports
      WHERE reporter_id = @reporterId
        AND entity_type = @entityType
        AND entity_id = @entityId
        AND violation_type = @violationType
        AND status IN ('PENDING', 'UNDER_REVIEW')
        AND DATEDIFF(DAY, created_at, SYSUTCDATETIME()) <= @withinDays
      ORDER BY created_at DESC
    `);

  return result.recordset[0] || null;
};

// ============================================================================
// OWNERSHIP VALIDATION
// ============================================================================

export const getProjectOwner = async (projectId) => {
  const id = toInt(projectId);
  if (!id || id <= 0) return null;

  const pool = await poolPromise;
  const result = await pool.request()
    .input('projectId', sql.Int, id)
    .query(`
      SELECT project_id, employer_id AS owner_id, title
      FROM projects WHERE project_id = @projectId
    `);

  return result.recordset[0] || null;
};

export const getUserById = async (userId) => {
  const id = toInt(userId);
  if (!id || id <= 0) return null;

  const pool = await poolPromise;
  const result = await pool.request()
    .input('userId', sql.Int, id)
    .query('SELECT user_id, full_name, email, status FROM users WHERE user_id = @userId');

  return result.recordset[0] || null;
};

// ============================================================================
// EVIDENCE
// ============================================================================

export const createEvidence = async ({ reportId, userId, fileUrl, fileType, fileName, fileSize }) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('reportId', sql.Int, reportId)
    .input('userId', sql.Int, userId)
    .input('fileUrl', sql.NVarChar(500), fileUrl)
    .input('fileType', sql.VarChar(50), fileType)
    .input('fileName', sql.NVarChar(255), fileName || null)
    .input('fileSize', sql.Int, fileSize || null)
    .query(`
      INSERT INTO report_evidence (report_id, file_url, file_type, file_name, file_size, uploaded_by, created_at)
      VALUES (@reportId, @fileUrl, @fileType, @fileName, @fileSize, @userId, SYSUTCDATETIME());
      SELECT SCOPE_IDENTITY() AS id;
    `);

  return result.recordset[0]?.id;
};

export const getEvidenceByReportId = async (reportId) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('reportId', sql.Int, reportId)
    .query(`
      SELECT id, report_id, file_url, file_type, file_name, file_size, uploaded_by, created_at
      FROM report_evidence
      WHERE report_id = @reportId
      ORDER BY created_at ASC
    `);

  return result.recordset || [];
};

// ============================================================================
// USER MY REPORTS
// ============================================================================

export const getMyReports = async (userId, { status, limit = 25, offset = 0 } = {}) => {
  const pool = await poolPromise;
  const safeLimit = Math.min(Math.max(toPositiveInt(limit) ?? 25, 1), 100);
  const safeOffset = toPositiveInt(offset) ?? 0;

  let whereClause = 'WHERE vr.reporter_id = @userId';
  const countReq = pool.request();
  const listReq = pool.request();

  countReq.input('userId', sql.Int, userId);
  listReq.input('userId', sql.Int, userId);

  if (status && ALLOWED_STATUSES.includes(status.toUpperCase())) {
    whereClause += ' AND vr.status = @status';
    countReq.input('status', sql.VarChar(50), status.toUpperCase());
    listReq.input('status', sql.VarChar(50), status.toUpperCase());
  }

  listReq.input('limit', sql.Int, safeLimit);
  listReq.input('offset', sql.Int, safeOffset);

  const countQuery = `SELECT COUNT(1) AS total FROM violation_reports vr ${whereClause}`;
  const listQuery = `
    SELECT vr.report_id, vr.entity_type, vr.entity_id, vr.violation_type, vr.report_type,
           vr.description, vr.status, vr.created_at, vr.updated_at,
           CASE 
             WHEN vr.entity_type = 'PROJECT' THEN p.title
             WHEN vr.entity_type = 'USER' THEN u.full_name
             ELSE NULL
           END AS entity_title
    FROM violation_reports vr
    LEFT JOIN projects p ON vr.entity_type = 'PROJECT' AND vr.entity_id = p.project_id
    LEFT JOIN users u ON vr.entity_type = 'USER' AND vr.entity_id = u.user_id
    ${whereClause}
    ORDER BY vr.created_at DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `;

  const [countResult, listResult] = await Promise.all([
    countReq.query(countQuery),
    listReq.query(listQuery)
  ]);

  return {
    total: countResult.recordset[0]?.total || 0,
    reports: listResult.recordset || []
  };
};

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const createNotification = async ({ userId, title, message, type }) => {
  const pool = await poolPromise;
  try {
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('title', sql.NVarChar(255), title || 'Hệ thống')
      .input('message', sql.NVarChar(sql.MAX), message)
      .input('type', sql.VarChar(50), type || 'SYSTEM')
      .query(`
        INSERT INTO notifications (user_id, title, message, notification_type, is_read, created_at)
        VALUES (@userId, @title, @message, @type, 0, SYSUTCDATETIME())
      `);
  } catch (error) {
    console.error('Error creating notification:', error.message);
  }
};