import { BaseTest } from '../../exercise4_basepage/tests/BaseTest.js';
import { FjmsLoginPage } from '../pages/FjmsLoginPage.js';
import { FjmsRegisterPage } from '../pages/FjmsRegisterPage.js';
import { startFjmsTestServer } from '../mockServer.js';

describe('Bài tập 6: Kiểm thử tự động E2E dự án FJMS (POM, BasePage, BaseTest)', () => {
  const PORT = 3050;
  const BASE_URL = `http://localhost:${PORT}`;

  let server;
  let loginPage;
  let registerPage;

  beforeAll(async () => {
    // Khởi động server test nội bộ cho dự án FJMS
    server = await startFjmsTestServer(PORT);

    // Khởi tạo BaseTest và Page Objects
    await BaseTest.setUpBase();
    const driver = BaseTest.getDriver();
    loginPage = new FjmsLoginPage(driver, BASE_URL);
    registerPage = new FjmsRegisterPage(driver, BASE_URL);
  });

  afterAll(async () => {
    await BaseTest.tearDownBase();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // ==========================================
  // CHỨC NĂNG 1: ĐĂNG NHẬP (LOGIN)
  // ==========================================
  describe('Chức năng 1: Kiểm thử Đăng nhập (Login Functionality)', () => {
    test('TC_LOGIN_001: Đăng nhập thành công với tài khoản và mật khẩu hợp lệ', async () => {
      await loginPage.navigate();
      await loginPage.login('freelancer@fjms.com', 'Password@123');

      const toast = await loginPage.getToastMessage();
      expect(toast).toContain('Đăng nhập thành công!');
    });

    test('TC_LOGIN_002: Đăng nhập thất bại khi nhập sai mật khẩu', async () => {
      await loginPage.navigate();
      await loginPage.login('freelancer@fjms.com', 'WrongPassword!123');

      const error = await loginPage.getErrorMessage();
      expect(error).toContain('Mật khẩu không chính xác!');
    });

    test('TC_LOGIN_003: Đăng nhập thất bại khi tài khoản email không tồn tại', async () => {
      await loginPage.navigate();
      await loginPage.login('nonexistent@fjms.com', 'Password@123');

      const error = await loginPage.getErrorMessage();
      expect(error).toContain('Tài khoản email không tồn tại');
    });

    test('TC_LOGIN_004: Form chặn submit khi người dùng bỏ trống Email', async () => {
      await loginPage.navigate();
      await loginPage.login('', 'Password@123');

      const validationMsg = await loginPage.getEmailValidationMessage();
      expect(validationMsg.length).toBeGreaterThan(0);
    });

    test('TC_LOGIN_005: Form chặn submit khi người dùng bỏ trống Mật khẩu', async () => {
      await loginPage.navigate();
      await loginPage.login('freelancer@fjms.com', '');

      const validationMsg = await loginPage.getPasswordValidationMessage();
      expect(validationMsg.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // CHỨC NĂNG 2: ĐĂNG KÝ (REGISTER)
  // ==========================================
  describe('Chức năng 2: Kiểm thử Đăng ký (Register Functionality)', () => {
    test('TC_REG_001: Đăng ký thành công tài khoản Freelancer với thông tin hợp lệ', async () => {
      await registerPage.navigate();
      await registerPage.register({
        fullname: 'Nguyễn Văn A',
        email: 'newuser@fjms.com',
        phone: '0912345678',
        password: 'Password@123',
        role: 'FREELANCER'
      });

      const toast = await registerPage.getToastMessage();
      expect(toast).toContain('Đăng ký tài khoản thành công!');
    });

    test('TC_REG_002: Đăng ký thất bại khi email đã tồn tại trong hệ thống', async () => {
      await registerPage.navigate();
      await registerPage.register({
        fullname: 'Nguyễn Văn B',
        email: 'existing@fjms.com',
        phone: '0987654321',
        password: 'Password@123'
      });

      const error = await registerPage.getErrorMessage();
      expect(error).toContain('Email này đã được đăng ký');
    });

    test('TC_REG_003: Form chặn submit khi định dạng số điện thoại không hợp lệ', async () => {
      await registerPage.navigate();
      await registerPage.register({
        fullname: 'Trần Văn C',
        email: 'userc@fjms.com',
        phone: '12345', // Quá ngắn và không bắt đầu bằng đầu số hợp lệ
        password: 'Password@123'
      });

      const validationMsg = await registerPage.getPhoneValidationMessage();
      expect(validationMsg.length).toBeGreaterThan(0);
    });
  });
});

