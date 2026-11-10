import { sql, poolPromise } from '../config/db.js';

const buildDateFilter = (startDate, endDate, alias = '') => {
  const prefix = alias ? `${alias}.` : '';
  const conditions = [];
  if (startDate) {
    conditions.push(`${prefix}created_at >= @startDate`);
  }
  if (endDate) {
    conditions.push(`${prefix}created_at <= @endDate`);
  }
  return conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';
};

const addDateInputs = (request, startDate, endDate) => {
  if (startDate) {
    request.input('startDate', sql.DateTime, startDate);
  }
  if (endDate) {
    request.input('endDate', sql.DateTime, endDate);
  }
  return request;
};

export const getOverviewStats = async (startDate = null, endDate = null) => {
  const pool = await poolPromise;
  const dateFilter = buildDateFilter(startDate, endDate);
  const dateFilterCreated = buildDateFilter(startDate, endDate, 'p');
  const dateFilterC = buildDateFilter(startDate, endDate, 'c');
  const dateFilterD = buildDateFilter(startDate, endDate, 'd');
  const dateFilterV = buildDateFilter(startDate, endDate, 'v');
  const dateFilterPay = buildDateFilter(startDate, endDate, 'pay');
  const dateFilterWT = buildDateFilter(startDate, endDate, 'wt');

  const queries = [
    addDateInputs(pool.request(), startDate, endDate).query(`SELECT COUNT(*) as count FROM users WHERE 1=1${dateFilter}`),
    addDateInputs(pool.request(), startDate, endDate).query(`SELECT COUNT(*) as count FROM users WHERE role_default = 'FREELANCER'${dateFilter}`),
    addDateInputs(pool.request(), startDate, endDate).query(`SELECT COUNT(*) as count FROM users WHERE role_default = 'EMPLOYER'${dateFilter}`),
    addDateInputs(pool.request(), startDate, endDate).query(`SELECT COUNT(*) as count FROM projects p WHERE 1=1${dateFilterCreated}`),
    addDateInputs(pool.request(), startDate, endDate).query(`SELECT COUNT(*) as count FROM projects p WHERE status = 'ACTIVE'${dateFilterCreated}`),
    addDateInputs(pool.request(), startDate, endDate).query(`SELECT COUNT(*) as count FROM projects p WHERE status = 'CLOSED'${dateFilterCreated}`),
    addDateInputs(pool.request(), startDate, endDate).query(`SELECT COUNT(*) as count FROM contracts c WHERE c.status IN ('ACTIVE', 'APPROVED')${dateFilterC}`),
    addDateInputs(pool.request(), startDate, endDate).query(`SELECT COUNT(*) as count FROM contracts c WHERE c.status = 'COMPLETED'${dateFilterC}`),
    addDateInputs(pool.request(), startDate, endDate).query(`SELECT COUNT(*) as count FROM disputes d WHERE d.status = 'OPEN'${dateFilterD}`),
    addDateInputs(pool.request(), startDate, endDate).query(`SELECT COUNT(*) as count FROM violation_reports v WHERE v.status = 'PENDING'${dateFilterV}`),
    addDateInputs(pool.request(), startDate, endDate).query(`SELECT ISNULL(SUM(pay.amount), 0) as total FROM payments pay WHERE pay.payment_status = 'COMPLETED'${dateFilterPay}`),
    addDateInputs(pool.request(), startDate, endDate).query(`SELECT ISNULL(SUM(wt.amount), 0) as total FROM WalletTransaction wt WHERE wt.transaction_type = 'SERVICE_FEE'${dateFilterWT}`),
  ];

  const results = await Promise.all(queries);

  return {
    totalUsers: results[0].recordset[0]?.count || 0,
    totalFreelancers: results[1].recordset[0]?.count || 0,
    totalEmployers: results[2].recordset[0]?.count || 0,
    totalProjects: results[3].recordset[0]?.count || 0,
    activeProjects: results[4].recordset[0]?.count || 0,
    completedProjects: results[5].recordset[0]?.count || 0,
    activeContracts: results[6].recordset[0]?.count || 0,
    completedContracts: results[7].recordset[0]?.count || 0,
    pendingDisputes: results[8].recordset[0]?.count || 0,
    pendingReports: results[9].recordset[0]?.count || 0,
    totalRevenue: results[10].recordset[0]?.total || 0,
    totalSystemFees: results[11].recordset[0]?.total || 0,
  };
};

export const getMonthlyRevenue = async (startDate = null, endDate = null) => {
  const pool = await poolPromise;
  let query = `
    SELECT 
      FORMAT(created_at, 'yyyy-MM') as month,
      ISNULL(SUM(amount), 0) as amount
    FROM WalletTransaction
    WHERE transaction_type = 'SERVICE_FEE'
  `;
  const dateFilter = buildDateFilter(startDate, endDate);
  query += `${dateFilter}
    GROUP BY FORMAT(created_at, 'yyyy-MM')
    ORDER BY month ASC
  `;
  const result = await addDateInputs(pool.request(), startDate, endDate).query(query);
  return result.recordset;
};

export const getMonthlyProjects = async (startDate = null, endDate = null) => {
  const pool = await poolPromise;
  let query = `
    SELECT 
      FORMAT(created_at, 'yyyy-MM') as month,
      COUNT(*) as count
    FROM projects
    WHERE 1=1
  `;
  const dateFilter = buildDateFilter(startDate, endDate);
  query += `${dateFilter}
    GROUP BY FORMAT(created_at, 'yyyy-MM')
    ORDER BY month ASC
  `;
  const result = await addDateInputs(pool.request(), startDate, endDate).query(query);
  return result.recordset;
};

export const getMonthlyUsers = async (startDate = null, endDate = null) => {
  const pool = await poolPromise;
  let query = `
    SELECT 
      FORMAT(created_at, 'yyyy-MM') as month,
      COUNT(*) as count
    FROM users
    WHERE 1=1
  `;
  const dateFilter = buildDateFilter(startDate, endDate);
  query += `${dateFilter}
    GROUP BY FORMAT(created_at, 'yyyy-MM')
    ORDER BY month ASC
  `;
  const result = await addDateInputs(pool.request(), startDate, endDate).query(query);
  return result.recordset;
};

export const getProjectStatusDistribution = async (startDate = null, endDate = null) => {
  const pool = await poolPromise;
  const dateFilter = buildDateFilter(startDate, endDate);
  const result = await addDateInputs(pool.request(), startDate, endDate).query(`
    SELECT status, COUNT(*) as count
    FROM projects
    WHERE 1=1${dateFilter}
    GROUP BY status
    ORDER BY count DESC
  `);
  return result.recordset;
};

export const getContractStatusDistribution = async (startDate = null, endDate = null) => {
  const pool = await poolPromise;
  const dateFilter = buildDateFilter(startDate, endDate);
  const result = await addDateInputs(pool.request(), startDate, endDate).query(`
    SELECT status, COUNT(*) as count
    FROM contracts
    WHERE 1=1${dateFilter}
    GROUP BY status
    ORDER BY count DESC
  `);
  return result.recordset;
};

export const getTopCategories = async (startDate = null, endDate = null) => {
  const pool = await poolPromise;
  const dateFilter = buildDateFilter(startDate, endDate, 'p');
  const result = await addDateInputs(pool.request(), startDate, endDate).query(`
    SELECT TOP 5
      pc.category_name as category,
      COUNT(p.project_id) as count
    FROM projects p
    LEFT JOIN project_categories pc ON p.category_id = pc.category_id
    WHERE 1=1${dateFilter}
    GROUP BY pc.category_name
    ORDER BY count DESC
  `);
  return result.recordset;
};

export const getTopSkills = async (startDate = null, endDate = null) => {
  const pool = await poolPromise;
  const dateFilter = buildDateFilter(startDate, endDate, 'ps');
  const result = await addDateInputs(pool.request(), startDate, endDate).query(`
    SELECT TOP 10
      s.skill_name as skill,
      COUNT(ps.project_id) as count
    FROM project_skills ps
    JOIN skills s ON ps.skill_id = s.skill_id
    WHERE 1=1${dateFilter}
    GROUP BY s.skill_name
    ORDER BY count DESC
  `);
  return result.recordset;
};