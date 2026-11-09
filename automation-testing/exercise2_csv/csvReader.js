import fs from 'fs';

/**
 * Đọc file CSV và parse thành mảng các mảng giá trị (hỗ trợ bỏ qua dòng tiêu đề và trim khoảng trắng)
 * Tương đương @CsvFileSource(resources = "/login-data.csv", numLinesToSkip = 1) trong JUnit 5
 * 
 * @param {string} filePath Đường dẫn tuyệt đối hoặc tương đối tới file CSV
 * @param {number} numLinesToSkip Số dòng bỏ qua từ đầu file (mặc định: 1 dòng header)
 * @returns {Array<Array<string>>} Mảng các dòng dữ liệu kiểm thử
 */
export function readCsvFile(filePath, numLinesToSkip = 1) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  const dataLines = lines.slice(numLinesToSkip);
  return dataLines.map(line => {
    // Tách cột theo dấu phẩy, xử lý trim và chuyển khoảng trắng/rỗng về chuỗi rỗng
    return line.split(',').map(val => (val !== undefined && val !== null ? val.trim() : ''));
  });
}
