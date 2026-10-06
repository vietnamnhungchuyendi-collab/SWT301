# Test plan và dữ liệu kiểm thử FJMS

Phạm vi: một tính năng Authentication gồm register, verifyEmail, login trong dự án FJMS thực tế tại repository SWT301. Căn cứ là mã nguồn commit 794896fde8f47b9646613ce1f00c43ba607fa644. Không thay thế quy tắc mật khẩu FJMS bằng quy tắc của bài AccountService trước.

Chiến lược: Given–When–Then, equivalence partitioning, boundary values, negative/error paths. Unit test dùng mock SQL, bcrypt, JWT, email; integration test dùng Express, controller, bcrypt và JWT thật, SQL/email giả ở ranh giới adapter. Không phải kiểm thử SQL Server hoặc Gmail thật.

## register
Base body: fullName=Test User, email=test@example.com, password=Aa12345!, role=FREELANCER; phone omitted. SQL default empty, insert returns user_id=7, RNG=0.5, clock=2026-10-07T00:00:00Z. R09 runs two invalid passwords Aaabcdef! and Aa123456, two status/message assertions per vector, four total. R13 phone=0912345678 and phone result exists. R15 phone=0912345678 with role EMPLOYER. R14 verifies minimum valid password length 8 and lowercase role normalization.

HTTP status; exact/body message or success payload; SQL call count/no write; outbound email or hash side effect.

| ID | Input hoặc trạng thái thay đổi | HTTP expected | N/A/B | Actual | Assertions |
|---|---|---:|:---:|---|---:|
| R01 | fullName="" | 400 | A | PASS | 4 |
| R02 | email="" | 400 | A | PASS | 4 |
| R03 | password="" | 400 | A | PASS | 4 |
| R04 | role="" | 400 | A | PASS | 4 |
| R05 | role=ADMIN | 400 | A | PASS | 4 |
| R06 | password=Aa1234! | 400 | B | PASS | 4 |
| R07 | password=aa12345! | 400 | A | PASS | 4 |
| R08 | password=AA12345! | 400 | A | PASS | 4 |
| R09 | no digit/special | 400 | A | PASS | 4 |
| R10 | SQL query rejects | 500 | A | PASS | 4 |
| R11 | email exists | 400 | A | PASS | 4 |
| R12 | phone=123 | 400 | A | PASS | 4 |
| R13 | phone exists | 400 | A | PASS | 4 |
| R14 | role=freelancer | 201 | B | PASS | 4 |
| R15 | role=EMPLOYER | 201 | N | PASS | 4 |
## verifyEmail
Base body: email=test@example.com, code=550000. user_id=7, verified=false, verification_id=9. SQL returns valid unused code expiring now+10m unless overridden. V03 no user; V04 verified=true; V05/V06 OTP query empty (wrong/used modeled by no matching unused row). Fixed clock=2026-10-07T00:00:00Z. Boundary equality accepted by existing source (> expiry).

HTTP status/body; number of SQL operations; bound email/user/code parameters or update IDs; no outbound email for errors.

| ID | Input hoặc trạng thái thay đổi | HTTP expected | N/A/B | Actual | Assertions |
|---|---|---:|:---:|---|---:|
| V01 | email="" | 400 | A | PASS | 4 |
| V02 | code="" | 400 | A | PASS | 4 |
| V03 | user not found | 404 | A | PASS | 4 |
| V04 | verified=true | 200 | N | PASS | 4 |
| V05 | code=wrong | 400 | A | PASS | 4 |
| V06 | code=used | 400 | A | PASS | 4 |
| V07 | expiry=now-1ms | 400 | B | PASS | 4 |
| V08 | expiry=now | 200 | B | PASS | 4 |
| V09 | expiry=now+1ms | 200 | B | PASS | 4 |
| V10 | expiry=now+10m | 200 | N | PASS | 4 |
| V11 | query1 rejects | 500 | A | PASS | 4 |
| V12 | query2 rejects | 500 | A | PASS | 4 |
| V13 | query3 rejects | 500 | A | PASS | 4 |
| V14 | query4 rejects | 500 | A | PASS | 4 |
| V15 | valid OTP | 200 | N | PASS | 4 |
## login
Base body: email=test@example.com, password=Aa12345!. User id=7, status ACTIVE, verified=true, role FREELANCER, password_hash=hashed. bcrypt result true, roles=[FREELANCER], token=jwt-token; rows patched by scenario. L09 ADMIN password_hash=Aa12345!; L10 ADMIN hash=hashed. L07/L15 verified=false. JWT default expiresIn=7d.

HTTP status/body; rejected login does not issue JWT; expected password check/query count; valid JWT payload and persisted token.

| ID | Input hoặc trạng thái thay đổi | HTTP expected | N/A/B | Actual | Assertions |
|---|---|---:|:---:|---|---:|
| L01 | email="" | 400 | A | PASS | 4 |
| L02 | password="" | 400 | A | PASS | 4 |
| L03 | user not found | 400 | A | PASS | 4 |
| L04 | status=LOCKED | 403 | A | PASS | 4 |
| L05 | SUSPENDED | 403 | A | PASS | 4 |
| L06 | wrong password | 400 | A | PASS | 4 |
| L07 | verified=false | 401 | N | PASS | 4 |
| L08 | FREELANCER hash | 200 | N | PASS | 4 |
| L09 | ADMIN plain pwd | 200 | N | PASS | 4 |
| L10 | ADMIN bcrypt | 200 | N | PASS | 4 |
| L11 | query1 rejects | 500 | A | PASS | 4 |
| L12 | query2 rejects | 500 | A | PASS | 4 |
| L13 | query3 rejects | 500 | A | PASS | 4 |
| L14 | JWT sign throws | 500 | A | PASS | 4 |
| L15 | OTP save rejects | 500 | A | PASS | 4 |

## Integration scenarios

| ID | Steps | Expected / assertions |
|---|---|---|
| I01 | POST register with valid EMPLOYER | 201; real bcrypt verifies password; response OTP equals saved OTP; email adapter receives saved OTP |
| I02 | POST register then verify returned OTP | 200; success=true; user verified flag true; OTP used flag true |
| I03 | Register → verify → login | 200; real JWT signature/payload valid; refresh token persisted; password hash absent from returned user |

## Review và phạm vi

Tổng: 45 unit + 3 integration = 48; 192 assertions = 4/test. Mỗi test reset dependencies; fixed clock/RNG ở unit giúp lặp lại. Integration không dùng fake timers vì HTTP cần timer thật. Hai case V05/V06 dùng cùng kết quả SQL rỗng để phản ánh predicate is_used=0 của controller; kiểm chứng khác nhau ở SQL thật nằm ngoài phạm vi.

Không thêm nghiệp vụ cho email syntax hoặc role non-string khi source chưa có contract. SQL/email failure handled bằng HTTP 500; không diễn giải đây là exception ném ra caller. Login ADMIN plaintext fallback được ghi nhận đúng hành vi nguồn, không được xem là khuyến nghị thiết kế. Các hàm forgot/reset/resend/google ngoài ba hàm được chọn không nằm trong coverage denominator.

Report5 giữ cột hẹp và validation O gốc: mỗi điều kiện ghi input/state kèm mã HTTP sau dấu hai chấm; giải mã1=200,2=201,3=400,4=401,5=403,6=404,7=500 nằm ở C5. Confirmation O kiểm HTTP đúng như input và payload/side effect như test code. Ngày7/10 tại ma trận là07/10/2026 theo Cover. Không đổi font/width/merge để nhét số3chữ số vào ô vốn thiết kế cho O.
