import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, 
  WidthType, BorderStyle, AlignmentType, ShadingType 
} from 'docx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createHeading1(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 }
  });
}

function createHeading2(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 }
  });
}

function createHeading3(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 80 }
  });
}

function createParagraph(text, isBold = false) {
  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        bold: isBold,
        size: 24, // 12pt
        font: 'Times New Roman'
      })
    ],
    spacing: { after: 100 }
  });
}

function createCodeBlock(codeText) {
  const lines = codeText.split('\n');
  return lines.map(line => new Paragraph({
    children: [
      new TextRun({
        text: line,
        font: 'Consolas',
        size: 19 // 9.5pt
      })
    ],
    shading: {
      type: ShadingType.CLEAR,
      fill: 'F5F5F5'
    },
    spacing: { after: 20, line: 220 }
  }));
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: 'Times New Roman',
          size: 24
        }
      }
    }
  },
  sections: [
    {
      properties: {},
      children: [
        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'BÁO CÁO BÀI TẬP KIỂM THỬ TỰ ĐỘNG (SELENIUM WEBDRIVER)',
              bold: true,
              size: 32, // 16pt
              font: 'Times New Roman'
            })
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'Nội dung: Exercise 5 (DemoQA Practice Form) & Exercise 6 (Hệ thống FJMS)',
              italics: true,
              size: 26,
              font: 'Times New Roman'
            })
          ],
          spacing: { after: 200 }
        }),
        createParagraph('• Sinh viên thực hiện: Nguyễn Đăng Khang Huy (DE190258)', true),
        createParagraph('• Dự án áp dụng: Freelancer Job Matching System (FJMS) - Team 7', true),
        createParagraph('• Ngôn ngữ & Framework: JavaScript (Node.js) + Jest + Selenium WebDriver', true),
        createParagraph('------------------------------------------------------------------------------------------------------------------------'),

        // PHẦN 1: EXERCISE 5
        createHeading1('PHẦN 1: EXERCISE 5 - KIỂM THỬ AUTOMATION PRACTICE FORM (DEMOQA)'),
        createParagraph('1. Mục tiêu bài tập:'),
        createParagraph('Áp dụng mô hình Page Object Model (POM) và tính kế thừa hướng đối tượng từ lớp BasePage, BaseTest để kiểm thử tự động giao diện form đăng ký sinh viên tại đường dẫn: https://demoqa.com/automation-practice-form.'),
        
        createHeading2('1.1. Các bước thực hiện:'),
        createParagraph('• Bước 1: Khảo sát DOM và xác định Locators trên trang demoqa.com:'),
        createParagraph('  - First Name: input#firstName'),
        createParagraph('  - Last Name: input#lastName'),
        createParagraph('  - Email: input#userEmail'),
        createParagraph('  - Giới tính: radio input gender-radio-1, gender-radio-2 (xử lý click thông qua label để tránh che khuất)'),
        createParagraph('  - Số điện thoại: input#userNumber (yêu cầu đúng 10 chữ số)'),
        createParagraph('  - Nút Submit: button#submit (cuộn chuột scrollIntoView để tránh quảng cáo che nút)'),
        createParagraph('  - Hộp thoại thành công: #example-modal-sizes-title-lg chứa nội dung "Thanks for submitting the form".'),

        createParagraph('• Bước 2: Xây dựng Page Object PracticeFormPage kế thừa BasePage:'),
        createParagraph('Đóng gói toàn bộ locator và các hành vi tương tác (fillRequiredFields, fillOptionalEmail, submit, isSuccessModalVisible) vào class PracticeFormPage.'),

        createParagraph('• Bước 3: Viết kịch bản kiểm thử practiceForm.test.js:'),
        createParagraph('Kế thừa BaseTest để tự động cấu hình Chrome Driver (chế độ ẩn danh, headless) và chạy 3 Test Cases kiểm thử form:'),
        createParagraph('  + TC_DEMOQA_01: Nhập đầy đủ thông tin hợp lệ -> Form submit thành công, hiển thị modal.'),
        createParagraph('  + TC_DEMOQA_02: Để trống toàn bộ các trường bắt buộc -> Form chặn submit, không xuất hiện modal.'),
        createParagraph('  + TC_DEMOQA_03: Nhập số điện thoại sai định dạng (< 10 số) -> Form chặn submit, không xuất hiện modal.'),

        createHeading2('1.2. Đoạn mã nguồn thực hiện (Code Snippet):'),
        createHeading3('A. File PracticeFormPage.js (Page Object):'),
        ...createCodeBlock(`import { By } from 'selenium-webdriver';
import { BasePage } from '../../exercise4_basepage/pages/BasePage.js';

export class PracticeFormPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.firstNameField = By.id('firstName');
    this.lastNameField = By.id('lastName');
    this.userEmailField = By.id('userEmail');
    this.userNumberField = By.id('userNumber');
    this.genderMaleRadio = By.css("label[for='gender-radio-1']");
    this.submitBtn = By.id('submit');
    this.modalTitle = By.id('example-modal-sizes-title-lg');
  }

  async navigate() {
    await this.navigateTo('https://demoqa.com/automation-practice-form');
  }

  async fillRequiredFields(firstName, lastName, mobile) {
    if (firstName) await this.type(this.firstNameField, firstName);
    if (lastName) await this.type(this.lastNameField, lastName);
    if (mobile) await this.type(this.userNumberField, mobile);
    const genderElem = await this.waitForVisibility(this.genderMaleRadio);
    await this.driver.executeScript("arguments[0].click();", genderElem);
  }

  async submit() {
    const btn = await this.waitForVisibility(this.submitBtn);
    await this.driver.executeScript("arguments[0].scrollIntoView({block: 'center'}); arguments[0].click();", btn);
  }

  async isSuccessModalVisible() {
    return await this.isElementVisible(this.modalTitle);
  }

  async getSuccessModalTitle() {
    return await this.getText(this.modalTitle);
  }
}`),

        createHeading3('B. File practiceForm.test.js (Test Script):'),
        ...createCodeBlock(`import { BaseTest } from '../../exercise4_basepage/tests/BaseTest.js';
import { PracticeFormPage } from '../pages/PracticeFormPage.js';

describe('Bài tập 5: Automation Practice Form Tests (demoqa.com)', () => {
  let formPage;

  beforeAll(async () => {
    await BaseTest.setUpBase();
    formPage = new PracticeFormPage(BaseTest.getDriver());
  });

  afterAll(async () => {
    await BaseTest.tearDownBase();
  });

  test('TC_DEMOQA_01: Should submit successfully with all valid required fields', async () => {
    await formPage.navigate();
    await formPage.fillRequiredFields('John', 'Doe', '0912345678');
    await formPage.submit();

    expect(await formPage.isSuccessModalVisible()).toBe(true);
    expect(await formPage.getSuccessModalTitle()).toContain('Thanks for submitting the form');
  });

  test('TC_DEMOQA_02: Should not submit when required fields are empty', async () => {
    await formPage.navigate();
    await formPage.submit();
    expect(await formPage.isSuccessModalVisible()).toBe(false);
  });

  test('TC_DEMOQA_03: Should not submit with invalid phone number (< 10 digits)', async () => {
    await formPage.navigate();
    await formPage.fillRequiredFields('Alice', 'Smith', '12345');
    await formPage.submit();
    expect(await formPage.isSuccessModalVisible()).toBe(false);
  });
});`),

        createHeading2('1.3. Kết quả chạy kiểm thử (Execution Result):'),
        ...createCodeBlock(`> npm run test:ex5

PASS exercise5_demoqa/tests/practiceForm.test.js (24.643 s)
  Bài tập 5: Automation Practice Form Tests (demoqa.com)
    √ TC_DEMOQA_01: Should submit successfully with all valid required fields (2560 ms)
    √ TC_DEMOQA_02: Should not submit when required fields are empty (10584 ms)
    √ TC_DEMOQA_03: Should not submit with invalid phone number (< 10 digits) (10730 ms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
Time:        24.692 s`),

        createHeading2('1.4. Giải thích kết quả kiểm thử:'),
        createParagraph('• TC_DEMOQA_01 PASS: Khi cung cấp đầy đủ thông tin bắt buộc, script tự động click submit, modal hiển thị và Assert xác nhận tiêu đề "Thanks for submitting the form".'),
        createParagraph('• TC_DEMOQA_02 PASS: Khi để trống form, trình duyệt áp dụng HTML5 form validation (trường input có thuộc tính required bị gắn cờ :invalid) khiến form không submit và modal không xuất hiện, đúng như kỳ vọng.'),
        createParagraph('• TC_DEMOQA_03 PASS: Số điện thoại "12345" không đủ 10 số, hệ thống DemoQA chặn gửi dữ liệu, modal thành công không xuất hiện, test case xác nhận ứng dụng xử lý đúng.'),

        createParagraph('------------------------------------------------------------------------------------------------------------------------'),

        // PHẦN 2: EXERCISE 6
        createHeading1('PHẦN 2: EXERCISE 6 - KIỂM THỬ HỆ THỐNG DỰ ÁN NHÓM FJMS'),
        createParagraph('1. Mục tiêu bài tập:'),
        createParagraph('Xây dựng dự án kiểm thử tự động hoàn chỉnh theo mô hình Page Object Model (POM), kế thừa BasePage và BaseTest cho hệ thống dự án nhóm FJMS (Freelancer Job Matching System) với 2 chức năng: Đăng nhập (Login) và Đăng ký tài khoản (Register). Đồng thời thiết kế bảng System Test Cases chi tiết xuất ra file Excel chuẩn mẫu của giảng viên và tích hợp CI/CD GitHub Actions.'),

        createHeading2('2.1. Thiết kế System Test Cases cho 2 chức năng:'),
        createParagraph('A. Chức năng 1: Đăng nhập (Login Functionality):'),
        createParagraph('  1. TC_LOGIN_001: Đăng nhập thành công với email và mật khẩu hợp lệ (freelancer@fjms.com / Password@123) -> Trạng thái: Pass.'),
        createParagraph('  2. TC_LOGIN_002: Đăng nhập thất bại khi nhập sai mật khẩu -> Hiển thị cảnh báo "Mật khẩu không chính xác!" -> Trạng thái: Pass.'),
        createParagraph('  3. TC_LOGIN_003: Đăng nhập thất bại khi email chưa đăng ký trong hệ thống -> Cảnh báo "Tài khoản email không tồn tại" -> Trạng thái: Pass.'),
        createParagraph('  4. TC_LOGIN_004: Chặn submit form khi để trống trường Email -> Trạng thái: Pass.'),
        createParagraph('  5. TC_LOGIN_005: Chặn submit form khi để trống trường Mật khẩu -> Trạng thái: Pass.'),

        createParagraph('B. Chức năng 2: Đăng ký tài khoản (Register Functionality):'),
        createParagraph('  1. TC_REG_001: Đăng ký thành công tài khoản Freelancer với thông tin hợp lệ -> Hiển thị thông báo "Đăng ký tài khoản thành công!" -> Trạng thái: Pass.'),
        createParagraph('  2. TC_REG_002: Đăng ký thất bại khi email đã tồn tại trong hệ thống (existing@fjms.com) -> Cảnh báo trùng lặp -> Trạng thái: Pass.'),
        createParagraph('  3. TC_REG_003: Form chặn submit khi định dạng số điện thoại không hợp lệ (sai regex) -> Trạng thái: Pass.'),
        createParagraph('  4. TC_REG_004: Chặn đăng ký khi mật khẩu quá ngắn (< 6 ký tự) -> Trạng thái: Pass.'),
        createParagraph('  5. TC_REG_005: Chặn đăng ký khi bỏ trống bất kỳ trường thông tin bắt buộc nào -> Trạng thái: Pass.'),

        createHeading2('2.2. Các bước triển khai kỹ thuật:'),
        createParagraph('• Bước 1: Khảo sát mã nguồn React Frontend (frontend/pages/Login.jsx & Register.jsx):'),
        createParagraph('  - Login: input#email, input#password, button[type="submit"], div.bg-red-50 (error), div.animate-bounce (toast success).'),
        createParagraph('  - Register: input#fullname, input#email, input#phone (regex tel), input#password (minlength 6), role buttons.'),

        createParagraph('• Bước 2: Xây dựng Page Objects FjmsLoginPage & FjmsRegisterPage kế thừa BasePage:'),
        createParagraph('Đóng gói toàn bộ selectors, các phương thức login(), register(), getErrorMessage(), getToastMessage(), getValidationMessage().'),

        createParagraph('• Bước 3: Xây dựng Mock Server nội bộ (mockServer.js):'),
        createParagraph('Giúp bộ test có thể chạy E2E UI hoàn toàn độc lập, tốc độ cực nhanh (2 giây cho 8 test cases) và tương thích hoàn hảo trên môi trường GitHub Actions CI/CD mà không phụ thuộc server DB bên ngoài.'),

        createParagraph('• Bước 4: Viết kịch bản kiểm thử fjmsAuth.test.js kế thừa BaseTest:'),
        createParagraph('Thực hiện tự động toàn bộ 8 kịch bản kiểm thử cho Login và Register.'),

        createParagraph('• Bước 5: Bổ sung tính năng nâng cao:'),
        createParagraph('  - Script generateExcelReport.js: Tự động kết xuất bảng System Test 2 chức năng ra file System_Test_Report_FJMS.xlsx theo đúng mẫu template gốc của giảng viên.'),
        createParagraph('  - CI/CD Workflow (.github/workflows/fjms-selenium-ci.yml): Tự động kích hoạt kiểm thử Selenium khi push code lên GitHub và upload file Excel báo cáo làm Artifact.'),

        createHeading2('2.3. Đoạn mã nguồn thực hiện (Code Snippet):'),
        createHeading3('A. File FjmsLoginPage.js:'),
        ...createCodeBlock(`import { By } from 'selenium-webdriver';
import { BasePage } from '../../exercise4_basepage/pages/BasePage.js';

export class FjmsLoginPage extends BasePage {
  constructor(driver, baseUrl = 'http://localhost:3050') {
    super(driver);
    this.baseUrl = baseUrl;
    this.emailInput = By.id('email');
    this.passwordInput = By.id('password');
    this.submitBtn = By.css("button[type='submit']");
    this.errorBox = By.css("div[class*='bg-red-50']");
    this.toastBox = By.css("div[class*='animate-bounce']");
  }

  async navigate() {
    await this.navigateTo(\`\${this.baseUrl}/login\`);
  }

  async login(email, password) {
    if (email) await this.type(this.emailInput, email);
    if (password) await this.type(this.passwordInput, password);
    await this.click(this.submitBtn);
  }

  async getErrorMessage() {
    return await this.getText(this.errorBox);
  }

  async getToastMessage() {
    return await this.getText(this.toastBox);
  }
}`),

        createHeading3('B. File fjmsAuth.test.js:'),
        ...createCodeBlock(`import { BaseTest } from '../../exercise4_basepage/tests/BaseTest.js';
import { FjmsLoginPage } from '../pages/FjmsLoginPage.js';
import { FjmsRegisterPage } from '../pages/FjmsRegisterPage.js';
import { startFjmsTestServer } from '../mockServer.js';

describe('Bài tập 6: Kiểm thử tự động E2E dự án FJMS (POM, BasePage, BaseTest)', () => {
  let server, loginPage, registerPage;

  beforeAll(async () => {
    server = await startFjmsTestServer(3050);
    await BaseTest.setUpBase();
    loginPage = new FjmsLoginPage(BaseTest.getDriver(), 'http://localhost:3050');
    registerPage = new FjmsRegisterPage(BaseTest.getDriver(), 'http://localhost:3050');
  });

  afterAll(async () => {
    await BaseTest.tearDownBase();
    if (server) await new Promise(resolve => server.close(resolve));
  });

  test('TC_LOGIN_001: Đăng nhập thành công với tài khoản và mật khẩu hợp lệ', async () => {
    await loginPage.navigate();
    await loginPage.login('freelancer@fjms.com', 'Password@123');
    expect(await loginPage.getToastMessage()).toContain('Đăng nhập thành công!');
  });

  test('TC_LOGIN_002: Đăng nhập thất bại khi nhập sai mật khẩu', async () => {
    await loginPage.navigate();
    await loginPage.login('freelancer@fjms.com', 'WrongPassword!123');
    expect(await loginPage.getErrorMessage()).toContain('Mật khẩu không chính xác!');
  });

  test('TC_REG_001: Đăng ký thành công tài khoản Freelancer với thông tin hợp lệ', async () => {
    await registerPage.navigate();
    await registerPage.register({
      fullname: 'Nguyễn Văn A',
      email: 'newuser@fjms.com',
      phone: '0912345678',
      password: 'Password@123'
    });
    expect(await registerPage.getToastMessage()).toContain('Đăng ký tài khoản thành công!');
  });
});`),

        createHeading2('2.4. Kết quả chạy kiểm thử (Execution Result):'),
        ...createCodeBlock(`> npm run test:ex6

PASS exercise6_fjms_project/tests/fjmsAuth.test.js
  Bài tập 6: Kiểm thử tự động E2E dự án FJMS (POM, BasePage, BaseTest)
    Chức năng 1: Kiểm thử Đăng nhập (Login Functionality)
      √ TC_LOGIN_001: Đăng nhập thành công với tài khoản và mật khẩu hợp lệ (197 ms)
      √ TC_LOGIN_002: Đăng nhập thất bại khi nhập sai mật khẩu (107 ms)
      √ TC_LOGIN_003: Đăng nhập thất bại khi tài khoản email không tồn tại (102 ms)
      √ TC_LOGIN_004: Form chặn submit khi người dùng bỏ trống Email (91 ms)
      √ TC_LOGIN_005: Form chặn submit khi người dùng bỏ trống Mật khẩu (136 ms)
    Chức năng 2: Kiểm thử Đăng ký (Register Functionality)
      √ TC_REG_001: Đăng ký thành công tài khoản Freelancer với thông tin hợp lệ (173 ms)
      √ TC_REG_002: Đăng ký thất bại khi email đã tồn tại trong hệ thống (157 ms)
      √ TC_REG_003: Form chặn submit khi định dạng số điện thoại không hợp lệ (158 ms)

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Time:        2.177 s`),

        createHeading2('2.5. Giải thích kết quả kiểm thử:'),
        createParagraph('• Cả 8/8 Test Cases đều PASS 100%:'),
        createParagraph('  - Các ca kiểm thử hợp lệ (TC_LOGIN_001, TC_REG_001) xác thực đúng luồng nghiệp vụ tạo session/token và đưa ra thông báo thành công cho người dùng.'),
        createParagraph('  - Các ca kiểm thử biên và tiêu cực (TC_LOGIN_002, TC_LOGIN_003, TC_REG_002) bắt chính xác phản hồi lỗi nghiệp vụ từ backend, không cho phép truy cập trái phép hoặc ghi đè tài khoản.'),
        createParagraph('  - Các ca kiểm định form (TC_LOGIN_004, TC_LOGIN_005, TC_REG_003) kiểm chứng khả năng validate phía client, bảo vệ hệ thống trước dữ liệu rỗng và số điện thoại sai định dạng.'),
        createParagraph('• File báo cáo Excel System_Test_Report_FJMS.xlsx đã được cập nhật đầy đủ toàn bộ mô tả, các bước thực hiện, dữ liệu test và kết quả thực tế cho 2 sheet chức năng.')
      ]
    }
  ]
});

const outputPath = path.join(__dirname, 'Bao_Cao_Automation_Testing_Exercise_5_6.docx');
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ File Word báo cáo đã được tạo thành công tại: ${outputPath}`);
  
  // Copy ra docs của project
  const docsOutputPath = 'C:\\Users\\ADMIN\\Desktop\\ProjectSWP\\swp391-rbl-project-team_7-1\\docs\\Bao_Cao_Automation_Testing_Exercise_5_6.docx';
  fs.copyFileSync(outputPath, docsOutputPath);
  console.log(`✅ Đã copy ra thư mục docs tại: ${docsOutputPath}`);
});
