# Dữ liệu kiểm thử FJMS

Thư mục này chỉ chứa dữ liệu JSON và hướng dẫn. Không có code chạy test hoặc `expect`.

| File | Nội dung | Code đọc dữ liệu |
|---|---|---|
| common.json | Clock fixture, random, crypto/email mock values và lỗi giả lập | unit và integration |
| register.json | Base input, input override, mock recordsets, expected; R01–R15 | ../unit/auth.test.js |
| login.json | Base input/user, trạng thái, roles, SQL failure index, expected; L01–L15 | ../unit/auth.test.js |
| reset-password.json | Input, token/user IDs, expiry offsets, failure index, expected; P01–P15 | ../unit/reset-password.test.js |
| integration.json | Account, password mới, routes, fixture IDs, expected và I01–I03 | ../integration/auth-flow.test.js |

Mỗi unit case có `id`, `name`, `kind` và `expected`; tùy tình huống có `input`, `user`, `records`, `failAt`, `expiryOffsetMs` hoặc `passwords`. `kind` chọn cách setup/assert trong code test. JSON không tự thực thi mã.

Ví dụ P09: `expiryOffsetMs: 0`, expected HTTP 200, userId 7, passwordHash new-hash và resetId 9. Code test tạo Date từ clock cố định, gọi resetPassword rồi kiểm tra status, success và hai SQL writes. R09/P05 có hai input nhưng vẫn một case với bốn assertions tổng.

Thay input/expected của một ca ở JSON, không cần chỉnh thuật toán test nếu vẫn dùng kind hiện có. Nếu thêm loại tình huống mới, phải bổ sung logic setup/assert tương ứng và cập nhật test plan/Excel/statistics. Không đổi expected chỉ để làm test PASS; expected phải dựa vào yêu cầu hoặc hợp đồng đã được xác nhận.

Các test clone case/account trước khi sử dụng để tránh thay đổi dữ liệu chung. Token phát sinh trong integration được lấy từ response cùng ca, không lưu token chạy thật vào JSON. Các giá trị tài khoản, JWT secret và mật khẩu ở đây chỉ là dữ liệu test, không dùng tài khoản production.

Chạy từ backend: `npm ci`, `npm run test:ci`. Kết quả sau tách: cùng 48 case names, 45 unit +3 integration, 192 assertions, 100% selected coverage. Mocks vẫn ở ../unit/mocks; production handlers giữ nguyên.
