import { sql, poolPromise } from '../config/db.js';
import { callGeminiAPI } from '../utils/geminiHelper.js';

/**
  * Employer invites a freelancer to a project
  */
export const createInvitation = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { projectId, freelancerId, message } = req.body;

    if (!projectId || !freelancerId) {
      return res.status(400).json({ success: false, message: 'Thiếu projectId hoặc freelancerId.' });
    }

    const pool = await poolPromise;

    // 1. Kiểm tra dự án có tồn tại và thuộc về Employer không
    const projectRes = await pool.request()
      .input('projectId', sql.Int, projectId)
      .query('SELECT employer_id, status, title FROM projects WHERE project_id = @projectId');
    
    if (projectRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dự án.' });
    }

    const project = projectRes.recordset[0];
    if (project.employer_id !== employerId) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền mời dự án này.' });
    }

    if (project.status !== 'OPEN') {
      return res.status(400).json({ success: false, message: 'Dự án này không còn nhận đề xuất ứng tuyển.' });
    }

    // 2. Kiểm tra xem đã mời hoặc freelancer đã ứng tuyển chưa
    const checkInvite = await pool.request()
      .input('projectId', sql.Int, projectId)
      .input('freelancerId', sql.Int, freelancerId)
      .query(`
        SELECT 1 FROM project_invitations WHERE project_id = @projectId AND freelancer_id = @freelancerId AND status = 'PENDING'
        UNION
        SELECT 1 FROM proposals WHERE project_id = @projectId AND freelancer_id = @freelancerId
      `);
    
    if (checkInvite.recordset.length > 0) {
      return res.status(400).json({ success: false, message: 'Đã có lời mời đang chờ hoặc Freelancer đã nộp đề xuất cho dự án này.' });
    }

    // 3. Thêm bản ghi lời mời
    await pool.request()
      .input('projectId', sql.Int, projectId)
      .input('employerId', sql.Int, employerId)
      .input('freelancerId', sql.Int, freelancerId)
      .input('message', sql.NVarChar, message || '')
      .query(`
        INSERT INTO project_invitations (project_id, employer_id, freelancer_id, message, status, created_at, updated_at)
        VALUES (@projectId, @employerId, @freelancerId, @message, 'PENDING', GETDATE(), GETDATE())
      `);

    // 4. Lấy thông tin Employer để gửi thông báo Socket
    const empInfo = await pool.request()
      .input('empId', sql.Int, employerId)
      .query('SELECT full_name FROM users WHERE user_id = @empId');
    const employerName = empInfo.recordset[0]?.full_name || 'Nhà tuyển dụng';

    // 5. Gửi thông báo Socket.io thời gian thực nếu freelancer online
    const io = req.app.get('socketio');
    const activeUsers = req.app.get('activeUsers');
    if (io && activeUsers) {
      const freelancerSession = activeUsers.get(Number(freelancerId));
      if (freelancerSession && freelancerSession.socketId) {
        io.to(freelancerSession.socketId).emit('new_project_invitation', {
          projectId: Number(projectId),
          projectTitle: project.title,
          employerName,
          message: message || ''
        });
      }
    }

    // Trả về kết quả
    res.status(201).json({ 
      success: true, 
      message: 'Gửi lời mời ứng tuyển dự án thành công!',
      employerName,
      projectTitle: project.title
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo lời mời.' });
  }
};

/**
 * Get all invitations received by the freelancer
 */
export const getFreelancerInvitations = async (req, res) => {
  try {
    const freelancerId = req.user.id;
    const pool = await poolPromise;

    const result = await pool.request()
      .input('freelancerId', sql.Int, freelancerId)
      .query(`
        SELECT pi.*, p.title as project_title, p.description as project_description, u.full_name as employer_name, u.avatar_url as employer_avatar
        FROM project_invitations pi
        JOIN projects p ON pi.project_id = p.project_id
        JOIN users u ON pi.employer_id = u.user_id
        WHERE pi.freelancer_id = @freelancerId
        ORDER BY pi.created_at DESC
      `);

    res.json({ success: true, invitations: result.recordset });
  } catch (error) {
    console.error('Error fetching freelancer invitations:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách lời mời.' });
  }
};

/**
 * Freelancer responds to invitation (ACCEPT or DECLINE)
 */
export const respondToInvitation = async (req, res) => {
  try {
    const freelancerId = req.user.id;
    const invitationId = parseInt(req.params.id, 10);
    const { status } = req.body; // 'ACCEPTED' or 'DECLINED'

    if (isNaN(invitationId) || !['ACCEPTED', 'DECLINED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Dữ liệu phản hồi không hợp lệ.' });
    }

    const pool = await poolPromise;

    // 1. Kiểm tra lời mời có tồn tại và thuộc về Freelancer không
    const inviteRes = await pool.request()
      .input('invitationId', sql.Int, invitationId)
      .query('SELECT * FROM project_invitations WHERE invitation_id = @invitationId');
    
    if (inviteRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lời mời.' });
    }

    const invite = inviteRes.recordset[0];
    if (invite.freelancer_id !== freelancerId) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện hành động này.' });
    }

    if (invite.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Lời mời này đã được phản hồi trước đó.' });
    }

    if (status === 'ACCEPTED') {
      // 2. Chấp nhận: Cập nhật status lời mời và tự động tạo proposal ứng tuyển
      // Để tạo proposal, chúng ta lấy giá đề xuất mặc định của freelancer hoặc giá thương lượng
      const flProfileRes = await pool.request()
        .input('freelancerId', sql.Int, freelancerId)
        .query('SELECT hourly_rate FROM freelancer_profiles WHERE freelancer_id = @freelancerId');
      
      const hourlyRate = flProfileRes.recordset[0]?.hourly_rate || 100000;
      
      // Tạo proposal
      await pool.request()
        .input('projectId', sql.Int, invite.project_id)
        .input('freelancerId', sql.Int, freelancerId)
        .input('proposedPrice', sql.Decimal(12, 2), hourlyRate * 8) // Giả định đề xuất theo giá 1 ngày làm việc (8 giờ) làm mốc cơ sở
        .input('deliveryTimeDays', sql.Int, 7) // Thời hạn mặc định 7 ngày
        .input('coverLetter', sql.NVarChar, `Được chấp nhận từ lời mời của Nhà tuyển dụng: "${invite.message || ''}"`)
        .query(`
          INSERT INTO proposals (project_id, freelancer_id, proposed_price, delivery_time_days, cover_letter, status, created_at)
          VALUES (@projectId, @freelancerId, @proposedPrice, @deliveryTimeDays, @coverLetter, 'SUBMITTED', GETDATE())
        `);
    }

    // 3. Cập nhật trạng thái lời mời
    await pool.request()
      .input('invitationId', sql.Int, invitationId)
      .input('status', sql.VarChar, status)
      .query('UPDATE project_invitations SET status = @status, updated_at = GETDATE() WHERE invitation_id = @invitationId');

    res.json({ success: true, message: `Bạn đã ${status === 'ACCEPTED' ? 'chấp nhận' : 'từ chối'} lời mời thành công!` });
  } catch (error) {
    console.error('Error responding to invitation:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi phản hồi lời mời.' });
  }
};

/**
 * AI auto draft invitation message based on Gemini
 */
export const draftAIInvitation = async (req, res) => {
  try {
    const hasGemini = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS;
    if (!hasGemini) {
      return res.status(500).json({ success: false, message: 'API Key Gemini chưa được cấu hình ở Server.' });
    }

    const { projectId, freelancerId } = req.body;
    if (!projectId || !freelancerId) {
      return res.status(400).json({ success: false, message: 'Thiếu projectId hoặc freelancerId.' });
    }

    const pool = await poolPromise;

    // Query project details + required skills
    const projectRes = await pool.request()
      .input('projectId', sql.Int, projectId)
      .query(`
        SELECT p.title, p.description,
               (SELECT STRING_AGG(s.skill_name, ', ') 
                FROM project_skills ps 
                JOIN skills s ON ps.skill_id = s.skill_id 
                WHERE ps.project_id = p.project_id) as required_skills
        FROM projects p 
        WHERE p.project_id = @projectId
      `);

    // Query freelancer info + skills + CV evaluation
    const freelancerRes = await pool.request()
      .input('flId', sql.Int, freelancerId)
      .query(`
        SELECT u.full_name, fp.headline, fp.cv_ai_evaluation,
               (SELECT STRING_AGG(s.skill_name, ', ') 
                FROM freelancer_skills fs 
                JOIN skills s ON fs.skill_id = s.skill_id 
                WHERE fs.freelancer_id = u.user_id) as skills
        FROM users u
        LEFT JOIN freelancer_profiles fp ON u.user_id = fp.freelancer_id
        WHERE u.user_id = @flId
      `);

    const project = projectRes.recordset[0] || {};
    const freelancer = freelancerRes.recordset[0] || {};

    const systemInstruction = `Bạn là trợ lý AI của hệ thống FJMS. Nhiệm vụ của bạn là thay mặt Nhà tuyển dụng viết một lời nhắn mời hợp tác NGẮN GỌN (khoảng 3 câu, tối đa 80 từ) gửi đến Freelancer. 

Yêu cầu lời nhắn phải được viết dưới góc nhìn của Nhà tuyển dụng (xưng "Tôi" hoặc "Chúng tôi", gọi đối phương là "Bạn" hoặc "Anh/Chị"), TUYỆT ĐỐI KHÔNG xưng là "FJMS".

Cấu trúc lời nhắn:
1. Lời chào ngắn gọn gửi đến Freelancer.
2. Nêu nhanh lý do thấy kỹ năng/chuyên môn của họ phù hợp với dự án.
3. Ngỏ lời mời họ ứng tuyển hoặc phản hồi để thảo luận thêm.

Định dạng đầu ra: Chỉ trả về nội dung lời nhắn mời hợp tác hoàn chỉnh dưới dạng văn bản thuần túy, không chứa lời dẫn giải, không tự thoại, không có ký tự markdown.`;

    const userPrompt = `
Hãy viết lời mời hợp tác ngắn gọn (khoảng 60-80 từ) gửi cho freelancer sau đây dưới góc nhìn của Nhà tuyển dụng (Employer):

--- THÔNG TIN CHI TIẾT ---
- Tên Freelancer: ${freelancer.full_name || 'Ứng viên'}
- Chuyên môn của Freelancer: ${freelancer.headline || 'Chuyên viên tự do'}
- Dự án của tôi: ${project.title || 'Dự án trên FJMS'}
- Mô tả dự án: ${(project.description || '').substring(0, 300)}
- Kỹ năng dự án yêu cầu: ${project.required_skills || 'N/A'}

Lưu ý: Lời nhắn phải đại diện cho Nhà tuyển dụng (xưng "Chúng tôi/Tôi"), nêu ngắn gọn lý do kỹ năng phù hợp và ngỏ lời mời ứng tuyển. Trả về đúng lời nhắn hoàn chỉnh.
`.trim();

    try {
      const text = await callGeminiAPI(userPrompt, systemInstruction, null, 0.7);
      return res.json({ success: true, draft: text });
    } catch (apiErr) {
      console.error('[AI Invitation Draft] Error calling Gemini:', apiErr.message);
      return res.status(500).json({ success: false, message: 'Không thể tạo lời nhắn bằng AI do lỗi API.' });
    }
  } catch (error) {
    console.error('Error drafting AI invitation:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi soạn lời mời bằng AI.' });
  }
};
