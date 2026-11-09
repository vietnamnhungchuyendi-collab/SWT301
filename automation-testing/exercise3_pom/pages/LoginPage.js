import { By } from 'selenium-webdriver';

/**
 * LoginPage: Page Object đại diện cho trang Login
 * Đóng gói toàn bộ Locators và Actions của màn hình Login
 * Tương đương LoginPage.java trong bài tập mẫu
 */
export class LoginPage {
  /**
   * @param {import('selenium-webdriver').WebDriver} driver
   */
  constructor(driver) {
    this.driver = driver;

    // Locators
    this.usernameField = By.id('username');
    this.passwordField = By.id('password');
    this.loginButton = By.css("button[type='submit']");
    this.successMsg = By.css('.flash.success');
    this.errorMsg = By.css('.flash.error');
  }

  // Actions
  async navigate() {
    await this.driver.get('https://the-internet.herokuapp.com/login');
  }

  async login(username, password) {
    const userElem = await this.driver.findElement(this.usernameField);
    await userElem.clear();
    if (username) {
      await userElem.sendKeys(username);
    }

    const passElem = await this.driver.findElement(this.passwordField);
    await passElem.clear();
    if (password) {
      await passElem.sendKeys(password);
    }

    const submitElem = await this.driver.findElement(this.loginButton);
    await submitElem.click();
  }

  getSuccessLocator() {
    return this.successMsg;
  }

  getErrorLocator() {
    return this.errorMsg;
  }
}

