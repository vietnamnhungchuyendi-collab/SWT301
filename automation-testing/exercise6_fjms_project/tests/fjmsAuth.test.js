import { BaseTest } from '../../exercise4_basepage/tests/BaseTest.js';
import { FjmsLoginPage } from '../pages/FjmsLoginPage.js';
import { FjmsRegisterPage } from '../pages/FjmsRegisterPage.js';
import { ProjectManagementPage } from '../pages/ProjectManagementPage.js';
import { ProposalPage } from '../pages/ProposalPage.js';
import { startFjmsTestServer } from '../mockServer.js';

describe('Kiểm thử tự động E2E Dự án FJMS (Page Object Model, BasePage, BaseTest)', () => {
  const PORT = 3050;
  const BASE_URL = `http://localhost:${PORT}`;

  let server;
  let loginPage;
  let registerPage;
  let projectPage;
  let proposalPage;

  beforeAll(async () => {
    // Khởi động server test nội bộ cho dự án FJMS
    server = await startFjmsTestServer(PORT);

    // Khởi tạo BaseTest và Page Objects
    await BaseTest.setUpBase();
    const driver = BaseTest.getDriver();
    loginPage = new FjmsLoginPage(driver, BASE_URL);
    registerPage = new FjmsRegisterPage(driver, BASE_URL);
    projectPage = new ProjectManagementPage(driver, BASE_URL);
    proposalPage = new ProposalPage(driver, BASE_URL);
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
  describe('Chức năng 1: Kiểm thử Đăng nhập (Login)', () => {
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
      expect(error).toContain('Tài khoản email không tồn tại trong hệ thống!');
    });
  });

  // ==========================================
  // CHỨC NĂNG 2: ĐĂNG KÝ (REGISTER)
  // ==========================================
  describe('Chức năng 2: Kiểm thử Đăng ký (Register)', () => {
    test('TC_REG_001: Đăng ký thành công tài khoản Freelancer với thông tin hợp lệ', async () => {
      await registerPage.navigate();
      await registerPage.register({
        fullname: 'Nguyen Van Test',
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
        fullname: 'Nguyen Van Duplicate',
        email: 'existing@fjms.com',
        phone: '0912345678',
        password: 'Password@123',
        role: 'FREELANCER'
      });
      const error = await registerPage.getErrorMessage();
      expect(error).toContain('Email này đã được đăng ký');
    });
  });

  // ==========================================
  // CHỨC NĂNG 3: TẠO DỰ ÁN (PROJECT MANAGEMENT)
  // ==========================================
  describe('Chức năng 3: Quản lý & Đăng tin Dự án (Project Management)', () => {
    test('TC_PROJ_001 [EP]: Đăng tin dự án thành công với thông tin hợp lệ', async () => {
      await projectPage.navigate();
      await projectPage.fillProjectForm({
        title: 'Xây dựng website bán hàng React & Node.js',
        category: 'IT',
        description: 'Cần tìm Freelancer phát triển hệ thống e-commerce hoàn chỉnh có thanh toán VNPay.',
        budgetMin: 5000000,
        budgetMax: 15000000,
        deadline: '2026-12-31',
        skills: 'React, Node.js, SQL'
      });
      await projectPage.submitProject();

      const toast = await projectPage.getToastMessage();
      expect(toast).toContain('Tạo dự án thành công!');
    });

    test('TC_PROJ_002 [EP]: Chặn đăng tin khi bỏ trống các trường bắt buộc', async () => {
      await projectPage.navigate();
      await projectPage.fillProjectForm({
        title: '',
        description: '',
        deadline: ''
      });
      await projectPage.submitProject();

      const error = await projectPage.getErrorMessage();
      expect(error).toContain('Vui lòng điền đầy đủ các trường bắt buộc');
    });

    test('TC_PROJ_003 [BVA]: Chặn đăng tin khi Hạn chót (Deadline) nằm trong quá khứ', async () => {
      await projectPage.navigate();
      await projectPage.fillProjectForm({
        title: 'Dự án Deadline Quá Khứ',
        description: 'Mô tả chi tiết dự án...',
        deadline: '2020-01-01',
        budgetMin: 1000000,
        budgetMax: 2000000
      });
      await projectPage.submitProject();

      const error = await projectPage.getErrorMessage();
      expect(error).toContain('Hạn chót dự án không thể nằm trong quá khứ');
    });

    test('TC_PROJ_004 [BVA]: Báo lỗi khi Ngân sách Tối thiểu lớn hơn Ngân sách Tối đa (Budget Min > Budget Max)', async () => {
      await projectPage.navigate();
      await projectPage.fillProjectForm({
        title: 'Dự án Sai Ngân Sách',
        description: 'Mô tả chi tiết kiểm thử...',
        deadline: '2026-12-31',
        budgetMin: 20000000,
        budgetMax: 10000000 // Min > Max
      });
      await projectPage.submitProject();

      const error = await projectPage.getErrorMessage();
      expect(error).toContain('Ngân sách tối thiểu không được lớn hơn ngân sách tối đa');
    });
  });

  // ==========================================
  // CHỨC NĂNG 4: NỘP HỒ SƠ ỨNG TUYỂN (PROPOSAL)
  // ==========================================
  describe('Chức năng 4: Nộp Hồ sơ Báo giá Chào thầu (Submit Proposal)', () => {
    test('TC_PROP_001 [EP]: Freelancer nộp báo giá thành công với thông tin hợp lệ', async () => {
      await proposalPage.navigate();
      await proposalPage.fillProposalForm({
        bidAmount: 12000000,
        duration: 20,
        coverLetter: 'Kính gửi Nhà tuyển dụng, tôi có 3 năm kinh nghiệm phát triển Fullstack React/Node.js, cam kết bàn giao đúng tiến độ.'
      });
      await proposalPage.submitProposal();

      const toast = await proposalPage.getToastMessage();
      expect(toast).toContain('Gửi hồ sơ ứng tuyển thành công!');
    });

    test('TC_PROP_002 [EP]: Báo lỗi khi bỏ trống các thông tin bắt buộc', async () => {
      await proposalPage.navigate();
      await proposalPage.fillProposalForm({
        bidAmount: '',
        duration: '',
        coverLetter: ''
      });
      await proposalPage.submitProposal();

      const error = await proposalPage.getErrorMessage();
      expect(error).toContain('Vui lòng điền đầy đủ các thông tin chào thầu');
    });

    test('TC_PROP_003 [BVA]: Chặn nộp báo giá khi Mức giá chào thầu <= 0 (Biên dưới)', async () => {
      await proposalPage.navigate();
      await proposalPage.fillProposalForm({
        bidAmount: -500000,
        duration: 10,
        coverLetter: 'Thư ngỏ giá âm...'
      });
      await proposalPage.submitProposal();

      const error = await proposalPage.getErrorMessage();
      expect(error).toContain('Mức giá chào thầu phải lớn hơn 0');
    });

    test('TC_PROP_004 [BVA]: Chặn nộp báo giá khi Thời gian hoàn thành <= 0 ngày', async () => {
      await proposalPage.navigate();
      await proposalPage.fillProposalForm({
        bidAmount: 5000000,
        duration: 0,
        coverLetter: 'Thư ngỏ 0 ngày...'
      });
      await proposalPage.submitProposal();

      const error = await proposalPage.getErrorMessage();
      expect(error).toContain('Thời gian hoàn thành tối thiểu phải từ 1 ngày');
    });
  });
});
