import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templateSource = 'C:\\Users\\ADMIN\\Desktop\\26_10_2026___06f50a18-29df-4192-9dd6-c8c37f78c4df\\Presentation\\SystemTest\\System Test_template.xlsx';

const loginRows = [
  {
    id: 'TC_LOGIN_001',
    desc: 'Verify user can login successfully with valid email and password',
    pre: '- User is on the Login Page (/login)\n- Website is running and accessible\n- Account freelancer@fjms.com exists and is active',
    steps: '1. Enter "freelancer@fjms.com" into the Email field\n2. Enter "Password@123" into the Password field\n3. Click "Đăng nhập" button',
    data: 'Email: freelancer@fjms.com\nPassword: Password@123',
    expected: 'User is authenticated successfully, toast message "Đăng nhập thành công!" is displayed, and redirected to dashboard',
    actual: 'User was logged in successfully. Toast displayed correctly and redirected as expected.',
    priority: 'High',
    severity: 'Critical',
    status: 'Pass'
  },
  {
    id: 'TC_LOGIN_002',
    desc: 'Verify error message displayed when logging in with incorrect password',
    pre: '- User is on the Login Page\n- Account freelancer@fjms.com exists',
    steps: '1. Enter "freelancer@fjms.com" into the Email field\n2. Enter "WrongPassword!123" into the Password field\n3. Click "Đăng nhập" button',
    data: 'Email: freelancer@fjms.com\nPassword: WrongPassword!123',
    expected: 'Login fails. Error alert displayed: "Mật khẩu không chính xác!"',
    actual: 'Login failed. Error alert displayed correctly.',
    priority: 'High',
    severity: 'Major',
    status: 'Pass'
  },
  {
    id: 'TC_LOGIN_003',
    desc: 'Verify error message displayed when email does not exist in system',
    pre: '- User is on the Login Page\n- Email non_existent@fjms.com is not registered',
    steps: '1. Enter "non_existent@fjms.com" into the Email field\n2. Enter "Password@123" into the Password field\n3. Click "Đăng nhập" button',
    data: 'Email: non_existent@fjms.com\nPassword: Password@123',
    expected: 'Login fails. Error alert displayed: "Tài khoản email không tồn tại trong hệ thống!"',
    actual: 'Login failed. Error alert displayed correctly.',
    priority: 'High',
    severity: 'Major',
    status: 'Pass'
  },
  {
    id: 'TC_LOGIN_004',
    desc: 'Verify HTML5 validation triggers when Email field is left blank',
    pre: '- User is on the Login Page',
    steps: '1. Leave Email field blank\n2. Enter "Password@123" into Password field\n3. Click "Đăng nhập" button',
    data: 'Email: (empty)\nPassword: Password@123',
    expected: 'Form submission is prevented. Browser displays validation message: "Please fill out this field"',
    actual: 'Form was blocked by HTML5 required validation. No network request sent.',
    priority: 'Medium',
    severity: 'Minor',
    status: 'Pass'
  },
  {
    id: 'TC_LOGIN_005',
    desc: 'Verify HTML5 validation triggers when Password field is left blank',
    pre: '- User is on the Login Page',
    steps: '1. Enter "freelancer@fjms.com" into Email field\n2. Leave Password field blank\n3. Click "Đăng nhập" button',
    data: 'Email: freelancer@fjms.com\nPassword: (empty)',
    expected: 'Form submission is prevented. Browser displays validation message for required password',
    actual: 'Form submission was prevented. Validation message shown correctly.',
    priority: 'Medium',
    severity: 'Minor',
    status: 'Pass'
  }
];

const registerRows = [
  {
    id: 'TC_REG_001',
    desc: 'Verify new user can register Freelancer account successfully with valid info',
    pre: '- User is on Register Page (/register)\n- Email newuser@fjms.com has not been used yet',
    steps: '1. Enter "Nguyễn Văn A" into Họ và tên\n2. Enter "newuser@fjms.com" into Email\n3. Enter "0912345678" into Số điện thoại\n4. Enter "Password@123" into Mật khẩu\n5. Select Freelancer role\n6. Click "Đăng ký tài khoản"',
    data: 'Fullname: Nguyễn Văn A\nEmail: newuser@fjms.com\nPhone: 0912345678\nPassword: Password@123\nRole: FREELANCER',
    expected: 'Account created successfully. Toast notification "Đăng ký tài khoản thành công!" displayed.',
    actual: 'Account created. Toast notification displayed correctly.',
    priority: 'High',
    severity: 'Critical',
    status: 'Pass'
  },
  {
    id: 'TC_REG_002',
    desc: 'Verify registration fails when email is already registered in system',
    pre: '- User is on Register Page\n- Email existing@fjms.com already exists in database',
    steps: '1. Enter "Nguyễn Văn B" into Họ và tên\n2. Enter "existing@fjms.com" into Email\n3. Enter "0987654321" into Số điện thoại\n4. Enter "Password@123" into Mật khẩu\n5. Click "Đăng ký tài khoản"',
    data: 'Fullname: Nguyễn Văn B\nEmail: existing@fjms.com\nPhone: 0987654321\nPassword: Password@123',
    expected: 'Registration fails. Error alert displayed: "Email này đã được đăng ký tài khoản!"',
    actual: 'Registration rejected. Duplicate email error message displayed correctly.',
    priority: 'High',
    severity: 'Major',
    status: 'Pass'
  },
  {
    id: 'TC_REG_003',
    desc: 'Verify validation fails when phone number format is invalid',
    pre: '- User is on Register Page',
    steps: '1. Enter "Trần Văn C" into Họ và tên\n2. Enter "userc@fjms.com" into Email\n3. Enter "12345" (invalid format) into Số điện thoại\n4. Enter "Password@123" into Mật khẩu\n5. Click "Đăng ký tài khoản"',
    data: 'Fullname: Trần Văn C\nEmail: userc@fjms.com\nPhone: 12345\nPassword: Password@123',
    expected: 'Form submission is blocked by phone regex pattern validation (10 digits starting with 0/84/+84)',
    actual: 'Form submission was prevented. Regex pattern error shown.',
    priority: 'Medium',
    severity: 'Minor',
    status: 'Pass'
  },
  {
    id: 'TC_REG_004',
    desc: 'Verify validation triggers when password is too short (< 6 characters)',
    pre: '- User is on Register Page',
    steps: '1. Enter valid Fullname, Email, Phone\n2. Enter "12345" (< 6 chars) into Password\n3. Click "Đăng ký tài khoản"',
    data: 'Fullname: Lê Thị D\nEmail: userd@fjms.com\nPhone: 0933333333\nPassword: 12345',
    expected: 'Form submission is prevented. Browser warns password must be at least 6 characters',
    actual: 'Browser enforced minlength=6 rule. Form was not submitted.',
    priority: 'Medium',
    severity: 'Minor',
    status: 'Pass'
  },
  {
    id: 'TC_REG_005',
    desc: 'Verify form blocks submission when any required field is left blank',
    pre: '- User is on Register Page',
    steps: '1. Leave Fullname, Email, Phone, and Password empty\n2. Click "Đăng ký tài khoản"',
    data: 'All fields empty',
    expected: 'Form submission is blocked. First required empty field is focused with prompt',
    actual: 'Form blocked correctly by HTML5 validation.',
    priority: 'High',
    severity: 'Minor',
    status: 'Pass'
  }
];

function buildSheet(projectName, author, featureName, rows) {
  const wsData = [
    ['Name of your project', projectName],
    ['Author', author],
    [],
    ['Test Case ID', 'Test Case Description', 'Pre-conditions', 'Test Case Procedure', 'Test Data', 'Expected Results', 'Actual Result', 'Priority', 'Severity', 'Status'],
    [`Feature: ${featureName}`]
  ];

  for (const r of rows) {
    wsData.push([
      r.id,
      r.desc,
      r.pre,
      r.steps,
      r.data,
      r.expected,
      r.actual,
      r.priority,
      r.severity,
      r.status
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  // Cấu hình độ rộng các cột
  ws['!cols'] = [
    { wch: 15 }, // ID
    { wch: 35 }, // Description
    { wch: 30 }, // Pre-conditions
    { wch: 40 }, // Procedure
    { wch: 30 }, // Data
    { wch: 35 }, // Expected
    { wch: 35 }, // Actual
    { wch: 10 }, // Priority
    { wch: 10 }, // Severity
    { wch: 10 }  // Status
  ];

  return ws;
}

const wb = XLSX.utils.book_new();

const loginWs = buildSheet(
  'Freelancer Job Matching System (FJMS)',
  'Nguyen Dang Khang Huy',
  'Login Functionality',
  loginRows
);
XLSX.utils.book_append_sheet(wb, loginWs, 'Login_Functionality');

const regWs = buildSheet(
  'Freelancer Job Matching System (FJMS)',
  'Nguyen Dang Khang Huy',
  'Register Functionality',
  registerRows
);
XLSX.utils.book_append_sheet(wb, regWs, 'Register_Functionality');

// Xuất file ra thư mục reports và docs
const reportsDir = path.join(__dirname, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const reportPath = path.join(reportsDir, 'System_Test_Report_FJMS.xlsx');
XLSX.writeFile(wb, reportPath);
console.log(`✅ File System Test Excel đã được tạo thành công tại: ${reportPath}`);

// Copy qua docs của dự án
const docsReportPath = 'C:\\Users\\ADMIN\\Desktop\\ProjectSWP\\swp391-rbl-project-team_7-1\\docs\\System_Test_Report_FJMS.xlsx';
fs.copyFileSync(reportPath, docsReportPath);
console.log(`✅ Đã copy vào docs tại: ${docsReportPath}`);
