import { BaseTest } from './BaseTest.js';
import { LoginPage } from '../pages/LoginPage.js';

describe('Bài tập 4: Login Tests kế thừa BasePage và BaseTest', () => {
  let loginPage;

  beforeAll(async () => {
    await BaseTest.setUpBase();
    loginPage = new LoginPage(BaseTest.getDriver());
  });

  afterAll(async () => {
    await BaseTest.tearDownBase();
  });

  test('Order 1: Should login successfully with valid credentials', async () => {
    await loginPage.navigate();
    await loginPage.login('tomsmith', 'SuperSecretPassword!');

    const message = await loginPage.getMessageText(loginPage.getSuccessLocator());
    expect(message).toContain('You logged into a secure area!');
  });

  test('Order 2: Should show error for invalid credentials', async () => {
    await loginPage.navigate();
    await loginPage.login('wronguser', 'wrongpassword');

    const message = (await loginPage.getMessageText(loginPage.getErrorLocator())).toLowerCase();
    expect(message).toContain('invalid');
  });

  const inlineCases = [
    ['tomsmith', 'SuperSecretPassword!', 'success'],
    ['wronguser', 'SuperSecretPassword!', 'error'],
    ['tomsmith', 'wrongpassword', 'error'],
    ['', '', 'error']
  ];

  test.each(inlineCases)(
    'Order 3: CSV Inline parameterized test: %s / %s => Expected: %s',
    async (rawUser, rawPass, expected) => {
      await loginPage.navigate();
      const username = (rawUser || '').trim();
      const password = (rawPass || '').trim();

      await loginPage.login(username, password);
      const locator = expected === 'success' ? loginPage.getSuccessLocator() : loginPage.getErrorLocator();
      const message = (await loginPage.getMessageText(locator)).toLowerCase();

      if (expected === 'success') {
        expect(message).toContain('you logged into a secure area!');
      } else {
        expect(message).toContain('invalid');
      }
    }
  );
});
