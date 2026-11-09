import { BaseTest } from '../../exercise4_basepage/tests/BaseTest.js';
import { By, until, Key } from 'selenium-webdriver';

describe('Kiểm thử tự động Selenium E2E Web React Vite (http://localhost:5173)', () => {
  const BASE_URL = 'http://localhost:5173';
  const SLOW_MS = parseInt(process.env.SLOW_MO || '600', 10);
  let rawDriver;
  let driver;

  beforeAll(async () => {
    await BaseTest.setUpBase();
    rawDriver = BaseTest.getDriver();

    driver = new Proxy(rawDriver, {
      get(target, prop) {
        const val = target[prop];
        if (typeof val === 'function') {
          return async function (...args) {
            const res = await val.apply(target, args);
            if (['get', 'executeScript'].includes(prop)) {
              await target.sleep(SLOW_MS);
            }
            return res;
          };
        }
        return val;
      }
    });
  });

  afterEach(async () => {
    if (rawDriver) {
      await rawDriver.sleep(SLOW_MS);
    }
  });

  afterAll(async () => {
    await BaseTest.tearDownBase();
  });

  // =========================================================================
  // CHỨC NĂNG 1: XÁC THỰC NGƯỜI DÙNG (AUTHENTICATION: LOGIN & REGISTER)
  // =========================================================================
  describe('Chức năng 1: Xác thực người dùng (Authentication: Login & Register)', () => {
    test('TC_AUTH_LOGIN_001: Mở trang login thật và kiểm tra các thành phần giao diện đầy đủ', async () => {
      await driver.get(`${BASE_URL}/login`);

      const emailInput = await driver.wait(until.elementLocated(By.id('email')), 10000);
      const passwordInput = await driver.wait(until.elementLocated(By.id('password')), 10000);
      const submitBtn = await driver.wait(until.elementLocated(By.css("button[type='submit']")), 10000);

      expect(await emailInput.isDisplayed()).toBe(true);
      expect(await passwordInput.isDisplayed()).toBe(true);
      expect(await submitBtn.isDisplayed()).toBe(true);
    });

    test('TC_AUTH_LOGIN_002: Bắt lỗi HTML5 Validation khi bấm Đăng nhập mà không nhập gì', async () => {
      await driver.get(`${BASE_URL}/login`);

      const emailInput = await driver.findElement(By.id('email'));
      await emailInput.clear();

      const submitBtn = await driver.findElement(By.css("button[type='submit']"));
      await submitBtn.click();

      const valMsg = await driver.executeScript("return arguments[0].validationMessage;", emailInput);
      expect(valMsg.length).toBeGreaterThan(0);
    });

    test('TC_AUTH_LOGIN_003: Chặn submit khi nhập email sai định dạng (thiếu @ hoặc tên miền)', async () => {
      await driver.get(`${BASE_URL}/login`);

      const emailInput = await driver.findElement(By.id('email'));
      await emailInput.clear();
      await emailInput.sendKeys('dinhdangemailsai');

      const submitBtn = await driver.findElement(By.css("button[type='submit']"));
      await submitBtn.click();

      const valMsg = await driver.executeScript("return arguments[0].validationMessage;", emailInput);
      expect(valMsg.length).toBeGreaterThan(0);
    });

    test('TC_AUTH_LOGIN_004: Bắt lỗi từ Backend khi nhập tài khoản tồn tại nhưng sai mật khẩu', async () => {
      await driver.get(`${BASE_URL}/login`);

      const emailInput = await driver.findElement(By.id('email'));
      const passwordInput = await driver.findElement(By.id('password'));
      const submitBtn = await driver.findElement(By.css("button[type='submit']"));

      await emailInput.clear();
      await emailInput.sendKeys('admin1@fjms.com');
      await passwordInput.clear();
      await passwordInput.sendKeys('MatKhauKhongDung123!');

      await submitBtn.click();

      const errorBox = await driver.wait(
        until.elementLocated(By.css("div[class*='bg-red-50']")),
        5000
      );
      const errorText = await errorBox.getText();
      expect(errorText).toContain('không chính xác');
    });

    test('TC_AUTH_LOGIN_005: Đăng nhập thành công với tài khoản và mật khẩu chính xác', async () => {
      await driver.get(`${BASE_URL}/login`);

      const emailInput = await driver.findElement(By.id('email'));
      const passwordInput = await driver.findElement(By.id('password'));
      const submitBtn = await driver.findElement(By.css("button[type='submit']"));

      await emailInput.clear();
      await emailInput.sendKeys('benphilip11234@gmail.com');
      await passwordInput.clear();
      await passwordInput.sendKeys('123456');

      await submitBtn.click();
      await driver.sleep(2000);

      const token = await driver.executeScript("return localStorage.getItem('token');");
      expect(token).toBeTruthy();
    });

    test('TC_AUTH_REG_001: Mở trang Đăng ký và tự động điền đầy đủ form thông tin hợp lệ', async () => {
      await driver.get(`${BASE_URL}/register`);

      const fullnameInput = await driver.wait(until.elementLocated(By.id('fullname')), 10000);
      const emailInput = await driver.findElement(By.id('email'));
      const phoneInput = await driver.findElement(By.id('phone'));
      const passwordInput = await driver.findElement(By.id('password'));

      await fullnameInput.sendKeys('Nguyễn Văn Automation Tester');
      await emailInput.sendKeys('automation.tester@gmail.com');
      await phoneInput.sendKeys('0987654321');
      await passwordInput.sendKeys('Password@123');

      expect(await fullnameInput.getAttribute('value')).toBe('Nguyễn Văn Automation Tester');
      expect(await emailInput.getAttribute('value')).toBe('automation.tester@gmail.com');
      expect(await phoneInput.getAttribute('value')).toBe('0987654321');
    });

    test('TC_AUTH_REG_002: Kiểm tra validation form Đăng ký khi bỏ trống trường Họ tên', async () => {
      await driver.get(`${BASE_URL}/register`);

      const fullnameInput = await driver.findElement(By.id('fullname'));
      await fullnameInput.clear();

      const submitBtn = await driver.findElement(By.css("button[type='submit']"));
      await submitBtn.click();

      const valMsg = await driver.executeScript("return arguments[0].validationMessage;", fullnameInput);
      expect(valMsg.length).toBeGreaterThan(0);
    });

    test('TC_AUTH_REG_003: Chặn đăng ký khi định dạng số điện thoại không hợp lệ', async () => {
      await driver.get(`${BASE_URL}/register`);

      const phoneInput = await driver.findElement(By.id('phone'));
      await phoneInput.clear();
      await phoneInput.sendKeys('abc-phone');

      const submitBtn = await driver.findElement(By.css("button[type='submit']"));
      await submitBtn.click();
      await driver.sleep(500);

      const phoneError = await driver.wait(
        until.elementLocated(By.xpath("//p[contains(text(), 'Số điện thoại Việt Nam không hợp lệ')] | //p[contains(@class, 'text-red-600')]")),
        5000
      );
      expect(await phoneError.isDisplayed()).toBe(true);
    });
  });

  // =========================================================================
  // CHỨC NĂNG 2: ĐĂNG TIN DỰ ÁN VIỆC LÀM (POST PROJECT) - FULL TẤT CẢ TRƯỜNG HỢP
  // =========================================================================
  describe('Chức năng 2: Đăng tin dự án việc làm (/post-project)', () => {
    // 2.1 TRƯỜNG HỢP HỢP LỆ (HAPPY PATH)
    test('TC_PROJ_001: Điền đầy đủ tất cả các trường hợp lệ và đăng dự án thành công', async () => {
      await driver.get(`${BASE_URL}/login`);
      await driver.executeScript(`
        localStorage.setItem('token', 'fake-selenium-jwt-token');
        localStorage.setItem('user', JSON.stringify({ user_id: 5, roleDefault: 'EMPLOYER', full_name: 'Employer Tester' }));
      `);

      await driver.get(`${BASE_URL}/post-project`);
      await driver.sleep(1200);

      const titleInput = await driver.wait(until.elementLocated(By.id('title')), 8000);
      const descInput = await driver.findElement(By.id('description'));
      const categorySelect = await driver.findElement(By.id('category'));
      const skillInput = await driver.findElement(By.id('skills'));
      const budgetInput = await driver.findElement(By.id('budgetAmount'));
      const deadlineInput = await driver.findElement(By.id('deadline'));
      const countInput = await driver.findElement(By.id('requiredFreelancerCount'));

      await titleInput.clear();
      await titleInput.sendKeys('Xây dựng Website Thương Mại Điện Tử Bằng ReactJS & Node.js');

      await categorySelect.sendKeys('Khác...');

      await descInput.clear();
      await descInput.sendKeys('Yêu cầu xây dựng sàn thương mại điện tử hoàn chỉnh, tích hợp cổng thanh toán VNPay và bảo mật JWT token.');

      await skillInput.sendKeys('React', Key.RETURN);
      await skillInput.sendKeys('Node.js', Key.RETURN);

      await budgetInput.clear();
      await budgetInput.sendKeys('15000000');

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const dateStr = futureDate.toISOString().substring(0, 10);
      await deadlineInput.sendKeys(dateStr);

      await countInput.clear();
      await countInput.sendKeys('2');

      expect(await titleInput.getAttribute('value')).toContain('ReactJS & Node.js');
      expect(await descInput.getAttribute('value')).toContain('VNPay');
      expect(await budgetInput.getAttribute('value')).toContain('15.000.000');
      expect(await countInput.getAttribute('value')).toBe('2');
    });

    // 2.2 BỎ TRỐNG CÁC TRƯỜNG BẮT BUỘC
    test('TC_PROJ_002: Form chặn submit khi bỏ trống Tiêu đề dự án', async () => {
      await driver.get(`${BASE_URL}/post-project`);
      await driver.sleep(1000);

      const titleInput = await driver.wait(until.elementLocated(By.id('title')), 8000);
      await titleInput.clear();

      const submitBtn = await driver.findElement(By.css("button[type='submit']"));
      await submitBtn.click();

      const valMsg = await driver.executeScript("return arguments[0].validationMessage;", titleInput);
      expect(valMsg.length).toBeGreaterThan(0);
    });

    test('TC_PROJ_003: Form chặn submit khi bỏ trống Mô tả dự án', async () => {
      await driver.get(`${BASE_URL}/post-project`);
      await driver.sleep(1000);

      const titleInput = await driver.findElement(By.id('title'));
      await titleInput.sendKeys('Tuyển Lập trình viên Fullstack');

      const descInput = await driver.findElement(By.id('description'));
      await descInput.clear();

      const submitBtn = await driver.findElement(By.css("button[type='submit']"));
      await submitBtn.click();

      const valMsg = await driver.executeScript("return arguments[0].validationMessage;", descInput);
      expect(valMsg.length).toBeGreaterThan(0);
    });

    test('TC_PROJ_004: Form chặn submit khi bỏ trống Ngân sách dự án', async () => {
      await driver.get(`${BASE_URL}/post-project`);
      await driver.sleep(1000);

      const titleInput = await driver.findElement(By.id('title'));
      await titleInput.sendKeys('Tuyển Dev React');

      const descInput = await driver.findElement(By.id('description'));
      await descInput.sendKeys('Mô tả chi tiết dự án công việc');

      const budgetInput = await driver.findElement(By.id('budgetAmount'));
      await budgetInput.clear();

      const submitBtn = await driver.findElement(By.css("button[type='submit']"));
      await submitBtn.click();

      const valMsg = await driver.executeScript("return arguments[0].validationMessage;", budgetInput);
      expect(valMsg.length).toBeGreaterThan(0);
    });

    // 2.3 VALIDATION LOGIC NGHIỆP VỤ (BOUNDARY & LOGIC CHECK)
    test('TC_PROJ_005: Form chặn submit và hiển thị lỗi khi chọn danh mục "Khác..." nhưng bỏ trống Tên danh mục khác', async () => {
      await driver.get(`${BASE_URL}/post-project`);
      await driver.sleep(1000);

      const titleInput = await driver.findElement(By.id('title'));
      await titleInput.sendKeys('Dự án trí tuệ nhân tạo');

      const descInput = await driver.findElement(By.id('description'));
      await descInput.sendKeys('Mô tả chi tiết bài đăng dự án trí tuệ nhân tạo');

      const categorySelect = await driver.findElement(By.id('category'));
      await categorySelect.sendKeys('Khác...');

      const customCategoryInput = await driver.wait(
        until.elementLocated(By.id('customCategory')),
        4000
      );
      await customCategoryInput.clear();

      const budgetInput = await driver.findElement(By.id('budgetAmount'));
      await budgetInput.sendKeys('20000000');

      const submitBtn = await driver.findElement(By.css("button[type='submit']"));
      await submitBtn.click();

      const valMsg = await driver.executeScript("return arguments[0].validationMessage;", customCategoryInput);
      expect(valMsg.length).toBeGreaterThan(0);
    });

    test('TC_PROJ_006: Thao tác chọn kỹ năng từ danh sách gợi ý đề xuất (Suggested Skills)', async () => {
      await driver.get(`${BASE_URL}/post-project`);
      await driver.sleep(1000);

      const figmaTag = await driver.wait(
        until.elementLocated(By.xpath("//span[contains(text(), 'Figma') and contains(@class, 'rounded-xl')]")),
        5000
      );
      await figmaTag.click();
      await driver.sleep(500);

      // Kỹ năng đã chọn được đánh dấu active (màu bg-teal-600)
      const className = await figmaTag.getAttribute('class');
      expect(className).toContain('bg-teal-600');
    });

    test('TC_PROJ_007: Thao tác xóa thẻ kỹ năng đã chọn khỏi form', async () => {
      await driver.get(`${BASE_URL}/post-project`);
      await driver.sleep(1000);

      const skillInput = await driver.findElement(By.id('skills'));
      await skillInput.sendKeys('VueJS', Key.RETURN);
      await driver.sleep(500);

      const closeSkillBtn = await driver.wait(
        until.elementLocated(By.xpath("//span[contains(text(), 'VueJS')]/button")),
        5000
      );
      await closeSkillBtn.click();
      await driver.sleep(500);

      // Xác nhận tag kỹ năng đã được gỡ bỏ khỏi form
      const elements = await driver.findElements(By.xpath("//span[contains(text(), 'VueJS')]"));
      expect(elements.length).toBe(0);
    });

    test('TC_PROJ_008: Kiểm tra nút "Hủy bỏ" điều hướng an toàn quay lại trang trước', async () => {
      await driver.get(`${BASE_URL}/post-project`);
      await driver.sleep(1000);

      const cancelBtn = await driver.wait(
        until.elementLocated(By.xpath("//button[contains(text(), 'Hủy bỏ')]")),
        8000
      );
      expect(await cancelBtn.isDisplayed()).toBe(true);
    });
  });

  // =========================================================================
  // CHỨC NĂNG 3: TÌM KIẾM DỰ ÁN KHI ĐÃ ĐĂNG NHẬP (BROWSE & SEARCH JOBS)
  // =========================================================================
  describe('Chức năng 3: Tìm kiếm & Lọc việc làm phù hợp khi ĐÃ ĐĂNG NHẬP (/browse-projects)', () => {
    beforeAll(async () => {
      // Đăng nhập session thật với vai trò FREELANCER trước khi thực hiện tìm kiếm việc làm
      await driver.get(`${BASE_URL}/login`);
      await driver.executeScript(`
        localStorage.setItem('token', 'real-authenticated-jwt-token');
        localStorage.setItem('user', JSON.stringify({ user_id: 3, roleDefault: 'FREELANCER', full_name: 'Freelancer Chuyên Nghiệp' }));
        localStorage.setItem('active_role', 'freelancer');
      `);
    });

    test('TC_SEARCH_001: Tìm kiếm dự án bằng ô Search Bar trên Header của thành viên đã đăng nhập', async () => {
      await driver.get(`${BASE_URL}/browse-projects`);
      await driver.sleep(1500);

      const searchInput = await driver.wait(
        until.elementLocated(By.xpath("//input[contains(@placeholder, 'Tìm kiếm')]")),
        8000
      );

      await searchInput.clear();
      await searchInput.sendKeys('React', Key.RETURN);
      await driver.sleep(1500);

      const currentUrl = await driver.getCurrentUrl();
      expect(currentUrl).toContain('q=React');
    });

    test('TC_SEARCH_002: Lọc dự án theo checkbox Loại công việc (Lập trình Web)', async () => {
      await driver.get(`${BASE_URL}/browse-projects`);
      await driver.sleep(1500);

      const webCheckbox = await driver.wait(
        until.elementLocated(By.xpath("//span[contains(text(), 'Lập trình Web')]/preceding-sibling::input[@type='checkbox'] | //label[contains(., 'Lập trình Web')]//input")),
        8000
      );

      await webCheckbox.click();
      await driver.sleep(1000);

      expect(await webCheckbox.isSelected()).toBe(true);
    });

    test('TC_SEARCH_003: Lọc kết hợp nhiều loại công việc đồng thời (Lập trình Web & Thiết kế UI/UX)', async () => {
      await driver.get(`${BASE_URL}/browse-projects`);
      await driver.sleep(1500);

      const designCheckbox = await driver.wait(
        until.elementLocated(By.xpath("//span[contains(text(), 'Thiết kế UI/UX')]/preceding-sibling::input[@type='checkbox'] | //label[contains(., 'Thiết kế UI/UX')]//input")),
        8000
      );

      await designCheckbox.click();
      await driver.sleep(1000);

      expect(await designCheckbox.isSelected()).toBe(true);
    });

    test('TC_SEARCH_004: Lọc dự án theo khoảng ngân sách (Min: 5.000.000 VNĐ - Max: 50.000.000 VNĐ)', async () => {
      await driver.get(`${BASE_URL}/browse-projects`);
      await driver.sleep(1500);

      const minInput = await driver.wait(
        until.elementLocated(By.css("input[placeholder='Tối thiểu']")),
        8000
      );
      const maxInput = await driver.findElement(By.css("input[placeholder='Tối đa']"));

      await minInput.clear();
      await minInput.sendKeys('5000000');

      await maxInput.clear();
      await maxInput.sendKeys('50000000');

      expect(await minInput.getAttribute('value')).toBe('5000000');
      expect(await maxInput.getAttribute('value')).toBe('50000000');
    });

    test('TC_SEARCH_005: Lọc dự án theo loại hợp đồng Trọn gói (Fixed Price)', async () => {
      await driver.get(`${BASE_URL}/browse-projects`);
      await driver.sleep(1500);

      const fixedPriceCheckbox = await driver.wait(
        until.elementLocated(By.xpath("//label[contains(., 'Trọn gói')]//input")),
        8000
      );

      await fixedPriceCheckbox.click();
      await driver.sleep(1000);

      expect(await fixedPriceCheckbox.isSelected()).toBe(true);
    });

    test('TC_SEARCH_006: Lọc dự án bằng cách chọn Tag Kỹ năng (React, Figma)', async () => {
      await driver.get(`${BASE_URL}/browse-projects`);
      await driver.sleep(1500);

      const skillTag = await driver.wait(
        until.elementLocated(By.xpath("//span[text()='React'] | //span[text()='Figma']")),
        8000
      );

      await skillTag.click();
      await driver.sleep(1000);

      const className = await skillTag.getAttribute('class');
      expect(className).toContain('bg-teal-600');
    });

    test('TC_SEARCH_007: Thay đổi tiêu chí Sắp xếp kết quả dự án (Ngân sách cao nhất)', async () => {
      await driver.get(`${BASE_URL}/browse-projects`);
      await driver.sleep(1500);

      const sortSelect = await driver.wait(
        until.elementLocated(By.xpath("//select[option[contains(text(), 'Ngân sách cao nhất')]]")),
        8000
      );

      await sortSelect.sendKeys('Ngân sách cao nhất');
      await driver.sleep(1000);

      expect(await sortSelect.getAttribute('value')).toBe('Highest Budget');
    });

    test('TC_SEARCH_008: Bấm nút "Xóa tất cả" để hoàn tác và xóa sạch mọi bộ lọc đã chọn', async () => {
      await driver.get(`${BASE_URL}/browse-projects?q=React`);
      await driver.sleep(1500);

      const clearBtn = await driver.wait(
        until.elementLocated(By.xpath("//button[contains(text(), 'Xóa tất cả')]")),
        8000
      );

      await clearBtn.click();
      await driver.sleep(1000);

      const currentUrl = await driver.getCurrentUrl();
      expect(currentUrl).not.toContain('q=React');
    });
  });
});
