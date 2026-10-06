# Demo ngắn cho nhóm

Thời lượng dự kiến 5–7 phút; đây là kịch bản để nhóm trình bày, chưa có lời khẳng định đã trình bày trước lớp.

1. Mở Presentation.html và Feature-analysis.md: giới thiệu FJMS, chọn Authentication và ba functions.
2. Mở backend/tests/unit/auth.test.js: Given fixture; When gọi register; Then kiểm status/body/query/email. Giải thích jest.fn, jest.mock, jest.spyOn và test.each.
3. Chạy `cd backend`, `npm ci`, `npm test -- --testNamePattern="R14|V08|L06"`. R14 happy/minimum password boundary; V08 OTP đúng lúc hết hạn; L06 invalid password không cấp token.
4. Chạy `npm test -- --testNamePattern=I03`: real Express → register → verify → login; real bcrypt và JWT, SQL/email giả. Nêu rõ giới hạn component integration.
5. Chạy `npm run test:ci`; mở tests/coverage/index.html; chỉ ra48 PASS,4 assertions/test,100% scoped coverage và gate80%.
6. Mở GitHub Actions của repository: ba workflows MathUtil, Sales, FJMS; mở actual run và download JAR/test artifact. Dùng GitHub-status.md để xác định run thật, không dùng hình trong đề làm bằng chứng bài mình.
7. Mở Report5_UnitTest.xlsx: Cover, Functions, Statistics và từng matrix; đối chiếu R/V/L ID với source/tests.

Gợi ý chia nội dung cho các thành viên (tự điền tên thật): người1 giới thiệu framework/lifecycle; người2 giải thích mocks/data-driven; người3 demo integration/coverage; người4 giải thích CI/report. Không tự tạo tên thành viên hoặc tuyên bố SWP391 đã xác nhận nếu nhóm chưa xác nhận.

Muốn demo regression, trên bản sao tạm đổi OTP `>` thành `>=`, chạy V08 để thấy FAIL rồi khôi phục; không commit mutation. Đây là thao tác demo đề xuất, chưa được tính là lỗi đã phát hiện từ lần chạy.
