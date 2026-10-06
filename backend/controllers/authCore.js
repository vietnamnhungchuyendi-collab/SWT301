import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql, poolPromise } from '../config/db.js';
import { sendOTPEmail } from '../utils/emailService.js';

/**
 * Register User
 */
export const register = async (req, res) => {
  const { fullName, email, phone, password, role } = req.body;

  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ các thông tin bắt buộc.' });
  }

  const roleUpper = role.toUpperCase();
  if (roleUpper !== 'FREELANCER' && roleUpper !== 'EMPLOYER') {
    return res.status(400).json({ message: 'Vai trò không hợp lệ. Chỉ chấp nhận FREELANCER hoặc EMPLOYER.' });
  }

  // Password validation: ít nhất 8 ký tự, 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ 
      message: 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm ít nhất: 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt (ví dụ: @, $, !, %, *, ?, &, #).' 
    });
  }

  try {
    const pool = await poolPromise;

    // Check if email already exists
    const emailCheckResult = await pool.request()
      .input('email', sql.VarChar, email)
      .query('SELECT 1 FROM users WHERE email = @email');

    if (emailCheckResult.recordset.length > 0) {
      return res.status(400).json({ message: 'Email đã được sử dụng.' });
    }

    // Check if phone already exists (if provided)
    if (phone) {
      const phoneRegex = /^(0|84|\+84)[35789][0-9]{8}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ message: 'Số điện thoại không hợp lệ. Vui lòng nhập đúng số điện thoại Việt Nam (ví dụ: 0912345678).' });
      }

      const phoneCheckResult = await pool.request()
        .input('phone', sql.VarChar, phone)
        .query('SELECT 1 FROM users WHERE phone = @phone');

      if (phoneCheckResult.recordset.length > 0) {
        return res.status(400).json({ message: 'Số điện thoại đã được sử dụng.' });
      }
    }

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // Insert user and get identity ID
    const userInsertResult = await pool.request()
      .input('fullName', sql.NVarChar, fullName)
      .input('email', sql.VarChar, email)
      .input('phone', sql.VarChar, phone || null)
      .input('passwordHash', sql.VarChar, passwordHash)
      .input('roleDefault', sql.VarChar, roleUpper)
      .query(`
        INSERT INTO users (full_name, email, phone, password_hash, role_default, is_email_verified)
        VALUES (@fullName, @email, @phone, @passwordHash, @roleDefault, 0);
        SELECT SCOPE_IDENTITY() AS user_id;
      `);

    const userId = userInsertResult.recordset[0].user_id;

    // Insert into user_roles
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('roleName', sql.VarChar, roleUpper)
      .query(`
        INSERT INTO user_roles (user_id, role_id)
        SELECT @userId, role_id FROM roles WHERE role_name = @roleName
      `);

    // Create Freelancer profile if registered as Freelancer
    if (roleUpper === 'FREELANCER') {
      await pool.request()
        .input('freelancerId', sql.Int, userId)
        .query(`
          INSERT INTO freelancer_profiles (freelancer_id, availability_status, rating_average, total_reviews)
          VALUES (@freelancerId, 'AVAILABLE', 0.00, 0)
        `);
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiredAt = new Date();
    expiredAt.setMinutes(expiredAt.getMinutes() + 10); // Expires in 10 minutes

    // Save Email Verification Code
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('otpCode', sql.VarChar, otpCode)
      .input('expiredAt', sql.DateTime, expiredAt)
      .query(`
        INSERT INTO email_verifications (user_id, verification_code, expired_at, is_used)
        VALUES (@userId, @otpCode, @expiredAt, 0)
      `);

    // Send Real Verification OTP Email
    await sendOTPEmail(email, otpCode, fullName);

    console.log(`Registration successful for ${email}. Generated verification OTP: ${otpCode}`);

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công! Vui lòng kiểm tra mã xác thực email.',
      userId,
      email,
      otpCode // Returning the code for testing & simulated notifications
    });
  } catch (error) {
    console.error('Error during registration:', error);
    return res.status(500).json({ message: 'Đã xảy ra lỗi hệ thống trong quá trình đăng ký.' });
  }
};

/**
 * Verify Email OTP
 */
export const verifyEmail = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ email và mã OTP.' });
  }

  try {
    const pool = await poolPromise;

    // Find User
    const userResult = await pool.request()
      .input('email', sql.VarChar, email)
      .query('SELECT user_id, is_email_verified FROM users WHERE email = @email');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản với email này.' });
    }

    const user = userResult.recordset[0];
    const userId = user.user_id;

    if (user.is_email_verified) {
      return res.status(200).json({ success: true, message: 'Email đã được xác thực trước đó.' });
    }

    // Verify OTP code
    const otpResult = await pool.request()
      .input('userId', sql.Int, userId)
      .input('code', sql.VarChar, code)
      .query(`
        SELECT TOP 1 verification_id, expired_at
        FROM email_verifications
        WHERE user_id = @userId AND verification_code = @code AND is_used = 0
        ORDER BY created_at DESC
      `);

    if (otpResult.recordset.length === 0) {
      return res.status(400).json({ message: 'Mã xác thực không hợp lệ hoặc đã được sử dụng.' });
    }

    const { verification_id, expired_at } = otpResult.recordset[0];

    // Check expiration
    if (new Date() > new Date(expired_at)) {
      return res.status(400).json({ message: 'Mã xác thực đã hết hạn.' });
    }

    // Update email_verifications and users table
    await pool.request()
      .input('verificationId', sql.Int, verification_id)
      .query('UPDATE email_verifications SET is_used = 1 WHERE verification_id = @verificationId');

    await pool.request()
      .input('userId', sql.Int, userId)
      .query('UPDATE users SET is_email_verified = 1 WHERE user_id = @userId');

    return res.status(200).json({
      success: true,
      message: 'Xác thực email thành công! Bây giờ bạn đã có thể đăng nhập.'
    });
  } catch (error) {
    console.error('Error during email verification:', error);
    return res.status(500).json({ message: 'Đã xảy ra lỗi khi xác minh email.' });
  }
};

/**
 * Login User
 */
export const login = async (req, res) => {
  const { email, password } = req.body;
  console.log('Login Request Body:', { email, password });

  if (!email || !password) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ email và mật khẩu.' });
  }

  try {

    const pool = await poolPromise;

    // Get user from DB
    const userResult = await pool.request()
      .input('email', sql.VarChar, email)
      .query('SELECT * FROM users WHERE email = @email');

    if (userResult.recordset.length === 0) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu không chính xác.' });
    }

    const user = userResult.recordset[0];

    // Check if account status is Active
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ message: `Tài khoản của bạn đã bị khóa hoặc đình chỉ (${user.status}).` });
    }

    // Match password
    let isPasswordValid = false;
    
    // Fallback for fixed admin accounts that might have plaintext passwords in DB
    if (user.role_default === 'ADMIN' && password === user.password_hash) {
      isPasswordValid = true;
    } else {
      isPasswordValid = bcrypt.compareSync(password, user.password_hash);
    }

    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Email hoặc mật khẩu không chính xác.' });
    }

    // Check email verification status
    if (!user.is_email_verified) {
      // Re-trigger OTP code generation just in case they need to verify
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiredAt = new Date();
      expiredAt.setMinutes(expiredAt.getMinutes() + 10);

      await pool.request()
        .input('userId', sql.Int, user.user_id)
        .input('otpCode', sql.VarChar, otpCode)
        .input('expiredAt', sql.DateTime, expiredAt)
        .query(`
          INSERT INTO email_verifications (user_id, verification_code, expired_at, is_used)
          VALUES (@userId, @otpCode, @expiredAt, 0)
        `);

      // Send Real Verification OTP Email
      await sendOTPEmail(user.email, otpCode, user.full_name);

      return res.status(401).json({
        success: false,
        isEmailVerified: false,
        message: 'Tài khoản chưa xác thực email. Hệ thống đã gửi mã OTP mới.',
        email: user.email,
        otpCode // Return code for simulation/testing convenience
      });
    }

    // Fetch user roles
    const rolesResult = await pool.request()
      .input('userId', sql.Int, user.user_id)
      .query(`
        SELECT r.role_name 
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.role_id
        WHERE ur.user_id = @userId
      `);

    const roles = rolesResult.recordset.map(r => r.role_name);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role_default,
        roles: roles
      },
      process.env.JWT_SECRET || 'fjms_secret_key_extremely_secure_123!@#',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Save refresh token (optional)
    await pool.request()
      .input('userId', sql.Int, user.user_id)
      .input('token', sql.VarChar, token)
      .query('UPDATE users SET refresh_token = @token WHERE user_id = @userId');

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: {
        userId: user.user_id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        roleDefault: user.role_default,
        roles: roles
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ message: 'Đã xảy ra lỗi trong quá trình đăng nhập.' });
  }
};

