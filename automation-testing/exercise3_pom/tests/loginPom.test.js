import { until } from 'selenium-webdriver';
import { DriverFactory } from '../utils/DriverFactory.js';
import { LoginPage } from '../pages/LoginPage.js';

describe('Bài tập 3: Login Tests sử dụng Page Object Model (POM)', () => {
  let driver;
  let loginPage;

  beforeAll(async () => {
    driver = await DriverFactory.createDriver(true);
    loginPage = new LoginPage(driver);
  });

  afterAll(async () => {
    if (driver) {
      await driver.quit();
    }
  });

  test('Order 1: Should login successfully with valid credentials', async () => {
    await loginPage.navigate();
    await loginPage.login('tomsmith', 'SuperSecretPassword!');

    const successElem = await driver.wait(until.elementLocated(loginPage.getSuccessLocator()), 10000);
    await driver.wait(until.elementIsVisible(successElem), 10000);
    const text = await successElem.getText();
    expect(text).toContain('You logged into a secure area!');
  });

  test('Order 2: Should show error for invalid credentials', async () => {
    await loginPage.navigate();
    await loginPage.login('wronguser', 'wrongpassword');

    const errorElem = await driver.wait(until.elementLocated(loginPage.getErrorLocator()), 10000);
    await driver.wait(until.elementIsVisible(errorElem), 10000);
    const text = (await errorElem.getText()).toLowerCase();
    expect(text).toContain('invalid');
  });

  const inlineCases = [
    ['tomsmith', 'SuperSecretPassword!', 'success'],
    ['wronguser', 'SuperSecretPassword!', 'error'],
    ['tomsmith', 'wrongpassword', 'error'],
    ['', '', 'error']
  ];

  test.each(inlineCases)(
    'Order 3: CSV Inline: %s / %s => Expected: %s',
    async (rawUser, rawPass, expected) => {
      await loginPage.navigate();
      const username = (rawUser || '').trim();
      const password = (rawPass || '').trim();

      await loginPage.login(username, password);
      const locator = expected === 'success' ? loginPage.getSuccessLocator() : loginPage.getErrorLocator();
      const resultElem = await driver.wait(until.elementLocated(locator), 10000);
      await driver.wait(until.elementIsVisible(resultElem), 10000);
      const text = (await resultElem.getText()).toLowerCase();

      if (expected === 'success') {
        expect(text).toContain('you logged into a secure area!');
      } else {
        expect(text).toContain('invalid');
      }
    }
  );
});

