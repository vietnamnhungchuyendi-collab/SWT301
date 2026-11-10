import { sql, poolPromise } from '../config/db.js';

/**
 * Get all projects pending admin approval (status = CLOSED)
 * Only ADMIN can access this
 */
export const getPendingProjects = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.max(parseInt(limit, 10) || 10, 1);
    const offset = (pageNum - 1) * lim;

    const pool = await poolPromise;

    let whereClause = "WHERE p.status = 'CLOSED'";
    if (q) {
      whereClause += ` AND (p.title LIKE @search OR u.full_name LIKE @search)`;
    }

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM projects p
      LEFT JOIN users u ON p.employer_id = u.user_id
      ${whereClause}
    `;

    const countReq = pool.request();
    if (q) {
      countReq.input('search', sql.NVarChar, `%${q}%`);
    }
    const countResult = await countReq.query(countQuery);
    const total = countResult.recordset[0]?.total || 0;
    const totalPages = Math.max(Math.ceil(total / lim), 1);

    // Get paged results
    const listReq = pool.request();
    if (q) {
      listReq.input('search', sql.NVarChar, `%${q}%`);
    }
    listReq.input('offset', sql.Int, offset);
    listReq.input('limit', sql.Int, lim);

    const listQuery = `
      SELECT p.project_id, p.title, p.description, p.budget_type, p.budget_min, p.budget_max,
             p.required_freelancer_count, p.deadline, p.status, p.created_at,
             u.full_name as employer_name, u.email as employer_email,
             pc.category_name
      FROM projects p
      LEFT JOIN users u ON p.employer_id = u.user_id
      LEFT JOIN project_categories pc ON p.category_id = pc.category_id
      ${whereClause}
      ORDER BY p.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const listResult = await listReq.query(listQuery);
    const projects = listResult.recordset;

    // Fetch skills for each project
    for (let project of projects) {
      const skillsResult = await pool.request()
        .input('projectId', sql.Int, project.project_id)
        .query(`
          SELECT s.skill_name 
          FROM project_skills ps
          JOIN skills s ON ps.skill_id = s.skill_id
          WHERE ps.project_id = @projectId
        `);
      project.skills = skillsResult.recordset.map(r => r.skill_name);
    }

    res.json({
      success: true,
      data: {
        projects,
        total,
        page: pageNum,
        limit: lim,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching pending projects:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách dự án chờ duyệt.' });
  }
};

/**
 * Admin approves a project (OPEN)
 */
export const approveProject = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const projectCheck = await pool.request()
      .input('projectId', sql.Int, id)
      .query("SELECT status FROM projects WHERE project_id = @projectId");

    if (projectCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dự án.' });
    }

    if (projectCheck.recordset[0].status !== 'CLOSED') {
      return res.status(400).json({ success: false, message: 'Dự án không ở trạng thái chờ duyệt.' });
    }

    await pool.request()
      .input('projectId', sql.Int, id)
      .query(`
        UPDATE projects 
        SET status = 'OPEN', updated_at = SYSUTCDATETIME() 
        WHERE project_id = @projectId
      `);

    res.json({ success: true, message: 'Dự án đã được duyệt thành công!' });
  } catch (error) {
    console.error('Error approving project:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi duyệt dự án.' });
  }
};

/**
 * Admin rejects a project (keeps CLOSED)
 */
export const rejectProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const pool = await poolPromise;

    const projectCheck = await pool.request()
      .input('projectId', sql.Int, id)
      .query("SELECT status FROM projects WHERE project_id = @projectId");

    if (projectCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dự án.' });
    }

    if (projectCheck.recordset[0].status !== 'CLOSED') {
      return res.status(400).json({ success: false, message: 'Dự án không ở trạng thái chờ duyệt.' });
    }

    await pool.request()
      .input('projectId', sql.Int, id)
      .query(`
        UPDATE projects 
        SET status = 'REJECTED', updated_at = SYSUTCDATETIME() 
        WHERE project_id = @projectId
      `);

    res.json({ success: true, message: 'Dự án đã bị từ chối.' });
  } catch (error) {
    console.error('Error rejecting project:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi từ chối dự án.' });
  }
};

/**
 * Get project detail for admin moderation
 */
export const getProjectDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool.request()
      .input('projectId', sql.Int, id)
      .query(`
        SELECT p.*, pc.category_name, u.full_name as employer_name, u.email as employer_email,
               u.avatar_url as employer_avatar, u.phone as employer_phone
        FROM projects p
        LEFT JOIN project_categories pc ON p.category_id = pc.category_id
        LEFT JOIN users u ON p.employer_id = u.user_id
        WHERE p.project_id = @projectId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dự án.' });
    }

    const project = result.recordset[0];

    // Fetch skills
    const skillsResult = await pool.request()
      .input('projectId', sql.Int, id)
      .query(`
        SELECT s.skill_name 
        FROM project_skills ps
        JOIN skills s ON ps.skill_id = s.skill_id
        WHERE ps.project_id = @projectId
      `);
    project.skills = skillsResult.recordset.map(r => r.skill_name);

    res.json({ success: true, data: project });
  } catch (error) {
    console.error('Error fetching project detail:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy chi tiết dự án.' });
  }
};

/**
 * Get all projects regardless of status (with filters) for admin management
 */
export const getAllProjectsAdmin = async (req, res) => {
  try {
    const { q, status, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.max(parseInt(limit, 10) || 10, 1);
    const offset = (pageNum - 1) * lim;

    const pool = await poolPromise;
    const request = pool.request();

    let whereClause = "WHERE 1=1";
    if (q) {
      request.input('search', sql.NVarChar, `%${q}%`);
      whereClause += ` AND (p.title LIKE @search OR u.full_name LIKE @search)`;
    }
    if (status) {
      request.input('status', sql.VarChar, status);
      whereClause += ` AND p.status = @status`;
    }

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM projects p
      LEFT JOIN users u ON p.employer_id = u.user_id
      ${whereClause}
    `;
    const countResult = await request.query(countQuery);
    const total = countResult.recordset[0]?.total || 0;
    const totalPages = Math.max(Math.ceil(total / lim), 1);

    // Get paged results
    const listReq = pool.request();
    if (q) {
      listReq.input('search', sql.NVarChar, `%${q}%`);
    }
    if (status) {
      listReq.input('status', sql.VarChar, status);
    }
    listReq.input('offset', sql.Int, offset);
    listReq.input('limit', sql.Int, lim);

    const listQuery = `
      SELECT p.project_id, p.title, p.description, p.budget_type, p.budget_min, p.budget_max,
             p.required_freelancer_count, p.deadline, p.status, p.created_at,
             u.full_name as employer_name, u.email as employer_email,
             pc.category_name
      FROM projects p
      LEFT JOIN users u ON p.employer_id = u.user_id
      LEFT JOIN project_categories pc ON p.category_id = pc.category_id
      ${whereClause}
      ORDER BY p.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const listResult = await listReq.query(listQuery);
    const projects = listResult.recordset;

    // Fetch skills
    for (let project of projects) {
      const skillsResult = await pool.request()
        .input('projectId', sql.Int, project.project_id)
        .query(`
          SELECT s.skill_name 
          FROM project_skills ps
          JOIN skills s ON ps.skill_id = s.skill_id
          WHERE ps.project_id = @projectId
        `);
      project.skills = skillsResult.recordset.map(r => r.skill_name);
    }

    res.json({
      success: true,
      data: {
        projects,
        total,
        page: pageNum,
        limit: lim,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching all projects:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách dự án.' });
  }
};