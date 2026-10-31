# SWT301 — CI Maven: Exercise 1 và Exercise 2

[![MathUtil CI](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/workflows/maven.yml/badge.svg?branch=codex%2Fmaven-ci-exercises-1-2)](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/workflows/maven.yml?query=branch%3Acodex%2Fmaven-ci-exercises-1-2)
[![Sales Management CI](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/workflows/sales-ci.yml/badge.svg?branch=codex%2Fmaven-ci-exercises-1-2)](https://github.com/vietnamnhungchuyendi-collab/SWT301/actions/workflows/sales-ci.yml?query=branch%3Acodex%2Fmaven-ci-exercises-1-2)

Phạm vi bài nộp: Exercise 1 MathUtil và Exercise 2 Sales Management trong đề CI Maven. Không có Exercise 3, Jest hoặc Report5 trong gói CI này. Nhánh riêng: `codex/maven-ci-exercises-1-2`. Repository gốc vẫn chứa ứng dụng FJMS; đó không phải nội dung bài CI Java này.

## File của từng bài

| Bài | Project Maven | Workflow | Artifact JAR |
|---|---|---|---|
| Exercise 1 | labs/math-util | .github/workflows/maven.yml | math-util-1.0-SNAPSHOT |
| Exercise 2 | labs/sales-management | .github/workflows/sales-ci.yml | sales-management-1.0-SNAPSHOT |

Mỗi project có pom.xml, src/main/java và src/test/java. Dùng unit tests của các bài Lab2 đã hoàn thành. MathUtil kiểm tra factorial; Sales Management kiểm tra Product và SalesService. Hai project build độc lập.

## Workflow hoạt động

1. Kích hoạt khi push lên main/develop/codex/**, khi có pull request hướng tới main/develop, hoặc chạy thủ công bằng workflow_dispatch.
2. Checkout mã nguồn trên runner Ubuntu.
3. Cài Temurin JDK 17, cache dependency Maven theo pom.xml tương ứng.
4. Chạy `mvn -B clean verify --file pom.xml` trong project. `verify` đi qua compile, test và package nên bao gồm bước tạo JAR mà đề yêu cầu.
5. Sao chép JAR từ target sang staging.
6. Upload JAR bằng actions/upload-artifact@v4. Upload Surefire test reports và JaCoCo reports để xem bằng chứng. JUnit5/JaCoCo đã có trong project Lab2; coverage là báo cáo bổ sung, không thay yêu cầu CI.

Unit test hoặc build lỗi làm job FAIL; khi đó bước tạo/tải JAR thành công không được tuyên bố hoàn thành. Đây là CI build/test/package; không triển khai ứng dụng lên hosting.

## Chạy trên máy

Chuẩn bị JDK 17+ và Maven. Mở terminal tại thư mục gốc:

```text
mvn -B clean verify --file labs/math-util/pom.xml
mvn -B clean verify --file labs/sales-management/pom.xml
```

JAR xuất hiện ở `labs/<project>/target/`; kết quả test ở `target/surefire-reports/`; coverage ở `target/site/jacoco/index.html`. target/staging/private NetBeans bị loại khỏi Git bằng .gitignore. Không cần mở NetBeans để runner GitHub chạy Maven.

## Xem CI và tải JAR trên GitHub

Mở repository → Actions → chọn **MathUtil CI** hoặc **Sales Management CI** → chọn lần chạy của nhánh `codex/maven-ci-exercises-1-2` → mở job build để xem các bước. Khi job xanh, kéo xuống **Artifacts** ở trang lần chạy và tải JAR/test-evidence. Cần đăng nhập GitHub để tải artifact khi hệ thống yêu cầu. Kết quả thực tế và liên kết run được ghi trong `CI_RESULTS.md`.

## Đối chiếu yêu cầu đề

| Yêu cầu | File/bằng chứng đáp ứng |
|---|---|
| Hoàn thiện MathUtil Lab2 | labs/math-util/src và pom.xml; JUnit tests |
| Đưa project lên GitHub | Nhánh bài CI riêng của repository SWT301 |
| Có .gitignore cho Maven/NetBeans | .gitignore: target, staging, class/JAR, nbproject/private, nbbuild/nbdist |
| Java with Maven workflow, trigger push/PR | .github/workflows/maven.yml |
| Thiết lập JDK 17, Temurin, Maven cache | actions/setup-java@v4 trong cả hai workflow |
| Build/test/package bằng Maven | clean verify bao gồm test và package |
| Sao chép và upload JAR | Stage JAR và upload-artifact@v4 |
| Badge README | Hai huy hiệu ở đầu tài liệu và README gốc |
| Exercise 2: CI Sales Management | .github/workflows/sales-ci.yml và labs/sales-management |

Ngày chuẩn bị bài riêng: 31/10/2026. Xem CI_RESULTS.md để biết run thật; không dùng ảnh trong đề làm bằng chứng.
