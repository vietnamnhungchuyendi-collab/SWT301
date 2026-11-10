import 'dotenv/config';
import { sql, poolPromise } from './config/db.js';
import bcrypt from 'bcryptjs';

async function run() {
  try {
    const pool = await poolPromise;
    console.log("Connected to database successfully!");

    // 1. Get Categories
    const categoriesRes = await pool.request().query(`SELECT * FROM project_categories`);
    console.log("Categories in DB:", categoriesRes.recordset);

    // 2. Check or create User
    const email = 'employer_demo@fjms.com';
    const password = 'Password123!';
    const fullName = 'Công ty TNHH Giải pháp Công nghệ TechNova';
    const phone = '0987654321';
    const roleUpper = 'EMPLOYER';

    let userRes = await pool.request()
      .input('email', email)
      .query(`SELECT user_id, is_email_verified FROM users WHERE email = @email`);

    let userId;
    if (userRes.recordset.length === 0) {
      console.log("Creating demo employer account...");
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);

      const insertUserRes = await pool.request()
        .input('fullName', fullName)
        .input('email', email)
        .input('phone', phone)
        .input('passwordHash', passwordHash)
        .input('roleDefault', roleUpper)
        .query(`
          INSERT INTO users (full_name, email, phone, password_hash, role_default, is_email_verified)
          VALUES (@fullName, @email, @phone, @passwordHash, @roleDefault, 1);
          SELECT SCOPE_IDENTITY() AS user_id;
        `);
      
      userId = insertUserRes.recordset[0].user_id;
      
      // Assign role
      await pool.request()
        .input('userId', userId)
        .input('roleName', roleUpper)
        .query(`
          INSERT INTO user_roles (user_id, role_id)
          SELECT @userId, role_id FROM roles WHERE role_name = @roleName
        `);
      console.log(`Demo employer created. ID: ${userId}, Email: ${email}, Password: ${password}`);
    } else {
      userId = userRes.recordset[0].user_id;
      console.log(`Demo employer already exists with ID: ${userId}. Overwriting/re-seeding projects.`);
      
      // Let's delete existing projects for this employer to start fresh
      await pool.request()
        .input('userId', userId)
        .query(`
          -- Delete submissions, revisions, contracts, proposals, reports etc if needed.
          -- For simplicity, let's just delete projects that don't have contracts.
          DELETE FROM projects WHERE employer_id = @userId AND project_id NOT IN (SELECT project_id FROM contracts);
        `);
    }

    // 3. Define 5 detailed projects
    // Categories in DB could be e.g. 1 (Web/Programming), 2 (Design), 3 (Writing), etc.
    const cats = categoriesRes.recordset;
    const findCatId = (name) => {
      const found = cats.find(c => c.category_name.toLowerCase().includes(name.toLowerCase()));
      return found ? found.category_id : (cats[0]?.category_id || 1);
    };

    const webCatId = findCatId('web') || findCatId('programming') || 1;
    const designCatId = findCatId('design') || findCatId('đồ họa') || 2;
    const writingCatId = findCatId('writing') || findCatId('viết') || 3;
    const marketingCatId = findCatId('marketing') || findCatId('quảng cáo') || 5;

    const projectsToSeed = [
      {
        title: "Xây dựng Website Thương mại Điện tử Nông sản Sạch",
        description: `Chúng tôi cần phát triển một website thương mại điện tử chuyên nghiệp cung cấp nông sản sạch, thực phẩm hữu cơ trực tiếp từ trang trại đến người tiêu dùng.

Yêu cầu chi tiết hệ thống:
1. Giao diện: Hiện đại, tối giản, chuẩn SEO, responsive đầy đủ trên mobile và tablet. Thiết kế UX tốt để tối ưu tỷ lệ chuyển đổi mua hàng.
2. Chức năng cốt lõi:
   - Đăng ký/Đăng nhập (OTP SMS, Google, Facebook).
   - Bộ lọc tìm kiếm nông sản thông minh theo danh mục, giá, vị trí địa lý trang trại, chuẩn organic.
   - Giỏ hàng & Thanh toán đa kênh (momo, VNPAY, COD).
   - Quản lý kho hàng thông minh, hỗ trợ đa chi nhánh/kho.
   - Bảng quản trị (Admin/Vendor dashboard) trực quan theo dõi doanh thu, số lượng đơn hàng, quản lý sản phẩm tồn kho.
3. Yêu cầu công nghệ:
   - ReactJS (NextJS là một lợi thế lớn) cho frontend.
   - NodeJS / Express hoặc Java Spring Boot cho backend.
   - Cơ sở dữ liệu: PostgreSQL hoặc MySQL.
   - Tối ưu hóa tải trang dưới 2 giây.

Tiến độ & Hợp tác:
- Giai đoạn 1 (2 tuần): Thiết kế UI/UX và chuẩn hóa API.
- Giai đoạn 2 (4 tuần): Coding chức năng cốt lõi.
- Giai đoạn 3 (2 tuần): Tích hợp cổng thanh toán, tối ưu hóa bảo mật và kiểm thử diện rộng.`,
        category_id: webCatId,
        budget_type: 'FIXED',
        budget_min: 15000000,
        budget_max: 30000000,
        required_freelancer_count: 2,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        skills: ['ReactJS', 'NodeJS', 'SQL Server', 'RESTful API', 'E-commerce UI Design']
      },
      {
        title: "Thiết kế Bộ nhận diện thương hiệu cho Chuỗi Cafe Organic",
        description: `Dự án thiết kế sáng tạo bộ nhận diện thương hiệu cho thương hiệu cafe sinh thái mới tên là "GreenBean Coffee & Tea". Phong cách chủ đạo hướng về thiên nhiên, sang trọng và ấm cúng.

Các hạng mục bàn giao chi tiết:
1. Thiết kế Logo: Logo chính, logo phụ, favicon, phiên bản logo âm bản/dương bản, hướng dẫn quy chuẩn logo (Logo Guidelines).
2. Bộ ấn phẩm văn phòng (Stationery):
   - Danh thiếp (Name card), phong bì thư (A4, A5), tiêu đề thư (Letterhead).
   - Thẻ nhân viên, hóa đơn bán lẻ, túi giấy đựng quà tặng.
3. Ấn phẩm tại điểm bán (POSM) & Bao bì sản phẩm:
   - Thiết kế cốc giấy, cốc nhựa mang đi (takeaway) size S/M/L.
   - Bao bì túi hạt cafe rang xay (250g, 500g, 1kg).
   - Menu để bàn, menu chính treo tường, bảng hiệu bên ngoài quán cafe.
   - Đồng phục nhân viên (tạp dề, áo thun, mũ).
4. Brand Guidelines Book: Tài liệu hướng dẫn sử dụng font chữ thương hiệu, bảng mã màu CMYK/RGB/HEX, và các quy chuẩn cấm khi sử dụng hình ảnh.

Yêu cầu Freelancer:
- Cần có portfolio gồm các dự án thiết kế nhận diện thương hiệu thực tế (ưu tiên lĩnh vực F&B).
- Sử dụng thành thạo Adobe Illustrator, Photoshop, Figma.
- Sẵn sàng chỉnh sửa tối thiểu 3 lần cho đến khi đạt chất lượng hoàn hảo nhất.`,
        category_id: designCatId,
        budget_type: 'FIXED',
        budget_min: 8000000,
        budget_max: 12000000,
        required_freelancer_count: 1,
        deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        skills: ['Adobe Illustrator', 'Branding Design', 'Adobe Photoshop', 'Figma', 'UI/UX Design']
      },
      {
        title: "Biên soạn Bộ Tài liệu Hướng dẫn và Kịch bản Chăm sóc Khách hàng",
        description: `Chúng tôi đang mở rộng bộ phận chăm sóc khách hàng và cần một chuyên gia viết nội dung/quy trình chuyên nghiệp biên soạn bộ cẩm nang quy trình (CSKH Playbook) toàn diện.

Nội dung cần thực hiện bao gồm:
1. Sổ tay Quy trình CSKH chuẩn:
   - Các nguyên tắc giao tiếp cốt lõi (Tôn trọng, lắng nghe, chủ động giải quyết vấn đề).
   - Quy trình đón tiếp khách hàng mới, xử lý khiếu nại, quy trình giữ chân khách hàng cũ.
   - Quy trình chuyển tiếp và phối hợp liên phòng ban để giải quyết sự cố kỹ thuật.
2. Kịch bản phản hồi khách hàng (Templates & Scripts):
   - Kịch bản chat/gọi điện trực tiếp xử lý các câu hỏi thường gặp (FAQs) về giá cả, đổi trả hàng, lỗi kỹ thuật.
   - Kịch bản đàm phán giải quyết tranh chấp/khiếu nại khó khăn của khách hàng bức xúc.
   - Bộ email mẫu chúc mừng sinh nhật, thông báo nâng cấp dịch vụ, thông báo bảo trì định kỳ.
3. Kịch bản quản trị khủng hoảng truyền thông:
   - Phác thảo các bước phản ứng nhanh khi có sự cố lớn về rò rỉ dữ liệu hoặc lỗi dịch vụ trên diện rộng.

Yêu cầu freelancer:
- Có kinh nghiệm làm việc ở vị trí Quản lý dịch vụ khách hàng hoặc Copywriter chuyên nghiệp.
- Giọng văn tự nhiên, chuyên nghiệp, lịch sự, chuẩn tiếng Việt.`,
        category_id: writingCatId,
        budget_type: 'FIXED',
        budget_min: 5000000,
        budget_max: 7500000,
        required_freelancer_count: 1,
        deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
        skills: ['Content Writing', 'Copywriting', 'Customer Support', 'Quy trình CSKH', 'Tiếng Việt chuyên nghiệp']
      },
      {
        title: "Phát triển Ứng dụng Quản lý Tài chính Cá nhân trên iOS & Android",
        description: `Cần tuyển một lập trình viên Mobile App (hoặc một nhóm) giàu kinh nghiệm để phát triển ứng dụng di động theo dõi chi tiêu cá nhân thông minh, tích hợp phân tích biểu đồ và nhắc nhở tự động.

Các tính năng nổi bật:
1. Giao diện người dùng: Trực quan, tươi sáng, có chế độ Dark Mode.
2. Quản lý chi tiêu:
   - Ghi chép nhanh các khoản thu chi hàng ngày theo danh mục (Ăn uống, Di chuyển, Mua sắm, Giáo dục).
   - Thiết lập ngân sách tối đa theo tháng và tự động cảnh báo khi chi tiêu sắp vượt ngưỡng.
   - Tính năng quét hóa đơn (OCR) để tự động nhập số tiền từ ảnh chụp hóa đơn mua sắm.
3. Phân tích & Báo cáo: Biểu đồ hình quạt biểu diễn tỷ trọng các khoản chi tiêu theo tuần/tháng/năm. Xuất báo cáo chi tiêu định kỳ dạng tệp PDF/Excel.
4. Công nghệ đề xuất:
   - Sử dụng React Native hoặc Flutter để phát triển cross-platform tối ưu chi phí.
   - Backend sử dụng Firebase hoặc Node.js (PostgreSQL).
   - Bảo mật sinh trắc học (FaceID / TouchID).

Freelancer cần cung cấp các sản phẩm đã phát triển thành công trên Google Play và App Store để chúng tôi tham khảo trước khi ký hợp đồng.`,
        category_id: webCatId,
        budget_type: 'FIXED',
        budget_min: 40000000,
        budget_max: 70000000,
        required_freelancer_count: 2,
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        skills: ['React Native', 'Flutter', 'Firebase', 'OCR Technology', 'UI/UX Mobile Design']
      },
      {
        title: "Lên chiến dịch Marketing Digital và Chạy Quảng cáo Facebook/Google",
        description: `Chúng tôi cần triển khai chiến dịch Digital Marketing toàn diện trong vòng 1 tháng nhằm quảng bá và gia tăng doanh số cho dòng sản phẩm thời trang thiết kế cao cấp mới ra mắt.

Nhiệm vụ cụ thể của Freelancer:
1. Nghiên cứu & Lập kế hoạch: Phân tích đối thủ cạnh tranh, xác định tệp khách hàng mục tiêu chuẩn xác (Targeting), đề xuất thông điệp truyền thông cốt lõi.
2. Chạy Quảng cáo Facebook Ads:
   - Thiết kế các mẫu quảng cáo (hình ảnh & nội dung thu hút click).
   - Set up chiến dịch chuyển đổi, A/B Testing các mẫu sáng tạo và nhóm đối tượng khác nhau.
   - Tối ưu hóa chi phí trên mỗi đơn hàng thành công (CPA).
3. Chạy Quảng cáo Google Search & Display Ads:
   - Nghiên cứu từ khóa mua sắm có tỷ lệ chuyển đổi cao.
   - Tối ưu hóa trang đích (Landing Page) để tăng điểm chất lượng quảng cáo.
4. Báo cáo hàng tuần: Gửi báo cáo chi tiết về ngân sách đã sử dụng, số lượt hiển thị, số lượt click, và doanh số mang lại trực tiếp từ quảng cáo.

Yêu cầu Freelancer:
- Đã từng quản lý ngân sách quảng cáo từ 50 triệu/tháng trở lên.
- Có tư duy số liệu tốt, phản ứng nhanh nhạy với biến động của thuật toán quảng cáo.`,
        category_id: marketingCatId,
        budget_type: 'FIXED',
        budget_min: 10000000,
        budget_max: 18000000,
        required_freelancer_count: 1,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        skills: ['Digital Marketing', 'Facebook Ads', 'Google Ads', 'Landing Page Optimization', 'Data Analysis']
      }
    ];

    // 4. Insert projects with 'OPEN' status so they are public
    for (let pData of projectsToSeed) {
      console.log(`Inserting project: "${pData.title}"...`);
      const result = await pool.request()
        .input('employerId', sql.Int, userId)
        .input('categoryId', sql.Int, pData.category_id)
        .input('title', sql.NVarChar, pData.title)
        .input('description', sql.NVarChar, pData.description)
        .input('budgetType', sql.VarChar, pData.budget_type)
        .input('budgetMin', sql.Decimal(18, 2), pData.budget_min)
        .input('budgetMax', sql.Decimal(18, 2), pData.budget_max)
        .input('requiredFreelancerCount', sql.Int, pData.required_freelancer_count)
        .input('deadline', sql.Date, pData.deadline)
        .query(`
          INSERT INTO projects (employer_id, category_id, title, description, budget_type, budget_min, budget_max, required_freelancer_count, deadline, status, created_at)
          VALUES (@employerId, @categoryId, @title, @description, @budgetType, @budgetMin, @budgetMax, @requiredFreelancerCount, @deadline, 'OPEN', SYSUTCDATETIME());
          SELECT SCOPE_IDENTITY() AS project_id;
        `);

      const projectId = result.recordset[0].project_id;
      console.log(`Project inserted with ID: ${projectId}. Registering skills...`);

      // Register skills for the project
      for (let skillName of pData.skills) {
        // Find or create skill
        let skillRes = await pool.request()
          .input('skillName', sql.NVarChar, skillName.trim())
          .query(`SELECT skill_id FROM skills WHERE skill_name = @skillName`);

        let skillId;
        if (skillRes.recordset.length === 0) {
          const insertSkillRes = await pool.request()
            .input('skillName', sql.NVarChar, skillName.trim())
            .query(`INSERT INTO skills (skill_name) VALUES (@skillName); SELECT SCOPE_IDENTITY() AS skill_id;`);
          skillId = insertSkillRes.recordset[0].skill_id;
        } else {
          skillId = skillRes.recordset[0].skill_id;
        }

        // Link project to skill
        await pool.request()
          .input('projectId', sql.Int, projectId)
          .input('skillId', sql.Int, skillId)
          .query(`
            IF NOT EXISTS (SELECT 1 FROM project_skills WHERE project_id = @projectId AND skill_id = @skillId)
            BEGIN
              INSERT INTO project_skills (project_id, skill_id) VALUES (@projectId, @skillId);
            END
          `);
      }
    }

    console.log("\n=============================================");
    console.log("SEEDED SUCCESSFULLY!");
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log("=============================================");

  } catch (err) {
    console.error("Error seeding data:", err);
  } finally {
    process.exit();
  }
}

run();
