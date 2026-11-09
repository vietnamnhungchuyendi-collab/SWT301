import { By } from 'selenium-webdriver';
import { BasePage } from '../../exercise4_basepage/pages/BasePage.js';

/**
 * FjmsLoginPage: Page Object đại diện cho trang Login của dự án FJMS
 * Kế thừa từ BasePage theo mô hình POM
 */
export class FjmsLoginPage extends BasePage {
  constructor(driver, baseUrl = 'http://localhost:5173') {
    super(driver);
    this.baseUrl = baseUrl;

    // Locators trỏ đúng vào các element thực tế của Login.jsx
    this.emailInput = By.id('email');
    this.passwordInput = By.id('password');
    this.submitBtn = By.css("button[type='submit']");
    this.errorBox = By.css("div[class*='bg-red-50']");
    this.toastBox = By.css("div[class*='animate-bounce']");
    this.togglePasswordBtn = By.css("button[type='button']:has(span.material-symbols-outlined)");
  }

  async navigate() {
    await this.navigateTo(`${this.baseUrl}/login`);
  }

  /**
   * Thực hiện hành vi đăng nhập
   * @param {string} email 
   * @param {string} password 
   */
  async login(email, password) {
    if (email !== undefined) {
      await this.type(this.emailInput, email);
    }
    if (password !== undefined) {
      await this.type(this.passwordInput, password);
    }
    await this.click(this.submitBtn);
  }

  /**
   * Lấy nội dung thông báo lỗi khi đăng nhập thất bại
   */
  async getErrorMessage() {
    try {
      return await this.getText(this.errorBox);
    } catch {
      return '';
    }
  }

  /**
   * Lấy nội dung thông báo toast khi đăng nhập thành công
   */
  async getToastMessage() {
    try {
      return await this.getText(this.toastBox);
    } catch {
      return '';
    }
  }

  /**
   * Kiểm tra thông báo lỗi có hiển thị không
   */
  async isErrorDisplayed() {
    return await this.isElementVisible(this.errorBox);
  }

  /**
   * Kiểm tra validation của input HTML5 (ví dụ required, type email)
   */
  async getEmailValidationMessage() {
    const elem = await this.waitForVisibility(this.emailInput);
    return await this.driver.executeScript("return arguments[0].validationMessage;", elem);
  }

  async getPasswordValidationMessage() {
    const elem = await this.waitForVisibility(this.passwordInput);
    return await this.driver.executeScript("return arguments[0].validationMessage;", elem);
  }
}

