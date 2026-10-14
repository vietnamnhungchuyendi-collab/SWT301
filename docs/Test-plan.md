# Test plan và dữ liệu kiểm thử FJMS

Phạm vi: một tính năng Authentication gồm register, resetPassword, login trong dự án FJMS thực tế tại repository SWT301. Căn cứ là handler FJMS hiện có được tách module giữ nguyên hành vi; version/hash tại evidence/manifest.json và test-source-sha256.json. Không thay thế quy tắc mật khẩu FJMS bằng quy tắc của bài AccountService trước.

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
## resetPassword
Fixture: email=test@example.com, otpCode=550000, newPassword=Bb12345!, user_id=7, reset_id=9. Fixed clock 2026-10-12T00:00:00Z; reset SQL/bcrypt mocks per case. Existing equality rule accepts now=expiry; business confirmation pending. Password hash and token-used writes occur in this order.

| ID | Input/state | HTTP expected | N/A/B | Actual | Assertions |
|---|---|---:|:---:|---|---:|
| P01 | email rỗng | 400 | A | PASS | 4 |
| P02 | otpCode rỗng | 400 | A | PASS | 4 |
| P03 | newPassword rỗng | 400 | A | PASS | 4 |
| P04 | Bb1234! (7 ký tự) | 400 | B | PASS | 4 |
| P05 | bb12345! và BB12345! (hai partition) | 400 | A | PASS | 4 |
| P06 | không có tài khoản | 404 | A | PASS | 4 |
| P07 | token sai/đã dùng → query không có row | 400 | A | PASS | 4 |
| P08 | expiry=now-1ms | 400 | B | PASS | 4 |
| P09 | expiry=now | 200 | B | PASS | 4 |
| P10 | expiry=now+1ms | 200 | B | PASS | 4 |
| P11 | query1 lỗi | 500 | A | PASS | 4 |
| P12 | query2 lỗi | 500 | A | PASS | 4 |
| P13 | query3 lỗi | 500 | A | PASS | 4 |
| P14 | query4 lỗi sau password write | 500 | A | PASS | 4 |
| P15 | bcrypt hashing lỗi | 500 | A | PASS | 4 |

P05 has two inputs with two assertions each, one case. P07 checks the query contains is_used=0; this does not prove live SQL rejects reused tokens. P09/P10 verify hash and bound write IDs. P15 checks error logging before writes. No rollback claim for P14.

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


## Component integration
I01: register, real bcrypt hash, OTP persistence and email mock (4 assertions).
I02: register → forgot-password → reset-password; new hash accepts Bb12345!, rejects old password, token used (4 assertions).
I03: verified account setup → forgot/reset → new-password login, real JWT/persistence and reset replay 400 (4 assertions).
Each case resets state; SQL/email fake, Express/bcrypt/JWT real. Dedicated test-app routes do not prove production router/server works.

## Planned staging
ST-01 registration boundaries; ST-02 reset password/token reuse; ST-03 locked login. AT-01/02 freelancer/employer recovery journeys. All five Pending, not executed. Details in Report5_Test Report.xlsx. Full catalogue 53; executed 48/53=90.57%; PASS among executed 48/48=100%.


## Tách dữ liệu và code test — 14/10/2026
Dữ liệu và expected ở backend/tests/data/{common,register,login,reset-password,integration}.json. Code thực thi/assertions ở tests/unit và tests/integration; mock engine ở unit/mocks. Xem backend/tests/data/README.md để sửa đúng một scenario. Giữ nguyên 48 case names, 192 assertions và coverage 100% của các module được chọn. Không đổi handler production, case IDs, nội dung Excel hoặc trạng thái 5 ST/AT Pending. Báo cáo Word/Excel vẫn mô tả cùng các ca và bằng chứng baseline 12/10; lần xác minh refactor mới lưu riêng tại docs/evidence/data-separation-2026-10-14.
