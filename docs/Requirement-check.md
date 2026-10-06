# Đối chiếu hai đề và kết quả bài làm

Nguồn: đề Unit testing với AI ngày27/09; đề CI Maven ngày28/09; mẫu Report5 ngày28/09. Nội dung JavaScript/Jest mẫu trong đề AI là ví dụ; bài này dùng code FJMS thật. Screenshot trong đề CI là hướng dẫn, không tính là bằng chứng chạy của bài nộp.

| ID | Yêu cầu trong đề | Kết quả hoặc bằng chứng | Đánh giá |
|---|---|---|---|
| AI00 | Framework, runner, coverage, verify environment; Prompt0 | backend/package.json, lockfile, Babel/Jest config; npm ci/test thực tế | Đã làm |
| AI01 | Chọn1core feature; mô tả cấu trúc và functions; Prompt1 | Feature-analysis.md; Authentication,3handlers code FJMS thật | Đã làm |
| AI02 | Happy/edge/error cases, input data, review tối ưu; Prompt2 | Test-plan.md:45unit+3integration, fixture/overrides/oracles | Đã làm |
| AI03 | Test code, assertions, setup/teardown/config; Prompt3 | tests/unit/auth.test.js; beforeEach/afterEach; config | Đã làm |
| AI04 | Chạy, debug lỗi thật, screenshot và coverage; Prompt4 | evidence/results.json, Test-results.png, Coverage.png; HTML coverage | Đã làm local |
| AI05 | Mock dependencies, tối ưu, integration, refactor; Prompt5 | mocks/dependencies.js; integration/auth-flow; authCore re-export; cold/warm timings | Đã làm |
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
| CI07 |2–3functions chính +unit tests +CI nhóm | register/verifyEmail/login,45unit; fjms-ci.yml | Local PASS; GitHub Actions SUCCESS |
| CI08 | Thuyết trình framework +code demo | Presentation.html8slides, Demo.md; source dùng để demo | Tài liệu hoàn thành; nhóm tự trình bày tại lớp |
| CI09 | UnitTest documentation đúng Report5 | Report5_UnitTest.xlsx,8tabs, Cover/Functions/Statistics/3function sheets | Giữ form;8tabs,styles,merges,dimensions,statistical formulas preserved; 2 document code formulas populated |

Không bỏ yêu cầu bắt buộc; phần GitHub có trạng thái riêng để phân biệt cấu hình và run thật. Việc trình bày trước lớp cần nhóm thực hiện. Chưa có tên nhóm/thành viên/lớp nên không tự điền tên giả. Creator dùng Git identity tam0605; Reviewer ghi chưa phê duyệt.

Kiểm tra phần thêm: Supertest và integration folder phục vụ yêu cầu integration; tách authCore để đo đúng feature và giữ handler khác; không đổi nghiệp vụ FJMS. Ba workflows trong cùng repository giúp giữ cùng nơi nộp, mỗi bài có đường dẫn Maven riêng. Không có CRUD/Google/reset/password rules mới ngoài phạm vi. .gitignore cho phép commit lockfile để npm ci tái lập.

Giới hạn: các case phản ánh source hiện có; không phải kiểm toán toàn hệ thống. Suite không kiểm schema/transaction SQL thật, gửi Gmail thật hay frontend. Report5 thống kê45unit;3integration nằm trong plan và metrics, không bỏ sót hoặc tính trùng. E6 TC/KLOC dùng N/A vì đề không quy định norm riêng; không tự lấy100cases/KLOC trong số liệu mẫu làm tiêu chí chấm.
