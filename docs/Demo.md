# Demo nhóm — 5–7 phút

1. Giới thiệu Authentication: register/resetPassword/login, 15 unit mỗi hàm.
2. Mở unit/auth.test.js và unit/reset-password.test.js; giải thích Given–When–Then, expect, jest.mock/fn/spyOn, beforeEach/afterEach, test.each.
3. Chạy `npm test -- --testNamePattern="R14|P09|L06"`: password boundary, reset expiry equality, invalid login.
4. Chạy `npm test -- --testNamePattern=I03`: forgot/reset → new-password login → reset-token replay rejection; bcrypt/JWT thật, SQL/email fake.
5. Chạy `npm run test:ci`; xem 48 PASS, 192 assertions, scoped coverage và gate 80%.
6. Mở GitHub-status.md, actual CI run và artifact. Mở Report5_UnitTest.xlsx hoặc Report5_Unit Test.xlsx (hai tên cùng nội dung); bấm Description để mở matrix R/P/L.
7. Giải thích 5 ST/AT Pending và rủi ro query cuối thất bại nhưng password đã đổi; không tuyên bố transaction/SQL thật được kiểm tra.

Phân công đề xuất: Mỹ Tâm kế hoạch/tài liệu; Khang Huy Unit/CI; Quang Tùng Integration/System. Nhóm chưa xác nhận vai trò, chưa tuyên bố đã thuyết trình.

FAIL/PASS đã thực hiện trên nhánh demo riêng: V08 của verification cũ, không phải P09 của recovery mới. FAIL: https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/38164135977 ; PASS sau khôi phục: https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/runs/38164201150 . Lỗi cố ý đổi > thành >=; trình bày rõ là regression demonstration.
