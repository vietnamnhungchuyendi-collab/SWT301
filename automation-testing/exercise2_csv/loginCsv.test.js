import path from 'path';
import { fileURLToPath } from 'url';
import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { readCsvFile } from './csvReader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Bài tập 2: Parameterized Login Tests từ file CSV ngoài', () => {
  let driver;
  const csvPath = path.join(__dirname, 'resources', 'login-data.csv');
  const csvData = readCsvFile(csvPath, 1); // Bỏ qua 1 dòng header

  beforeAll(async () => {
    const options = new chrome.Options();
    options.addArguments('--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080');
    options.addArguments('--incognito');
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  });

  afterAll(async () => {
    if (driver) {
      await driver.quit();
    }
  });

  // Tương đương @ParameterizedTest + @CsvFileSource trong JUnit 5
  test.each(csvData)(
    'Test login from CSV with: "%s" / "%s" => Expected: %s',
    async (rawUsername, rawPassword, expectedResult) => {
      // Xử lý trim để tránh khoảng trắng thừa giống hướng dẫn
      const username = (rawUsername || '').trim();
      const password = (rawPassword || '').trim();

      await driver.get('https://the-internet.herokuapp.com/login');

      const usernameInput = await driver.findElement(By.id('username'));
      await usernameInput.clear();
      if (username) {
        await usernameInput.sendKeys(username);
      }

      const passwordInput = await driver.findElement(By.id('password'));
      await passwordInput.clear();
      if (password) {
        await passwordInput.sendKeys(password);
      }

      const submitBtn = await driver.findElement(By.css("button[type='submit']"));
      await submitBtn.click();

      const messageLocator = expectedResult === 'success' 
        ? By.css('.flash.success') 
        : By.css('.flash.error');

      const messageElement = await driver.wait(until.elementLocated(messageLocator), 10000);
      await driver.wait(until.elementIsVisible(messageElement), 10000);
      const text = (await messageElement.getText()).toLowerCase();

      if (expectedResult === 'success') {
        expect(text).toContain('you logged into a secure area!');
      } else {
        expect(text).toContain('invalid');
      }
    }
  );
});

