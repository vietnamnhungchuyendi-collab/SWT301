import { BaseTest } from '../../exercise4_basepage/tests/BaseTest.js';
import { PracticeFormPage } from '../pages/PracticeFormPage.js';

describe('Bài tập 5: Automation Practice Form Tests (demoqa.com)', () => {
  let formPage;

  beforeAll(async () => {
    await BaseTest.setUpBase();
    formPage = new PracticeFormPage(BaseTest.getDriver());
  });

  afterAll(async () => {
    await BaseTest.tearDownBase();
  });

  test('TC_DEMOQA_01: Should submit successfully with all valid required fields', async () => {
    await formPage.navigate();
    await formPage.fillRequiredFields('John', 'Doe', '0912345678', 'Male');
    await formPage.fillOptionalEmail('john.doe@example.com');
    await formPage.submit();

    const isVisible = await formPage.isSuccessModalVisible();
    expect(isVisible).toBe(true);

    const title = await formPage.getSuccessModalTitle();
    expect(title).toContain('Thanks for submitting the form');
  });

  test('TC_DEMOQA_02: Should not submit when required fields are empty', async () => {
    await formPage.navigate();
    // Bỏ trống toàn bộ các trường bắt buộc và nhấn Submit
    await formPage.submit();

    // Hộp thoại thành công không được phép xuất hiện
    const isVisible = await formPage.isSuccessModalVisible();
    expect(isVisible).toBe(false);
  });

  test('TC_DEMOQA_03: Should not submit with invalid phone number (< 10 digits)', async () => {
    await formPage.navigate();
    await formPage.fillRequiredFields('Alice', 'Smith', '12345', 'Female');
    await formPage.submit();

    const isVisible = await formPage.isSuccessModalVisible();
    expect(isVisible).toBe(false);
  });
});
