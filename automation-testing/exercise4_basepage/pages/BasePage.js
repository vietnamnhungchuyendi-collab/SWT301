import { until } from 'selenium-webdriver';

/**
 * BasePage: Lớp cơ sở (Superclass) cho toàn bộ Page Objects
 * Tương đương BasePage.java trong hướng dẫn bài tập 4
 * Đóng gói toàn bộ các hàm thao tác chung: waitForVisibility, click, type, getText, navigateTo, isElementVisible
 */
export class BasePage {
  /**
   * @param {import('selenium-webdriver').WebDriver} driver
   * @param {number} timeoutMs Thời gian chờ mặc định (mặc định: 10000ms = 10s)
   */
  constructor(driver, timeoutMs = 10000) {
    this.driver = driver;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Chờ element hiển thị trên màn hình
   * @param {import('selenium-webdriver').Locator} locator
   * @returns {Promise<import('selenium-webdriver').WebElement>}
   */
  async waitForVisibility(locator) {
    const elem = await this.driver.wait(until.elementLocated(locator), this.timeoutMs);
    await this.driver.wait(until.elementIsVisible(elem), this.timeoutMs);
    return elem;
  }

  /**
   * Click an toàn vào element sau khi chờ nó hiển thị
   * @param {import('selenium-webdriver').Locator} locator
   */
  async click(locator) {
    const elem = await this.waitForVisibility(locator);
    await elem.click();
  }

  /**
   * Nhập dữ liệu an toàn vào input sau khi clear
   * @param {import('selenium-webdriver').Locator} locator
   * @param {string} text
   */
  async type(locator, text) {
    const elem = await this.waitForVisibility(locator);
    await elem.clear();
    if (text !== undefined && text !== null && text !== '') {
      await elem.sendKeys(text);
    }
  }

  /**
   * Lấy text của element an toàn
   * @param {import('selenium-webdriver').Locator} locator
   * @returns {Promise<string>}
   */
  async getText(locator) {
    const elem = await this.waitForVisibility(locator);
    return await elem.getText();
  }

  /**
   * Điều hướng tới URL
   * @param {string} url
   */
  async navigateTo(url) {
    await this.driver.get(url);
  }

  /**
   * Kiểm tra element có hiển thị hay không
   * @param {import('selenium-webdriver').Locator} locator
   * @returns {Promise<boolean>}
   */
  async isElementVisible(locator) {
    try {
      const elem = await this.waitForVisibility(locator);
      return await elem.isDisplayed();
    } catch {
      return false;
    }
  }
}
