import { sql, poolPromise } from '../config/db.js';

const parseIntParam = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const allowedStatuses = ['OPEN', 'RESOLVED', 'CLOSED'];
const allowedDecisions = ['REFUND_EMPLOYER', 'PAY_FREELANCER', 'SPLIT_PAYMENT', 'NO_ACTION'];

export const buildDisputeFilters = ({ status }) => {
  const whereClauses = [];
  const params = {};

  if (status && typeof status === 'string') {
    const normalizedStatus = status.trim().toUpperCase();
    if (allowedStatuses.includes(normalizedStatus)) {
      whereClauses.push('d.status = @status');
      params.status = { type: sql.VarChar(50), value: normalizedStatus };
    }
  }

  return {
    whereSql: whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '',
    params
  };
};

export const fetchDisputes = async ({ status, limit = 25, offset = 0 }) => {
  const pool = await poolPromise;
  const { whereSql, params } = buildDisputeFilters({ status });

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) >= 0 ? parseInt(limit, 10) : 25, 1), 100);
  const safeOffset = parseInt(offset, 10) >= 0 ? parseInt(offset, 10) : 0;

  const countRequest = pool.request();
  const listRequest = pool.request();

  Object.entries(params).forEach(([name, { type, value }]) => {
    countRequest.input(name, type, value);
    listRequest.input(name, type, value);
  });

  listRequest.input('limit', sql.Int, safeLimit);
  listRequest.input('offset', sql.Int, safeOffset);

  const countQuery = `
    SELECT COUNT(1) AS total
    FROM disputes d
    ${whereSql}
  `;

  const listQuery = `
    SELECT
      d.dispute_id,
      d.contract_id,
      d.opened_by,
      d.against_user_id,
      d.reason,
      d.decision,
      d.status,
      d.created_at,
      d.resolved_at
    FROM disputes d
    ${whereSql}
    ORDER BY d.created_at DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `;

  const [countResult, listResult] = await Promise.all([
    countRequest.query(countQuery),
    listRequest.query(listQuery)
  ]);

  return {
    total: countResult.recordset[0]?.total || 0,
    disputes: listResult.recordset || []
  };
};

export const getDisputeById = async (disputeId) => {
  const id = parseIntParam(disputeId);
  if (!id || id <= 0) {
    return null;
  }

  const pool = await poolPromise;
  const result = await pool.request()
    .input('disputeId', sql.Int, id)
    .query(`
      SELECT
        dispute_id,
        contract_id,
        opened_by,
        against_user_id,
        reason,
        decision,
        status,
        created_at,
        resolved_at
      FROM disputes
      WHERE dispute_id = @disputeId
    `);

  return result.recordset[0] || null;
};

export const updateDisputeStatus = async (disputeId, status, decision = null) => {
  const id = parseIntParam(disputeId);
  if (!id || id <= 0) {
    throw new Error('Invalid dispute id.');
  }

  const pool = await poolPromise;
  const request = pool.request()
    .input('disputeId', sql.Int, id)
    .input('status', sql.VarChar(50), status)
    .input('decision', sql.VarChar(50), decision);

  await request.query(`
    UPDATE disputes
    SET
      status = @status,
      decision = CASE WHEN @decision IS NOT NULL THEN @decision ELSE decision END,
      resolved_at = SYSUTCDATETIME()
    WHERE dispute_id = @disputeId
  `);
};

export const isAllowedDecision = (decision) => {
  return typeof decision === 'string' && allowedDecisions.includes(decision.trim().toUpperCase());
};

export const getAllowedDecisions = () => allowedDecisions;
