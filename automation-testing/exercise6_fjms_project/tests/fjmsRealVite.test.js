import { BaseTest } from '../../exercise4_basepage/tests/BaseTest.js';
import { By, until, Key } from 'selenium-webdriver';

describe('Kiểm thử tự động Selenium trực tiếp trên Web React Vite (http://localhost:5173)', () => {
  const BASE_URL = 'http://localhost:5173';
  let driver;

  beforeAll(async () => {
    // Khởi động Chrome thật hiển thị trên màn hình
    await BaseTest.setUpBase();
    driver = BaseTest.getDriver();
  });

  afterAll(async () => {
    await BaseTest.tearDownBase();
  });

  // ==========================================
  // 1. CHỨC NĂNG ĐĂNG NHẬP (AUTH)
  // ==========================================
  describe('1. Kiểm thử giao diện Đăng nhập React (/login)', () => {
    test('TC_VITE_LOGIN_001: Mở trang login thật và kiểm tra các thành phần giao diện', async () => {
      await driver.get(`${BASE_URL}/login`);

      const emailInput = await driver.wait(until.elementLocated(By.id('email')), 10000);
      const passwordInput = await driver.wait(until.elementLocated(By.id('password')), 10000);
      const submitBtn = await driver.wait(until.elementLocated(By.css("button[type='submit']")), 10000);

      expect(await emailInput.isDisplayed()).toBe(true);
      expect(await passwordInput.isDisplayed()).toBe(true);
      expect(await submitBtn.isDisplayed()).toBe(true);
    });

    test('TC_VITE_LOGIN_002: Bắt lỗi Validation khi bấm Đăng nhập mà không nhập gì', async () => {
      await driver.get(`${BASE_URL}/login`);

      const emailInput = await driver.findElement(By.id('email'));
      await emailInput.clear();

      const submitBtn = await driver.findElement(By.css("button[type='submit']"));
      await submitBtn.click();

      const valMsg = await driver.executeScript("return arguments[0].validationMessage;", emailInput);
      expect(valMsg.length).toBeGreaterThan(0);
    });

    test('TC_VITE_LOGIN_003: Tự động nhập tài khoản sai mật khẩu và kiểm tra phản hồi Backend', async () => {
      await driver.get(`${BASE_URL}/login`);

      const emailInput = await driver.findElement(By.id('email'));
      const passwordInput = await driver.findElement(By.id('password'));
      const submitBtn = await driver.findElement(By.css("button[type='submit']"));

      await emailInput.clear();
      await emailInput.sendKeys('admin1@fjms.com');
      await passwordInput.clear();
      await passwordInput.sendKeys('SaiMatKhau123!');

      await submitBtn.click();

      const errorBox = await driver.wait(
        until.elementLocated(By.css("div[class*='bg-red-50']")),
        5000
      );
      const errorText = await errorBox.getText();
      expect(errorText).toContain('không chính xác');
    });
  });

  // ==========================================
  // 2. CHỨC NĂNG ĐĂNG KÝ (REGISTER) - TỰ ĐỘNG ĐIỀN FORM
  // ==========================================
  describe('2. Kiểm thử giao diện Đăng ký React (/register)', () => {
    test('TC_VITE_REG_001: Tự động điền đầy đủ form đăng ký tài khoản Freelancer mới', async () => {
      await driver.get(`${BASE_URL}/register`);

      const fullnameInput = await driver.wait(until.elementLocated(By.id('fullname')), 10000);
      const emailInput = await driver.findElement(By.id('email'));
      const phoneInput = await driver.findElement(By.id('phone'));
      const passwordInput = await driver.findElement(By.id('password'));

      // Tự động gõ thông tin từng ô
      await fullnameInput.sendKeys('Nguyễn Văn Automation Tester');
      await emailInput.sendKeys('automation.tester@gmail.com');
      await phoneInput.sendKeys('0987654321');
      await passwordInput.sendKeys('Password@123');

      expect(await fullnameInput.getAttribute('value')).toBe('Nguyễn Văn Automation Tester');
      expect(await emailInput.getAttribute('value')).toBe('automation.tester@gmail.com');
      expect(await phoneInput.getAttribute('value')).toBe('0987654321');
    });

    test('TC_VITE_REG_002: Kiểm tra validation form khi bỏ trống thông tin bắt buộc', async () => {
      await driver.get(`${BASE_URL}/register`);

      const fullnameInput = await driver.findElement(By.id('fullname'));
      await fullnameInput.clear();

      const submitBtn = await driver.findElement(By.css("button[type='submit']"));
      await submitBtn.click();

      const valMsg = await driver.executeScript("return arguments[0].validationMessage;", fullnameInput);
      expect(valMsg.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 3. CHỨC NĂNG ĐĂNG TIN DỰ ÁN (POST PROJECT) - TỰ ĐỘNG ĐIỀN ĐẦY ĐỦ FORM & VALIDATION
  // ==========================================
  describe('3. Kiểm thử giao diện Đăng dự án React (/post-project)', () => {
    test('TC_VITE_PROJ_001: Tự động điền đầy đủ tất cả các trường: Tiêu đề, Ngành nghề, Mô tả, Kỹ năng, Ngân sách, Hạn chót, Số lượng', async () => {
      // Đăng nhập session giả lập vào localStorage để mở form dự án
      await driver.get(`${BASE_URL}/login`);
      await driver.executeScript(`
        localStorage.setItem('token', 'fake-selenium-jwt-token');
        localStorage.setItem('user', JSON.stringify({ user_id: 5, roleDefault: 'EMPLOYER', full_name: 'Employer Tester' }));
      `);

      await driver.get(`${BASE_URL}/post-project`);
      await driver.sleep(1000);

      const titleInput = await driver.wait(until.elementLocated(By.id('title')), 8000);
      const descInput = await driver.findElement(By.id('description'));
      const categorySelect = await driver.findElement(By.id('category'));
      const skillInput = await driver.findElement(By.id('skills'));
      const budgetInput = await driver.findElement(By.id('budgetAmount'));
      const deadlineInput = await driver.findElement(By.id('deadline'));
      const countInput = await driver.findElement(By.id('requiredFreelancerCount'));

      // 1. Tự động điền Tiêu đề dự án
      await titleInput.clear();
      await titleInput.sendKeys('Xây dựng Website Thương Mại Điện Tử Bằng ReactJS & Node.js');

      // 2. Chọn Danh mục công việc
      await categorySelect.sendKeys('Khác...');

      // 3. Tự động điền Mô tả dự án
      await descInput.clear();
      await descInput.sendKeys('Yêu cầu xây dựng sàn thương mại điện tử hoàn chỉnh, tích hợp cổng thanh toán VNPay và bảo mật JWT token.');

      // 4. Nhập Kỹ năng yêu cầu (nhấn Enter để thêm tag)
      await skillInput.sendKeys('React', Key.RETURN);
      await skillInput.sendKeys('Node.js', Key.RETURN);

      // 5. Tự động điền Ngân sách
      await budgetInput.clear();
      await budgetInput.sendKeys('15000000'); // 15 triệu VNĐ

      // 6. Tự động chọn Hạn chót hoàn thành (chọn ngày sau hôm nay)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const dateStr = futureDate.toISOString().substring(0, 10);
      await deadlineInput.sendKeys(dateStr);

      // 7. Tự động điền Số lượng cần tuyển
      await countInput.clear();
      await countInput.sendKeys('2');

      // Assertions kiểm tra dữ liệu đã được gõ vào form chính xác
      expect(await titleInput.getAttribute('value')).toContain('ReactJS & Node.js');
      expect(await descInput.getAttribute('value')).toContain('VNPay');
      expect(await budgetInput.getAttribute('value')).toContain('15.000.000');
      expect(await countInput.getAttribute('value')).toBe('2');
    });

    test('TC_VITE_PROJ_002: Form chặn submit và hiển thị validation khi bỏ trống trường bắt buộc', async () => {
      await driver.get(`${BASE_URL}/post-project`);
      await driver.sleep(1000);

      const titleInput = await driver.wait(until.elementLocated(By.id('title')), 8000);
      await titleInput.clear();

      const submitBtn = await driver.findElement(By.css("button[type='submit']"));
      await submitBtn.click();

      // Kiểm tra HTML5 validation message kích hoạt trên trường bắt buộc
      const valMsg = await driver.executeScript("return arguments[0].validationMessage;", titleInput);
      expect(valMsg.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 4. CHỨC NĂNG RÚT TIỀN (WITHDRAW FUNDS) - TỰ ĐỘNG CHỌN TIỀN VÀ ĐIỀN
  // ==========================================
  describe('4. Kiểm thử giao diện Rút tiền (/withdraw)', () => {
    test('TC_VITE_WITHDRAW_001: Mở trang rút tiền và tự động điền số tiền tùy chỉnh qua nút "Số khác"', async () => {
      // Giữ session đăng nhập
      await driver.executeScript(`
        localStorage.setItem('token', 'fake-selenium-jwt-token');
        localStorage.setItem('user', JSON.stringify({ user_id: 3, roleDefault: 'FREELANCER', full_name: 'Freelancer Tester' }));
      `);

      await driver.get(`${BASE_URL}/withdraw`);
      await driver.sleep(1500);

      // Nhấn nút "Số khác" để kích hoạt ô nhập số tiền tùy chỉnh
      const customBtn = await driver.wait(
        until.elementLocated(By.xpath("//button[contains(., 'Số khác')]")),
        8000
      );
      await customBtn.click();

      // Sau khi bấm "Số khác", ô input number sẽ xuất hiện để điền
      const amountInput = await driver.wait(
        until.elementLocated(By.css("input[type='number']")),
        5000
      );

      await amountInput.clear();
      await amountInput.sendKeys('500000'); // Tự động điền 500,000 VNĐ

      expect(await amountInput.getAttribute('value')).toBe('500000');
    });

    test('TC_VITE_WITHDRAW_002: Kiểm tra thao tác chọn các hạn mức rút tiền nhanh có sẵn', async () => {
      await driver.get(`${BASE_URL}/withdraw`);
      await driver.sleep(1000);

      // Kiểm tra có các nút hạn mức và nút Số khác hiển thị
      const customBtn = await driver.wait(
        until.elementLocated(By.xpath("//button[contains(., 'Số khác')]")),
        8000
      );
      expect(await customBtn.isDisplayed()).toBe(true);
    });
  });

  // ==========================================
  // 5. CHỨC NĂNG NẠP TIỀN KÝ QUỸ (ESCROW DEPOSIT) - TỰ ĐỘNG ĐIỀN TIỀN NẠP
  // ==========================================
  describe('5. Kiểm thử giao diện Nạp tiền Ký quỹ dự án (/project/1/fund)', () => {
    test('TC_VITE_DEPOSIT_001: Mở giao diện nạp tiền và tự động điền số tiền nạp VNPay (10.000.000 VNĐ)', async () => {
      await driver.get(`${BASE_URL}/project/1/fund`);
      await driver.sleep(1000);

      // Tìm ô input nhập tiền nạp
      const depositInput = await driver.wait(
        until.elementLocated(By.css("input[type='number']")),
        8000
      );

      await depositInput.clear();
      await depositInput.sendKeys('10000000'); // Tự động điền 10,000,000 VNĐ

      expect(await depositInput.getAttribute('value')).toBe('10000000');
    });

    test('TC_VITE_DEPOSIT_002: Kiểm tra giao diện và nút hành động chuyển hướng VNPay', async () => {
      await driver.get(`${BASE_URL}/project/1/fund`);
      await driver.sleep(1000);

      const depositInput = await driver.wait(
        until.elementLocated(By.css("input[type='number']")),
        8000
      );
      await depositInput.clear();
      await depositInput.sendKeys('5000000');

      // Kiểm tra nút thanh toán VNPay có mặt trên giao diện
      const vnpayBtn = await driver.findElement(By.xpath("//button[contains(., 'VNPay') or contains(., 'Thanh toán') or contains(., 'Xác nhận')]"));
      expect(await vnpayBtn.isDisplayed()).toBe(true);
    });
  });
});
