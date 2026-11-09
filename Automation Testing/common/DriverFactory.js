import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

/**
 * DriverFactory: Khởi tạo và cấu hình WebDriver dùng chung
 * Tương đương DriverFactory.java trong JUnit 5 / Selenium
 */
export class DriverFactory {
  /**
   * Khởi tạo Chrome WebDriver với các options tối ưu
   * @param {boolean} headless Có chạy ở chế độ headless hay không (mặc định: true cho tự động hoá/CI)
   * @returns {Promise<import('selenium-webdriver').WebDriver>}
   */
  static async createDriver(headless = null) {
    const isHeadless = headless !== null 
      ? headless 
      : (process.env.HEADLESS !== 'false' && (process.env.CI || true));
    
    // Nếu biến môi trường HEADLESS=false thì tắt chế độ headless để hiện cửa sổ Chrome
    const finalHeadless = process.env.HEADLESS === 'false' ? false : (headless ?? true);

    const options = new chrome.Options();
    if (finalHeadless || process.env.CI) {
      options.addArguments('--headless=new', '--no-sandbox', '--disable-dev-shm-usage');
    }
    options.addArguments('--window-size=1920,1080');
    options.addArguments('--incognito'); // Ẩn danh

    const driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    await driver.manage().window().maximize();
    return driver;
  }
}

