import { BasePage } from '../../exercise4_basepage/pages/BasePage.js';
import { By } from 'selenium-webdriver';

/**
 * Page Object Model cho chức năng Nộp Báo giá (Submit Proposal)
 * Dành cho Freelancer nộp hồ sơ ứng tuyển vào dự án
 */
export class ProposalPage extends BasePage {
  constructor(driver, baseUrl) {
    super(driver);
    this.baseUrl = baseUrl;
    this.url = `${baseUrl}/submit-proposal`;

    // Locators
    this.bidAmountInput = By.id('bidAmount');
    this.durationInput = By.id('duration');
    this.coverLetterInput = By.id('coverLetter');
    this.submitButton = By.css("button[type='submit']");
    this.errorContainer = By.id('error-container');
    this.toastContainer = By.id('toast-container');
  }

  async navigate() {
    await this.navigateTo(this.url);
  }

  async fillProposalForm({
    bidAmount = '',
    duration = '',
    coverLetter = ''
  }) {
    if (bidAmount !== '' && bidAmount !== undefined) await this.type(this.bidAmountInput, bidAmount.toString());
    if (duration !== '' && duration !== undefined) await this.type(this.durationInput, duration.toString());
    if (coverLetter) await this.type(this.coverLetterInput, coverLetter);
  }

  async submitProposal() {
    await this.click(this.submitButton);
  }

  async getErrorMessage() {
    return await this.getText(this.errorContainer);
  }

  async getToastMessage() {
    return await this.getText(this.toastContainer);
  }
}
