import { By } from 'selenium-webdriver';
import { BasePage } from '../../common/BasePage.js';

/**
 * PracticeFormPage: Page Object cho trang demoqa.com/automation-practice-form
 * Kế thừa từ BasePage
 */
export class PracticeFormPage extends BasePage {
  constructor(driver) {
    super(driver);

    // Locators
    this.firstNameField = By.id('firstName');
    this.lastNameField = By.id('lastName');
    this.userEmailField = By.id('userEmail');
    this.userNumberField = By.id('userNumber');
    this.genderMaleRadio = By.css("label[for='gender-radio-1']");
    this.genderFemaleRadio = By.css("label[for='gender-radio-2']");
    this.genderOtherRadio = By.css("label[for='gender-radio-3']");
    this.submitBtn = By.id('submit');
    this.modalTitle = By.id('example-modal-sizes-title-lg');
    this.closeModalBtn = By.id('closeLargeModal');
  }

  async navigate() {
    await this.navigateTo('https://demoqa.com/automation-practice-form');
    // Ẩn các banner quảng cáo nếu có trên demoqa để tránh chắn click
    try {
      await this.driver.executeScript(`
        const ads = document.querySelectorAll('#adplus-anchor, #fixedban, footer');
        ads.forEach(ad => ad.style.display = 'none');
      `);
    } catch {
      // Bỏ qua nếu trang không có ad
    }
  }

  /**
   * Điền thông tin form đăng ký sinh viên
   */
  async fillRequiredFields(firstName, lastName, mobile, gender = 'Male') {
    if (firstName) await this.type(this.firstNameField, firstName);
    if (lastName) await this.type(this.lastNameField, lastName);
    if (mobile) await this.type(this.userNumberField, mobile);

    // Chọn giới tính
    let genderLocator = this.genderMaleRadio;
    if (gender === 'Female') genderLocator = this.genderFemaleRadio;
    else if (gender === 'Other') genderLocator = this.genderOtherRadio;
    
    try {
      const genderElem = await this.waitForVisibility(genderLocator);
      await this.driver.executeScript("arguments[0].click();", genderElem);
    } catch {
      // Fallback click
    }
  }

  async fillOptionalEmail(email) {
    if (email) {
      await this.type(this.userEmailField, email);
    }
  }

  /**
   * Submit form với cuộn chuột tránh che khuất bởi banner
   */
  async submit() {
    const btn = await this.waitForVisibility(this.submitBtn);
    await this.driver.executeScript("arguments[0].scrollIntoView({block: 'center'}); arguments[0].click();", btn);
  }

  async isSuccessModalVisible() {
    return await this.isElementVisible(this.modalTitle);
  }

  async getSuccessModalTitle() {
    return await this.getText(this.modalTitle);
  }
}

