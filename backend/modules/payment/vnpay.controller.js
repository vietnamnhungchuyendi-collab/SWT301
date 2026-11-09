import { sql, poolPromise } from '../../config/db.js';
import { createPaymentUrl, verifyReturnUrl } from './vnpay.service.js';

export const createPayment = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Số tiền không hợp lệ' });
    }

    const userId = req.user.id;
    // OrderInfo: UserID_Amount_Timestamp
    const orderInfo = `Deposit_${userId}_${amount}_${Date.now()}`;
    // The frontend return URL (where user is redirected after paying)
    const returnUrl = process.env.VNP_RETURNURL || 'http://localhost:5173/vnpay-return';

    const vnpUrl = createPaymentUrl(req, amount, orderInfo, returnUrl);
    
    return res.status(200).json({ paymentUrl: vnpUrl });
  } catch (error) {
    console.error('createPayment error:', error);
    res.status(500).json({ message: 'Lỗi server khi tạo link thanh toán.' });
  }
};

export const vnpayReturn = async (req, res) => {
  try {
    const vnp_Params = req.query;
    
    const isValid = verifyReturnUrl(vnp_Params);
    if (!isValid) {
      return res.status(400).json({ message: 'Chữ ký không hợp lệ', code: '97' });
    }

    const responseCode = vnp_Params['vnp_ResponseCode'];
    if (responseCode !== '00') {
      return res.status(400).json({ message: 'Giao dịch không thành công', code: responseCode });
    }

    // Extract info
    const orderInfo = vnp_Params['vnp_OrderInfo']; // Deposit_userId_amount_timestamp
    const parts = orderInfo.split('_');
    const userId = parseInt(parts[1], 10);
    const amount = parseFloat(parts[2]);

    const pool = await poolPromise;

    // Check if wallet exists
    let walletResult = await pool.request()
      .input('user_id', sql.Int, userId)
      .query('SELECT * FROM Wallet WHERE user_id = @user_id');
      
    if (walletResult.recordset.length === 0) {
      await pool.request()
        .input('user_id', sql.Int, userId)
        .input('balance', sql.Decimal(18,2), 0)
        .query('INSERT INTO Wallet (user_id, balance) VALUES (@user_id, @balance)');
      walletResult = await pool.request()
        .input('user_id', sql.Int, userId)
        .query('SELECT * FROM Wallet WHERE user_id = @user_id');
    }
    const walletId = walletResult.recordset[0].wallet_id;

    // Check if transaction was already processed (using vnp_TxnRef)
    const txnRef = vnp_Params['vnp_TxnRef'];
    const checkTx = await pool.request()
      .input('description', sql.NVarChar(255), `VNPay Ref: ${txnRef}`)
      .query('SELECT transaction_id FROM WalletTransaction WHERE description = @description');

    if (checkTx.recordset.length > 0) {
      return res.status(200).json({ message: 'Giao dịch đã được xử lý trước đó', code: '00' });
    }

    // Process Transaction
    const transaction = new sql.Transaction(pool);
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
        .input('description', sql.NVarChar(255), `VNPay Ref: ${txnRef}`)
        .query("INSERT INTO WalletTransaction (wallet_id, transaction_type, amount, description, status) VALUES (@wallet_id, @transaction_type, @amount, @description, 'COMPLETED')");

      await transaction.commit();
      
      return res.status(200).json({ message: 'Nạp tiền VNPay thành công', code: '00' });
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('vnpayReturn error:', error);
    res.status(500).json({ message: 'Lỗi server khi xử lý kết quả VNPay.' });
  }
};
