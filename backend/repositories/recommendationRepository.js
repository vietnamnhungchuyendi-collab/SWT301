import { sql, poolPromise } from '../config/db.js';

export const getProjectDetails = async (projectId) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('projectId', sql.Int, projectId)
    .query(`
      SELECT 
        p.project_id, p.employer_id, p.title, p.description, p.category_id,
        p.budget_min, p.budget_max, p.budget_type,
        (
          SELECT STRING_AGG(s.skill_name, ',')
          FROM project_skills ps
          JOIN skills s ON ps.skill_id = s.skill_id
          WHERE ps.project_id = p.project_id
        ) as required_skills,
        pc.category_name
      FROM projects p
      LEFT JOIN project_categories pc ON p.category_id = pc.category_id
      WHERE p.project_id = @projectId
    `);
  return result.recordset[0] || null;
};

export const getProjectSkills = async (projectId) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('projectId', sql.Int, projectId)
    .query(`
      SELECT s.skill_id, s.skill_name
      FROM project_skills ps
      JOIN skills s ON ps.skill_id = s.skill_id
      WHERE ps.project_id = @projectId
    `);
  return result.recordset;
};

export const getEmployerHistory = async (employerId) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('employerId', sql.Int, employerId)
    .query(`
      SELECT 
        c.contract_id, c.freelancer_id, c.total_amount, c.status, c.created_at,
        p.project_id, p.category_id, p.budget_min, p.budget_max, p.budget_type,
        pc.category_name,
        fp.rating_average, fp.experience_years
      FROM contracts c
      JOIN projects p ON c.project_id = p.project_id
      LEFT JOIN project_categories pc ON p.category_id = pc.category_id
      LEFT JOIN freelancer_profiles fp ON c.freelancer_id = fp.freelancer_id
      WHERE c.employer_id = @employerId
      ORDER BY c.created_at DESC
    `);
  return result.recordset;
};

export const getEmployerProjectSkills = async (employerId) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('employerId', sql.Int, employerId)
    .query(`
      SELECT DISTINCT s.skill_id, s.skill_name, COUNT(*) as frequency
      FROM contracts c
      JOIN projects p ON c.project_id = p.project_id
      JOIN project_skills ps ON p.project_id = ps.project_id
      JOIN skills s ON ps.skill_id = s.skill_id
      WHERE c.employer_id = @employerId
      GROUP BY s.skill_id, s.skill_name
      ORDER BY frequency DESC
    `);
  return result.recordset;
};

export const getFreelancersForProject = async (projectId) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('projectId', sql.Int, projectId)
    .query(`
      SELECT DISTINCT
        u.user_id, u.full_name, u.avatar_url,
        fp.rating_average, fp.total_reviews, fp.headline,
        fp.experience_years, fp.hourly_rate, fp.availability_status,
        fp.portfolio_summary, fp.cv_ai_evaluation
      FROM users u
      JOIN freelancer_profiles fp ON u.user_id = fp.freelancer_id
      WHERE u.role_default = 'FREELANCER'
        AND u.status = 'ACTIVE'
    `);
  return result.recordset;
};

export const getFreelancerSkills = async (freelancerIds) => {
  if (freelancerIds.length === 0) return [];
  const pool = await poolPromise;
  const ids = freelancerIds.map(id => `@id${id}`).join(',');
  const request = pool.request();
  freelancerIds.forEach(id => {
    request.input(`id${id}`, sql.Int, id);
  });
  const result = await request.query(`
    SELECT fs.freelancer_id, s.skill_id, s.skill_name, fs.skill_level
    FROM freelancer_skills fs
    JOIN skills s ON fs.skill_id = s.skill_id
    WHERE fs.freelancer_id IN (${ids})
  `);
  return result.recordset;
};

export const getFreelancerProposals = async (freelancerIds) => {
  if (freelancerIds.length === 0) return [];
  const pool = await poolPromise;
  const ids = freelancerIds.map(id => `@id${id}`).join(',');
  const request = pool.request();
  freelancerIds.forEach(id => {
    request.input(`id${id}`, sql.Int, id);
  });
  const result = await request.query(`
    SELECT 
      freelancer_id,
      COUNT(*) as total_proposals,
      SUM(CASE WHEN status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted_proposals,
      SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected_proposals,
      AVG(proposed_price) as avg_proposed_price,
      AVG(CAST(delivery_time_days AS FLOAT)) as avg_delivery_days
    FROM proposals
    WHERE freelancer_id IN (${ids})
    GROUP BY freelancer_id
  `);
  return result.recordset;
};

export const getFreelancerContracts = async (freelancerIds) => {
  if (freelancerIds.length === 0) return [];
  const pool = await poolPromise;
  const ids = freelancerIds.map(id => `@id${id}`).join(',');
  const request = pool.request();
  freelancerIds.forEach(id => {
    request.input(`id${id}`, sql.Int, id);
  });
  const result = await request.query(`
    SELECT 
      freelancer_id,
      COUNT(*) as total_contracts,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_contracts
    FROM contracts
    WHERE freelancer_id IN (${ids})
    GROUP BY freelancer_id
  `);
  return result.recordset;
};

export const getFreelancerPortfolios = async (freelancerIds) => {
  if (freelancerIds.length === 0) return [];
  const pool = await poolPromise;
  const ids = freelancerIds.map(id => `@id${id}`).join(',');
  const request = pool.request();
  freelancerIds.forEach(id => {
    request.input(`id${id}`, sql.Int, id);
  });
  const result = await request.query(`
    SELECT freelancer_id, title, description
    FROM portfolios
    WHERE freelancer_id IN (${ids})
  `);
  return result.recordset;
};

export const getAllOpenProjectsWithSkills = async () => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      p.project_id, p.employer_id, p.title, p.description, p.category_id,
      p.budget_min, p.budget_max, p.budget_type, p.created_at,
      pc.category_name,
      u.full_name as company_name, u.avatar_url,
      (SELECT STRING_AGG(s.skill_name, ', ') 
       FROM project_skills ps 
       JOIN skills s ON ps.skill_id = s.skill_id 
       WHERE ps.project_id = p.project_id) as required_skills
    FROM projects p
    LEFT JOIN project_categories pc ON p.category_id = pc.category_id
    LEFT JOIN users u ON p.employer_id = u.user_id
    WHERE p.status = 'OPEN'
    ORDER BY p.created_at DESC
  `);
  return result.recordset;
};

export const getSingleFreelancerProfile = async (userId) => {
  const pool = await poolPromise;
  const flRes = await pool.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT u.user_id, u.full_name, u.bio,
             fp.headline, fp.experience_years, fp.hourly_rate,
             fp.rating_average, fp.total_reviews, fp.cv_ai_evaluation
      FROM users u
      LEFT JOIN freelancer_profiles fp ON u.user_id = fp.freelancer_id
      WHERE u.user_id = @userId
    `);
  if (flRes.recordset.length === 0) return null;
  const fl = flRes.recordset[0];

  const skillsRes = await pool.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT s.skill_name 
      FROM freelancer_skills fs
      JOIN skills s ON fs.skill_id = s.skill_id
      WHERE fs.freelancer_id = @userId
    `);
  fl.skills = skillsRes.recordset.map(r => r.skill_name);

  return fl;
};

export const getProjectProposalsAIEvaluation = async (projectId) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('projectId', sql.Int, projectId)
    .query('SELECT freelancer_id, ai_evaluation FROM proposals WHERE project_id = @projectId');
  return result.recordset;
};