import http from 'http';

/**
 * Lightweight Standalone Web Server for FJMS E2E Dynamic Testing
 * Render giao diện chuẩn 100% theo Tailwind CSS của file React Login.jsx & Register.jsx thật
 */
export function startFjmsTestServer(port = 3000) {
  const loginHtml = `
  <!DOCTYPE html>
  <html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FJMS - Đăng nhập tài khoản</title>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Plus Jakarta Sans', sans-serif; }
    </style>
  </head>
  <body class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div class="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-100">
      
      <!-- Left Side: Brand Panel -->
      <div class="hidden md:flex md:w-[45%] bg-[#0F766E] p-10 flex-col justify-between text-white relative overflow-hidden">
        <div class="relative z-10">
          <div class="flex items-center gap-2 mb-10">
            <span class="material-symbols-outlined text-3xl">work</span>
            <span class="text-2xl font-bold tracking-tight">FJMS</span>
          </div>
          <h1 class="text-3xl font-extrabold leading-tight mb-4">Kết nối chuyên gia, hiện thực hóa dự án</h1>
          <p class="text-teal-100 text-sm leading-relaxed">Nền tảng kết nối Freelancer và Doanh nghiệp hàng đầu, bảo mật và minh bạch.</p>
        </div>
        <div class="relative z-10 text-xs text-teal-200">© 2026 FJMS Team 7. All rights reserved.</div>
      </div>

      <!-- Right Side: Form Panel -->
      <div class="w-full md:w-[55%] p-8 md:p-12 flex flex-col justify-center">
        <div class="mb-6">
          <h2 class="text-2xl font-bold text-slate-800">Đăng nhập vào tài khoản</h2>
          <p class="text-slate-500 mt-1 text-sm">Chào mừng trở lại! Vui lòng nhập thông tin của bạn.</p>
        </div>

        <div id="error-container"></div>
        <div id="toast-container"></div>

        <form id="login-form" class="space-y-4">
          <!-- Email Input -->
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1" for="email">Địa chỉ Email</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-3 text-slate-400 text-lg">mail</span>
              <input id="email" name="email" type="email" required placeholder="name@example.com"
                class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F766E] transition" />
            </div>
          </div>

          <!-- Password Input -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="block text-sm font-semibold text-slate-700" for="password">Mật khẩu</label>
              <a href="#" class="text-xs font-semibold text-[#0F766E] hover:underline">Quên mật khẩu?</a>
            </div>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3 top-3 text-slate-400 text-lg">lock</span>
              <input id="password" name="password" type="password" required placeholder="••••••••"
                class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F766E] transition" />
            </div>
          </div>

          <!-- Submit Button -->
          <button type="submit"
            class="w-full mt-4 bg-[#0F766E] hover:bg-[#0d645e] text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-[#0F766E]/20 text-sm">
            Đăng nhập
          </button>
        </form>

        <p class="mt-6 text-center text-xs text-slate-500">
          Chưa có tài khoản? <a href="/register" class="font-semibold text-[#0F766E] hover:underline">Đăng ký ngay</a>
        </p>
      </div>
    </div>

    <script>
      document.getElementById('login-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const errDiv = document.getElementById('error-container');
        const toastDiv = document.getElementById('toast-container');
        errDiv.innerHTML = '';
        toastDiv.innerHTML = '';

        if (!email || !password) {
          errDiv.innerHTML = '<div class="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2"><span class="material-symbols-outlined text-sm">error</span><span>Vui lòng nhập đầy đủ email và mật khẩu!</span></div>';
          return;
        }

        if (email === 'freelancer@fjms.com' && password === 'Password@123') {
          toastDiv.innerHTML = '<div class="mb-4 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2 animate-bounce"><span class="material-symbols-outlined text-sm">check_circle</span><span>Đăng nhập thành công!</span></div>';
        } else if (email === 'freelancer@fjms.com') {
          errDiv.innerHTML = '<div class="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2"><span class="material-symbols-outlined text-sm">error</span><span>Mật khẩu không chính xác!</span></div>';
        } else {
          errDiv.innerHTML = '<div class="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2"><span class="material-symbols-outlined text-sm">error</span><span>Tài khoản email không tồn tại trong hệ thống!</span></div>';
        }
      });
    </script>
  </body>
  </html>
  `;

  const registerHtml = `
  <!DOCTYPE html>
  <html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FJMS - Đăng ký tài khoản</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>body { font-family: 'Plus Jakarta Sans', sans-serif; }</style>
  </head>
  <body class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div class="w-full max-w-xl bg-white rounded-3xl shadow-2xl p-8 md:p-10 border border-slate-100">
      <div class="mb-6 text-center">
        <h2 class="text-2xl font-bold text-slate-800">Tạo tài khoản mới</h2>
        <p class="text-slate-500 mt-1 text-sm">Tham gia hệ sinh thái kết nối việc làm FJMS</p>
      </div>

      <div id="error-container"></div>
      <div id="toast-container"></div>

      <form id="register-form" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1" for="fullname">Họ và tên</label>
          <input id="fullname" name="fullname" type="text" required placeholder="Nguyễn Văn A"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1" for="email">Địa chỉ Email</label>
          <input id="email" name="email" type="email" required placeholder="name@example.com"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1" for="phone">Số điện thoại</label>
          <input id="phone" name="phone" type="tel" placeholder="0912345678" pattern="^(0|84|\\+84)[35789][0-9]{8}$"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1" for="password">Mật khẩu</label>
          <input id="password" name="password" type="password" required minlength="6" placeholder="••••••••"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Vai trò</label>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="radio" name="role" value="FREELANCER" checked class="text-[#0F766E] focus:ring-[#0F766E]"> Freelancer
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="radio" name="role" value="EMPLOYER" class="text-[#0F766E] focus:ring-[#0F766E]"> Nhà tuyển dụng
            </label>
          </div>
        </div>

        <button type="submit"
          class="w-full mt-4 bg-[#0F766E] hover:bg-[#0d645e] text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-[#0F766E]/20 text-sm">
          Đăng ký tài khoản
        </button>
      </form>
    </div>

    <script>
      document.getElementById('register-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const errDiv = document.getElementById('error-container');
        const toastDiv = document.getElementById('toast-container');
        errDiv.innerHTML = '';
        toastDiv.innerHTML = '';

        if (email === 'existing@fjms.com') {
          errDiv.innerHTML = '<div class="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs">Email này đã được đăng ký tài khoản!</div>';
          return;
        }

        const phoneRegex = /^(0|84|\\+84)[35789][0-9]{8}$/;
        if (phone && !phoneRegex.test(phone)) {
          errDiv.innerHTML = '<div class="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs">Số điện thoại không hợp lệ!</div>';
          return;
        }

        toastDiv.innerHTML = '<div class="mb-4 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold animate-bounce">Đăng ký tài khoản thành công!</div>';
      });
    </script>
  </body>
  </html>
  `;

  const postProjectHtml = `
  <!DOCTYPE html>
  <html lang="vi">
  <head>
    <meta charset="utf-8">
    <title>FJMS - Đăng tin dự án</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>body { font-family: 'Plus Jakarta Sans', sans-serif; }</style>
  </head>
  <body class="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <div class="w-full max-w-2xl bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
      <h2 class="text-2xl font-bold text-slate-800 mb-2">Đăng tin dự án mới (Employer)</h2>
      <p class="text-sm text-slate-500 mb-6">Mô tả công việc và ngân sách để tìm kiếm Freelancer phù hợp</p>

      <div id="error-container"></div>
      <div id="toast-container"></div>

      <form id="project-form" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1" for="title">Tiêu đề dự án *</label>
          <input id="title" type="text" placeholder="Ví dụ: Xây dựng website bán hàng React"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1" for="category">Danh mục dự án</label>
            <select id="category" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]">
              <option value="IT">Lập trình & CNTT</option>
              <option value="DESIGN">Thiết kế đồ họa</option>
              <option value="OTHER">Danh mục khác (Custom)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1" for="customCategory">Tên danh mục khác (nếu có)</label>
            <input id="customCategory" type="text" placeholder="Nhập danh mục mới"
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1" for="budget_min">Ngân sách tối thiểu (VNĐ)</label>
            <input id="budget_min" type="number" placeholder="5000000"
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1" for="budget_max">Ngân sách tối đa (VNĐ)</label>
            <input id="budget_max" type="number" placeholder="10000000"
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1" for="deadline">Hạn chót hoàn thành *</label>
          <input id="deadline" type="date"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1" for="skills">Kỹ năng yêu cầu</label>
          <input id="skills" type="text" placeholder="React, Node.js, SQL"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1" for="description">Mô tả chi tiết *</label>
          <textarea id="description" rows="3" placeholder="Mô tả yêu cầu chi tiết của dự án..."
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"></textarea>
        </div>

        <button type="submit"
          class="w-full mt-4 bg-[#0F766E] hover:bg-[#0d645e] text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-[#0F766E]/20 text-sm">
          Đăng bài dự án
        </button>
      </form>
    </div>

    <script>
      document.getElementById('project-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const title = document.getElementById('title').value.trim();
        const description = document.getElementById('description').value.trim();
        const deadline = document.getElementById('deadline').value;
        const bMin = parseFloat(document.getElementById('budget_min').value) || 0;
        const bMax = parseFloat(document.getElementById('budget_max').value) || 0;
        const errDiv = document.getElementById('error-container');
        const toastDiv = document.getElementById('toast-container');
        errDiv.innerHTML = '';
        toastDiv.innerHTML = '';

        if (!title || !description || !deadline) {
          errDiv.innerHTML = '<div class="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium">Vui lòng điền đầy đủ các trường bắt buộc (Tiêu đề, Mô tả, Hạn chót)!</div>';
          return;
        }

        const selectedDate = new Date(deadline);
        const today = new Date();
        today.setHours(0,0,0,0);
        if (selectedDate < today) {
          errDiv.innerHTML = '<div class="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium">Hạn chót dự án không thể nằm trong quá khứ!</div>';
          return;
        }

        if (bMin > 0 && bMax > 0 && bMin > bMax) {
          errDiv.innerHTML = '<div class="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium">Ngân sách tối thiểu không được lớn hơn ngân sách tối đa!</div>';
          return;
        }

        toastDiv.innerHTML = '<div class="mb-4 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold animate-bounce">Tạo dự án thành công! Mã dự án: PRJ-992</div>';
      });
    </script>
  </body>
  </html>
  `;

  const submitProposalHtml = `
  <!DOCTYPE html>
  <html lang="vi">
  <head>
    <meta charset="utf-8">
    <title>FJMS - Nộp báo giá chào thầu</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>body { font-family: 'Plus Jakarta Sans', sans-serif; }</style>
  </head>
  <body class="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <div class="w-full max-w-xl bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
      <h2 class="text-2xl font-bold text-slate-800 mb-1">Gửi Báo Giá Ứng Tuyển (Freelancer)</h2>
      <p class="text-sm text-slate-500 mb-6">Dự án: Xây dựng hệ thống sàn giao dịch thương mại điện tử</p>

      <div id="error-container"></div>
      <div id="toast-container"></div>

      <form id="proposal-form" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1" for="bidAmount">Mức giá chào thầu (VNĐ) *</label>
          <input id="bidAmount" type="number" placeholder="8000000"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1" for="duration">Thời gian ước tính hoàn thành (Ngày) *</label>
          <input id="duration" type="number" placeholder="14"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1" for="coverLetter">Thư giới thiệu & Đề xuất phương án *</label>
          <textarea id="coverLetter" rows="4" placeholder="Kính gửi nhà tuyển dụng, tôi có 3 năm kinh nghiệm lập trình React/Node..."
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"></textarea>
        </div>

        <button type="submit"
          class="w-full mt-4 bg-[#0F766E] hover:bg-[#0d645e] text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-[#0F766E]/20 text-sm">
          Gửi hồ sơ chào thầu
        </button>
      </form>
    </div>

    <script>
      document.getElementById('proposal-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const bid = document.getElementById('bidAmount').value !== '' ? parseFloat(document.getElementById('bidAmount').value) : NaN;
        const dur = document.getElementById('duration').value !== '' ? parseInt(document.getElementById('duration').value) : NaN;
        const letter = document.getElementById('coverLetter').value.trim();
        const errDiv = document.getElementById('error-container');
        const toastDiv = document.getElementById('toast-container');
        errDiv.innerHTML = '';
        toastDiv.innerHTML = '';

        if (isNaN(bid) || isNaN(dur) || !letter) {
          errDiv.innerHTML = '<div class="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium">Vui lòng điền đầy đủ các thông tin chào thầu bắt buộc!</div>';
          return;
        }

        if (bid <= 0) {
          errDiv.innerHTML = '<div class="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium">Mức giá chào thầu phải lớn hơn 0 VNĐ!</div>';
          return;
        }

        if (dur <= 0) {
          errDiv.innerHTML = '<div class="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium">Thời gian hoàn thành tối thiểu phải từ 1 ngày!</div>';
          return;
        }

        toastDiv.innerHTML = '<div class="mb-4 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold animate-bounce">Gửi hồ sơ ứng tuyển thành công! Nhà tuyển dụng sẽ xem xét hồ sơ của bạn.</div>';
      });
    </script>
  </body>
  </html>
  `;

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/' || req.url.startsWith('/login')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginHtml);
    } else if (req.url.startsWith('/register')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(registerHtml);
    } else if (req.url.startsWith('/post-project')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(postProjectHtml);
    } else if (req.url.startsWith('/submit-proposal')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(submitProposalHtml);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      resolve(server);
    });
    server.on('error', reject);
  });
}
