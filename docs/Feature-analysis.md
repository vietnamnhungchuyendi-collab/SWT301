# Phân tích tính năng Authentication FJMS

Nguồn thực tế: repository vietnamnhungchuyendi-collab/SWT301, main commit 794896fde8f47b9646613ce1f00c43ba607fa644. Backend Node.js/Express ES modules, SQL Server, bcryptjs, JWT, email OTP; frontend React/Vite. Chọn một tính năng cốt lõi Authentication với ba hàm có liên hệ trực tiếp: register, verifyEmail, login.

| Hàm | Input | Output và quy tắc hiện có | Dependencies |
|---|---|---|---|
| register | fullName,email,phone?,password,role | Required fields; FREELANCER/EMPLOYER; mật khẩu ≥8 có hoa/thường/số/ký tự đặc biệt; email/phone không trùng; optional phone VN; tạo user/role/profile/OTP; HTTP 201 hoặc 400/500 | SQL,bcrypt,email,clock,RNG |
| verifyEmail | email,code | 404 khi không có user; 200 nếu đã xác thực; OTP phải tồn tại và chưa dùng; từ chối nếu now > expiry; cập nhật OTP và user; HTTP 200/400/404/500 | SQL,clock |
| login | email,password | User ACTIVE; kiểm tra bcrypt hoặc ADMIN plaintext fallback có trong source; chưa xác thực trả 401 và gửi OTP; verified tạo JWT + lưu refresh token; HTTP 200/400/401/403/500 | SQL,bcrypt,JWT,email,clock,RNG |

Refactor chỉ di chuyển nguyên ba function sang controllers/authCore.js và re-export qua authController.js. Public route/import cũ tiếp tục dùng được. Không bỏ logic hoặc cắt các nhánh để tăng coverage. authCore chứa ba hàm và callback mapping roles; coverage denominator công khai chỉ module này. Các handler forgotPassword, resetPassword, resendOtp, googleAuth giữ nguyên ngoài phạm vi được chọn.

Điểm cần phân biệt: lớp AccountService Java của bài trước dùng password >6; FJMS có chính sách ≥8 và complexity riêng. Không đưa điều kiện AccountService vào source FJMS. SQL/email thật không cần để chạy unit/component integration; không kết luận schema, SQL transaction hoặc Gmail hoạt động từ kết quả này.
