import { sql, poolPromise } from '../../config/db.js';

export const getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    let { page = 1, limit = 10, type = '' } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);
    const offset = (page - 1) * limit;

    const pool = await poolPromise;
    
    // First, verify user has a wallet
    const walletResult = await pool.request()
      .input('user_id', sql.Int, userId)
      .query('SELECT wallet_id FROM Wallet WHERE user_id = @user_id');

    if (walletResult.recordset.length === 0) {
      return res.status(200).json({ data: [], total: 0, page, limit });
    }
    
    const walletId = walletResult.recordset[0].wallet_id;

    // Build query conditionally based on type
    let queryStr = `SELECT * FROM WalletTransaction WHERE wallet_id = @wallet_id`;
    let countQueryStr = `SELECT COUNT(*) as total FROM WalletTransaction WHERE wallet_id = @wallet_id`;

    if (type) {
      queryStr += ` AND transaction_type = @type`;
      countQueryStr += ` AND transaction_type = @type`;
    }

    queryStr += ` ORDER BY created_at DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

    const request = pool.request()
      .input('wallet_id', sql.Int, walletId)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limit);

    if (type) {
      request.input('type', sql.NVarChar(50), type);
    }

    const transactions = await request.query(queryStr);
    const totalResult = await request.query(countQueryStr);

    res.status(200).json({
      data: transactions.recordset,
      total: totalResult.recordset[0].total,
      page,
      limit
    });
  } catch (error) {
    console.error('getTransactions error:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy lịch sử giao dịch.' });
  }
};
