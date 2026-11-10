import { sql, poolPromise } from '../config/db.js';

/**
 * Moderation Repository
 * 
 * Production-grade audit trail for all moderation actions.
 * Every status change is logged immutably.
 */
export const createModerationLog = async ({ reportId, adminId, action, note, oldStatus, newStatus }) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('reportId', sql.Int, reportId)
    .input('adminId', sql.Int, adminId)
    .input('action', sql.VarChar(50), action)
    .input('note', sql.NVarChar(sql.MAX), note || null)
    .input('oldStatus', sql.VarChar(50), oldStatus)
    .input('newStatus', sql.VarChar(50), newStatus)
    .query(`
      INSERT INTO moderation_logs (report_id, admin_id, action, note, old_status, new_status, created_at)
      VALUES (@reportId, @adminId, @action, @note, @oldStatus, @newStatus, SYSUTCDATETIME());
      SELECT SCOPE_IDENTITY() AS id;
    `);

  return result.recordset[0]?.id;
};

export const getModerationHistory = async (reportId) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('reportId', sql.Int, reportId)
    .query(`
      SELECT 
        ml.id,
        ml.report_id,
        ml.admin_id,
        ml.action,
        ml.note,
        ml.old_status,
        ml.new_status,
        ml.created_at,
        u.full_name AS admin_name,
        u.avatar_url AS admin_avatar
      FROM moderation_logs ml
      LEFT JOIN users u ON ml.admin_id = u.user_id
      WHERE ml.report_id = @reportId
      ORDER BY ml.created_at ASC
    `);

  return result.recordset || [];
};