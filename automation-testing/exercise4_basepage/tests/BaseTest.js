import { DriverFactory } from '../../exercise3_pom/utils/DriverFactory.js';

/**
 * BaseTest: Quản lý vòng đời khởi tạo và dọn dẹp WebDriver
 * Tương đương BaseTest.java trong JUnit 5
 */
export class BaseTest {
  static driver = null;

  static async setUpBase() {
    this.driver = await DriverFactory.createDriver(true);
  }

  static async tearDownBase() {
    if (this.driver) {
      await this.driver.quit();
      this.driver = null;
    }
  }

  static getDriver() {
    return this.driver;
  }
}
