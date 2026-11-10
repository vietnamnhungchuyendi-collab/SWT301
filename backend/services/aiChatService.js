import * as aiChatRepository from '../repositories/aiChatRepository.js';
import { sql, poolPromise } from '../config/db.js';
import { callGeminiAPI } from '../utils/geminiHelper.js';

const SYSTEM_PROMPT = `You are FJMS AI Assistant, a helpful, direct, and concise virtual assistant for the Freelance Job Management System (FJMS).

Guidelines for your response:
1. Be extremely brief, concise, and to-the-point. Avoid long introductory/concluding remarks. Keep answers within 2-3 short paragraphs or clean bullet points.
2. ALWAYS respond in Vietnamese.
3. If "Live Open Projects" or "Live Active Freelancers" data is provided in the prompt context:
   - Prioritize showing these recommendations IMMEDIATELY at the beginning of your response.
   - Format them clearly with details like title, budget, company/name, and the exact markdown link (e.g. "[Xem chi tiết & ứng tuyển](/project-details/[id])" or "[Xem hồ sơ](/profile/[id])").
   - Do NOT give generic instructions on how to browse projects/freelancers if live matches are present. Highlight these live matching options directly.
4. If a question is completely unrelated to FJMS platform, respond politely in Vietnamese: "Mình là trợ lý hỗ trợ riêng cho hệ thống FJMS. Bạn có câu hỏi nào về dự án, ví tiền, nạp/rút hay ký quỹ trên hệ thống không, cứ hỏi mình nhé!"`;

const ROLE_CONTEXT = {
  FREELANCER: `The user is a FREELANCER on FJMS. Prioritize guidance on:
- Browsing and applying to projects with proposals
- Managing active contracts and submitting work
- Getting paid through escrow releases
- Building reputation through reviews and ratings
- Withdrawing earnings to their wallet
- Communicating with employers`,
  EMPLOYER: `The user is an EMPLOYER on FJMS. Prioritize guidance on:
- Posting projects with clear requirements and budget
- Reviewing freelancer proposals and hiring
- Funding escrow to start contracts
- Reviewing submitted work and approving/rejecting
- Managing disputes if issues arise
- Making payments and managing their wallet`,
  ADMIN: `The user is an ADMIN on FJMS. Prioritize guidance on:
- Moderating projects and proposals
- Managing user reports and violations
- Resolving disputes with decisions (REFUND_EMPLOYER, PAY_FREELANCER, SPLIT_PAYMENT)
- Applying warnings, suspensions, or bans
- Viewing analytics and generating reports
- Managing platform settings and users`
};

const generateTitle = async (message) => {
  const maxLength = 50;
  const cleaned = message.replace(/[^\w\sÀ-ÿ]/g, '').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, cleaned.lastIndexOf(' ', maxLength)) + '...';
};

const isUnrelated = (message) => {
  const lower = message.toLowerCase();
  const fmsKeywords = [
    'proposal', 'project', 'freelancer', 'employer', 'contract', 'escrow', 'payment',
    'dispute', 'report', 'violation', 'wallet', 'withdraw', 'deposit', 'profile',
    'account', 'login', 'register', 'password', 'email', 'verify', 'skill',
    'category', 'budget', 'deadline', 'submission', 'review', 'revision', 'approve',
    'reject', 'fjm', 'fjms', 'platform', 'help', 'how', 'what', 'guide', 'support',
    'fee', 'charge', 'rating', 'notification', 'message', 'chat', 'hi', 'hello',
    'hey', 'thanks', 'thank', 'okay', 'ok', 'yes', 'no', 'good', 'great', 'awesome',
    'can', 'could', 'would', 'should', 'do', 'does', 'is', 'are', 'was', 'were',
    'create', 'make', 'find', 'search', 'look', 'see', 'show', 'tell', 'explain',
    'start', 'begin', 'finish', 'complete', 'done', 'working', 'work', 'job',
    'hire', 'hiring', 'apply', 'applied', 'submit', 'submitted', 'status',
    'pending', 'active', 'completed', 'cancelled', 'money', 'fund', 'funding',
    'balance', 'transaction', 'transfer', 'bank', 'vnpay', 'payment method',
    'dự án', 'freelancer', 'hợp đồng', 'ví', 'nạp', 'rút', 'tranh chấp', 'khiếu nại',
    'thanh toán', 'phí', 'đề xuất'
  ];
  const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'chào', 'xin chào', 'alo'];
  if (greetings.some(g => lower.includes(g))) return false;
  if (lower.split(' ').length <= 3) return false;
  return !fmsKeywords.some(kw => lower.includes(kw));
};

const buildConversationPrompt = (messages, userRole, currentMessage) => {
  const roleContext = ROLE_CONTEXT[userRole] || ROLE_CONTEXT.FREELANCER;
  
  let prompt = `${SYSTEM_PROMPT}\n\n${roleContext}\n\n`;
  prompt += `## Conversation History\n`;
  
  const recentMessages = messages.slice(-10);
  for (const msg of recentMessages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    prompt += `${role}: ${msg.content}\n`;
  }
  
  prompt += `\n## Current User Message\nUser: ${currentMessage}\n\nAssistant:`;
  
  return prompt;
};

// Query active, open projects matching keywords and user skills
const queryMatchingProjects = async (userId, keyword = '') => {
  try {
    const pool = await poolPromise;
    
    // Fetch freelancer skills
    const skillsRes = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT s.skill_name 
        FROM freelancer_skills fs
        JOIN skills s ON fs.skill_id = s.skill_id
        WHERE fs.freelancer_id = @userId
      `);
    const userSkills = skillsRes.recordset.map(r => r.skill_name.toLowerCase());
    
    // Fetch open projects
    const projectsRes = await pool.request().query(`
      SELECT TOP 10 p.project_id, p.title, p.description, p.budget_min, p.budget_max, p.budget_type, pc.category_name, u.full_name as company_name
      FROM projects p
      LEFT JOIN project_categories pc ON p.category_id = pc.category_id
      LEFT JOIN users u ON p.employer_id = u.user_id
      WHERE p.status = 'OPEN'
      ORDER BY p.created_at DESC
    `);
    const allProjects = projectsRes.recordset;
    
    for (let project of allProjects) {
      const skillsResult = await pool.request()
        .input('projectId', sql.Int, project.project_id)
        .query(`
          SELECT s.skill_name 
          FROM project_skills ps
          JOIN skills s ON ps.skill_id = s.skill_id
          WHERE ps.project_id = @projectId
        `);
      project.skills = skillsResult.recordset.map(r => r.skill_name.toLowerCase());
    }
    
    const ranked = allProjects.map(project => {
      let score = 0;
      const reasons = [];
      
      const matchingSkills = project.skills.filter(ps => userSkills.includes(ps));
      if (matchingSkills.length > 0) {
        score += matchingSkills.length * 20;
        reasons.push(`đúng thế mạnh ${matchingSkills.join(', ')} của bạn`);
      }
      
      if (keyword) {
        const kw = keyword.toLowerCase();
        if (project.title.toLowerCase().includes(kw) || project.description.toLowerCase().includes(kw)) {
          score += 35;
          reasons.push('trùng với từ khóa tìm kiếm');
        }
        
        const kwMatches = project.skills.filter(ps => ps.includes(kw));
        if (kwMatches.length > 0) {
          score += 15;
          reasons.push(`yêu cầu kỹ năng ${kwMatches.join(', ')}`);
        }
      }
      
      return { ...project, score, reasons };
    });
    
    return ranked
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch (err) {
    console.error('Error querying matching projects:', err);
    return [];
  }
};

// Query active freelancers matching keywords
const queryMatchingFreelancers = async (keyword = '') => {
  try {
    const pool = await poolPromise;
    const freelancersRes = await pool.request().query(`
      SELECT TOP 10 u.user_id, u.full_name, u.avatar_url, fp.headline, fp.rating_average, fp.experience_years, fp.hourly_rate
      FROM users u
      JOIN freelancer_profiles fp ON u.user_id = fp.freelancer_id
      WHERE u.role_default = 'FREELANCER' AND u.status = 'ACTIVE'
    `);
    const allFreelancers = freelancersRes.recordset;
    
    for (let fl of allFreelancers) {
      const skillsResult = await pool.request()
        .input('freelancerId', sql.Int, fl.user_id)
        .query(`
          SELECT s.skill_name 
          FROM freelancer_skills fs
          JOIN skills s ON fs.skill_id = s.skill_id
          WHERE fs.freelancer_id = @freelancerId
        `);
      fl.skills = skillsResult.recordset.map(r => r.skill_name.toLowerCase());
    }
    
    const ranked = allFreelancers.map(fl => {
      let score = 0;
      const reasons = [];
      
      if (keyword) {
        const kw = keyword.toLowerCase();
        if (fl.full_name.toLowerCase().includes(kw) || (fl.headline && fl.headline.toLowerCase().includes(kw))) {
          score += 30;
          reasons.push('phù hợp chuyên môn');
        }
        
        const skillMatches = fl.skills.filter(s => s.includes(kw));
        if (skillMatches.length > 0) {
          score += 20;
          reasons.push(`sở hữu kỹ năng: ${skillMatches.join(', ')}`);
        }
      } else {
        score = (fl.rating_average || 0) * 10;
      }
      
      return { ...fl, score, reasons };
    });
    
    return ranked
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch (err) {
    console.error('Error querying matching freelancers:', err);
    return [];
  }
};

const generateAIResponse = async (prompt, originalMessage, userRole, userId, previousMessages = [], liveDataContext = '') => {
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  
  if (openaiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: prompt.split('\n\n## Conversation History')[0] },
            { role: 'user', content: prompt.split('## Current User Message\nUser: ')[1]?.split('\n\nAssistant:')[0] || prompt }
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.choices[0].message.content.trim();
      }
    } catch (err) {
      console.error('OpenAI API error:', err);
    }
  }
  
  const hasGemini = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS;
  if (hasGemini) {
    try {
      const systemInstructionText = `${SYSTEM_PROMPT}\n\n${ROLE_CONTEXT[userRole] || ROLE_CONTEXT.FREELANCER}${liveDataContext ? '\n\n' + liveDataContext : ''}`;
      
      const contents = [];
      const recentMessages = previousMessages.slice(-10);
      for (const msg of recentMessages) {
        const role = msg.role === 'user' ? 'user' : 'model';
        contents.push({
          role: role,
          parts: [{ text: msg.content }]
        });
      }
      
      // Ensure the current user message is appended if not present
      const lastMsg = contents[contents.length - 1];
      if (!lastMsg || lastMsg.role !== 'user' || lastMsg.parts[0].text !== originalMessage) {
        contents.push({
          role: 'user',
          parts: [{ text: originalMessage }]
        });
      }
      
      const aiResponse = await callGeminiAPI(contents, systemInstructionText, null, 0.7);
      if (aiResponse) {
        return aiResponse;
      }
    } catch (err) {
      console.error('Gemini API error in chatbot:', err.message);
    }
  }
  
  // Fallback: Generate contextual response using knowledge base
  return generateFallbackResponse(prompt, originalMessage, userRole, userId);
};

const generateFallbackResponse = async (prompt, originalMessage = '', userRole = 'FREELANCER', userId = null) => {
  const lowerMsg = originalMessage.toLowerCase();
  
  // Check if unrelated
  if (isUnrelated(originalMessage) && originalMessage.split(' ').length > 3) {
    return "Hihi, mình là trợ lý AI hỗ trợ riêng cho nền tảng FJMS nè. Bạn có câu hỏi nào về các tính năng như tìm dự án, nạp tiền, rút tiền, ký quỹ hay hợp đồng không? Cứ hỏi mình nhé, mình giải đáp liền! 😉";
  }
  
  // 1. PROJECT / FREELANCER RECOMMENDATIONS
  if (userRole === 'FREELANCER' && (lowerMsg.includes('dự án') || lowerMsg.includes('project') || lowerMsg.includes('việc làm') || lowerMsg.includes('tìm việc') || lowerMsg.includes('gợi ý'))) {
    const projects = await queryMatchingProjects(userId, originalMessage);
    if (projects.length > 0) {
      let reply = `Chào bạn nhé! Mình vừa quét nhanh qua hệ thống và tìm thấy một số dự án cực kỳ tiềm năng và phù hợp với hồ sơ của bạn đây: 🥳\n\n`;
      projects.forEach((p, index) => {
        const budget = p.budget_max ? `${Math.round(p.budget_max).toLocaleString('vi-VN')} đ` : 'thỏa thuận';
        const reasonStr = p.reasons && p.reasons.length > 0 ? ` (được đề xuất vì: *${p.reasons.join(', ')}*)` : '';
        
        reply += `✨ **${index + 1}. ${p.title}**\n`;
        reply += `   - **Doanh nghiệp đăng:** ${p.company_name || 'Đối tác ẩn danh'}\n`;
        reply += `   - **Lĩnh vực:** ${p.category_name || 'N/A'}\n`;
        reply += `   - **Mức thù lao:** **${budget}** (${p.budget_type === 'FIXED' ? 'Trọn gói' : 'Theo giờ'})${reasonStr}\n`;
        reply += `   - 👉 **[Xem chi tiết & Nộp Proposal ngay](/project-details/${p.project_id})**\n\n`;
      });
      reply += `Bạn thấy các dự án này thế nào? Bạn chỉ cần nhấn vào liên kết **[Xem chi tiết & Nộp Proposal ngay]** ở trên là có thể xem yêu cầu cụ thể và gửi hồ sơ ứng tuyển trực tiếp luôn đó. Chúc bạn sớm nhận được dự án nhé! 🚀`;
      return reply;
    } else {
      return `Mình vừa tìm quanh hệ thống nhưng chưa thấy dự án nào khớp trực tiếp với yêu cầu này của bạn cả. 🥺 Đừng nản lòng nhé! Bạn có thể ghé qua trang **[Tìm kiếm công việc](/browse-projects)** để chủ động tìm và lọc thêm nhiều công việc hấp dẫn khác nha!`;
    }
  }
  
  if (userRole === 'EMPLOYER' && (lowerMsg.includes('freelancer') || lowerMsg.includes('nhân sự') || lowerMsg.includes('ứng viên') || lowerMsg.includes('gợi ý'))) {
    const freelancers = await queryMatchingFreelancers(originalMessage);
    if (freelancers.length > 0) {
      let reply = `Chào bạn! Mình đã quét qua danh sách freelancer đang hoạt động trên FJMS và chọn lọc ra một vài gương mặt nổi bật nhất cho bạn đây: 🌟\n\n`;
      freelancers.forEach((f, index) => {
        const rate = f.hourly_rate ? `${Math.round(f.hourly_rate).toLocaleString('vi-VN')} đ/giờ` : 'Thỏa thuận';
        const reasonStr = f.reasons && f.reasons.length > 0 ? ` (*${f.reasons.join(', ')}*)` : '';
        
        reply += `👤 **${index + 1}. ${f.full_name}** ${reasonStr}\n`;
        reply += `   - **Chuyên môn:** ${f.headline || 'Chuyên gia Freelancer'}\n`;
        reply += `   - **Đánh giá:** ⭐ **${f.rating_average ? Number(f.rating_average).toFixed(1) : 'Chưa có đánh giá'}** (${f.experience_years || 0} năm kinh nghiệm)\n`;
        reply += `   - **Chi phí mong muốn:** ${rate}\n`;
        reply += `   - 👉 **[Xem hồ sơ năng lực](/profile/${f.user_id})**\n\n`;
      });
      reply += `Bạn có thể bấm vào **[Xem hồ sơ năng lực]** để xem chi tiết các sản phẩm họ từng làm (Portfolio) và gửi tin nhắn mời họ hợp tác ngay lập tức nhé!`;
      return reply;
    } else {
      return `Hiện tại mình chưa tìm thấy ứng viên nào khớp hoàn toàn với mô tả của bạn trên hệ thống. Bạn thử ghé trang **[Danh sách Freelancer](/freelancers)** để tự tay lọc các hồ sơ chi tiết hơn xem sao nha!`;
    }
  }

  // 2. SYSTEM SERVICE FAQS
  const isGreeting = /^(hi|hello|hey|chào|alo|xin chào)/.test(lowerMsg.trim());
  if (isGreeting) {
    const roleText = userRole === 'FREELANCER' ? 'Freelancer chuyên nghiệp' : 'Nhà tuyển dụng';
    return `Chào bạn nha! Rất vui được trò chuyện với bạn. 🥰 Mình là **Trợ lý Ảo FJMS AI**, đồng hành cùng bạn dưới vai trò **${roleText}**.\n\nHôm nay bạn cần mình hỗ trợ gì nè? Mình rành nhất là giải đáp mấy mục này đó:\n- **Ký quỹ VNPay Escrow:** Cơ chế thanh toán an toàn 🔒\n- **Nạp/Rút tiền & Ví:** Cách giao dịch tài chính nhanh gọn 💰\n- **Quy trình hợp đồng & Nghiệm thu:** Cách làm việc và nhận tiền 📋\n- **Xử lý tranh chấp (Dispute):** Cách phân xử khi có bất đồng ⚖️\n- **Gợi ý công việc:** Tìm việc ngon/freelancer xịn 🚀\n\nCứ thoải mái chat cho mình biết nha!`;
  }

  if (/thanks|thank you|cảm ơn|thank/i.test(lowerMsg)) {
    return "Dạ không có chi nè! 🥰 Được hỗ trợ bạn là niềm vui của mình. Nếu sau này có bất kỳ thắc mắc nào khác về FJMS, bạn cứ nhắn mình nhé. Chúc bạn có những trải nghiệm tuyệt vời trên hệ thống!";
  }

  if (lowerMsg.includes('escrow') || lowerMsg.includes('ký quỹ') || lowerMsg.includes('thanh toán an toàn')) {
    return `### 🔒 Cơ chế Ký quỹ VNPay Escrow bảo mật thế nào?
Để mình giải thích thật ngắn gọn và dễ hiểu cho bạn nhé! Tính năng này hoạt động giống như một **"người trung gian uy tín"** giữ tiền hộ hai bên:

1. **Doanh nghiệp nạp tiền trước:** Ngay khi chốt thuê Freelancer, Doanh nghiệp (Employer) sẽ nạp tiền và **ký quỹ 100% giá trị hợp đồng** vào FJMS qua cổng VNPay.
2. **Tiền được giữ an toàn:** Số tiền này được hệ thống khóa lại, Freelancer nhìn thấy tiền đã được ký quỹ thì sẽ an tâm tập trung làm việc hết sức mình. Doanh nghiệp cũng yên tâm vì tiền chưa hề chuyển đi.
3. **Nghiệm thu & Tự động trả tiền:** Khi Freelancer nộp bài hoàn tất và Doanh nghiệp bấm duyệt **Nghiệm thu (Approve)**, hệ thống sẽ tự động chuyển tiền ký quỹ vào ví của Freelancer.
4. **Phân xử khi có sự cố:** Nếu có mâu thuẫn (trễ hạn, làm sai yêu cầu), Admin hệ thống sẽ đứng ra làm trọng tài kiểm tra bằng chứng và quyết định hoàn tiền hoặc giải ngân theo tỷ lệ xứng đáng.

*Bạn thấy cơ chế này siêu an toàn và công bằng cho cả hai bên đúng không nào!*`;
  }

  if (lowerMsg.includes('rút tiền') || lowerMsg.includes('withdraw') || lowerMsg.includes('rút')) {
    return `### 💰 Rút tiền về tài khoản ngân hàng như thế nào?
Rút tiền trên FJMS thì siêu dễ dàng luôn nha bạn ơi! Để mình chỉ bạn cách làm nè:

1. Đầu tiên, bạn vô trang **[Ví tiền của mình](/freelancer-wallet)** (nếu là Freelancer) hoặc **[Ví của tôi](/employer-wallet)** (nếu là Employer) nha.
2. Nhớ **thêm tài khoản ngân hàng liên kết** trước nhé (nhập đúng Tên ngân hàng, Số tài khoản và Tên chủ thẻ viết hoa không dấu nha).
3. Tiếp theo, nhấn nút **Rút tiền**, điền số tiền bạn mong muốn rút rồi gửi yêu cầu.
4. Để đảm bảo an toàn tuyệt đối, tránh các trường hợp hack tài khoản hoặc gian lận, Admin sẽ duyệt thủ công yêu cầu của bạn trong vòng tối đa 24 giờ làm việc. Tiền duyệt xong sẽ ting ting về tài khoản ngân hàng của bạn ngay!`;
  }

  if (lowerMsg.includes('nạp tiền') || lowerMsg.includes('deposit') || lowerMsg.includes('nạp')) {
    return `### 💳 Cách nạp tiền vào ví đơn giản nhất
Để nạp tiền vào số dư ví chuẩn bị ký quỹ cho các hợp đồng, bạn làm theo hướng dẫn này của mình nha:

1. Bạn truy cập vào trang **[Ví & Giao dịch](/employer-wallet)**.
2. Bấm vào nút **Nạp tiền** ở góc trên.
3. Nhập số tiền bạn muốn nạp rồi nhấn xác nhận. Hệ thống sẽ kết nối trực tiếp đưa bạn sang cổng thanh toán **VNPay**.
4. Bạn chỉ cần mở app Ngân hàng quét mã QR hoặc nhập thẻ ATM nội địa để thanh toán. Giao dịch thành công là ví của bạn sẽ được cộng tiền ngay lập tức luôn đó!`;
  }

  if (lowerMsg.includes('tranh chấp') || lowerMsg.includes('dispute') || lowerMsg.includes('khiếu nại') || lowerMsg.includes('phân xử')) {
    return `### ⚖️ Lỡ xảy ra bất đồng thì giải quyết tranh chấp (Dispute) thế nào?
Đừng lo lắng nhé! Nếu trong quá trình làm việc giữa Freelancer và Employer xảy ra mâu thuẫn không thể tự thỏa thuận:

1. Bất kỳ bên nào cũng có thể nhấn nút **Mở tranh chấp (Open Dispute)** trực tiếp ngay tại trang quản lý hợp đồng đó.
2. Hệ thống sẽ yêu cầu cả hai bên cung cấp thông tin và tải lên các bằng chứng (tệp đính kèm, ảnh chụp màn hình tin nhắn, file sản phẩm làm dở,...).
3. Ban quản trị (Admin) của FJMS sẽ nhảy vào làm trọng tài, đọc kỹ yêu cầu ban đầu của dự án và đối chiếu sản phẩm thực tế để phân xử cực kỳ công tâm.
4. **Admin sẽ đưa ra quyết định phân xử theo 3 hướng:**
   - **Hoàn trả cho Employer (Refund Employer):** Nếu Freelancer làm sai hoàn toàn hoặc biến mất không lý do.
   - **Thanh toán cho Freelancer (Pay Freelancer):** Nếu sản phẩm đạt chuẩn đúng giao kèo nhưng Employer cố tình không chịu nghiệm thu.
   - **Chia sẻ tỷ lệ (Split Payment):** Chia đôi tiền ký quỹ theo tỷ lệ phần trăm khối lượng công việc thực tế mà Freelancer đã hoàn thành được.`;
  }

  if (lowerMsg.includes('phí') || lowerMsg.includes('fee') || lowerMsg.includes('chi phí')) {
    return `### 📊 Phí dịch vụ trên FJMS tính thế nào?
FJMS luôn áp dụng chính sách phí dịch vụ cực kỳ rõ ràng và minh bạch luôn nè:
- **Phí đăng tuyển dự án:** Doanh nghiệp (Employer) được đăng tin tìm người hoàn toàn **miễn phí 100%**.
- **Phí hoa hồng nền tảng (Platform Commission):** Hệ thống chỉ thu **5% - 10%** trên tổng giá trị hợp đồng khi giao dịch giải ngân thành công (phí này sẽ trừ trực tiếp vào số tiền Freelancer nhận được khi kết thúc hợp đồng).
- **Phí nạp tiền:** Hoàn toàn miễn phí khi thanh toán qua VNPay.
- **Phí rút tiền:** Tùy thuộc vào quy định chuyển khoản liên ngân hàng của phía ngân hàng (nếu có).`;
  }

  if (lowerMsg.includes('hợp đồng') || lowerMsg.includes('contract') || lowerMsg.includes('nghiệm thu')) {
    return `### 📋 Vòng đời của một hợp đồng trên FJMS
Mỗi hợp tác trên hệ thống sẽ đi qua 5 trạng thái chuyên nghiệp này nè:
1. **PENDING_APPROVAL (Chờ duyệt):** Hợp đồng vừa tạo khi Employer chấp nhận đề xuất, chờ hai bên bấm nút xác nhận đồng ý điều khoản.
2. **ACTIVE (Đang thực hiện):** Employer đã nạp tiền ký quỹ thành công. Lúc này Freelancer mới bắt đầu làm việc nhé!
3. **SUBMITTED WORK (Bàn giao bài):** Freelancer hoàn thành sản phẩm và gửi báo cáo đính kèm lên hệ thống.
4. **COMPLETED (Hoàn tất):** Employer bấm duyệt nghiệm thu sản phẩm. Tiền ký quỹ lập tức được giải ngân tự động về ví của Freelancer.
5. **CANCELLED (Đã hủy):** Hợp đồng bị hủy do tranh chấp hoặc thỏa thuận chung của hai bên.`;
  }

  // General Fallback
  return `Mình hiểu là bạn đang muốn tìm hiểu về hệ thống **FJMS** đúng không nè. 

Để mình hỗ trợ bạn nhanh và chuẩn xác nhất, bạn có thể thử hỏi mình những câu như:
- **"Gợi ý cho mình vài dự án phù hợp đi"** (nếu bạn muốn tìm việc làm)
- **"Đề xuất cho mình vài freelancer giỏi"** (nếu bạn muốn tuyển người làm việc)
- Hoặc hỏi mình về **thanh toán ký quỹ VNPay**, cách **nạp tiền / rút tiền**, hay quy trình **phân xử tranh chấp (dispute)** nha.

*Mình luôn ở đây chờ tin nhắn từ bạn! 🥰*`;
};

export const getSessions = async (userId) => {
  return aiChatRepository.getUserSessions(userId);
};

export const createNewSession = async (userId) => {
  const title = 'New Chat';
  const sessionId = await aiChatRepository.createSession(userId, title);
  return { session_id: sessionId, title, user_id: userId };
};

export const getMessages = async (sessionId, userId) => {
  const session = await aiChatRepository.getSessionById(sessionId, userId);
  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }
  return aiChatRepository.getSessionMessages(sessionId);
};

export const processChatMessage = async (sessionId, message, userId, userRole) => {
  const session = await aiChatRepository.getSessionById(sessionId, userId);
  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  // Save user message
  await aiChatRepository.saveMessage(sessionId, 'user', message);

  // Get conversation history for context
  const previousMessages = await aiChatRepository.getSessionMessages(sessionId);
  
  // Check if user is asking for recommendations or searching projects/freelancers
  let liveDataContext = '';
  const lowerMsg = message.toLowerCase();
  
  if (userRole === 'FREELANCER' && (lowerMsg.includes('dự án') || lowerMsg.includes('project') || lowerMsg.includes('việc làm') || lowerMsg.includes('tìm việc') || lowerMsg.includes('gợi ý') || lowerMsg.includes('hỗ trợ') || lowerMsg.includes('giúp') || lowerMsg.includes('chào') || lowerMsg.includes('xin chào') || lowerMsg.includes('hi') || lowerMsg.includes('hello'))) {
    const matchingProjects = await queryMatchingProjects(userId, message);
    if (matchingProjects.length > 0) {
      liveDataContext = `\n## Live Open Projects in FJMS Database:\n`;
      matchingProjects.forEach(p => {
        liveDataContext += `- Project ID: ${p.project_id}
  Title: ${p.title}
  Description: ${p.description.substring(0, 150)}...
  Budget: ${p.budget_min ? p.budget_min.toLocaleString() : '0'} - ${p.budget_max ? p.budget_max.toLocaleString() : '0'} VNĐ (${p.budget_type})
  Category: ${p.category_name}
  Company: ${p.company_name}
  Link: /project-details/${p.project_id}
`;
      });
      liveDataContext += `\nInstructions to Assistant: Guide the user to these matching projects. Provide the markdown link "[Xem chi tiết](/project-details/[id])" so they can click and apply directly. Explain why they fit the user.\n`;
    } else {
      liveDataContext = `\n## Live Open Projects: No active projects matched the specific query, but encourage them to check the general Browse Projects page at /browse-projects.\n`;
    }
  } else if (userRole === 'EMPLOYER' && (lowerMsg.includes('freelancer') || lowerMsg.includes('nhân sự') || lowerMsg.includes('ứng viên') || lowerMsg.includes('gợi ý') || lowerMsg.includes('hỗ trợ') || lowerMsg.includes('giúp') || lowerMsg.includes('chào') || lowerMsg.includes('xin chào') || lowerMsg.includes('hi') || lowerMsg.includes('hello'))) {
    const matchingFreelancers = await queryMatchingFreelancers(message);
    if (matchingFreelancers.length > 0) {
      liveDataContext = `\n## Live Active Freelancers in FJMS Database:\n`;
      matchingFreelancers.forEach(f => {
        liveDataContext += `- Freelancer ID: ${f.user_id}
  Name: ${f.full_name}
  Headline: ${f.headline || 'Professional Freelancer'}
  Rating: ${f.rating_average || 'N/A'} (${f.experience_years || 0} years experience)
  Hourly Rate: ${f.hourly_rate ? f.hourly_rate.toLocaleString() : '0'} VNĐ/hr
  Skills: ${f.skills ? f.skills.join(', ') : ''}
  Link: /profile/${f.user_id}
`;
      });
      liveDataContext += `\nInstructions to Assistant: Suggest these freelancers to the employer. Provide the markdown link "[Xem hồ sơ](/profile/[id])" so they can click to view and invite them.\n`;
    }
  }

  // Build AI prompt with conversation memory
  let prompt = buildConversationPrompt(previousMessages, userRole, message);
  if (liveDataContext) {
    prompt = prompt.replace('## Current User Message', `${liveDataContext}\n## Current User Message`);
  }
  
  // Generate AI response
  const reply = await generateAIResponse(prompt, message, userRole, userId, previousMessages, liveDataContext);

  // Save AI response
  await aiChatRepository.saveMessage(sessionId, 'assistant', reply);

  // Generate title from first message if it's still default
  if (session.title === 'New Chat') {
    const title = await generateTitle(message);
    const pool = await poolPromise;
    await pool.request()
      .input('sessionId', sql.Int, sessionId)
      .input('title', sql.NVarChar(255), title)
      .query(`UPDATE ai_chat_sessions SET title = @title WHERE session_id = @sessionId`);
  }

  // Update session timestamp
  await aiChatRepository.updateSessionTimestamp(sessionId);

  return { reply };
};

export const deleteExistingSession = async (sessionId, userId) => {
  const session = await aiChatRepository.getSessionById(sessionId, userId);
  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }
  await aiChatRepository.deleteSessionMessages(sessionId);
  await aiChatRepository.deleteSession(sessionId);
  return { success: true };
};