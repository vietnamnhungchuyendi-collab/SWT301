import { sql, poolPromise } from '../config/db.js';

const parseIntParam = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const parsePositiveIntParam = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

export const buildProposalFilters = ({ status, projectId, employerId, freelancerId, search }) => {
  const whereClauses = [];
  const params = {};

  if (status && typeof status === 'string') {
    whereClauses.push('p.status = @status');
    params.status = { type: sql.VarChar(50), value: status.trim().toUpperCase() };
  }

  const parsedProjectId = parseIntParam(projectId);
  if (parsedProjectId !== null) {
    whereClauses.push('p.project_id = @projectId');
    params.projectId = { type: sql.Int, value: parsedProjectId };
  }

  const parsedFreelancerId = parseIntParam(freelancerId);
  if (parsedFreelancerId !== null) {
    whereClauses.push('p.freelancer_id = @freelancerId');
    params.freelancerId = { type: sql.Int, value: parsedFreelancerId };
  }

  const parsedEmployerId = parseIntParam(employerId);
  if (parsedEmployerId !== null) {
    whereClauses.push('pr.employer_id = @employerId');
    params.employerId = { type: sql.Int, value: parsedEmployerId };
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    whereClauses.push('(u.full_name LIKE @search OR p.cover_letter LIKE @search OR pr.title LIKE @search)');
    params.search = { type: sql.NVarChar(sql.MAX), value: `%${search.trim()}%` };
  }

  return { whereSql: whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '', params };
};

export const fetchProposals = async ({ status, projectId, employerId, freelancerId, search, limit = 25, offset = 0 }) => {
  const pool = await poolPromise;
  const { whereSql, params } = buildProposalFilters({ status, projectId, employerId, freelancerId, search });

  const safeLimit = Math.min(Math.max(parsePositiveIntParam(limit) ?? 25, 1), 100);
  const safeOffset = parsePositiveIntParam(offset) ?? 0;

  const countRequest = pool.request();
  const listRequest = pool.request();

  Object.entries(params).forEach(([name, { type, value }]) => {
    countRequest.input(name, type, value);
    listRequest.input(name, type, value);
  });

  listRequest.input('limit', sql.Int, safeLimit);
  listRequest.input('offset', sql.Int, safeOffset);

  const countQuery = `SELECT COUNT(1) as total FROM proposals p JOIN projects pr ON p.project_id = pr.project_id ${whereSql}`;
  const listQuery = `
    SELECT
      p.proposal_id,
      p.project_id,
      p.freelancer_id,
      p.proposed_price,
      p.delivery_time_days,
      p.cover_letter,
      p.status,
      p.created_at,
      p.updated_at,
      u.full_name as freelancer_name,
      u.avatar_url as freelancer_avatar,
      pr.title as project_title,
      pr.employer_id,
      emp.full_name as employer_name,
      c.contract_id
    FROM proposals p
    JOIN users u ON p.freelancer_id = u.user_id
    JOIN projects pr ON p.project_id = pr.project_id
    JOIN users emp ON pr.employer_id = emp.user_id
    LEFT JOIN contracts c ON p.project_id = c.project_id AND p.freelancer_id = c.freelancer_id
    ${whereSql}
    ORDER BY p.created_at DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `;

  const [countResult, listResult] = await Promise.all([
    countRequest.query(countQuery),
    listRequest.query(listQuery)
  ]);

  return {
    total: countResult.recordset[0]?.total || 0,
    proposals: listResult.recordset || []
  };
};

export const getProposalById = async (proposalId) => {
  if (!Number.isInteger(proposalId) || proposalId <= 0) {
    return null;
  }

  const pool = await poolPromise;
  const result = await pool.request()
    .input('proposalId', sql.Int, proposalId)
    .query(`
      SELECT
        p.proposal_id,
        p.project_id,
        p.freelancer_id,
        p.proposed_price,
        p.delivery_time_days,
        p.cover_letter,
        p.status,
        p.created_at,
        p.updated_at,
        pr.employer_id,
        pr.title as project_title
      FROM proposals p
      JOIN projects pr ON p.project_id = pr.project_id
      WHERE p.proposal_id = @proposalId
    `);

  return result.recordset[0] || null;
};

export const proposalExistsForContract = async ({ proposalId, projectId, freelancerId, employerId }, transaction) => {
  const request = transaction ? transaction.request() : (await poolPromise).request();
  const result = await request
    .input('proposalId', sql.Int, proposalId)
    .input('projectId', sql.Int, projectId)
    .input('freelancerId', sql.Int, freelancerId)
    .input('employerId', sql.Int, employerId)
    .query(`
      SELECT TOP 1 1 AS exists_flag
      FROM contracts
      WHERE proposal_id = @proposalId
         OR (project_id = @projectId AND freelancer_id = @freelancerId AND employer_id = @employerId AND status IN ('ACTIVE','PENDING_APPROVAL','APPROVED'))
    `);

  return result.recordset.length > 0;
};

export const createContract = async ({ projectId, employerId, freelancerId, proposalId, totalAmount, contractTitle }, transaction) => {
  const amount = Number(totalAmount);
  if (Number.isNaN(amount) || amount < 0) {
    throw new Error('Invalid total amount.');
  }

  const request = transaction.request();
  const result = await request
    .input('projectId', sql.Int, projectId)
    .input('employerId', sql.Int, employerId)
    .input('freelancerId', sql.Int, freelancerId)
    .input('proposalId', sql.Int, proposalId)
    .input('totalAmount', sql.Decimal(18, 2), amount)
    .input('contractTitle', sql.NVarChar(255), String(contractTitle).trim())
    .query(`
      INSERT INTO contracts (project_id, employer_id, freelancer_id, proposal_id, contract_title, total_amount, status, started_at, created_at, updated_at)
      OUTPUT inserted.contract_id, inserted.project_id, inserted.employer_id, inserted.freelancer_id, inserted.proposal_id,
             inserted.contract_title, inserted.total_amount, inserted.status, inserted.started_at, inserted.created_at, inserted.updated_at
      VALUES (@projectId, @employerId, @freelancerId, @proposalId, @contractTitle, @totalAmount, 'ACTIVE', SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME())
    `);

  return result.recordset[0] || null;
};

export const updateProposalStatus = async (proposalId, status, transaction) => {
  const request = transaction ? transaction.request() : (await poolPromise).request();
  await request
    .input('proposalId', sql.Int, proposalId)
    .input('status', sql.VarChar(30), status)
    .query(`
      UPDATE proposals
      SET status = @status,
          updated_at = SYSUTCDATETIME()
      WHERE proposal_id = @proposalId
    `);
};
