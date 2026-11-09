import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

describe('Bài tập 1: Parameterized Login Tests (the-internet.herokuapp.com)', () => {
  let driver;

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

  // Tương đương @ParameterizedTest + @CsvSource trong JUnit 5
  const loginTestCases = [
    ['tomsmith', 'SuperSecretPassword!', 'success', 'Valid credentials'],
    ['wronguser', 'SuperSecretPassword!', 'error', 'Invalid username'],
    ['tomsmith', 'wrongpassword', 'error', 'Invalid password'],
    ['', '', 'error', 'Empty credentials']
  ];

  test.each(loginTestCases)(
    'Test Login - Username: "%s", Password: "%s" => Expected: %s (%s)',
    async (username, password, expectedResult) => {
      await driver.get('https://the-internet.herokuapp.com/login');

      // Điền thông tin đăng nhập
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

      // Click submit
      const submitBtn = await driver.findElement(By.css("button[type='submit']"));
      await submitBtn.click();

      // Chờ thông báo hiển thị (Explicit Wait giống WebDriverWait)
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
