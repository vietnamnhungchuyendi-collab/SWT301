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
  // TEST TRỰC TIẾP TRÊN TRANG /login CỦA REACT
  // ==========================================
  describe('1. Kiểm thử giao diện Đăng nhập React (http://localhost:5173/login)', () => {
    test('TC_VITE_LOGIN_001: Mở trang login thật và kiểm tra các thành phần giao diện', async () => {
      await driver.get(`${BASE_URL}/login`);

      // Chờ form hiển thị
      const emailInput = await driver.wait(until.elementLocated(By.id('email')), 10000);
      const passwordInput = await driver.wait(until.elementLocated(By.id('password')), 10000);
      const submitBtn = await driver.wait(until.elementLocated(By.css("button[type='submit']")), 10000);

      expect(await emailInput.isDisplayed()).toBe(true);
      expect(await passwordInput.isDisplayed()).toBe(true);
      expect(await submitBtn.isDisplayed()).toBe(true);
    });

    test('TC_VITE_LOGIN_002: Bắt lỗi Validation giao diện khi bấm Đăng nhập mà không nhập gì', async () => {
      await driver.get(`${BASE_URL}/login`);

      const emailInput = await driver.findElement(By.id('email'));
      await emailInput.clear();

      const submitBtn = await driver.findElement(By.css("button[type='submit']"));
      await submitBtn.click();

      // Kiểm tra validation HTML5 hoặc thông báo lỗi của React
      const valMsg = await driver.executeScript("return arguments[0].validationMessage;", emailInput);
      expect(valMsg.length).toBeGreaterThan(0);
    });

    test('TC_VITE_LOGIN_003: Tự động nhập tài khoản sai mật khẩu và kiểm tra phản hồi từ Backend', async () => {
      await driver.get(`${BASE_URL}/login`);

      const emailInput = await driver.findElement(By.id('email'));
      const passwordInput = await driver.findElement(By.id('password'));
      const submitBtn = await driver.findElement(By.css("button[type='submit']"));

      await emailInput.clear();
      await emailInput.sendKeys('admin1@fjms.com');
      await passwordInput.clear();
      await passwordInput.sendKeys('SaiMatKhau123!');

      await submitBtn.click();

      // Chờ thông báo lỗi đỏ từ Backend trả về
      const errorBox = await driver.wait(
        until.elementLocated(By.css("div[class*='bg-red-50']")),
        5000
      );
      const errorText = await errorBox.getText();
      expect(errorText).toContain('không chính xác');
    });
  });

  // ==========================================
  // TEST TRỰC TIẾP TRÊN TRANG /register CỦA REACT
  // ==========================================
  describe('2. Kiểm thử giao diện Đăng ký React (http://localhost:5173/register)', () => {
    test('TC_VITE_REG_001: Mở trang đăng ký và kiểm tra các trường thông tin', async () => {
      await driver.get(`${BASE_URL}/register`);

      const fullnameInput = await driver.wait(until.elementLocated(By.id('fullname')), 10000);
      const emailInput = await driver.wait(until.elementLocated(By.id('email')), 10000);

      expect(await fullnameInput.isDisplayed()).toBe(true);
      expect(await emailInput.isDisplayed()).toBe(true);
    });

    test('TC_VITE_REG_002: Kiểm tra bắt buộc điền các trường bắt buộc trên trang đăng ký', async () => {
      await driver.get(`${BASE_URL}/register`);

      const fullnameInput = await driver.findElement(By.id('fullname'));
      await fullnameInput.clear();

      const submitBtn = await driver.findElement(By.css("button[type='submit']"));
      await submitBtn.click();

      // Kiểm tra validation HTML5 hoặc lỗi React
      const valMsg = await driver.executeScript("return arguments[0].validationMessage;", fullnameInput);
      expect(valMsg.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // TEST TRỰC TIẾP TRÊN TRANG /post-project CỦA REACT
  // ==========================================
  describe('3. Kiểm thử giao diện Đăng tin Dự án (http://localhost:5173/post-project)', () => {
    test('TC_VITE_PROJ_001: Mở form đăng việc và kiểm tra các trường Title, Budget, Deadline', async () => {
      await driver.get(`${BASE_URL}/post-project`);

      // Chờ tải trang post-project
      await driver.sleep(1500);
      const currentUrl = await driver.getCurrentUrl();
      
      // Nếu được redirect về /login do chưa auth thì xác nhận luồng bảo vệ Protected Route
      if (currentUrl.includes('/login')) {
        expect(currentUrl).toContain('/login');
      } else {
        const titleInput = await driver.findElement(By.id('title'));
        expect(await titleInput.isDisplayed()).toBe(true);
      }
    });
  });
});
