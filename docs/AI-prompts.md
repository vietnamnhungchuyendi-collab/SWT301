# Prompt cho bài Unit testing với AI

AI sử dụng: Codex trong phiên làm bài này. Đây là bản ghi các prompt tác nghiệp được chuẩn hóa cùng kết quả có thể kiểm chứng trong file, không phải bản chụp nguyên văn một hội thoại ChatGPT khác. Không có lời khẳng định đã dùng Copilot, Mockito hoặc công cụ ngoài phiên này.

## Prompt 0 Setup
Hướng dẫn thiết lập Jest cho backend Node.js/Express ES modules trong repository FJMS. Dùng Babel cho import/export, thêm test runner, coverage HTML và CI, giữ Node runtime production. Coverage tối thiểu 80% cho ba controller được chọn. Không kết nối SQL hoặc gửi email khi test.

Kết quả áp dụng: backend/package.json, babel.config.cjs, jest.config.cjs, package-lock.json. Jest 29.7 và babel-jest cùng phiên bản; scripts test/test:coverage/test:ci. Các ngưỡng statements/branches/functions/lines 80%. Cài dependency và chạy test thực tế; các lỗi môi trường được ghi ở Prompt 4.

## Prompt 1 Analyze
Đọc backend/controllers/authController.js, routes/authRoutes.js, config/db.js và utils/emailService.js. Chọn một core feature và 2–3 functions chính. Mô tả input/output/dependency/branch, giữ business rules gốc. Phân biệt chính sách password FJMS và bài Java trước.

Kết quả: docs/Feature-analysis.md. Authentication với register/verifyEmail/login. Có nhánh phone optional, FREELANCER profile, OTP equality boundary, ADMIN fallback và SQL errors cần kiểm thử.

## Prompt 2 Design
Thiết kế happy path, edge case, error case cho ba functions. Nêu base fixture, từng input override, expected status/body/side effect. Ít nhất 15 case; mỗi test 3–5 assertions có ý nghĩa; bao phủ unit và integration. Review các nhánh dễ thiếu.

Kết quả: docs/Test-plan.md và Report5_UnitTest.xlsx. Review bổ sung register SQL failure R10, OTP expiry now-1/now/now+1, query update failures V13/V14, JWT failure L14, OTP persistence failure L15. 45 unit +3 integration, 4 assertions mỗi test. Không thêm regex email hoặc constraint username không có trong FJMS.

## Prompt 3 Generate
Sinh Jest tests từ plan; dùng beforeEach/afterEach, data-driven cases, chained SQL request mock, predictable clock/RNG, spy console, setup/teardown đúng. Integration chạy real Express HTTP +bcrypt +JWT, adapter SQL/email giả. Refactor test boundary nếu cần mà giữ production behavior.

Kết quả thực thi: backend/tests/unit/auth.test.js, unit/mocks/dependencies.js, integration/auth-flow.test.js. Tách nguyên ba hàm thành authCore.js; re-export để routes không đổi. Assertions kiểm HTTP, payload, bound SQL parameters, không tạo token/write khi lỗi, persistence và JWT signature.

## Prompt 4 Run and debug
Chạy suite và coverage; đọc lỗi thật, xác định lỗi môi trường hay business. Sửa đúng nguyên nhân, chạy lại và lưu bằng chứng. Không tạo ảnh hoặc kết quả PASS giả.

Kết quả thật: lần đầu sandbox chặn rename Jest transform cache (EPERM), suite chưa chạy; dùng cache writable và chạy với quyền phù hợp cho HTTP cục bộ. Kết quả sau đó 48/48 PASS, coverage 100%. MathUtil từng fail coverage gate 90% vì default constructor chưa test; bài không bắt 90%, dùng gate80% và báo scope rõ, không thêm test constructor để làm đẹp số. JaCoCo giới hạn instrumentation trong package application tránh lỗi class JDK24. Log cuối lưu docs/evidence.

## Prompt 5 Optimize and mock
Tối ưu deterministic fixtures và dependency mocks; không mock component đang cần integration. Đo cold/warm suite time và không mô tả cache warm-up là tăng tốc code production. Giữ test isolation, coverage và số assertions.

Kết quả: helper mock SQL chain tái sử dụng; unit mock bcrypt/JWT/email giúp nhanh, fixed clock/RNG ổn định; integration sử dụng thư viện bcrypt/JWT thật. Cold run 15.402s, baseline warm run1.256s; final48-case run1.439s trên máy này; khác biệt chủ yếu Babel cache, không cam kết thời gian CI giống máy local. Hai baseline runs trước tối ưu có49 PASS. Suite cuối có48 PASS, warm1.439s: R09 gộp hai input thiếu số và thiếu ký tự đặc biệt, hai assertions/input, bốn assertions/case; không bỏ kiểm tra constraint. Không có test timeout tùy tiện hoặc network ngoài.

## Prompt 6 Documentation and demo
Viết README, metrics, hướng dẫn chạy, demo ngắn và thuyết trình framework cho nhóm; cấu hình CI cho MathUtil, Sales và dự án nhóm; tạo Git commit. Đối chiếu từng yêu cầu hai đề, chỉ ghi GitHub Actions đạt sau khi có run thật.

Kết quả: backend/tests/README.md, docs/Metrics.md, Demo.md, Presentation.html, Requirement-check.md; .github/workflows/*.yml; Git commit và GitHub trạng thái ghi ở GitHub-status.md. File báo cáo dùng form Report5 gồm đủ Cover/Functions/Statistics/ba function sheets; Guideline/Example giữ làm tham khảo.

## Cách tái lập và đánh giá prompt
Đưa source và hợp đồng đầu vào như Prompt 1; chạy Prompt 2 trước khi sinh test; review branch thiếu như trên; sinh theo Prompt 3 rồi chạy thật. Nếu đổi source, phải cập nhật oracle/plan trước; không chỉ sửa expected value để test qua. Prompt 0–6 có input, output file và review/refinement; bằng chứng có thể kiểm qua source, test và JSON runtime.
