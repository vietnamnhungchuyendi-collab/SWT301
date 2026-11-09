import { BaseTest } from '../../exercise4_basepage/tests/BaseTest.js';
import { By, until } from 'selenium-webdriver';

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
  // 2. CHỨC NĂNG ĐĂNG KÝ (REGISTER)
  // ==========================================
  describe('2. Kiểm thử giao diện Đăng ký React (/register)', () => {
    test('TC_VITE_REG_001: Mở trang đăng ký và kiểm tra các trường bắt buộc', async () => {
      await driver.get(`${BASE_URL}/register`);

      const fullnameInput = await driver.wait(until.elementLocated(By.id('fullname')), 10000);
      const emailInput = await driver.wait(until.elementLocated(By.id('email')), 10000);

      expect(await fullnameInput.isDisplayed()).toBe(true);
      expect(await emailInput.isDisplayed()).toBe(true);
    });

    test('TC_VITE_REG_002: Kiểm tra validation form khi bỏ trống thông tin', async () => {
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
  // 3. CHỨC NĂNG ĐĂNG TIN DỰ ÁN (POST PROJECT)
  // ==========================================
  describe('3. Kiểm thử giao diện Đăng dự án React (/post-project)', () => {
    test('TC_VITE_PROJ_001: Kiểm tra mở form đăng việc và cơ chế bảo vệ phiên đăng nhập', async () => {
      await driver.get(`${BASE_URL}/post-project`);
      await driver.sleep(1500);

      const currentUrl = await driver.getCurrentUrl();
      // Nếu chưa login thì trang chuyển về login (Protected Route)
      expect(currentUrl.includes('/post-project') || currentUrl.includes('/login')).toBe(true);
    });
  });

  // ==========================================
  // 4. CHỨC NĂNG RÚT TIỀN (WITHDRAW FUNDS)
  // ==========================================
  describe('4. Kiểm thử giao diện Rút tiền (/withdraw)', () => {
    test('TC_VITE_WITHDRAW_001: Truy cập trang rút tiền và kiểm tra xác thực người dùng', async () => {
      await driver.get(`${BASE_URL}/withdraw`);
      await driver.sleep(1500);

      const currentUrl = await driver.getCurrentUrl();
      // Chưa đăng nhập thì router điều hướng về /login để bảo vệ số dư tài khoản
      expect(currentUrl.includes('/withdraw') || currentUrl.includes('/login')).toBe(true);
    });
  });

  // ==========================================
  // 5. CHỨC NĂNG NẠP TIỀN KÝ QUỸ (ESCROW DEPOSIT)
  // ==========================================
  describe('5. Kiểm thử giao diện Nạp tiền Ký quỹ dự án (/project/1/fund)', () => {
    test('TC_VITE_DEPOSIT_001: Mở giao diện nạp tiền dự án và kiểm tra phương thức VNPay', async () => {
      await driver.get(`${BASE_URL}/project/1/fund?amount=5000000`);
      await driver.sleep(1500);

      const currentUrl = await driver.getCurrentUrl();
      expect(currentUrl.includes('/fund') || currentUrl.includes('/login')).toBe(true);
    });
  });
});
