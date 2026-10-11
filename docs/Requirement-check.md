# Đối chiếu hai đề và kết quả bài làm

Nguồn: đề Unit testing với AI ngày27/09; đề CI Maven ngày28/09; mẫu Report5 ngày28/09. Nội dung JavaScript/Jest mẫu trong đề AI là ví dụ; bài này dùng code FJMS thật. Screenshot trong đề CI là hướng dẫn, không tính là bằng chứng chạy của bài nộp.

| ID | Yêu cầu trong đề | Kết quả hoặc bằng chứng | Đánh giá |
|---|---|---|---|
| AI00 | Framework, runner, coverage, verify environment; Prompt0 | backend/package.json, lockfile, Babel/Jest config; npm ci/test thực tế | Đã làm |
| AI01 | Chọn1core feature; mô tả cấu trúc và functions; Prompt1 | Feature-analysis.md; Authentication,3handlers code FJMS thật | Đã làm |
| AI02 | Happy/edge/error cases, input data, review tối ưu; Prompt2 | Test-plan.md:45unit+3integration, fixture/overrides/oracles | Đã làm |
| AI03 | Test code, assertions, setup/teardown/config; Prompt3 | tests/unit/auth.test.js; beforeEach/afterEach; config | Đã làm |
| AI04 | Chạy, debug lỗi thật, screenshot và coverage; Prompt4 | evidence/results.json, Test-results.png, Coverage.png; HTML coverage | Đã làm local |
| AI05 | Mock dependencies, tối ưu, integration, refactor; Prompt5 | mocks/dependencies.js; integration/auth-flow; authCore/authController public re-exports; cold/warm timings | Đã làm |
| AI06 | README, metrics, short demo, Git commit; Prompt6 | tests/README.md, Metrics.md, Demo.md; commit xem GitHub-status.md | Đã commit/push; xem GitHub-status.md |
| AI07 | File structure tests/unit/mocks, coverage/index.html, README | Đúng tại backend/tests; thêm integration folder vì bắt buộc integration | Đã làm |
| AI08 | Coverage≥80% |100%scoped module; gate80%all4metrics | Đạt |
| AI09 | Ít nhất15cases |48FJMS cases, không cộng Java vào ngưỡng | Đạt |
| AI10 | Unit +integration |45unit+3component integration; SQL/email adapter giả | Đạt trong phạm vi đã nêu |
| AI11 | Trung bình3–5assertions/test |192/48=4 từ numPassingAsserts JSON | Đạt |
| AI12 | Chất lượng40%,AIprompt30%,Implementation20%,Documentation10% | Plan/mocks/oracles; AI-prompts.md ghi prompt/output/refinement; runtime evidence; README/demo | Có đủ nhóm tài liệu; không tự chấm điểm thay giảng viên |
| CI01 | Exercise1 hoàn thiện MathUtil Lab2 | labs/math-util; factorial source,13tests, build JAR | Đã làm local |
| CI02 | GitHub +.gitignore | .gitignore Node/Maven/NetBeans; branch/commit/push trong GitHub-status.md | Đã commit và push |
| CI03 | Java Maven Actions push/PR main; Java17; package/artifact | .github/workflows/maven.yml; clean verify gồm package; staging/upload JAR | GitHub Actions SUCCESS |
| CI04 | README workflow badge |3badges repository thật, branch bài làm | Đã làm; badge có run sau push |
| CI05 | Exercise2 CI Sales Management | labs/sales-management,42tests; sales-ci.yml | Local PASS; GitHub Actions SUCCESS |
| CI06 | Exercise3 framework thực dùng dự án nhóm SWP391 | Jest được cấu hình và chạy trên FJMS trong repository người dùng cung cấp | Dự án FJMS thật; nhóm cần xác nhận đây là SWP391 |
| CI07 |2–3functions chính +unit tests +CI nhóm | register/resetPassword/login,45unit; fjms-ci.yml | Local PASS; GitHub Actions SUCCESS |
| CI08 | Thuyết trình framework +code demo | Presentation.html8slides, Demo.md; source dùng để demo | Tài liệu hoàn thành; nhóm tự trình bày tại lớp |
| CI09 | UnitTest documentation đúng Report5 | Report5_UnitTest.xlsx,8tabs, Cover/Functions/Statistics/3function sheets | Giữ form;8tabs,styles,merges,dimensions,statistical formulas preserved; 2 document code formulas populated |

Không bỏ yêu cầu bắt buộc; phần GitHub có trạng thái riêng để phân biệt cấu hình và run thật. Việc trình bày trước lớp cần nhóm thực hiện. Nhóm gồm Mỹ Tâm, Khang Huy, Quang Tùng; roles là đề xuất, Reviewer chưa phê duyệt. Không tự xác nhận lớp hoặc việc trình bày.

Kiểm tra phần thêm: Supertest và integration folder phục vụ yêu cầu integration; tách selected/recovery modules để đo đúng ba hàm và giữ handler khác; không đổi nghiệp vụ FJMS. Ba workflows trong cùng repository giúp giữ cùng nơi nộp, mỗi bài có đường dẫn Maven riêng. Không thêm CRUD/Google hoặc chính sách mật khẩu mới; resetPassword được chọn thay verifyEmail. .gitignore cho phép commit lockfile để npm ci tái lập.

Giới hạn: các case phản ánh source hiện có; không phải kiểm toán toàn hệ thống. Suite không kiểm schema/transaction SQL thật, gửi Gmail thật hay frontend. Report5 thống kê45unit;3integration nằm trong plan và metrics, không bỏ sót hoặc tính trùng. E6 TC/KLOC dùng N/A vì đề không quy định norm riêng; không tự lấy100cases/KLOC trong số liệu mẫu làm tiêu chí chấm.


# Đối chiếu yêu cầu Report5 — 12/10/2026

| Yêu cầu đề | Nội dung đáp ứng | Kết luận |
|---|---|---|
| 1. Scope: chức năng, phi chức năng trong/ngoài phạm vi | Đăng ký, đặt lại mật khẩu, đăng nhập; kiểm tra bảo mật chọn lọc; liệt kê phần loại trừ | Đủ |
| Các level: người phụ trách, đầu vào/thời gian, trọng tâm, acceptance criteria | Unit, component integration, System, Acceptance; phân công đề xuất, điều kiện vào/ra từng level | Đủ |
| Constraints/assumptions | Mock/fake, thiếu staging/SRS, hạn sáng 12/10, chưa phân công và chưa có đại diện nghiệm thu | Đủ |
| 2.1 Types: objective, technique, completion | Functional, structural, regression, selected security behavior, acceptance/usability | Đủ |
| 2.2 Level × type | Ma trận Unit/Integration/System/Acceptance; X đã chọn, P dự kiến, dấu – ngoài phạm vi | Đủ |
| 2.3 Tools | Purpose, Tool, Vendor/In-house, Version theo lockfile và cấu hình | Đủ |
| 3.1 Human resources | Mỹ Tâm, Khang Huy, Quang Tùng; vai trò và trách nhiệm đề xuất; đại diện chưa chỉ định | Đủ |
| 3.2 Environment | Purpose, Tool, Provider, Version; tách môi trường đã chạy với staging chưa xác nhận | Đủ |
| 3.3 Milestones | Task/Start/End; baseline, chạy lại, tài liệu, mục tiêu review/nộp; System/Acceptance chưa cam kết hoàn thành | Đủ |
| 4. Unit template | Report5_Unit Test.xlsx: R01–R15, P01–P15, L01–L15 = 45 ca | Đủ |
| 4. Other template | Report5_Test Report.xlsx: I01–I03, ST-01–ST-03, AT-01–AT-02 = 8 ca | Đủ |
| 5. Results/statistics/analysis | Kết quả Jest, coverage, số liệu, rủi ro và quyết định từng giai đoạn | Đủ |
| Giải thích lý do từng mục | Giai_thich_Report5.docx, tiếng Việt | Đủ |

## Kiểm chứng số liệu

- Jest: 3 suites, 48 passed, 0 failed, 0 skipped; 45 unit + 3 integration. Có 192 assertions, bốn mỗi ca.
- Danh mục: 45 + 3 + 3 ST + 2 AT = 53. Năm ca staging chưa chạy và ghi Pending.
- PASS trên ca đã chạy: 48/48 = 100%. Tỷ lệ thực thi toàn danh mục: 48/53 = 90,57%.
- File non-unit: 3 Passed, 5 Pending, tổng 8; hai tỷ lệ theo công thức mẫu đều 3/8 = 37,50%.
- Coverage chỉ authSelectedCore.js và passwordRecovery.js: lines 97/97, statements 98/98, branches 57/57, functions 4/4. Không suy rộng thành coverage toàn hệ thống/yêu cầu.
- HTTP 400/403/500 có thể là expected result của ca âm và vẫn PASS.

## Đối chiếu tổ hợp điều kiện đăng nhập

Đây là bảng rà soát các quy tắc đã có ca kiểm thử, không tuyên bố bao phủ mọi tổ hợp. Dấu – là điều kiện chưa cần xét ở nhánh đó. Hợp lệ mật khẩu bao gồm hành vi fallback ADMIN hiện tại, cần review bảo mật.

| Rule | Input đủ | Có tài khoản | ACTIVE | Mật khẩu hợp lệ | Email verified | Expected HTTP | Test |
|---|---|---|---|---|---|---|---|
| 1 | Không | – | – | – | – | 400, không query/JWT | L01, L02 |
| 2 | Có | Không | – | – | – | 400, không JWT | L03 |
| 3 | Có | Có | Không | – | – | 403, không kiểm tra mật khẩu/JWT | L04, L05 |
| 4 | Có | Có | Có | Không | – | 400, không JWT | L06 |
| 5 | Có | Có | Có | Có | Không | 401, gửi OTP, không JWT | L07 |
| 6 | Có | Có | Có | Có | Có | 200, JWT và lưu token | L08, L09, L10 |

## Kiểm tra thiếu/thừa và hình thức

Đã giữ thứ tự đề mục và các bảng của mẫu Word; Excel giữ các sheet, cột, ô gộp, màu, viền và validation của form. Chỉ tăng chiều cao các dòng testcase cần hiển thị đủ nội dung và định dạng ngày. Unit dùng bản .xlsx của mẫu .xls đã chuyển trước đó. Không thêm Java MathUtil/Sales hay các chức năng FJMS ngoài phạm vi vào thống kê. Guideline/Example trong mẫu unit là hướng dẫn, không được tính vào 45 ca. Bản giải thích và bằng chứng là tài liệu hỗ trợ, không thay thế ba file nộp chính.

Phần tài liệu đáp ứng toàn bộ mục yêu cầu. Phần thực thi đầy đủ System/Acceptance vẫn chưa hoàn tất vì chưa có staging và đại diện nghiệm thu. Không ghi kết quả, ngày chạy hay sign-off giả. Các phát hiện static review SR-01–SR-04 cần xác nhận/triage; không trình bày thành lỗi đã sửa.

## Thay đổi đã được người dùng chọn
Giữ ba hàm chính register/resetPassword/login. forgotPassword và verifyEmail chỉ là setup integration. Thay 15 V-case bằng 15 P-case; không cộng cả bộ cũ vào thống kê mới. Description có hyperlink thật đến A9 của mỗi bảng 15 ca, tiền điều kiện chi tiết hơn và wrap nội dung. Coverage target là module chứa đúng ba hàm đã chọn; các handler được di chuyển nguyên thân, public exports/routes giữ tương thích.
