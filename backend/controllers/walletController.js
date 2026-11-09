import { sql, poolPromise } from '../config/db.js';

export const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('user_id', userId)
      .query('SELECT balance FROM Wallet WHERE user_id = @user_id');

    if (result.recordset.length === 0) {
      return res.status(200).json({ balance: 0 });
    }
    
    return res.status(200).json({ balance: result.recordset[0].balance });
  } catch (error) {
    console.error('getWalletBalance error:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy số dư ví.' });
  }
};

export const getWallet = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('user_id', userId)
      .query('SELECT * FROM Wallet WHERE user_id = @user_id');

    if (result.recordset.length === 0) {
      // Create empty wallet if it doesn't exist
      await pool.request()
        .input('user_id', userId)
        .input('balance', 0)
        .query('INSERT INTO Wallet (user_id, balance) VALUES (@user_id, @balance)');
        
      const newWallet = await pool.request()
        .input('user_id', userId)
        .query('SELECT * FROM Wallet WHERE user_id = @user_id');
        
      return res.status(200).json(newWallet.recordset[0]);
    }
    
    return res.status(200).json(result.recordset[0]);
  } catch (error) {
    console.error('getWallet error:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin ví.' });
  }
};

export const depositFunds = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Số tiền nạp phải lớn hơn 0.' });
    }

    const pool = await poolPromise;
    
    // Check if wallet exists
    let walletResult = await pool.request()
      .input('user_id', userId)
      .query('SELECT * FROM Wallet WHERE user_id = @user_id');
      
    if (walletResult.recordset.length === 0) {
      await pool.request()
        .input('user_id', userId)
        .input('balance', 0)
        .query('INSERT INTO Wallet (user_id, balance) VALUES (@user_id, @balance)');
      walletResult = await pool.request()
        .input('user_id', userId)
        .query('SELECT * FROM Wallet WHERE user_id = @user_id');
    }

    const walletId = walletResult.recordset[0].wallet_id;

    // Perform deposit: Update balance and insert transaction
    const poolResolved = await poolPromise;
    const transaction = new sql.Transaction(poolResolved);
    await transaction.begin();

    try {
      const request = transaction.request();
      
      // Update balance
      await request
        .input('wallet_id', sql.Int, walletId)
        .input('amount', sql.Decimal(18, 2), amount)
        .query('UPDATE Wallet SET balance = balance + @amount, updated_at = GETDATE() WHERE wallet_id = @wallet_id');

      // Insert transaction
      await request
        .input('transaction_type', sql.NVarChar(50), 'DEPOSIT')
        .input('description', sql.NVarChar(255), 'Nạp tiền vào ví')
        .query('INSERT INTO WalletTransaction (wallet_id, transaction_type, amount, description) VALUES (@wallet_id, @transaction_type, @amount, @description)');

      await transaction.commit();
      
      // Get updated wallet
      const updatedWallet = await pool.request()
        .input('wallet_id', walletId)
        .query('SELECT balance FROM Wallet WHERE wallet_id = @wallet_id');

      return res.status(200).json({ 
        message: 'Nạp tiền thành công.',
        balance: updatedWallet.recordset[0].balance
      });
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('depositFunds error:', error);
    res.status(500).json({ message: 'Lỗi server khi nạp tiền: ' + (error.message || error.toString()) });
  }
};
