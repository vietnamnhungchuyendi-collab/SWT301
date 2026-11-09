import { BasePage } from '../../exercise4_basepage/pages/BasePage.js';
import { By } from 'selenium-webdriver';

/**
 * Page Object Model cho chức năng Quản lý Dự án (Create / Post Project)
 * Áp dụng Decision Table & Kỹ thuật Blackbox EP / BVA
 */
export class ProjectManagementPage extends BasePage {
  constructor(driver, baseUrl) {
    super(driver);
    this.baseUrl = baseUrl;
    this.url = `${baseUrl}/post-project`;

    // Locators
    this.titleInput = By.id('title');
    this.categorySelect = By.id('category');
    this.customCategoryInput = By.id('customCategory');
    this.descriptionInput = By.id('description');
    this.budgetMinInput = By.id('budget_min');
    this.budgetMaxInput = By.id('budget_max');
    this.deadlineInput = By.id('deadline');
    this.skillsInput = By.id('skills');
    this.submitButton = By.css("button[type='submit']");
    this.errorContainer = By.id('error-container');
    this.toastContainer = By.id('toast-container');
  }

  async navigate() {
    await this.navigateTo(this.url);
  }

  async fillProjectForm({
    title = '',
    category = 'IT',
    customCategory = '',
    description = '',
    budgetMin = '',
    budgetMax = '',
    deadline = '',
    skills = ''
  }) {
    if (title) await this.type(this.titleInput, title);
    // category is a select tag, use sendKeys directly without clear() to avoid InvalidElementStateError
    if (category) {
      const selectElem = await this.waitForVisibility(this.categorySelect);
      await selectElem.sendKeys(category);
    }
    if (customCategory) await this.type(this.customCategoryInput, customCategory);
    if (description) await this.type(this.descriptionInput, description);
    if (budgetMin !== '' && budgetMin !== undefined) await this.type(this.budgetMinInput, budgetMin.toString());
    if (budgetMax !== '' && budgetMax !== undefined) await this.type(this.budgetMaxInput, budgetMax.toString());
    if (deadline) await this.type(this.deadlineInput, deadline);
    if (skills) await this.type(this.skillsInput, skills);
  }

  async submitProject() {
    await this.click(this.submitButton);
  }

  async getErrorMessage() {
    return await this.getText(this.errorContainer);
  }

  async getToastMessage() {
    return await this.getText(this.toastContainer);
  }
}
