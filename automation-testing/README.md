# Bộ Kiểm Thử Tự Động (Selenium WebDriver & JavaScript/Jest) - Dự án FJMS

Bộ kiểm thử tự động động (Dynamic Automated Testing) được chuyển đổi từ mô hình mẫu Java (Maven, JUnit 5, Selenium Java) sang **hệ sinh thái JavaScript / Node.js & Jest** phù hợp với toàn bộ dự án nhóm **Freelancer Job Matching System (FJMS)**.

---

## 📊 Bảng đối chiếu Java JUnit 5 vs JavaScript Jest

| Khái niệm / Thành phần | Java (JUnit 5 + Selenium) | JavaScript (Node.js + Jest + Selenium) |
| :--- | :--- | :--- |
| **Test Runner** | Maven Surefire + JUnit 5 | Node.js + Jest |
| **Khởi chạy / Dọn dẹp** | `@BeforeAll`, `@AfterAll` | `beforeAll(async () => ...)`, `afterAll(async () => ...)` |
| **Test Case** | `@Test` | `test('name', async () => ...)` |
| **Parameterized Test** | `@ParameterizedTest` + `@CsvSource` | `test.each(cases)('title %s', async (...) => ...)` |
| **Đọc dữ liệu từ file CSV** | `@CsvFileSource(resources = "...")` | `readCsvFile(path, skipLines)` kết hợp `test.each` |
| **Khởi tạo Driver** | `new ChromeDriver(options)` | `new Builder().forBrowser('chrome').setChromeOptions(options).build()` |
| **Explicit Wait** | `WebDriverWait wait = new WebDriverWait(...)`<br>`wait.until(ExpectedConditions.visibilityOf(...))` | `await driver.wait(until.elementLocated(...), timeout)`<br>`await driver.wait(until.elementIsVisible(...), timeout)` |
| **Locators** | `By.id()`, `By.cssSelector()`, `By.xpath()` | `By.id()`, `By.css()`, `By.xpath()` |
| **Assertions** | `assertTrue(...)`, `assertEquals(...)` | `expect(...).toContain(...)`, `expect(...).toBe(...)` |
| **Mô hình kiến trúc** | Page Object Model (POM), BasePage, BaseTest | Page Object Model (POM), BasePage, BaseTest (ES6 Classes) |

---

## 📁 Cấu trúc thư mục

```text
automation-testing/
├── common/ (kế thừa từ bài 3 và bài 4)
│   ├── DriverFactory.js            # Khởi tạo WebDriver ẩn danh, headless cho CI/CD
│   ├── BasePage.js                 # Lớp cha BasePage đóng gói wait, click, type, getText
│   └── BaseTest.js                 # Quản lý vòng đời khởi tạo và quit trình duyệt
├── exercise1_parameterized/
│   └── loginParameterized.test.js  # Bài tập 1: Parameterized test với bộ dữ liệu inline
├── exercise2_csv/
│   ├── resources/
│   │   └── login-data.csv          # Bài tập 2: File dữ liệu CSV kiểm thử
│   ├── csvReader.js                # Parser đọc và chuẩn hóa dữ liệu CSV
│   └── loginCsv.test.js            # Bài tập 2: Test đăng nhập nạp dữ liệu từ file CSV
├── exercise3_pom/
│   ├── pages/
│   │   └── LoginPage.js            # Bài tập 3: Page Object đại diện trang Login
│   ├── utils/
│   │   └── DriverFactory.js        # Bài tập 3: Driver Factory
│   └── tests/
│       └── loginPom.test.js        # Bài tập 3: Test Login với mô hình POM
├── exercise4_basepage/
│   ├── pages/
│   │   ├── BasePage.js             # Bài tập 4: Xây dựng lớp cơ sở BasePage
│   │   └── LoginPage.js            # Bài tập 4: LoginPage kế thừa BasePage
│   └── tests/
│       ├── BaseTest.js             # Bài tập 4: BaseTest quản lý driver
│       └── loginBase.test.js       # Bài tập 4: Test Login kế thừa BasePage và BaseTest
├── exercise5_demoqa/
│   ├── pages/
│   │   └── PracticeFormPage.js     # Bài tập 5: POM kiểm thử trang DemoQA Practice Form
│   └── tests/
│       └── practiceForm.test.js    # Bài tập 5: Test form đăng ký sinh viên demoqa.com
├── exercise6_fjms_project/
│   ├── pages/
│   │   ├── FjmsLoginPage.js        # Bài tập 6: POM trang Đăng nhập FJMS
│   │   └── FjmsRegisterPage.js     # Bài tập 6: POM trang Đăng ký tài khoản FJMS
│   ├── mockServer.js               # Mock server độc lập chạy E2E UI không cần DB
│   ├── generateExcelReport.js      # Script xuất file System Test Excel theo mẫu chuẩn
│   ├── reports/
│   │   └── System_Test_Report_FJMS.xlsx # File báo cáo kiểm thử hệ thống 2 chức năng
│   └── tests/
│       └── fjmsAuth.test.js        # Bài tập 6: Kiểm thử 2 chức năng Login & Register
└── package.json
```

---

## 🚀 Hướng dẫn chạy kiểm thử

Tại thư mục `automation-testing`:

### 1. Cài đặt thư viện:
```bash
npm install
```

### 2. Chạy từng bài tập:
- **Bài tập 1 (Parameterized Test):**
  ```bash
  npm run test:ex1
  ```
- **Bài tập 2 (Đọc CSV bên ngoài):**
  ```bash
  npm run test:ex2
  ```
- **Bài tập 3 (Page Object Model cơ bản):**
  ```bash
  npm run test:ex3
  ```
- **Bài tập 4 (Nâng cao với BasePage & BaseTest):**
  ```bash
  npm run test:ex4
  ```
- **Bài tập 5 (Kiểm thử trang DemoQA):**
  ```bash
  npm run test:ex5
  ```
- **Bài tập 6 (Kiểm thử hệ thống dự án FJMS):**
  ```bash
  npm run test:ex6
  ```

### 3. Xuất file Báo cáo System Test Excel:
```bash
npm run export:excel
```
File Excel sẽ được tạo tại:
- `automation-testing/exercise6_fjms_project/reports/System_Test_Report_FJMS.xlsx`
- `docs/System_Test_Report_FJMS.xlsx`

### 4. Tích hợp CI/CD GitHub Actions:
Workflow đã được cấu hình tại `.github/workflows/fjms-selenium-ci.yml`, tự động chạy toàn bộ các bài test trên Ubuntu GitHub Actions và upload file System Test Excel làm artifact báo cáo.

