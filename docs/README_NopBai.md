# Bản nộp cập nhật: Password Recovery

Ba file chính: Report5_Test Documentation.docx, Report5_Unit Test.xlsx và Report5_Test Report.xlsx.
Giai_thich_Report5.docx giải thích bằng tiếng Việt. Requirement_Check.md đối chiếu đề.

Ba hàm chính: register, resetPassword, login. Đã thay verifyEmail bằng resetPassword trong 15 ca unit. forgotPassword/verifyEmail chỉ hỗ trợ chuẩn bị luồng integration. Tổng 45 unit + 3 integration PASS; 5 System/Acceptance Pending, chưa có staging và đại diện nghiệm thu.

Bấm Description hoặc Sheet Name trong Functions để mở bảng 15 testcase. Description đã có hyperlink thật; Pre-condition đã có fixture, mocks, clock và trạng thái cần thiết.

project/ chứa mã nguồn dự án để tái lập: vào backend, chạy npm ci rồi npm run test:ci với Node 22 như workflow. Bằng chứng local ở evidence/. Không dùng mật khẩu database/SMTP thật cho bộ test tự động.

Mỹ Tâm, Khang Huy, Quang Tùng: phân công vẫn là đề xuất. Hạn nộp sáng 12/10/2026. Bản này thay bộ tài liệu trước cho phạm vi được chọn mới.

Bằng chứng FAIL/PASS V08 trước đây thuộc verification trên nhánh demo riêng; không phải lỗi P09 của bộ recovery này. Không cộng kết quả demo vào 48 ca mới.
