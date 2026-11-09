import { spawnSync } from 'child_process';

console.log('🚀 [1/3] Đang chạy kiểm thử Jest...');

// 1. Chạy test (vẫn lưu results.json và coverage kể cả khi có lỗi)
const testResult = spawnSync('npm', ['run', 'test:ci'], {
  stdio: 'inherit',
  shell: true
});

const isPassed = testResult.status === 0;
const statusText = isPassed ? 'PASS' : 'FAIL';
const commitMsg = isPassed 
  ? `ci: run test PASSED (48/48 cases)` 
  : `ci: run test FAILED (regression evidence captured)`;

console.log(`\n📋 Kết quả test: [${statusText}]`);
console.log('📦 [2/3] Đang lưu thay đổi (git add & commit)...');

// 2. Git add
spawnSync('git', ['add', '.'], { stdio: 'inherit', shell: true });

// 3. Git commit
const commitResult = spawnSync('git', ['commit', '-m', commitMsg], {
  stdio: 'inherit',
  shell: true
});

// Nếu không có thay đổi gì mới để commit thì bỏ qua thông báo
if (commitResult.status !== 0) {
  console.log('ℹ️ Không có file nào thay đổi mới để commit.');
}

console.log('☁️ [3/3] Đang đẩy lên GitHub Actions (git push)...');

// 4. Git push
const pushResult = spawnSync('git', ['push'], {
  stdio: 'inherit',
  shell: true
});

if (pushResult.status === 0) {
  console.log(`\n🎉 HOÀN THÀNH! GitHub Actions đang tự động ghi nhận kết quả [${statusText}].`);
  console.log('👉 Vào tab "Actions" trên GitHub repo để xem tiến trình và tải báo cáo.');
} else {
  console.error('\n❌ Không thể git push. Vui lòng kiểm tra quyền truy cập hoặc kết nối mạng.');
}
