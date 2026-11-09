import { poolPromise } from '../config/db.js';

function removeVietnameseTones(str) {
  if (!str) return '';
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
  str = str.replace(/\u02C6|\u0306|\u031B/g, "");
  str = str.trim().replace(/\s+/g, ' ');
  return str.toUpperCase();
}

export const getBankAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('user_id', userId)
      .query('SELECT * FROM BankAccount WHERE user_id = @user_id');

    if (result.recordset.length === 0) {
      return res.status(200).json(null);
    }
    
    return res.status(200).json(result.recordset[0]);
  } catch (error) {
    console.error('getBankAccount error:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin tài khoản ngân hàng.' });
  }
};

export const createBankAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bank_name, account_number, account_holder_name } = req.body;

    if (!bank_name || !account_number || !account_holder_name) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin ngân hàng.' });
    }

    const pool = await poolPromise;
    
    // 1. KYC Validation: Check if account_holder_name matches user's full_name
    const userResult = await pool.request()
      .input('user_id', userId)
      .query('SELECT full_name FROM users WHERE user_id = @user_id');

    if (userResult.recordset.length > 0) {
      const fullName = userResult.recordset[0].full_name;
      const normalizedFullName = removeVietnameseTones(fullName);
      const normalizedHolderName = removeVietnameseTones(account_holder_name);
      
      if (normalizedFullName !== normalizedHolderName) {
        return res.status(400).json({ message: `Lỗi định danh KYC: Tên chủ tài khoản ngân hàng phải trùng khớp với tên thật đăng ký trên hệ thống (${normalizedFullName}).` });
      }
    }

    // 2. Global Uniqueness Validation: Check if bank account is used by someone else
    const uniqueCheck = await pool.request()
      .input('bank_name', bank_name)
      .input('account_number', account_number)
      .query('SELECT user_id FROM BankAccount WHERE bank_name = @bank_name AND account_number = @account_number');
      
    if (uniqueCheck.recordset.length > 0 && uniqueCheck.recordset[0].user_id !== userId) {
      return res.status(400).json({ message: 'Lỗi bảo mật: Tài khoản ngân hàng này đã được liên kết với một người dùng khác trong hệ thống.' });
    }

    // Check if a bank account already exists
    const checkResult = await pool.request()
      .input('user_id', userId)
      .query('SELECT bank_account_id FROM BankAccount WHERE user_id = @user_id');

    if (checkResult.recordset.length > 0) {
      return res.status(400).json({ message: 'Người dùng đã có tài khoản ngân hàng. Vui lòng cập nhật thay vì tạo mới.' });
    }

    const result = await pool.request()
      .input('user_id', userId)
      .input('bank_name', bank_name)
      .input('account_number', account_number)
      .input('account_holder_name', account_holder_name)
      .query(`
        INSERT INTO BankAccount (user_id, bank_name, account_number, account_holder_name) 
        OUTPUT INSERTED.*
        VALUES (@user_id, @bank_name, @account_number, @account_holder_name)
      `);

    return res.status(201).json({
      message: 'Thêm tài khoản ngân hàng thành công.',
      bankAccount: result.recordset[0]
    });
  } catch (error) {
    console.error('createBankAccount error:', error);
    res.status(500).json({ message: 'Lỗi server khi thêm tài khoản ngân hàng.' });
  }
};

export const updateBankAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { bank_name, account_number, account_holder_name } = req.body;

    if (!bank_name || !account_number || !account_holder_name) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin ngân hàng.' });
    }

    const pool = await poolPromise;
    
    // 1. KYC Validation: Check if account_holder_name matches user's full_name
    const userResult = await pool.request()
      .input('user_id', userId)
      .query('SELECT full_name FROM users WHERE user_id = @user_id');

    if (userResult.recordset.length > 0) {
      const fullName = userResult.recordset[0].full_name;
      const normalizedFullName = removeVietnameseTones(fullName);
      const normalizedHolderName = removeVietnameseTones(account_holder_name);
      
      if (normalizedFullName !== normalizedHolderName) {
        return res.status(400).json({ message: `Lỗi định danh KYC: Tên chủ tài khoản ngân hàng phải trùng khớp với tên thật đăng ký trên hệ thống (${normalizedFullName}).` });
      }
    }

    // 2. Global Uniqueness Validation: Check if bank account is used by someone else
    const uniqueCheck = await pool.request()
      .input('bank_name', bank_name)
      .input('account_number', account_number)
      .query('SELECT user_id FROM BankAccount WHERE bank_name = @bank_name AND account_number = @account_number');
      
    if (uniqueCheck.recordset.length > 0 && uniqueCheck.recordset[0].user_id !== userId) {
      return res.status(400).json({ message: 'Lỗi bảo mật: Tài khoản ngân hàng này đã được liên kết với một người dùng khác trong hệ thống.' });
    }

    // Check if the bank account exists and belongs to the user
    const checkResult = await pool.request()
      .input('bank_account_id', id)
      .input('user_id', userId)
      .query('SELECT * FROM BankAccount WHERE bank_account_id = @bank_account_id AND user_id = @user_id');

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản ngân hàng.' });
    }

    const result = await pool.request()
      .input('bank_account_id', id)
      .input('user_id', userId)
      .input('bank_name', bank_name)
      .input('account_number', account_number)
      .input('account_holder_name', account_holder_name)
      .query(`
        UPDATE BankAccount 
        SET bank_name = @bank_name, 
            account_number = @account_number, 
            account_holder_name = @account_holder_name,
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE bank_account_id = @bank_account_id AND user_id = @user_id
      `);

    return res.status(200).json({
      message: 'Cập nhật tài khoản ngân hàng thành công.',
      bankAccount: result.recordset[0]
    });
  } catch (error) {
    console.error('updateBankAccount error:', error);
    res.status(500).json({ message: 'Lỗi server khi cập nhật tài khoản ngân hàng.' });
  }
};
