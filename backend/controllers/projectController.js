import { sql, poolPromise } from '../config/db.js';
import { callGeminiAPI } from '../utils/geminiHelper.js';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Parse optional Bearer token from request to extract user info (role + id).
 * Returns { userId, role } or null if no valid token.
 */
function parseOptionalToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Normalize: decoded.userId or decoded.id
    const userId = decoded.userId || decoded.id;
    const role = decoded.role || decoded.roleDefault || null;
    return { userId, role };
  } catch {
    return null;
  }
}

/**
 * Get projects — filtered by authenticated user's role if a valid Bearer token is present:
 * - FREELANCER: only projects they have proposals for or contracts with
 * - EMPLOYER:   only projects they posted (employer_id)
 * - No token / other: all OPEN projects (public browsing)
 */
export const getProjects = async (req, res) => {
  try {
    const { q, categoryId, budgetMin, budgetMax, budgetType, filter } = req.query;
    const pool = await poolPromise;

    // 1. Check optional auth to determine role-based filtering
    const userInfo = parseOptionalToken(req);
    const isFreelancer = userInfo && userInfo.role === 'FREELANCER';
    const isEmployer   = userInfo && userInfo.role === 'EMPLOYER';

    let query = `
      SELECT p.*, pc.category_name, u.full_name as company_name, u.avatar_url
      FROM projects p
      LEFT JOIN project_categories pc ON p.category_id = pc.category_id
      LEFT JOIN users u ON p.employer_id = u.user_id
    `;

    const request = pool.request();

    const isReportSearch = req.query.report === 'true';

    if (isFreelancer && userInfo.userId && filter === 'my' && !isReportSearch) {
      // Freelancer: projects linked via proposals OR contracts
      const freelancerId = userInfo.userId;
      request.input('freelancerId', sql.Int, freelancerId);
      query += `
        INNER JOIN (
          SELECT DISTINCT project_id FROM proposals WHERE freelancer_id = @freelancerId
          UNION
          SELECT DISTINCT project_id FROM contracts WHERE freelancer_id = @freelancerId
        ) AS 参与 ON p.project_id = 参与.project_id
        WHERE 1=1
      `;
    } else if (isEmployer && userInfo.userId && filter === 'my' && !isReportSearch) {
      // Employer: only projects they posted
      request.input('employerId', sql.Int, userInfo.userId);
      query += ` WHERE p.employer_id = @employerId`;
    } else {
      // Anonymous / public (or logged-in browsing): show OPEN or IN_PROGRESS or COMPLETED if reporting/searching specifically
      if (q || isReportSearch) {
        query += ` WHERE p.status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'CLOSED', 'REJECTED')`;
      } else {
        query += ` WHERE p.status = 'OPEN'`;
      }
    }




    if (filter !== 'my') {
      // Apply filters for public browsing
      if (q) {
        request.input('search', sql.NVarChar, `%${q}%`);
        query += ` AND (p.title LIKE @search OR p.description LIKE @search)`;
      }

      if (categoryId) {
        request.input('categoryId', sql.Int, parseInt(categoryId));
        query += ` AND p.category_id = @categoryId`;
      }

      if (budgetMin) {
        request.input('budgetMin', sql.Decimal(18, 2), parseFloat(budgetMin));
        query += ` AND (p.budget_max >= @budgetMin OR p.budget_min >= @budgetMin)`;
      }

      if (budgetMax) {
        request.input('budgetMax', sql.Decimal(18, 2), parseFloat(budgetMax));
        query += ` AND (p.budget_min <= @budgetMax OR p.budget_max <= @budgetMax)`;
      }

      if (budgetType) {
        request.input('budgetType', sql.VarChar, budgetType.toUpperCase());
        query += ` AND p.budget_type = @budgetType`;
      }
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await request.query(query);

    // Fetch skills for each project
    const projects = result.recordset;
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

    res.json({ success: true, projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách dự án.' });
  }
};

/**
 * Get single project details by ID
 */
export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const result = await pool.request()
      .input('projectId', sql.Int, id)
      .query(`
        SELECT p.*, pc.category_name, u.full_name as company_name, u.avatar_url, u.address as location, u.email as contact_email, u.created_at as company_joined_at
        FROM projects p
        LEFT JOIN project_categories pc ON p.category_id = pc.category_id
        LEFT JOIN users u ON p.employer_id = u.user_id
        WHERE p.project_id = @projectId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy dự án.' });
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

    // Fetch proposals count and average bid
    const proposalsStats = await pool.request()
      .input('projectId', sql.Int, id)
      .query(`
        SELECT COUNT(*) as count, AVG(proposed_price) as avg_bid 
        FROM proposals 
        WHERE project_id = @projectId
      `);
    project.proposalsCount = proposalsStats.recordset[0].count || 0;
    project.averageBid = proposalsStats.recordset[0].avg_bid || 0;

    // Fetch related projects
    const relatedResult = await pool.request()
      .input('categoryId', sql.Int, project.category_id)
      .input('projectId', sql.Int, id)
      .query(`
        SELECT TOP 3 p.project_id, p.title, p.budget_min, p.budget_max, p.budget_type, p.deadline, pc.category_name
        FROM projects p
        LEFT JOIN project_categories pc ON p.category_id = pc.category_id
        WHERE p.category_id = @categoryId AND p.project_id != @projectId AND p.status = 'OPEN'
        ORDER BY p.created_at DESC
      `);
    project.relatedProjects = relatedResult.recordset;

    // Count total projects posted by this employer
    const employerStats = await pool.request()
      .input('employerId', sql.Int, project.employer_id)
      .query(`
        SELECT COUNT(*) as total_projects 
        FROM projects 
        WHERE employer_id = @employerId
      `);
    const totalProjects = employerStats.recordset[0].total_projects || 0;
    project.employerTotalProjects = totalProjects;

    // Calculate actual hire rate (projects that are IN_PROGRESS or COMPLETED)
    const hiredStats = await pool.request()
      .input('employerId', sql.Int, project.employer_id)
      .query(`
        SELECT COUNT(*) as hired_projects 
        FROM projects 
        WHERE employer_id = @employerId AND status IN ('IN_PROGRESS', 'COMPLETED')
      `);
    const hiredProjects = hiredStats.recordset[0].hired_projects || 0;
    project.employerHireRate = totalProjects > 0 ? Math.round((hiredProjects * 100) / totalProjects) : 0;

    res.json({ success: true, project });
  } catch (error) {
    console.error('Error fetching project by id:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy chi tiết dự án.' });
  }
};

/**
 * Get projects belonging to the logged-in Employer
 */
export const getEmployerProjects = async (req, res) => {
  try {
    const employerId = req.user.id;
    const pool = await poolPromise;

    const result = await pool.request()
      .input('employerId', sql.Int, employerId)
      .query(`
        SELECT p.*, pc.category_name
        FROM projects p
        LEFT JOIN project_categories pc ON p.category_id = pc.category_id
        WHERE p.employer_id = @employerId
        ORDER BY p.created_at DESC
      `);

    const projects = result.recordset;

    for (let project of projects) {
      // Fetch skills
      const skillsResult = await pool.request()
        .input('projectId', sql.Int, project.project_id)
        .query(`
          SELECT s.skill_name 
          FROM project_skills ps
          JOIN skills s ON ps.skill_id = s.skill_id
          WHERE ps.project_id = @projectId
        `);
      project.skills = skillsResult.recordset.map(r => r.skill_name);

      // Count proposals
      const proposalsResult = await pool.request()
        .input('projectId', sql.Int, project.project_id)
        .query(`SELECT COUNT(*) as count FROM proposals WHERE project_id = @projectId`);
      project.proposalsCount = proposalsResult.recordset[0].count;
    }

    res.json({ success: true, projects });
  } catch (error) {
    console.error('Error fetching employer projects:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách dự án của bạn.' });
  }
};

/**
 * Submit a proposal for a project (From develop)
 */
export const submitProposal = async (req, res) => {
  try {
    const { projectId } = req.params;
    const freelancerId = req.user.id; 
    let { proposedPrice, deliveryTimeDays, coverLetter, portfolioIds } = req.body;

    if (!proposedPrice || !deliveryTimeDays) {
      return res.status(400).json({ message: 'Vui lòng cung cấp giá thầu và thời gian ước tính.' });
    }

    if (parseFloat(proposedPrice) <= 0) {
      return res.status(400).json({ message: 'Giá thầu phải lớn hơn 0 VNĐ.' });
    }

    const pool = await poolPromise;

    const projectCheck = await pool.request()
      .input('projectId', sql.Int, projectId)
      .query('SELECT 1 FROM projects WHERE project_id = @projectId');
    
    if (projectCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy dự án để ứng tuyển.' });
    }

    const proposalCheck = await pool.request()
      .input('projectId', sql.Int, projectId)
      .input('freelancerId', sql.Int, freelancerId)
      .query('SELECT 1 FROM proposals WHERE project_id = @projectId AND freelancer_id = @freelancerId');

    if (proposalCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Bạn đã nộp đề xuất cho dự án này rồi.' });
    }

    let rawCoverLetter = coverLetter || '';
    if (req.file) {
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      coverLetter = `${coverLetter || ''}\n\n----------------------------------------\n[Tệp đính kèm bổ sung]: ${fileUrl}`;
    }

    // Parse selected portfolio IDs
    let selectedPortfolioIds = [];
    if (portfolioIds) {
      try {
        selectedPortfolioIds = typeof portfolioIds === 'string' ? JSON.parse(portfolioIds) : portfolioIds;
      } catch {
        selectedPortfolioIds = [];
      }
    }

    // Save chosen portfolio IDs to proposals table as JSON string, but do NOT attach them to cover letter text
    let portfolioIdsString = null;
    if (Array.isArray(selectedPortfolioIds) && selectedPortfolioIds.length > 0) {
      const validIds = selectedPortfolioIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (validIds.length > 0) {
        portfolioIdsString = JSON.stringify(validIds);
      }
    }

    const insertResult = await pool.request()
      .input('projectId', sql.Int, projectId)
      .input('freelancerId', sql.Int, freelancerId)
      .input('proposedPrice', sql.Decimal(12, 2), parseFloat(proposedPrice))
      .input('deliveryTimeDays', sql.Int, parseInt(deliveryTimeDays))
      .input('coverLetter', sql.NVarChar, coverLetter || '')
      .input('status', sql.VarChar, 'SUBMITTED')
      .input('portfolioIds', sql.NVarChar, portfolioIdsString)
      .query(`
        INSERT INTO proposals (project_id, freelancer_id, proposed_price, delivery_time_days, cover_letter, status, portfolio_ids, created_at)
        OUTPUT INSERTED.proposal_id
        VALUES (@projectId, @freelancerId, @proposedPrice, @deliveryTimeDays, @coverLetter, @status, @portfolioIds, SYSUTCDATETIME())
      `);

    const newProposalId = insertResult.recordset[0].proposal_id;

    res.status(201).json({ success: true, message: 'Nộp đề xuất ứng tuyển thành công! AI đang tiến hành đánh giá độ phù hợp của bạn ngầm.' });

    // Kích hoạt tác vụ phân tích AI ngầm dựa trên TOÀN BỘ hồ sơ cá nhân và Portfolio đã chọn
    processAIEvaluationInBackground(newProposalId, projectId, freelancerId, rawCoverLetter, selectedPortfolioIds);
  } catch (error) {
    console.error('Error submitting proposal:', error);
    res.status(500).json({ message: 'Lỗi server khi nộp đề xuất.' });
  }
};

// Tác vụ chạy ngầm phân tích hồ sơ freelancer và CV đã lưu bằng Gemini AI
async function processAIEvaluationInBackground(proposalId, projectId, freelancerId, coverLetterText, portfolioIds = []) {
  try {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS;
    if (!geminiKey) {
      console.warn("⚠️ GEMINI_API_KEY hoặc GEMINI_API_KEYS chưa được cấu hình. Bỏ qua phân tích AI.");
      return;
    }

    const pool = await poolPromise;

    // Lấy thông tin dự án
    const projectRes = await pool.request()
      .input('projectId', sql.Int, projectId)
      .query(`
        SELECT p.title, p.description, p.budget_min, p.budget_max,
               (SELECT STRING_AGG(s.skill_name, ', ') 
                FROM project_skills ps 
                JOIN skills s ON ps.skill_id = s.skill_id 
                WHERE ps.project_id = p.project_id) as required_skills
        FROM projects p 
        WHERE p.project_id = @projectId
      `);
    
    if (projectRes.recordset.length === 0) return;
    const project = projectRes.recordset[0];

    // Lấy TOÀN BỘ hồ sơ freelancer
    const freelancerRes = await pool.request()
      .input('freelancerId', sql.Int, freelancerId)
      .query(`
        SELECT u.full_name, u.bio, 
               fp.headline, fp.experience_years, fp.hourly_rate,
               fp.rating_average, fp.total_reviews, fp.portfolio_summary,
               fp.cv_ai_evaluation,
               (SELECT STRING_AGG(s.skill_name, ', ') 
                FROM freelancer_skills fs 
                JOIN skills s ON fs.skill_id = s.skill_id 
                WHERE fs.freelancer_id = u.user_id) as skills
        FROM users u 
        LEFT JOIN freelancer_profiles fp ON u.user_id = fp.freelancer_id
        WHERE u.user_id = @freelancerId
      `);
    
    if (freelancerRes.recordset.length === 0) return;
    const fl = freelancerRes.recordset[0];

    // Lấy chi tiết portfolio được đính kèm
    let selectedPortfoliosText = "";
    if (Array.isArray(portfolioIds) && portfolioIds.length > 0) {
      const validIds = portfolioIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (validIds.length > 0) {
        const portRes = await pool.request()
          .input('freelancerId', sql.Int, freelancerId)
          .query(`
            SELECT title, description, project_url 
            FROM portfolios 
            WHERE freelancer_id = @freelancerId AND portfolio_id IN (${validIds.join(',')})
          `);
        selectedPortfoliosText = portRes.recordset.map(p => `- ${p.title}: ${(p.description || '').substring(0, 200)}`).join('\n');
      }
    }

    // Trích xuất tóm tắt CV AI đã quét trước đó
    let cvSummary = "";
    if (fl.cv_ai_evaluation) {
      try {
        const cv = JSON.parse(fl.cv_ai_evaluation);
        cvSummary = `Chất lượng CV chung: ${cv.matchScore}/100. Tóm tắt: ${cv.quickSummary || ''}. Điểm mạnh CV: ${(cv.strengths || []).join(', ')}`;
      } catch {}
    }

    const systemInstruction = `
      Bạn là chuyên gia nhân sự AI của nền tảng FJMS. Nhiệm vụ của bạn là so sánh toàn bộ thông tin trong Hồ sơ cá nhân (Chức danh, Kỹ năng, Số năm kinh nghiệm, Mức giá/h, Portfolio), thông tin CV và giá thầu đề xuất của Freelancer với yêu cầu dự án của Nhà tuyển dụng.
      Hãy phân tích khách quan và trả về kết quả dưới dạng chuỗi JSON thuần túy (không chứa markdown \`\`\`json), ngôn ngữ Tiếng Việt, có cấu trúc như sau:
      {
        "matchScore": 88,
        "quickSummary": "Ứng viên sở hữu bộ kỹ năng khớp với dự án, số năm kinh nghiệm và mức thầu đề xuất rất hợp lý.",
        "strengths": [
          "Trùng khớp kỹ năng cốt lõi được yêu cầu trong dự án",
          "Số năm kinh nghiệm và thông tin hồ sơ năng lực đáp ứng tốt quy mô công việc",
          "Mức giá thầu đề xuất nằm trong khung ngân sách dự kiến của dự án",
          "Đánh giá sao cao và có lịch sử hoàn thành công việc uy tín"
        ],
        "gaps": ["Cần làm rõ thêm quy trình triển khai chi tiết trong buổi trao đổi trực tiếp"]
      }
    `;

    const userPrompt = `
      --- YÊU CẦU DỰ ÁN ---
      Tiêu đề: ${project.title}
      Mô tả: ${(project.description || '').substring(0, 600)}
      Kỹ năng yêu cầu: ${project.required_skills || 'N/A'}
      Ngân sách: ${project.budget_min || 0} - ${project.budget_max || 0} VNĐ

      --- HỒ SƠ FREELANCER ---
      Tên: ${fl.full_name}
      Chức danh: ${fl.headline || 'Chưa cung cấp'}
      Số năm kinh nghiệm: ${fl.experience_years || 0} năm
      Giá theo giờ: ${fl.hourly_rate || 0} VNĐ/h
      Đánh giá: ${fl.rating_average || 0}/5.0 (${fl.total_reviews || 0} đánh giá)
      Kỹ năng trên hệ thống: ${fl.skills || 'N/A'}
      Giới thiệu (Bio): ${(fl.bio || '').substring(0, 400)}
      ${cvSummary ? `Đánh giá CV trước đó: ${cvSummary}` : ''}
      ${selectedPortfoliosText ? `Portfolio đính kèm trong đề xuất:\n${selectedPortfoliosText}` : ''}

      --- THƯ GIỚI THIỆU (COVER LETTER) ---
      ${(coverLetterText || '').substring(0, 500)}
    `;

    try {
      const aiEvaluation = await callGeminiAPI(userPrompt, systemInstruction, "application/json", 0.2);
      
      // Cập nhật Database
      await pool.request()
        .input('proposalId', sql.Int, proposalId)
        .input('aiEvaluation', sql.NVarChar, aiEvaluation)
        .query('UPDATE proposals SET ai_evaluation = @aiEvaluation WHERE proposal_id = @proposalId');
      
      console.log(`[AI Profile Matcher] Phân tích thành công đề xuất ID: ${proposalId}`);
    } catch (apiErr) {
      console.error(`[AI Profile Matcher] Lỗi từ Gemini API:`, apiErr.message);

      // Ghi nhận phản hồi fallback khi hết hạn ngạch hoặc lỗi API để không bị ẩn khung giao diện
      const fallbackEvaluation = JSON.stringify({
        matchScore: 50,
        quickSummary: "Hệ thống AI của nền tảng tạm thời hết lượt yêu cầu miễn phí trong ngày (Gemini API Resource Exhausted). Vui lòng thử lại sau hoặc cấu hình gói khóa API trả phí.",
        strengths: ["Kỹ năng cơ bản của ứng viên đáp ứng yêu cầu"],
        gaps: ["Hạn ngạch API Gemini tạm thời vượt giới hạn"]
      });

      await pool.request()
        .input('proposalId', sql.Int, proposalId)
        .input('aiEvaluation', sql.NVarChar, fallbackEvaluation)
        .query('UPDATE proposals SET ai_evaluation = @aiEvaluation WHERE proposal_id = @proposalId');
    }
  } catch (error) {
    console.error("[AI Profile Matcher] Lỗi tiến trình ngầm:", error);
  }
}

/**
 * Get all project categories (From develop)
 */
export const getCategories = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT category_id, category_name FROM project_categories');
    res.json({ success: true, categories: result.recordset });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách danh mục.' });
  }
};

/**
 * Create a new Project
 */
export const createProject = async (req, res) => {
  try {
    const employerId = req.user.id;
    const title = req.body.title;
    const description = req.body.description;
    const category_id = req.body.category_id || req.body.categoryId;
    const budget_type = req.body.budget_type || req.body.budgetType;
    const budget_min = req.body.budget_min || req.body.budgetMin;
    const budget_max = req.body.budget_max || req.body.budgetMax;
    const required_freelancer_count = req.body.required_freelancer_count || req.body.requiredFreelancerCount;
    const deadline = req.body.deadline;
    let skills = req.body.skills;
    if (typeof skills === 'string') {
      try {
        skills = JSON.parse(skills);
      } catch (e) {
        skills = skills.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    if (!title || !description || !budget_type) {
      return res.status(400).json({ message: 'Vui lòng cung cấp tiêu đề, mô tả và loại ngân sách.' });
    }

    const pool = await poolPromise;

    let categoryId = parseInt(category_id);
    const customCategory = req.body.customCategory;
    if ((isNaN(categoryId) || category_id === 'other') && customCategory && customCategory.trim()) {
      const catCheck = await pool.request()
        .input('categoryName', sql.NVarChar, customCategory.trim())
        .query(`SELECT category_id FROM project_categories WHERE category_name = @categoryName`);
      
      if (catCheck.recordset.length > 0) {
        categoryId = catCheck.recordset[0].category_id;
      } else {
        const catInsert = await pool.request()
          .input('categoryName', sql.NVarChar, customCategory.trim())
          .query(`INSERT INTO project_categories (category_name) VALUES (@categoryName); SELECT SCOPE_IDENTITY() AS category_id;`);
        categoryId = catInsert.recordset[0].category_id;
      }
    } else if (isNaN(categoryId)) {
      const catMap = {
        'web': 1, 'Programming': 1,
        'design': 2, 'Design': 2,
        'writing': 3, 'Writing': 3,
        'translation': 4, 'Translation': 4,
        'accounting': 1, 'marketing': 5, 'Marketing': 5
      };
      categoryId = catMap[category_id] || 1; 
    }

    const bType = budget_type.toUpperCase() === 'HOURLY' ? 'HOURLY' : 'FIXED';
    const numFreelancers = required_freelancer_count ? parseInt(required_freelancer_count) : 1;
    const deadlineDate = deadline ? new Date(deadline) : null;

    if (deadlineDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (deadlineDate < today) {
        return res.status(400).json({ message: 'Hạn chót hoàn thành không được ở trong quá khứ.' });
      }
    }

    let attachmentUrl = null;
    if (req.file) {
      attachmentUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    const result = await pool.request()
      .input('employerId', sql.Int, employerId)
      .input('categoryId', sql.Int, categoryId)
      .input('title', sql.NVarChar, title)
      .input('description', sql.NVarChar, description)
      .input('budgetType', sql.VarChar, bType)
      .input('budgetMin', sql.Decimal(18, 2), budget_min ? parseFloat(budget_min) : null)
      .input('budgetMax', sql.Decimal(18, 2), budget_max ? parseFloat(budget_max) : null)
      .input('requiredFreelancerCount', sql.Int, numFreelancers)
      .input('deadline', sql.Date, deadlineDate)
      .input('attachmentUrl', sql.NVarChar, attachmentUrl)
      .query(`
        INSERT INTO projects (employer_id, category_id, title, description, budget_type, budget_min, budget_max, required_freelancer_count, deadline, status, attachment_url, created_at)
        VALUES (@employerId, @categoryId, @title, @description, @budgetType, @budgetMin, @budgetMax, @requiredFreelancerCount, @deadline, 'CLOSED', @attachmentUrl, SYSUTCDATETIME());
        SELECT SCOPE_IDENTITY() AS project_id;
      `);

    const projectId = result.recordset[0].project_id;

    if (Array.isArray(skills) && skills.length > 0) {
      for (let skillName of skills) {
        if (!skillName.trim()) continue;

        let skillResult = await pool.request()
          .input('skillName', sql.NVarChar, skillName.trim())
          .query(`SELECT skill_id FROM skills WHERE skill_name = @skillName`);

        let skillId;
        if (skillResult.recordset.length === 0) {
          const insertSkill = await pool.request()
            .input('skillName', sql.NVarChar, skillName.trim())
            .query(`
              INSERT INTO skills (skill_name, created_at)
              VALUES (@skillName, SYSUTCDATETIME());
              SELECT SCOPE_IDENTITY() AS skill_id;
            `);
          skillId = insertSkill.recordset[0].skill_id;
        } else {
          skillId = skillResult.recordset[0].skill_id;
        }

        await pool.request()
          .input('projectId', sql.Int, projectId)
          .input('skillId', sql.Int, skillId)
          .query(`
            IF NOT EXISTS (SELECT 1 FROM project_skills WHERE project_id = @projectId AND skill_id = @skillId)
            BEGIN
              INSERT INTO project_skills (project_id, skill_id, created_at)
              VALUES (@projectId, @skillId, SYSUTCDATETIME());
            END
          `);
      }
    }

    res.status(201).json({ success: true, message: 'Đăng dự án thành công!', projectId });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ message: 'Lỗi server khi đăng dự án mới.' });
  }
};

/**
 * Update project details
 */
export const updateProject = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { id } = req.params;
    const title = req.body.title;
    const description = req.body.description;
    const category_id = req.body.category_id || req.body.categoryId;
    const budget_type = req.body.budget_type || req.body.budgetType;
    const budget_min = req.body.budget_min || req.body.budgetMin;
    const budget_max = req.body.budget_max || req.body.budgetMax;
    const required_freelancer_count = req.body.required_freelancer_count || req.body.requiredFreelancerCount;
    const deadline = req.body.deadline;
    let skills = req.body.skills;
    if (typeof skills === 'string') {
      try {
        skills = JSON.parse(skills);
      } catch (e) {
        skills = skills.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    if (!title || !description || !budget_type) {
      return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc.' });
    }

    const deadlineDate = deadline ? new Date(deadline) : null;
    if (deadlineDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (deadlineDate < today) {
        return res.status(400).json({ message: 'Hạn chót hoàn thành không được ở trong quá khứ.' });
      }
    }

    const pool = await poolPromise;

    const ownerCheck = await pool.request()
      .input('projectId', sql.Int, id)
      .query(`SELECT employer_id FROM projects WHERE project_id = @projectId`);

    if (ownerCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy dự án.' });
    }

    if (ownerCheck.recordset[0].employer_id !== employerId) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa dự án này.' });
    }

    let categoryId = parseInt(category_id);
    const customCategory = req.body.customCategory;
    if ((isNaN(categoryId) || category_id === 'other') && customCategory && customCategory.trim()) {
      const catCheck = await pool.request()
        .input('categoryName', sql.NVarChar, customCategory.trim())
        .query(`SELECT category_id FROM project_categories WHERE category_name = @categoryName`);
      
      if (catCheck.recordset.length > 0) {
        categoryId = catCheck.recordset[0].category_id;
      } else {
        const catInsert = await pool.request()
          .input('categoryName', sql.NVarChar, customCategory.trim())
          .query(`INSERT INTO project_categories (category_name) VALUES (@categoryName); SELECT SCOPE_IDENTITY() AS category_id;`);
        categoryId = catInsert.recordset[0].category_id;
      }
    } else if (isNaN(categoryId)) {
      const catMap = {
        'web': 1, 'Programming': 1,
        'design': 2, 'Design': 2,
        'writing': 3, 'Writing': 3,
        'translation': 4, 'Translation': 4,
        'accounting': 1, 'marketing': 5, 'Marketing': 5
      };
      categoryId = catMap[category_id] || 1;
    }

    const bType = budget_type.toUpperCase() === 'HOURLY' ? 'HOURLY' : 'FIXED';
    const numFreelancers = required_freelancer_count ? parseInt(required_freelancer_count) : 1;

    let attachmentUrl = undefined;
    if (req.file) {
      attachmentUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    let updateQuery = `
      UPDATE projects
      SET category_id = @categoryId,
          title = @title,
          description = @description,
          budget_type = @budgetType,
          budget_min = @budgetMin,
          budget_max = @budgetMax,
          required_freelancer_count = @requiredFreelancerCount,
          deadline = @deadline,
          updated_at = SYSUTCDATETIME()
    `;
    
    const request = pool.request()
      .input('projectId', sql.Int, id)
      .input('categoryId', sql.Int, categoryId)
      .input('title', sql.NVarChar, title)
      .input('description', sql.NVarChar, description)
      .input('budgetType', sql.VarChar, bType)
      .input('budgetMin', sql.Decimal(18, 2), budget_min ? parseFloat(budget_min) : null)
      .input('budgetMax', sql.Decimal(18, 2), budget_max ? parseFloat(budget_max) : null)
      .input('requiredFreelancerCount', sql.Int, numFreelancers)
      .input('deadline', sql.Date, deadlineDate);

    if (attachmentUrl !== undefined) {
      updateQuery += `, attachment_url = @attachmentUrl`;
      request.input('attachmentUrl', sql.NVarChar, attachmentUrl);
    }
    
    updateQuery += ` WHERE project_id = @projectId`;

    await request.query(updateQuery);

    await pool.request()
      .input('projectId', sql.Int, id)
      .query(`DELETE FROM project_skills WHERE project_id = @projectId`);

    if (Array.isArray(skills) && skills.length > 0) {
      for (let skillName of skills) {
        if (!skillName.trim()) continue;

        let skillResult = await pool.request()
          .input('skillName', sql.NVarChar, skillName.trim())
          .query(`SELECT skill_id FROM skills WHERE skill_name = @skillName`);

        let skillId;
        if (skillResult.recordset.length === 0) {
          const insertSkill = await pool.request()
            .input('skillName', sql.NVarChar, skillName.trim())
            .query(`
              INSERT INTO skills (skill_name, created_at)
              VALUES (@skillName, SYSUTCDATETIME());
              SELECT SCOPE_IDENTITY() AS skill_id;
            `);
          skillId = insertSkill.recordset[0].skill_id;
        } else {
          skillId = skillResult.recordset[0].skill_id;
        }

        await pool.request()
          .input('projectId', sql.Int, id)
          .input('skillId', sql.Int, skillId)
          .query(`
            IF NOT EXISTS (SELECT 1 FROM project_skills WHERE project_id = @projectId AND skill_id = @skillId)
            BEGIN
              INSERT INTO project_skills (project_id, skill_id, created_at)
              VALUES (@projectId, @skillId, SYSUTCDATETIME());
            END
          `);
      }
    }

    res.json({ success: true, message: 'Cập nhật dự án thành công!' });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật dự án.' });
  }
};

/**
 * Close project (Status = CLOSED)
 */
export const closeProject = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { id } = req.params;
    const pool = await poolPromise;

    const ownerCheck = await pool.request()
      .input('projectId', sql.Int, id)
      .query(`SELECT employer_id FROM projects WHERE project_id = @projectId`);

    if (ownerCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy dự án.' });
    }

    if (ownerCheck.recordset[0].employer_id !== employerId) {
      return res.status(403).json({ message: 'Bạn không có quyền đóng dự án này.' });
    }

    await pool.request()
      .input('projectId', sql.Int, id)
      .query(`
        UPDATE projects
        SET status = 'CLOSED',
            updated_at = SYSUTCDATETIME()
        WHERE project_id = @projectId
      `);

    res.json({ success: true, message: 'Dự án đã được đóng thành công!' });
  } catch (error) {
    console.error('Error closing project:', error);
    res.status(500).json({ message: 'Lỗi hệ thống khi đóng dự án.' });
  }
};

/**
 * Get all proposals for a specific project (Employer only)
 */
export const getProjectProposals = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { projectId } = req.params;
    const pool = await poolPromise;

    // Verify project owner
    const projectCheck = await pool.request()
      .input('projectId', sql.Int, projectId)
      .query('SELECT employer_id, title FROM projects WHERE project_id = @projectId');

    if (projectCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy dự án.' });
    }

    if (projectCheck.recordset[0].employer_id !== employerId) {
      return res.status(403).json({ message: 'Bạn không có quyền xem các đề xuất của dự án này.' });
    }

    const proposalsResult = await pool.request()
      .input('projectId', sql.Int, projectId)
      .query(`
        SELECT 
          p.proposal_id,
          p.project_id,
          p.freelancer_id,
          p.proposed_price,
          p.delivery_time_days,
          p.cover_letter,
          p.status,
          p.ai_evaluation,
          p.portfolio_ids,
          p.created_at,
          p.updated_at,
          u.full_name as freelancer_name,
          u.avatar_url as freelancer_avatar,
          fp.headline,
          fp.rating_average,
          fp.total_reviews,
          c.contract_id
        FROM proposals p
        JOIN users u ON p.freelancer_id = u.user_id
        LEFT JOIN freelancer_profiles fp ON p.freelancer_id = fp.freelancer_id
        LEFT JOIN contracts c ON p.project_id = c.project_id AND p.freelancer_id = c.freelancer_id
        WHERE p.project_id = @projectId
        ORDER BY p.created_at DESC
      `);

    const proposals = proposalsResult.recordset;
    if (proposals.length > 0) {
      const freelancerIds = [...new Set(proposals.map(p => p.freelancer_id))];
      const portfoliosResult = await pool.request()
        .query(`
          SELECT portfolio_id, freelancer_id, title, description, project_url, image_url
          FROM portfolios
          WHERE freelancer_id IN (${freelancerIds.join(',')})
        `);
      
      const portfoliosMap = {};
      portfoliosResult.recordset.forEach(port => {
        if (!portfoliosMap[port.freelancer_id]) {
          portfoliosMap[port.freelancer_id] = [];
        }
        portfoliosMap[port.freelancer_id].push(port);
      });

      proposals.forEach(p => {
        let selectedIds = [];
        let selectedTitles = [];
        let hasPortfolioIds = false;

        if (p.portfolio_ids) {
          try {
            selectedIds = JSON.parse(p.portfolio_ids).map(id => parseInt(id, 10));
            if (selectedIds.length > 0) {
              hasPortfolioIds = true;
            }
          } catch {
            selectedIds = [];
          }
        }
        
        // Fallback for old proposals: parse titles from cover letter
        if (!hasPortfolioIds && p.cover_letter) {
          const portMarker = '📁 [Dự án Portfolio đính kèm]:';
          const index = p.cover_letter.indexOf(portMarker);
          if (index !== -1) {
            const lines = p.cover_letter.substring(index + portMarker.length).split('\n');
            lines.forEach(line => {
              if (line.trim().startsWith('•')) {
                // Extract title
                const match = line.match(/•\s*([^:(]+)/);
                if (match) {
                  selectedTitles.push(match[1].trim().toLowerCase());
                }
              }
            });
          }
        }

        const freelancerPorts = portfoliosMap[p.freelancer_id] || [];
        if (hasPortfolioIds) {
          p.portfolios = freelancerPorts.filter(port => selectedIds.includes(port.portfolio_id));
        } else if (selectedTitles.length > 0) {
          p.portfolios = freelancerPorts.filter(port => 
            selectedTitles.some(title => port.title.toLowerCase().includes(title) || title.includes(port.title.toLowerCase()))
          );
        } else {
          p.portfolios = [];
        }
      });
    }

    res.json({ 
      success: true, 
      projectTitle: projectCheck.recordset[0].title,
      proposals: proposals 
    });
  } catch (error) {
    console.error('Error fetching project proposals:', error);
    res.status(500).json({ message: 'Lỗi hệ thống khi lấy danh sách đề xuất.' });
  }
};

/**
 * Update proposal status (Employer only)
 */
export const updateProposalStatus = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { proposalId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['ACCEPTED', 'REJECTED', 'SHORTLISTED', 'SUBMITTED', 'WITHDRAWN', 'CANCELED'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Trạng thái đề xuất không hợp lệ.' });
    }

    const pool = await poolPromise;

    // Verify that the proposal exists and that the employer owns the project
    const proposalCheck = await pool.request()
      .input('proposalId', sql.Int, proposalId)
      .query(`
        SELECT p.status, pr.employer_id, pr.project_id
        FROM proposals p
        JOIN projects pr ON p.project_id = pr.project_id
        WHERE p.proposal_id = @proposalId
      `);

    if (proposalCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đề xuất.' });
    }

    const proposal = proposalCheck.recordset[0];
    if (proposal.employer_id !== employerId) {
      return res.status(403).json({ message: 'Bạn không có quyền cập nhật đề xuất này.' });
    }

    await pool.request()
      .input('proposalId', sql.Int, proposalId)
      .input('status', sql.VarChar(30), status)
      .query(`
        UPDATE proposals
        SET status = @status, updated_at = SYSUTCDATETIME()
        WHERE proposal_id = @proposalId
      `);

    res.json({ success: true, message: 'Cập nhật trạng thái đề xuất thành công!' });
  } catch (error) {
    console.error('Error updating proposal status:', error);
    res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật trạng thái đề xuất.' });
  }
};

/**
 * Delete a project (Employer only)
 */
export const deleteProject = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { id } = req.params;
    const pool = await poolPromise;

    // 1. Verify project existence and ownership
    const ownerCheck = await pool.request()
      .input('projectId', sql.Int, id)
      .query(`SELECT employer_id, status FROM projects WHERE project_id = @projectId`);

    if (ownerCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy dự án.' });
    }

    const userRole = req.user.role || req.user.roleDefault || req.user.role_default;
    if (ownerCheck.recordset[0].employer_id !== employerId && userRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Bạn không có quyền xóa dự án này.' });
    }

    // 2. Prevent deletion of projects with active contracts
    const contractCheck = await pool.request()
      .input('projectId', sql.Int, id)
      .query(`SELECT COUNT(*) as count FROM contracts WHERE project_id = @projectId`);
    
    if (contractCheck.recordset[0].count > 0) {
      return res.status(400).json({ message: 'Không thể xóa dự án đã có hợp đồng (đã thuê freelancer).' });
    }

    // 3. Cascading delete inside database transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      // Delete project skills
      await transaction.request()
        .input('projectId', sql.Int, id)
        .query(`DELETE FROM project_skills WHERE project_id = @projectId`);

      // Delete proposals
      await transaction.request()
        .input('projectId', sql.Int, id)
        .query(`DELETE FROM proposals WHERE project_id = @projectId`);

      // Delete messages
      await transaction.request()
        .input('projectId', sql.Int, id)
        .query(`DELETE FROM messages WHERE project_id = @projectId`);

      // Delete project invitations
      await transaction.request()
        .input('projectId', sql.Int, id)
        .query(`DELETE FROM project_invitations WHERE project_id = @projectId`);

      // Nullify references in violation reports so we don't break history
      await transaction.request()
        .input('projectId', sql.Int, id)
        .query(`UPDATE violation_reports SET entity_id = NULL WHERE entity_type = 'PROJECT' AND entity_id = @projectId`);

      // Delete project
      await transaction.request()
        .input('projectId', sql.Int, id)
        .query(`DELETE FROM projects WHERE project_id = @projectId`);

      await transaction.commit();
      res.json({ success: true, message: 'Dự án đã được xóa thành công!' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Lỗi hệ thống khi xóa dự án.' });
  }
};