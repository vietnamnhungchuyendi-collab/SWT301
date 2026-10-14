import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql, poolPromise } from '../config/db.js';
import { sendOTPEmail } from '../utils/emailService.js';

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

