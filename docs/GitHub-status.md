# GitHub — recovery update

Repository: https://github.com/vietnamnhungchuyendi-collab/SWT301
Submission branch: codex/slot7-testing-ci; existing PR #1: https://github.com/vietnamnhungchuyendi-collab/SWT301/pull/1 . No merge to main is claimed.

Current scope: register/resetPassword/login. Local 12 Oct: 48 PASS (45 unit +3 integration), 3 suites, 192 assertions, 100% selected coverage.

Implementation commit **a4b7ef64f0013ec2c0ad972d8aae8473cd0029bc** has completed SUCCESS for all three push and pull-request workflows:

| Workflow | Pull-request run (SUCCESS) | Push run (SUCCESS) |
|---|---|---|
| FJMS Authentication CI | [38167857323](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/38167857323) | [38167854228](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/38167854228) |
| MathUtil CI | [38167857370](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/38167857370) | [38167854114](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/38167854114) |
| Sales Management CI | [38167857373](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/38167857373) | [38167854141](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/38167854141) |

Download the FJMS run artifact `fjms-test-evidence` for CI-generated JSON and coverage. Files in docs/evidence are the separately labelled local run. The follow-up documentation commit records these links; it does not change the tested implementation. The Actions branch view shows any newer runs.

Current reports: Report5_Test Documentation.docx, Report5_Unit Test.xlsx and Report5_Test Report.xlsx. Report5_UnitTest.xlsx is a byte-identical alias retained so existing links open the updated form. Both Description and Sheet Name navigate to the relevant 15-case matrix. The Vietnamese explanation and README_NopBai accompany the three submission files. Five staging cases remain Pending.

Historical Java evidence and verification evidence are retained separately. Prior deliberate V08 FAIL/PASS remains at runs 38164135977/38164201150 on codex/fjms-fail-pass-demo and is not part of the new R/P/L baseline.


## Tách dữ liệu và code test — 14/10/2026
Dữ liệu và expected ở backend/tests/data/{common,register,login,reset-password,integration}.json. Code thực thi/assertions ở tests/unit và tests/integration; mock engine ở unit/mocks. Xem backend/tests/data/README.md để sửa đúng một scenario. Giữ nguyên 48 case names, 192 assertions và coverage 100% của các module được chọn. Không đổi handler production, case IDs, nội dung Excel hoặc trạng thái 5 ST/AT Pending. Báo cáo Word/Excel vẫn mô tả cùng các ca và bằng chứng baseline 12/10; lần xác minh refactor mới lưu riêng tại docs/evidence/data-separation-2026-10-14.

Các run liệt kê phía trên thuộc commit trước tách dữ liệu. Commit refactor **50304c85f88e607fedaa8b9a8f9098d41b86e630** đã SUCCESS trên cả ba workflow, cho push và PR:

| Workflow | PR run SUCCESS | Push run SUCCESS |
|---|---|---|
| FJMS | [38526938433](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/38526938433) | [38526932343](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/38526932343) |
| MathUtil | [38526938511](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/38526938511) | [38526932293](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/38526932293) |
| Sales | [38526938538](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/38526938538) | [38526932303](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/38526932303) |

Đây là kiểm chứng trên GitHub sau tách dữ liệu. Commit tài liệu tiếp theo chỉ ghi các liên kết này; mã/test data đã được kiểm chứng ở commit trên.
