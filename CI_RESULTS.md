# Kết quả CI — Exercise 1 và Exercise 2

Ngày xác minh local: 31/10/2026. Cả hai lệnh Maven clean verify BUILD SUCCESS, có JAR trong target.

| Bài | Tests | Failures | Errors | Skipped |
|---|---:|---:|---:|---:|
| MathUtil | 13 | 0 | 0 | 0 |
| Sales Management | 42 | 0 | 0 | 0 |

Số liệu lấy từ Surefire XML thực tế. Commit triển khai fc75f4d đã chạy GitHub Actions thành công trên nhánh codex/maven-ci-exercises-1-2. Gói nộp chỉ bao gồm hai project Java và hai workflow, không có Exercise 3.

## Bằng chứng GitHub Actions

| Workflow | Kết quả | Run thật |
|---|---|---|
| Sales Management CI | SUCCESS | [Mở run 41221214676](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/41221214676) |
| MathUtil CI | SUCCESS | [Mở run 41221214637](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/41221214637) |

Trong trang run, mục Artifacts chứa JAR và test-evidence. Commit tiếp theo chỉ ghi nhận các liên kết này; mã/workflow của commit triển khai đã được kiểm tra.
