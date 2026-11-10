import jwt from 'jsonwebtoken';
import { sql, poolPromise } from '../config/db.js';

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Không có quyền truy cập. Vui lòng đăng nhập.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', sql.Int, decoded.userId)
      .query('SELECT status FROM users WHERE user_id = @userId');

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'Người dùng không tồn tại.' });
    }

    const userStatus = result.recordset[0].status;
    if (userStatus !== 'ACTIVE') {
      return res.status(403).json({ message: 'Tài khoản của bạn đã bị khóa bởi quản trị viên.' });
    }

    req.user = { ...decoded, id: decoded.userId };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
};

export const verifyAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Không có quyền truy cập. Vui lòng đăng nhập.' });
  }

  const role = req.user.role || req.user.roleDefault;
  const roles = req.user.roles || [];

  if (role !== 'ADMIN' && !roles.includes('ADMIN')) {
    return res.status(403).json({ message: 'Chỉ Admin mới được phép thực hiện tác vụ này.' });
  }

  next();
};
