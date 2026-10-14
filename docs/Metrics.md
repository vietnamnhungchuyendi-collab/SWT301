# Kết quả hiện tại — 12/10/2026

Local recovery run: 48/48 PASS, 0 failed/skipped, 3 suites; 45 unit R/P/L + 3 component integration; 192 assertions, exactly 4/test. Elapsed suite time 1.577s, not API latency.

| Selected coverage targets: authSelectedCore.js + passwordRecovery.js | Covered/total | Result |
|---|---:|---:|
| Lines | 97/97 | 100% |
| Statements | 98/98 | 100% |
| Branch outcomes | 57/57 | 100% |
| Functions (3 handlers + role callback) | 4/4 | 100% |

Gate 80% per metric; not whole-project or live SQL coverage. Unit classifications: N=5, A=34, B=6 (45). All 45 executed, so unit template execution ratios 100%. Non-unit: 3 Passed + 5 Pending = 8, execution/successful ratios 37.50%. Full catalogue execution 48/53=90.57%; PASS among executed 100%. No full acceptance/sign-off claim.

Source: evidence/results.json, run-log.txt, coverage-summary.json, manifest.json, fjms-coverage/index.html. Test-results.png/Coverage.png are rendered report previews from actual figures, not terminal screenshots. Previous verification results are archived under evidence/historical-verification-2026-10-07.

Java historical results remain separate: MathUtil13/13, Sales42/42. Their evidence/workflows remain unchanged; latest GitHub status is in GitHub-status.md.


## Tách dữ liệu và code test — 14/10/2026
Dữ liệu và expected ở backend/tests/data/{common,register,login,reset-password,integration}.json. Code thực thi/assertions ở tests/unit và tests/integration; mock engine ở unit/mocks. Xem backend/tests/data/README.md để sửa đúng một scenario. Giữ nguyên 48 case names, 192 assertions và coverage 100% của các module được chọn. Không đổi handler production, case IDs, nội dung Excel hoặc trạng thái 5 ST/AT Pending. Báo cáo Word/Excel vẫn mô tả cùng các ca và bằng chứng baseline 12/10; lần xác minh refactor mới lưu riêng tại docs/evidence/data-separation-2026-10-14.

Lần xác minh sau tách: 3 suites, 48 PASS, 0 failed/skipped, 192 assertions; elapsed 2.693s. Coverage target/denominator không thay đổi. Đây là elapsed test-run, không phải response time.
