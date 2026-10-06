# Kết quả kiểm thử thực tế

Ngày thực hiện: 07/10/2026. Backend FJMS: **48/48 PASS**, 0 failed/skipped, 2 suites. **45 unit +3 component integration**. Số assertions từ Jest results JSON: **192**, trung bình **4.0/test**. Không đếm expect.any/objectContaining như assertions riêng.

| Coverage scope authCore.js | Covered / total | % |
|---|---:|---:|
| Lines | 95/95 | 100 |
| Statements | 96/96 | 100 |
| Branch outcomes | 56/56 | 100 |
| Functions | 4/4 | 100 |

Minimum 80% tất cả bốn loại được enforce trong Jest config và CI. Function total=4 gồm 3 handlers và callback mapping roles. Không phải coverage toàn bộ backend/frontend.

MathUtil: 13/13 parameterized cases, factorial 0..20 và out-of-range, JAR build đạt. getFactorial executable lines/branches đạt100%; constructor mặc định chưa gọi; bundle incl Main thấp hơn, xem JaCoCo HTML. Gate80% loại Main demo. Sales Management:42/42, coverage application lines/branches100%, JAR build đạt. Không cộng 55 Java test vào ngưỡng 15 ca của bài AI; riêng FJMS đã đủ48.

Runtime local: baseline49-case cold15.402s, warm1.256s; final48-case warm1.439s. Đây là elapsed test-run time, không phải request latency; cache/compiler/environment ảnh hưởng. Native SQL/Gmail không được gọi. Các side effects SQL ở integration dùng adapter fake có state.

Nguồn kết quả: docs/evidence/results.json, coverage-summary.json, run-log.txt; Java Surefire XML và *-run.txt. Report5 Statistics ghi tỷ lệ executed/successful case của45 unit, khác với JaCoCo/Jest code coverage. Integration được ghi riêng trong Test-plan.
