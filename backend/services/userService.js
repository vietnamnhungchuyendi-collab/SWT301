import { sql, poolPromise } from '../config/db.js';

export const getUserById = async (userId) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('userId', sql.Int, userId)
    .query('SELECT user_id, full_name, email, phone, role_default, status FROM users WHERE user_id = @userId');

  return result.recordset[0] || null;
};

export const fetchAllUsers = async () => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT user_id, full_name, email, phone, role_default, status, is_email_verified, created_at
    FROM users
    ORDER BY created_at DESC
  `);

  return result.recordset;
};

export const approveContractById = async (contractId) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('contractId', sql.Int, contractId)
    .query(`
      UPDATE contracts
      SET status = 'APPROVED'
      WHERE contract_id = @contractId AND status = 'PENDING_APPROVAL';
      SELECT contract_id, status FROM contracts WHERE contract_id = @contractId;
    `);

  if (!result.rowsAffected || result.rowsAffected[0] === 0) {
    return null;
  }

  return result.recordset[0] || null;
};

export const updateUserStatusById = async (userId, status) => {
  const pool = await poolPromise;
  await pool.request()
    .input('userId', sql.Int, userId)
    .input('status', sql.VarChar, status)
    .query(`
      UPDATE users
      SET status = @status,
          refresh_token = CASE WHEN @status = 'BANNED' THEN NULL ELSE refresh_token END
      WHERE user_id = @userId
    `);
};

export const fetchUsersWithFilters = async ({ search, role, status, limit = 25, offset = 0 }) => {
  const pool = await poolPromise;

  // Build WHERE clauses safely using parameters
  const whereClauses = [];
  const request = pool.request();

  if (search) {
    request.input('search', sql.VarChar, `%${search}%`);
    whereClauses.push("(full_name LIKE @search OR email LIKE @search OR phone LIKE @search)");
  }

  if (role) {
    request.input('role', sql.VarChar, role);
    whereClauses.push('role_default = @role');
  }

  if (status) {
    request.input('status', sql.VarChar, status);
    whereClauses.push('status = @status');
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  // Total count query
  const countQuery = `SELECT COUNT(*) AS total FROM users ${whereSql}`;

  // Paged query (SQL Server OFFSET/FETCH)
  const listQuery = `
    SELECT user_id, full_name, email, phone, role_default, status, is_email_verified, created_at
    FROM users
    ${whereSql}
    ORDER BY created_at DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `;

  // Build requests with same inputs
  const countReq = pool.request();
  const listReq = pool.request();

  if (search) {
    countReq.input('search', sql.VarChar, `%${search}%`);
    listReq.input('search', sql.VarChar, `%${search}%`);
  }
  if (role) {
    countReq.input('role', sql.VarChar, role);
    listReq.input('role', sql.VarChar, role);
  }
  if (status) {
    countReq.input('status', sql.VarChar, status);
    listReq.input('status', sql.VarChar, status);
  }

  listReq.input('limit', sql.Int, parseInt(limit, 10));
  listReq.input('offset', sql.Int, parseInt(offset, 10));

  const [countResult, listResult] = await Promise.all([
    countReq.query(countQuery),
    listReq.query(listQuery)
  ]);

  return {
    total: countResult.recordset[0]?.total || 0,
    users: listResult.recordset || []
  };
};

export const getDashboardStats = async () => {
  const pool = await poolPromise;

  // Execute all independent count queries in parallel
  const [
    totalUsersResult,
    totalProjectsResult,
    activeContractsResult,
    pendingDisputesResult,
    pendingReportsResult,
    totalRevenueResult,
    totalSystemFeesResult,
    pendingWithdrawalsResult,
    pendingProjectsResult,
    topFreelancersResult
  ] = await Promise.all([
    pool.request().query("SELECT COUNT(*) as count FROM users WHERE role_default != 'ADMIN'"),
    pool.request().query("SELECT COUNT(*) as count FROM projects"),
    pool.request().query("SELECT COUNT(*) as count FROM contracts WHERE status IN ('ACTIVE', 'APPROVED')"),
    pool.request().query("SELECT COUNT(*) as count FROM disputes WHERE status = 'OPEN'"),
    pool.request().query("SELECT COUNT(*) as count FROM violation_reports WHERE status = 'PENDING'"),
    pool.request().query("SELECT ISNULL(SUM(amount), 0) as total FROM payments WHERE payment_status = 'COMPLETED'"),
    pool.request().query("SELECT ISNULL(SUM(amount), 0) as total FROM WalletTransaction WHERE transaction_type = 'SERVICE_FEE'"),
    pool.request().query("SELECT COUNT(*) as count FROM WithdrawalRequests WHERE status = 'PENDING'"),
    pool.request().query("SELECT COUNT(*) as count FROM projects WHERE status = 'CLOSED'"),
    pool.request().query(`
      SELECT TOP 5 u.user_id, u.full_name, u.email, u.avatar_url, ISNULL(SUM(c.total_amount), 0) as total_earned
      FROM contracts c
      JOIN users u ON c.freelancer_id = u.user_id
      WHERE c.status = 'COMPLETED'
      GROUP BY u.user_id, u.full_name, u.email, u.avatar_url
      ORDER BY total_earned DESC
    `)
  ]);

  // Fetch real latest 5 projects with owner name
  const latestProjectsRes = await pool.request().query(`
    SELECT TOP 5 p.project_id, p.title, p.status, p.budget_min, u.full_name as owner_name
    FROM projects p
    LEFT JOIN users u ON p.employer_id = u.user_id
    ORDER BY p.created_at DESC
  `);

  // Fetch real latest 5 payments with payer name
  const latestPaymentsRes = await pool.request().query(`
    SELECT TOP 5 p.payment_id, p.amount, p.payment_method, p.paid_at, u.full_name as payer_name, pr.title as project_title
    FROM payments p
    LEFT JOIN users u ON p.payer_id = u.user_id
    LEFT JOIN contracts c ON p.contract_id = c.contract_id
    LEFT JOIN projects pr ON c.project_id = pr.project_id
    ORDER BY p.created_at DESC
  `);

  // Fetch real trends
  const monthlyUsersRes = await pool.request().query(`
    SELECT TOP 6
      FORMAT(created_at, 'yyyy-MM') as month,
      COUNT(*) as count
    FROM users
    WHERE role_default != 'ADMIN'
    GROUP BY FORMAT(created_at, 'yyyy-MM')
    ORDER BY month DESC
  `);

  const monthlyProjectsRes = await pool.request().query(`
    SELECT TOP 6
      FORMAT(created_at, 'yyyy-MM') as month,
      COUNT(*) as count
    FROM projects
    GROUP BY FORMAT(created_at, 'yyyy-MM')
    ORDER BY month DESC
  `);

  return {
    totalUsers: totalUsersResult.recordset[0]?.count || 0,
    totalProjects: totalProjectsResult.recordset[0]?.count || 0,
    activeContracts: activeContractsResult.recordset[0]?.count || 0,
    pendingDisputes: pendingDisputesResult.recordset[0]?.count || 0,
    pendingReports: pendingReportsResult.recordset[0]?.count || 0,
    totalRevenue: totalRevenueResult.recordset[0]?.total || 0,
    totalSystemFees: totalSystemFeesResult.recordset[0]?.total || 0,
    pendingWithdrawals: pendingWithdrawalsResult.recordset[0]?.count || 0,
    pendingProjects: pendingProjectsResult.recordset[0]?.count || 0,
    latestProjects: latestProjectsRes.recordset || [],
    latestPayments: latestPaymentsRes.recordset || [],
    topFreelancers: topFreelancersResult.recordset || [],
    monthlyUsers: (monthlyUsersRes.recordset || []).reverse(),
    monthlyProjects: (monthlyProjectsRes.recordset || []).reverse()
  };
};
