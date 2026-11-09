import http from 'http';

/**
 * Lightweight Standalone Web Server for FJMS E2E Dynamic Testing
 * Giả lập chuẩn xác giao diện và tương tác của Login.jsx và Register.jsx trong dự án FJMS
 */
export function startFjmsTestServer(port = 3000) {
  const loginHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>FJMS - Login</title>
  </head>
  <body>
    <div id="root">
      <h2>Đăng nhập vào tài khoản</h2>
      <div id="error-container"></div>
      <div id="toast-container"></div>
      <form id="login-form">
        <label for="email">Địa chỉ Email</label>
        <input id="email" name="email" type="email" required placeholder="name@example.com" />
        
        <label for="password">Mật khẩu</label>
        <input id="password" name="password" type="password" required placeholder="Mật khẩu" />
        
        <button type="submit">Đăng nhập</button>
      </form>
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
          errDiv.innerHTML = '<div class="bg-red-50 text-red-700">Vui lòng nhập đầy đủ email và mật khẩu!</div>';
          return;
        }

        if (email === 'freelancer@fjms.com' && password === 'Password@123') {
          toastDiv.innerHTML = '<div class="animate-bounce font-semibold">Đăng nhập thành công!</div>';
        } else if (email === 'freelancer@fjms.com') {
          errDiv.innerHTML = '<div class="bg-red-50 text-red-700">Mật khẩu không chính xác!</div>';
        } else {
          errDiv.innerHTML = '<div class="bg-red-50 text-red-700">Tài khoản email không tồn tại trong hệ thống!</div>';
        }
      });
    </script>
  </body>
  </html>
  `;

  const registerHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>FJMS - Register</title>
  </head>
  <body>
    <div id="root">
      <h2>Tạo tài khoản mới</h2>
      <div id="error-container"></div>
      <div id="toast-container"></div>
      <form id="register-form">
        <label for="fullname">Họ và tên</label>
        <input id="fullname" name="fullname" type="text" required placeholder="Họ và tên" />

        <label for="email">Địa chỉ Email</label>
        <input id="email" name="email" type="email" required placeholder="name@example.com" />

        <label for="phone">Số điện thoại</label>
        <input id="phone" name="phone" type="tel" pattern="^(0|84|\\+84)[35789][0-9]{8}$" required placeholder="0912345678" />

        <label for="password">Mật khẩu</label>
        <input id="password" name="password" type="password" required minlength="6" placeholder="Mật khẩu" />

        <div id="role-selector">
          <button type="button" id="role-freelancer">Freelancer</button>
          <button type="button" id="role-employer">Employer</button>
        </div>

        <button type="submit">Đăng ký tài khoản</button>
      </form>
    </div>
    <script>
      let selectedRole = 'FREELANCER';
      document.getElementById('role-freelancer').onclick = () => selectedRole = 'FREELANCER';
      document.getElementById('role-employer').onclick = () => selectedRole = 'EMPLOYER';

      document.getElementById('register-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const fullname = document.getElementById('fullname').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const password = document.getElementById('password').value;
        const errDiv = document.getElementById('error-container');
        const toastDiv = document.getElementById('toast-container');
        errDiv.innerHTML = '';
        toastDiv.innerHTML = '';

        if (!fullname || !email || !phone || !password) {
          errDiv.innerHTML = '<div class="bg-red-50 text-red-700">Vui lòng điền đầy đủ thông tin bắt buộc!</div>';
          return;
        }

        if (email === 'existing@fjms.com') {
          errDiv.innerHTML = '<div class="bg-red-50 text-red-700">Email này đã được đăng ký tài khoản!</div>';
          return;
        }

        toastDiv.innerHTML = '<div class="animate-bounce font-semibold">Đăng ký tài khoản thành công!</div>';
      });
    </script>
  </body>
  </html>
  `;

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url === '/login' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginHtml);
    } else if (req.url === '/register') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(registerHtml);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(server);
    });
  });
}

