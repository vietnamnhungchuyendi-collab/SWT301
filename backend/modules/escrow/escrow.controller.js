import { sql, poolPromise } from '../../config/db.js';

export const depositEscrow = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { projectId, amount } = req.body;

    if (!projectId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Thông tin ký quỹ không hợp lệ' });
    }

    const pool = await poolPromise;

    // 1. Check Employer Wallet Balance
    let walletResult = await pool.request()
      .input('user_id', sql.Int, employerId)
      .query('SELECT wallet_id, balance FROM Wallet WHERE user_id = @user_id');

    if (walletResult.recordset.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy ví của bạn' });
    }

    const wallet = walletResult.recordset[0];
    if (wallet.balance < amount) {
      return res.status(400).json({ message: 'Số dư ví không đủ để ký quỹ' });
    }

    // 2. Perform transaction: Deduct Wallet, Add Escrow, Insert Transactions
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = transaction.request();

      // Deduct from Wallet
      await request
        .input('wallet_id', sql.Int, wallet.wallet_id)
        .input('amount', sql.Decimal(18, 2), amount)
        .query('UPDATE Wallet SET balance = balance - @amount, updated_at = GETDATE() WHERE wallet_id = @wallet_id');

      // Insert WalletTransaction
      await request
        .input('transaction_type', sql.NVarChar(50), 'ESCROW_DEPOSIT')
        .input('description', sql.NVarChar(255), `Ký quỹ dự án #${projectId}`)
        .query("INSERT INTO WalletTransaction (wallet_id, transaction_type, amount, description, status) VALUES (@wallet_id, @transaction_type, -@amount, @description, 'COMPLETED')");

      // Insert EscrowAccounts
      await request
        .input('project_id', sql.Int, projectId)
        .input('employer_id', sql.Int, employerId)
        .query('INSERT INTO EscrowAccounts (project_id, employer_id, amount) VALUES (@project_id, @employer_id, @amount)');
      
      const escrowResult = await request.query('SELECT @@IDENTITY AS escrow_id');
      const escrowId = escrowResult.recordset[0].escrow_id;

      // Insert EscrowTransactions
      await request
        .input('escrow_id', sql.Int, escrowId)
        .input('type', sql.NVarChar(50), 'DEPOSIT')
        .query('INSERT INTO EscrowTransactions (escrow_id, amount, type) VALUES (@escrow_id, @amount, @type)');

      // Find the ACCEPTED proposal for this project to get the freelancer_id and proposal info
      const proposalRes = await request
        .query("SELECT TOP 1 proposal_id, freelancer_id, proposed_price FROM proposals WHERE project_id = @project_id AND status = 'ACCEPTED' ORDER BY created_at DESC");
      
      if (proposalRes.recordset.length > 0) {
        const prop = proposalRes.recordset[0];
        
        // Find project title
        const projectRes = await request
          .query("SELECT title FROM projects WHERE project_id = @project_id");
        const projectTitle = projectRes.recordset[0]?.title || 'Dự án';

        // Insert Contract
        await request
          .input('freelancer_id_val', sql.Int, prop.freelancer_id)
          .input('proposal_id_val', sql.Int, prop.proposal_id)
          .input('contract_title_val', sql.NVarChar, `Hợp đồng: ${projectTitle}`)
          .input('total_amount_val', sql.Decimal(18, 2), prop.proposed_price)
          .query(`
            INSERT INTO contracts (project_id, employer_id, freelancer_id, proposal_id, contract_title, total_amount, status, started_at, created_at, updated_at)
            VALUES (@project_id, @employer_id, @freelancer_id_val, @proposal_id_val, @contract_title_val, @total_amount_val, 'ACTIVE', SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME())
          `);
          
        // Update project status to IN_PROGRESS
        await request.query("UPDATE projects SET status = 'IN_PROGRESS' WHERE project_id = @project_id");
        
        // Delete all other proposals for this project
        await request.query("DELETE FROM proposals WHERE project_id = @project_id AND status <> 'ACCEPTED'");
      }

      await transaction.commit();

      res.status(200).json({ message: 'Ký quỹ thành công', escrowId });
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('depositEscrow error:', error);
    res.status(500).json({ message: 'Lỗi server khi ký quỹ.' });
  }
};

export const getEscrowByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('project_id', sql.Int, projectId)
      .query('SELECT * FROM EscrowAccounts WHERE project_id = @project_id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin ký quỹ cho dự án này' });
    }

    res.status(200).json(result.recordset[0]);
  } catch (error) {
    console.error('getEscrowByProject error:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin ký quỹ.' });
  }
};


export const releaseEscrow = async (req, res) => {
  try {
    const { projectId } = req.params;
    const clientId = req.user.id;

    const pool = await poolPromise;
    const escrowRes = await pool.request()
      .input('project_id', sql.Int, projectId)
      .query("SELECT * FROM EscrowAccounts WHERE project_id = @project_id AND status = 'FUNDED'");

    if (escrowRes.recordset.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy quỹ hợp lệ để giải ngân (có thể đã giải ngân rồi)' });
    }

    const escrow = escrowRes.recordset[0];
    if (escrow.employer_id !== clientId) {
      return res.status(403).json({ message: 'Bạn không có quyền giải ngân dự án này' });
    }

    // Get freelancer ID from contract
    const contractRes = await pool.request()
      .input('project_id2', sql.Int, projectId)
      .query("SELECT freelancer_id FROM contracts WHERE project_id = @project_id2");

    if (contractRes.recordset.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy hợp đồng hoặc Freelancer' });
    }
    const freelancerId = contractRes.recordset[0].freelancer_id;

    const amount = escrow.amount;
    const fee = amount * 0.05;
    const net = amount - fee;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = transaction.request();

      // Update Escrow Status
      await request
        .input('escrow_id', sql.Int, escrow.escrow_id)
        .query("UPDATE EscrowAccounts SET status = 'RELEASED' WHERE escrow_id = @escrow_id");

      // Escrow Transaction
      await request
        .input('escrow_id_tr', sql.Int, escrow.escrow_id)
        .input('amount', sql.Decimal(18,2), amount)
        .input('type', sql.NVarChar(50), 'RELEASE')
        .query("INSERT INTO EscrowTransactions (escrow_id, amount, type) VALUES (@escrow_id_tr, @amount, @type)");

      // Check Freelancer Wallet
      let fwRes = await request
        .input('freelancer_id', sql.Int, freelancerId)
        .query("SELECT wallet_id FROM Wallet WHERE user_id = @freelancer_id");
      
      let walletId;
      if (fwRes.recordset.length === 0) {
        const insertW = await request
          .input('freelancer_id2', sql.Int, freelancerId)
          .query("INSERT INTO Wallet (user_id, balance) OUTPUT INSERTED.wallet_id VALUES (@freelancer_id2, 0)");
        walletId = insertW.recordset[0].wallet_id;
      } else {
        walletId = fwRes.recordset[0].wallet_id;
      }

      // Add to Wallet (Net Amount)
      await request
        .input('wallet_id', sql.Int, walletId)
        .input('net_amount', sql.Decimal(18,2), net)
        .query("UPDATE Wallet SET balance = balance + @net_amount, updated_at = GETDATE() WHERE wallet_id = @wallet_id");

      // Wallet Transactions
      await request
        .input('wallet_id_tr1', sql.Int, walletId)
        .input('trans_type1', sql.NVarChar(50), 'ESCROW_RELEASE')
        .input('amount1', sql.Decimal(18,2), amount)
        .input('desc1', sql.NVarChar(255), `Nhận tiền giải ngân dự án #${projectId}`)
        .query("INSERT INTO WalletTransaction (wallet_id, transaction_type, amount, description) VALUES (@wallet_id_tr1, @trans_type1, @amount1, @desc1)");

      await request
        .input('wallet_id_tr2', sql.Int, walletId)
        .input('fee', sql.Decimal(18,2), fee)
        .input('trans_type2', sql.NVarChar(50), 'SERVICE_FEE')
        .input('desc2', sql.NVarChar(255), `Phí dịch vụ 5% dự án #${projectId}`)
        .query("INSERT INTO WalletTransaction (wallet_id, transaction_type, amount, description) VALUES (@wallet_id_tr2, @trans_type2, -@fee, @desc2)");

      // Insert Service Fee
      await request
        .input('project_id_sf', sql.Int, projectId)
        .input('client_id_sf', sql.Int, clientId)
        .input('freelancer_id_sf', sql.Int, freelancerId)
        .input('amount_sf', sql.Decimal(18,2), amount)
        .input('fee_sf', sql.Decimal(18,2), fee)
        .input('net_amount_sf', sql.Decimal(18,2), net)
        .query("INSERT INTO ServiceFees (project_id, client_id, freelancer_id, original_amount, fee_amount, net_amount) VALUES (@project_id_sf, @client_id_sf, @freelancer_id_sf, @amount_sf, @fee_sf, @net_amount_sf)");

      await transaction.commit();
      res.status(200).json({ message: 'Giải ngân thành công', netAmount: net });
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('releaseEscrow error:', error);
    res.status(500).json({ message: 'Lỗi server khi giải ngân.' });
  }
};

export const refundEscrow = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { refundAmount } = req.body; 

    const pool = await poolPromise;
    const escrowRes = await pool.request()
      .input('project_id', sql.Int, projectId)
      .query("SELECT * FROM EscrowAccounts WHERE project_id = @project_id AND status = 'FUNDED'");

    if (escrowRes.recordset.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy quỹ hợp lệ để hoàn tiền' });
    }

    const escrow = escrowRes.recordset[0];
    const amountToRefund = refundAmount ? parseFloat(refundAmount) : escrow.amount;

    if (amountToRefund <= 0 || amountToRefund > escrow.amount) {
      return res.status(400).json({ message: 'Số tiền hoàn không hợp lệ' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = transaction.request();

      if (amountToRefund === escrow.amount) {
        await request
          .input('escrow_id', sql.Int, escrow.escrow_id)
          .query("UPDATE EscrowAccounts SET status = 'REFUNDED' WHERE escrow_id = @escrow_id");
      } else {
        await request
          .input('escrow_id_partial', sql.Int, escrow.escrow_id)
          .input('amountToRefund', sql.Decimal(18,2), amountToRefund)
          .query("UPDATE EscrowAccounts SET amount = amount - @amountToRefund WHERE escrow_id = @escrow_id_partial");
      }

      await request
        .input('escrow_id_tr', sql.Int, escrow.escrow_id)
        .input('amountToRefund_tr', sql.Decimal(18,2), amountToRefund)
        .input('type', sql.NVarChar(50), 'REFUND')
        .query("INSERT INTO EscrowTransactions (escrow_id, amount, type) VALUES (@escrow_id_tr, @amountToRefund_tr, @type)");

      // Refund to Client Wallet
      let cwRes = await request
        .input('employer_id', sql.Int, escrow.employer_id)
        .query("SELECT wallet_id FROM Wallet WHERE user_id = @employer_id");
        
      if (cwRes.recordset.length > 0) {
        const walletId = cwRes.recordset[0].wallet_id;
        await request
          .input('wallet_id', sql.Int, walletId)
          .input('amountToRefund_w', sql.Decimal(18,2), amountToRefund)
          .query("UPDATE Wallet SET balance = balance + @amountToRefund_w, updated_at = GETDATE() WHERE wallet_id = @wallet_id");

        await request
          .input('wallet_id_tr', sql.Int, walletId)
          .input('trans_type', sql.NVarChar(50), 'ESCROW_REFUND')
          .input('amountToRefund_wtr', sql.Decimal(18,2), amountToRefund)
          .input('desc', sql.NVarChar(255), `Hoàn tiền dự án #${projectId}`)
          .query("INSERT INTO WalletTransaction (wallet_id, transaction_type, amount, description) VALUES (@wallet_id_tr, @trans_type, @amountToRefund_wtr, @desc)");
      }

      await transaction.commit();
      res.status(200).json({ message: 'Hoàn tiền thành công', amount: amountToRefund });
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('refundEscrow error:', error);
    res.status(500).json({ message: 'Lỗi server khi hoàn tiền.' });
  }
};
