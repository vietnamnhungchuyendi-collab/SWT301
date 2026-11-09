import { By } from 'selenium-webdriver';
import { BasePage } from '../../exercise4_basepage/pages/BasePage.js';

/**
 * FjmsRegisterPage: Page Object đại diện cho trang Đăng ký (Register) của dự án FJMS
 * Kế thừa từ BasePage theo mô hình POM
 */
export class FjmsRegisterPage extends BasePage {
  constructor(driver, baseUrl = 'http://localhost:5173') {
    super(driver);
    this.baseUrl = baseUrl;

    // Locators thực tế trong Register.jsx
    this.fullnameInput = By.id('fullname');
    this.emailInput = By.id('email');
    this.phoneInput = By.id('phone');
    this.passwordInput = By.id('password');
    this.submitBtn = By.css("button[type='submit']");
    this.errorBox = By.css("div[class*='bg-red-50']");
    this.toastBox = By.css("div[class*='animate-bounce']");
    this.roleFreelancer = By.xpath("//button[contains(., 'Freelancer')] | //div[contains(., 'Freelancer')]");
    this.roleEmployer = By.xpath("//button[contains(., 'Employer')] | //div[contains(., 'Employer')]");
  }

  async navigate() {
    await this.navigateTo(`${this.baseUrl}/register`);
  }

  /**
   * Điền toàn bộ thông tin form đăng ký
   */
  async register({ fullname, email, phone, password, role = 'FREELANCER' }) {
    if (fullname !== undefined) await this.type(this.fullnameInput, fullname);
    if (email !== undefined) await this.type(this.emailInput, email);
    if (phone !== undefined) await this.type(this.phoneInput, phone);
    if (password !== undefined) await this.type(this.passwordInput, password);

    if (role === 'EMPLOYER') {
      try {
        const empBtn = await this.waitForVisibility(this.roleEmployer);
        await empBtn.click();
      } catch {
        // Fallback
      }
    }

    await this.click(this.submitBtn);
  }

  async getErrorMessage() {
    try {
      return await this.getText(this.errorBox);
    } catch {
      return '';
    }
  }

  async getToastMessage() {
    try {
      return await this.getText(this.toastBox);
    } catch {
      return '';
    }
  }

  async getPhoneValidationMessage() {
    const elem = await this.waitForVisibility(this.phoneInput);
    return await this.driver.executeScript("return arguments[0].validationMessage;", elem);
  }
}

