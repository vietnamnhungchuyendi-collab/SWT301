import { sql, poolPromise } from '../../config/db.js';

export const requestWithdrawal = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bank_account_id, amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Số tiền rút phải lớn hơn 0.' });
    }

    if (!bank_account_id) {
      return res.status(400).json({ message: 'Vui lòng chọn tài khoản ngân hàng.' });
    }

    const pool = await poolPromise;

    // Verify wallet and balance
    const walletResult = await pool.request()
      .input('user_id', userId)
      .query('SELECT * FROM Wallet WHERE user_id = @user_id');

    if (walletResult.recordset.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy ví của người dùng.' });
    }

    const wallet = walletResult.recordset[0];
    if (wallet.balance < amount) {
      return res.status(400).json({ message: 'Số dư ví không đủ để rút số tiền này.' });
    }

    // Verify bank account ownership
    const bankAccountResult = await pool.request()
      .input('bank_account_id', bank_account_id)
      .input('user_id', userId)
      .query('SELECT * FROM BankAccount WHERE bank_account_id = @bank_account_id AND user_id = @user_id');

    if (bankAccountResult.recordset.length === 0) {
      return res.status(403).json({ message: 'Tài khoản ngân hàng không hợp lệ hoặc không thuộc về bạn.' });
    }

    // Insert Withdrawal Request (Status = PENDING)
    await pool.request()
      .input('wallet_id', wallet.wallet_id)
      .input('bank_account_id', bank_account_id)
      .input('amount', amount)
      .input('status', 'PENDING')
      .query(`
        INSERT INTO WithdrawalRequests (wallet_id, bank_account_id, amount, status) 
        VALUES (@wallet_id, @bank_account_id, @amount, @status)
      `);

    return res.status(201).json({ message: 'Đã gửi yêu cầu rút tiền. Vui lòng chờ admin phê duyệt.' });
  } catch (error) {
    console.error('requestWithdrawal error:', error);
    res.status(500).json({ message: 'Lỗi server khi tạo yêu cầu rút tiền.' });
  }
};

export const getMyWithdrawals = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;

    const result = await pool.request()
      .input('user_id', userId)
      .query(`
        SELECT w.*, b.bank_name, b.account_number 
        FROM WithdrawalRequests w
        JOIN Wallet wal ON w.wallet_id = wal.wallet_id
        JOIN BankAccount b ON w.bank_account_id = b.bank_account_id
        WHERE wal.user_id = @user_id
        ORDER BY w.created_at DESC
      `);

    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error('getMyWithdrawals error:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy lịch sử rút tiền.' });
  }
};

export const getAllWithdrawals = async (req, res) => {
  try {
    // Note: Assuming there is some check that caller is Admin. 
    // Usually via middleware, but for safety can check role if available.
    // if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    
    const pool = await poolPromise;

    const result = await pool.request()
      .query(`
        SELECT w.*, b.bank_name, b.account_number, b.account_holder_name, wal.user_id
        FROM WithdrawalRequests w
        JOIN Wallet wal ON w.wallet_id = wal.wallet_id
        JOIN BankAccount b ON w.bank_account_id = b.bank_account_id
        ORDER BY w.created_at DESC
      `);

    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error('getAllWithdrawals error:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách yêu cầu rút tiền.' });
  }
};

export const approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    
    const poolResolved = await poolPromise;
    const transaction = new sql.Transaction(poolResolved);
    await transaction.begin();

    try {
      const request = transaction.request();
      
      // Get the withdrawal request
      const withdrawalResult = await request
        .input('withdrawal_id', sql.Int, id)
        .query('SELECT * FROM WithdrawalRequests WHERE withdrawal_id = @withdrawal_id');
        
      if (withdrawalResult.recordset.length === 0) {
        throw new Error('Không tìm thấy yêu cầu rút tiền.');
      }
      
      const withdrawal = withdrawalResult.recordset[0];
      
      if (withdrawal.status !== 'PENDING') {
        throw new Error('Yêu cầu này đã được xử lý.');
      }

      // Check balance again
      const walletResult = await request
        .input('wallet_id', sql.Int, withdrawal.wallet_id)
        .query('SELECT balance FROM Wallet WHERE wallet_id = @wallet_id');
        
      if (walletResult.recordset.length === 0 || walletResult.recordset[0].balance < withdrawal.amount) {
        throw new Error('Số dư ví không đủ để phê duyệt yêu cầu này.');
      }

      // 1. Update WithdrawalRequests status
      await request
        .query(`
          UPDATE WithdrawalRequests 
          SET status = 'APPROVED', updated_at = GETDATE() 
          WHERE withdrawal_id = @withdrawal_id
        `);

      // 2. Deduct balance from Wallet
      await request
        .input('amount', sql.Decimal(18,2), withdrawal.amount)
        .query(`
          UPDATE Wallet 
          SET balance = balance - @amount, updated_at = GETDATE() 
          WHERE wallet_id = @wallet_id
        `);

      // 3. Insert WalletTransaction log
      await request
        .input('transaction_type', sql.NVarChar(50), 'WITHDRAWAL')
        .input('description', sql.NVarChar(255), 'Rút tiền về tài khoản ngân hàng')
        .query(`
          INSERT INTO WalletTransaction (wallet_id, transaction_type, amount, description, status) 
          VALUES (@wallet_id, @transaction_type, @amount, @description, 'COMPLETED')
        `);

      await transaction.commit();
      return res.status(200).json({ message: 'Đã phê duyệt yêu cầu rút tiền thành công.' });
    } catch (txError) {
      await transaction.rollback();
      return res.status(400).json({ message: txError.message || 'Lỗi giao dịch khi phê duyệt.' });
    }
  } catch (error) {
    console.error('approveWithdrawal error:', error);
    res.status(500).json({ message: 'Lỗi server khi phê duyệt yêu cầu rút tiền.' });
  }
};

export const rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    
    const result = await pool.request()
      .input('withdrawal_id', id)
      .query(`
        UPDATE WithdrawalRequests 
        SET status = 'REJECTED', updated_at = GETDATE()
        WHERE withdrawal_id = @withdrawal_id AND status = 'PENDING'
      `);
      
    if (result.rowsAffected[0] === 0) {
      return res.status(400).json({ message: 'Yêu cầu không hợp lệ hoặc đã được xử lý.' });
    }
    
    return res.status(200).json({ message: 'Đã từ chối yêu cầu rút tiền.' });
  } catch (error) {
    console.error('rejectWithdrawal error:', error);
    res.status(500).json({ message: 'Lỗi server khi từ chối yêu cầu.' });
  }
};
