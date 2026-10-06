# Trạng thái GitHub

Repository: https://github.com/vietnamnhungchuyendi-collab/SWT301

Branch bài làm: **codex/slot7-testing-ci**, đã commit và push. Draft PR: https://github.com/vietnamnhungchuyendi-collab/SWT301/pull/1. Chưa merge vào main.

Implementation commit đã chạy trên GitHub: **4e4b913a76eb56228dd1362bdcf08d5c6d43abce**. Cả ba workflow push đã completed/success:

| Workflow | Kết quả | Run thực tế |
|---|---|---|
| FJMS Authentication CI | SUCCESS | https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/37525573490 |
| MathUtil CI | SUCCESS | https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/37525573936 |
| Sales Management CI | SUCCESS | https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/37525573395 |

Local: FJMS48/48 (45unit+3integration), MathUtil13/13, Sales42/42; báo cáo runtime/coverage ở docs/evidence. Maven workflows upload JAR và test reports; FJMS upload JSON/HTML coverage. Các commit cập nhật tài liệu và hiển thị form sau đó tiếp tục kích hoạt workflow; xem Actions của branch hoặc PR để lấy run mới nhất.

Mở PR, tab Files changed để xem bài làm; Checks để xem CI; mở docs/Requirement-check.md đối chiếu từng câu hỏi. Nhóm mở docs/Presentation.html và Demo.md để thực hiện thuyết trình trước lớp. Report5 giữ form gốc; sheet Example là hướng dẫn tham khảo, không được cộng vào số45unit cases.

Không dùng ảnh hướng dẫn trong đề hoặc kết quả local để khẳng định GitHub Actions đã chạy thành công.
