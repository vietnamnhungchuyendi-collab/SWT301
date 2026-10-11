import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql, poolPromise } from '../config/db.js';
import { sendOTPEmail } from '../utils/emailService.js';

export const resetPassword = async (req, res) => {
  const { email, otpCode, newPassword } = req.body;

  if (!email || !otpCode || !newPassword) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ email, mã OTP và mật khẩu mới.' });
  }

  // Validate new password strength
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({ 
      message: 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm ít nhất: 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt.' 
    });
  }

  try {
    const pool = await poolPromise;

    // Find User
    const userResult = await pool.request()
      .input('email', sql.VarChar, email)
      .query('SELECT user_id FROM users WHERE email = @email');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản với email này.' });
    }

    const userId = userResult.recordset[0].user_id;

    // Verify Reset Token
    const tokenResult = await pool.request()
      .input('userId', sql.Int, userId)
      .input('resetToken', sql.VarChar, otpCode)
      .query(`
        SELECT TOP 1 reset_id, expired_at
        FROM password_reset_tokens
        WHERE user_id = @userId AND reset_token = @resetToken AND is_used = 0
        ORDER BY created_at DESC
      `);

    if (tokenResult.recordset.length === 0) {
      return res.status(400).json({ message: 'Mã xác nhận không hợp lệ hoặc đã được sử dụng.' });
    }

    const { reset_id, expired_at } = tokenResult.recordset[0];

    if (new Date() > new Date(expired_at)) {
      return res.status(400).json({ message: 'Mã xác nhận đã hết hạn.' });
    }

    // Hash new password
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(newPassword, salt);

    // Update password
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('passwordHash', sql.VarChar, passwordHash)
      .query('UPDATE users SET password_hash = @passwordHash WHERE user_id = @userId');

    // Mark token as used
    await pool.request()
      .input('resetId', sql.Int, reset_id)
      .query('UPDATE password_reset_tokens SET is_used = 1 WHERE reset_id = @resetId');

    return res.status(200).json({
      success: true,
      message: 'Mật khẩu đã được đặt lại thành công. Bạn có thể đăng nhập ngay bây giờ.'
    });

  } catch (error) {
    console.error('Error during resetPassword:', error);
    return res.status(500).json({ message: 'Đã xảy ra lỗi hệ thống khi đặt lại mật khẩu.' });
  }
};

