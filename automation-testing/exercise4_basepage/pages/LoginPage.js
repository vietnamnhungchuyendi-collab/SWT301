import { By } from 'selenium-webdriver';
import { BasePage } from './BasePage.js';

/**
 * LoginPage: Kế thừa BasePage
 * Tương đương LoginPage.java kế thừa BasePage trong Bài tập 4
 */
export class LoginPage extends BasePage {
  constructor(driver) {
    super(driver);

    // Locators
    this.usernameField = By.id('username');
    this.passwordField = By.id('password');
    this.loginButton = By.css("button[type='submit']");
    this.successMsg = By.css('.flash.success');
    this.errorMsg = By.css('.flash.error');
  }

  // Actions tái sử dụng các method của BasePage
  async navigate() {
    await this.navigateTo('https://the-internet.herokuapp.com/login');
  }

  async login(username, password) {
    await this.type(this.usernameField, username);
    await this.type(this.passwordField, password);
    await this.click(this.loginButton);
  }

  getSuccessLocator() {
    return this.successMsg;
  }

  getErrorLocator() {
    return this.errorMsg;
  }

  async getMessageText(locator) {
    return await this.getText(locator);
  }
}

