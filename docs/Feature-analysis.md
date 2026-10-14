# Authentication: ba hàm chính được chọn

Phạm vi hiện tại theo lựa chọn của người dùng ngày 12/10/2026: register, resetPassword, login. Thay 15 unit verifyEmail bằng 15 unit resetPassword; tổng vẫn 45 unit.

| Hàm | Input | Quy tắc/kết quả | Dependencies |
|---|---|---|---|
| register | fullName,email,phone?,password,role | Required fields, FREELANCER/EMPLOYER, mật khẩu ≥8 và complexity, email/phone không trùng, hash và account/role/profile/OTP writes; 201/400/500 | SQL,bcrypt,email,clock,RNG |
| resetPassword | email,otpCode,newPassword | Input/strength, user exists, token tồn tại/chưa dùng, từ chối now > expiry; hash mật khẩu mới, ghi password rồi token-used; 200/400/404/500 | SQL,bcrypt,clock |
| login | email,password | ACTIVE, password/verification, role lookup, JWT/refresh token; 200/400/401/403/500 | SQL,bcrypt,JWT,email,clock,RNG |

forgotPassword tạo token cho integration; verifyEmail chuẩn bị tài khoản verified. Đây là helper workflow, không phải hàm unit chính thứ tư/thứ năm. resendOtp/googleAuth và các feature khác ngoài phạm vi.

Các thân handler được giữ nguyên: register/login ở authSelectedCore.js, verifyEmail ở authVerification.js, resetPassword ở passwordRecovery.js. authCore.js/authController.js giữ public exports và routes cũ. Coverage chỉ hai module chứa ba hàm đã chọn; không thêm ignore để che nhánh.

Rủi ro cần triage: ADMIN plaintext fallback, log mật khẩu, OTP/resetToken lộ trong response, và password write/token update không có transaction chung. P14 chỉ chứng minh handler trả 500 khi query cuối lỗi, không chứng minh rollback hoặc an toàn concurrency. SQL fake không kiểm chứng schema/isolation/SMTP thật.


## Tách dữ liệu và code test — 14/10/2026
Dữ liệu và expected ở backend/tests/data/{common,register,login,reset-password,integration}.json. Code thực thi/assertions ở tests/unit và tests/integration; mock engine ở unit/mocks. Xem backend/tests/data/README.md để sửa đúng một scenario. Giữ nguyên 48 case names, 192 assertions và coverage 100% của các module được chọn. Không đổi handler production, case IDs, nội dung Excel hoặc trạng thái 5 ST/AT Pending. Báo cáo Word/Excel vẫn mô tả cùng các ca và bằng chứng baseline 12/10; lần xác minh refactor mới lưu riêng tại docs/evidence/data-separation-2026-10-14.
