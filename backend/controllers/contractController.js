import { sql, poolPromise } from '../config/db.js';

export const getContractById = async (req, res) => {
  try {
    const { contractId } = req.params;
    const userId = req.user.id;
    const pool = await poolPromise;

    const result = await pool.request()
      .input('contractId', sql.Int, contractId)
      .query(`
        SELECT c.*, p.title as project_title, p.description as project_description, p.deadline as project_deadline,
               u_emp.full_name as employer_name, u_free.full_name as freelancer_name,
               r.rating as review_rating, r.comment as review_comment,
               (SELECT TOP 1 status FROM work_submissions WHERE contract_id = c.contract_id ORDER BY submitted_at DESC) as latest_submission_status
        FROM contracts c
        JOIN projects p ON c.project_id = p.project_id
        JOIN users u_emp ON c.employer_id = u_emp.user_id
        JOIN users u_free ON c.freelancer_id = u_free.user_id
        LEFT JOIN reviews r ON c.contract_id = r.contract_id
        WHERE c.contract_id = @contractId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy hợp đồng.' });
    }

    const contract = result.recordset[0];
    if (contract.employer_id !== userId && contract.freelancer_id !== userId) {
      return res.status(403).json({ message: 'Bạn không có quyền xem hợp đồng này.' });
    }

    res.json({ success: true, contract });
  } catch (error) {
    console.error('Error in getContractById:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy chi tiết hợp đồng.' });
  }
};

export const getActiveContracts = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.query.role ? req.query.role.toUpperCase() : null;
    const pool = await poolPromise;

    let queryStr = `
      SELECT c.*, p.title as project_title, p.deadline as project_deadline,
             (SELECT TOP 1 status FROM work_submissions WHERE contract_id = c.contract_id ORDER BY submitted_at DESC) as latest_submission_status
      FROM contracts c
      JOIN projects p ON c.project_id = p.project_id
    `;

    if (role === 'EMPLOYER') {
      queryStr += ` WHERE c.employer_id = @userId`;
    } else if (role === 'FREELANCER') {
      queryStr += ` WHERE c.freelancer_id = @userId`;
    } else {
      queryStr += ` WHERE (c.employer_id = @userId OR c.freelancer_id = @userId)`;
    }

    queryStr += ` ORDER BY c.created_at DESC`;

    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(queryStr);

    res.json({ success: true, contracts: result.recordset });
  } catch (error) {
    console.error('Error in getActiveContracts:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách hợp đồng.' });
  }
};

export const getContractByProjectId = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const pool = await poolPromise;

    const result = await pool.request()
      .input('projectId', sql.Int, projectId)
      .input('userId', sql.Int, userId)
      .query(`
        SELECT c.*, p.title as project_title, p.deadline as project_deadline,
               u_emp.full_name as employer_name, u_free.full_name as freelancer_name,
               r.rating as review_rating, r.comment as review_comment,
               (SELECT TOP 1 status FROM work_submissions WHERE contract_id = c.contract_id ORDER BY submitted_at DESC) as latest_submission_status
        FROM contracts c
        JOIN projects p ON c.project_id = p.project_id
        JOIN users u_emp ON c.employer_id = u_emp.user_id
        JOIN users u_free ON c.freelancer_id = u_free.user_id
        LEFT JOIN reviews r ON c.contract_id = r.contract_id
        WHERE c.project_id = @projectId
          AND (c.employer_id = @userId OR c.freelancer_id = @userId)
        ORDER BY c.created_at DESC
      `);

    if (result.recordset.length === 0) {
      return res.json({ success: false, contract: null, message: 'Chưa có hợp đồng cho dự án này.' });
    }

    res.json({ success: true, contract: result.recordset[0] });
  } catch (error) {
    console.error('Error in getContractByProjectId:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy hợp đồng dự án.' });
  }
};

export const submitWork = async (req, res) => {
  try {
    const { contractId } = req.params;
    const freelancerId = req.user.id;
    const { notes, externalLink } = req.body;

    const pool = await poolPromise;

    // Verify contract and ownership
    const contractCheck = await pool.request()
      .input('contractId', sql.Int, contractId)
      .query('SELECT freelancer_id, status FROM contracts WHERE contract_id = @contractId');

    if (contractCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy hợp đồng.' });
    }

    const contract = contractCheck.recordset[0];
    if (contract.freelancer_id !== freelancerId) {
      return res.status(403).json({ message: 'Bạn không phải freelancer của hợp đồng này.' });
    }

    let fileUrl = null;
    if (req.files && req.files.length > 0) {
      const urls = req.files.map(f => `${req.protocol}://${req.get('host')}/uploads/${f.filename}`);
      fileUrl = urls.join(',');
    }

    let description = notes || '';
    if (externalLink) {
      description += `\n\n[Đường dẫn sản phẩm]: ${externalLink}`;
    }

    await pool.request()
      .input('contractId', sql.Int, contractId)
      .input('description', sql.NVarChar, description)
      .input('fileUrl', sql.NVarChar, fileUrl)
      .query(`
        INSERT INTO work_submissions (contract_id, description, file_url, status, submitted_at)
        VALUES (@contractId, @description, @fileUrl, 'SUBMITTED', SYSUTCDATETIME())
      `);

    res.status(201).json({ success: true, message: 'Nộp sản phẩm hoàn thành thành công!' });
  } catch (error) {
    console.error('Error in submitWork:', error);
    res.status(500).json({ message: 'Lỗi server khi nộp sản phẩm.' });
  }
};

export const getContractSubmissions = async (req, res) => {
  try {
    const { contractId } = req.params;
    const userId = req.user.id;
    const pool = await poolPromise;

    // Check permissions
    const contractCheck = await pool.request()
      .input('contractId', sql.Int, contractId)
      .query('SELECT employer_id, freelancer_id FROM contracts WHERE contract_id = @contractId');

    if (contractCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy hợp đồng.' });
    }

    const contract = contractCheck.recordset[0];
    if (contract.employer_id !== userId && contract.freelancer_id !== userId) {
      return res.status(403).json({ message: 'Bạn không có quyền xem thông tin này.' });
    }

    const result = await pool.request()
      .input('contractId', sql.Int, contractId)
      .query(`
        SELECT ws.*, r.revision_note, r.created_at as revision_requested_at, r.status as revision_status
        FROM work_submissions ws
        LEFT JOIN revisions r ON ws.submission_id = r.submission_id
        WHERE ws.contract_id = @contractId
        ORDER BY ws.submitted_at DESC
      `);

    res.json({ success: true, submissions: result.recordset });
  } catch (error) {
    console.error('Error in getContractSubmissions:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy lịch sử nộp sản phẩm.' });
  }
};

export const approveSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const employerId = req.user.id;

    const pool = await poolPromise;

    // 1. Get submission and contract details
    const subCheck = await pool.request()
      .input('submissionId', sql.Int, submissionId)
      .query(`
        SELECT ws.*, c.employer_id, c.freelancer_id, c.project_id, c.total_amount, c.contract_title
        FROM work_submissions ws
        JOIN contracts c ON ws.contract_id = c.contract_id
        WHERE ws.submission_id = @submissionId
      `);

    if (subCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy bài nộp.' });
    }

    const sub = subCheck.recordset[0];
    if (sub.employer_id !== employerId) {
      return res.status(403).json({ message: 'Bạn không có quyền duyệt bài nộp này.' });
    }

    if (sub.status === 'APPROVED') {
      return res.status(400).json({ message: 'Bài nộp này đã được duyệt trước đó.' });
    }

    // 2. Perform Transaction — each step uses its OWN request() to avoid duplicate param errors
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // Update submission status
      await tx.request()
        .input('submissionId', sql.Int, submissionId)
        .query("UPDATE work_submissions SET status = 'APPROVED', updated_at = SYSUTCDATETIME() WHERE submission_id = @submissionId");

      // Update contract status
      await tx.request()
        .input('contractId', sql.Int, sub.contract_id)
        .query("UPDATE contracts SET status = 'COMPLETED', completed_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME() WHERE contract_id = @contractId");

      // Update project status to COMPLETED
      await tx.request()
        .input('projectId', sql.Int, sub.project_id)
        .query("UPDATE projects SET status = 'COMPLETED', updated_at = SYSUTCDATETIME() WHERE project_id = @projectId");

      // Find EscrowAccount
      const escrowResult = await tx.request()
        .input('projectId', sql.Int, sub.project_id)
        .query("SELECT TOP 1 escrow_id, amount FROM EscrowAccounts WHERE project_id = @projectId AND status = 'FUNDED'");

      if (escrowResult.recordset.length > 0) {
        const escrow = escrowResult.recordset[0];

        // Update EscrowAccount status
        await tx.request()
          .input('escrowId', sql.Int, escrow.escrow_id)
          .query("UPDATE EscrowAccounts SET status = 'RELEASED' WHERE escrow_id = @escrowId");

        // Insert EscrowTransaction record
        await tx.request()
          .input('escrowId', sql.Int, escrow.escrow_id)
          .input('amount', sql.Decimal(18, 2), escrow.amount)
          .query("INSERT INTO EscrowTransactions (escrow_id, amount, type, status) VALUES (@escrowId, @amount, 'RELEASE', 'COMPLETED')");

        // Find or create Freelancer Wallet
        const walletRes = await tx.request()
          .input('freelancerId', sql.Int, sub.freelancer_id)
          .query("SELECT wallet_id FROM Wallet WHERE user_id = @freelancerId");

        let walletId;
        if (walletRes.recordset.length === 0) {
          // Create Wallet if not exists
          const newWalletRes = await tx.request()
            .input('freelancerId', sql.Int, sub.freelancer_id)
            .query("INSERT INTO Wallet (user_id, balance, created_at, updated_at) VALUES (@freelancerId, 0, GETDATE(), GETDATE()); SELECT SCOPE_IDENTITY() as wallet_id;");
          walletId = newWalletRes.recordset[0].wallet_id;
        } else {
          walletId = walletRes.recordset[0].wallet_id;
        }

        const escrowAmountNum = Number(escrow.amount);
        const serviceFee = escrowAmountNum * 0.05;
        const releaseAmount = escrowAmountNum - serviceFee;

        // Add funds to Freelancer Wallet (95%)
        await tx.request()
          .input('walletId', sql.Int, walletId)
          .input('amount', sql.Decimal(18, 2), releaseAmount)
          .query("UPDATE Wallet SET balance = balance + @amount, updated_at = GETDATE() WHERE wallet_id = @walletId");

        // Insert WalletTransaction record for Freelancer (95%)
        await tx.request()
          .input('walletId', sql.Int, walletId)
          .input('amount', sql.Decimal(18, 2), releaseAmount)
          .input('desc', sql.NVarChar(255), `Nhận thanh toán nghiệm thu hợp đồng (đã trừ 5% phí): ${sub.contract_title}`)
          .input('escrowId', sql.Int, escrow.escrow_id)
          .query("INSERT INTO WalletTransaction (wallet_id, transaction_type, amount, description, related_escrow_id, status) VALUES (@walletId, 'ESCROW_RELEASE', @amount, @desc, @escrowId, 'COMPLETED')");

        // Insert WalletTransaction record for Platform Service Fee (5%)
        await tx.request()
          .input('walletId', sql.Int, walletId)
          .input('feeAmount', sql.Decimal(18, 2), serviceFee)
          .input('descFee', sql.NVarChar(255), `Phí dịch vụ nền tảng (5%): ${sub.contract_title}`)
          .input('escrowId', sql.Int, escrow.escrow_id)
          .query("INSERT INTO WalletTransaction (wallet_id, transaction_type, amount, description, related_escrow_id, status) VALUES (@walletId, 'SERVICE_FEE', @feeAmount, @descFee, @escrowId, 'COMPLETED')");
      }

      await tx.commit();
      res.json({ success: true, message: 'Duyệt bài nộp và giải ngân ký quỹ thành công!' });
    } catch (txError) {
      await tx.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('Error in approveSubmission:', error);
    res.status(500).json({ message: 'Lỗi server khi duyệt sản phẩm.' });
  }
};

export const requestRevision = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const employerId = req.user.id;
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({ message: 'Vui lòng cung cấp nội dung yêu cầu chỉnh sửa.' });
    }

    const pool = await poolPromise;

    // Verify submission and contract ownership
    const subCheck = await pool.request()
      .input('submissionId', sql.Int, submissionId)
      .query(`
        SELECT ws.*, c.employer_id
        FROM work_submissions ws
        JOIN contracts c ON ws.contract_id = c.contract_id
        WHERE ws.submission_id = @submissionId
      `);

    if (subCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy bài nộp.' });
    }

    const sub = subCheck.recordset[0];
    if (sub.employer_id !== employerId) {
      return res.status(403).json({ message: 'Bạn không có quyền yêu cầu chỉnh sửa bài nộp này.' });
    }

    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // Update submission status to REVISION_REQUESTED (own request to avoid duplicate params)
      await tx.request()
        .input('submissionId', sql.Int, submissionId)
        .query("UPDATE work_submissions SET status = 'REVISION_REQUESTED', updated_at = SYSUTCDATETIME() WHERE submission_id = @submissionId");

      // Insert revision request record (own request)
      await tx.request()
        .input('submissionId', sql.Int, submissionId)
        .input('employerId', sql.Int, employerId)
        .input('note', sql.NVarChar, note)
        .query(`
          INSERT INTO revisions (submission_id, requested_by, revision_note, status, created_at)
          VALUES (@submissionId, @employerId, @note, 'REQUESTED', SYSUTCDATETIME())
        `);

      await tx.commit();
      res.json({ success: true, message: 'Gửi yêu cầu chỉnh sửa thành công!' });
    } catch (txError) {
      await tx.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('Error in requestRevision:', error);
    res.status(500).json({ message: 'Lỗi server khi yêu cầu chỉnh sửa.' });
  }
};

export const createContractReview = async (req, res) => {
  try {
    const { contractId } = req.params;
    const employerId = req.user.id;
    const { rating, comment } = req.body;

    const ratingVal = parseInt(rating);
    if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
      return res.status(400).json({ message: 'Điểm đánh giá phải từ 1 đến 5 sao.' });
    }

    const pool = await poolPromise;

    // 1. Verify contract status & owner
    const contractRes = await pool.request()
      .input('contractId', sql.Int, contractId)
      .query('SELECT employer_id, freelancer_id, status FROM contracts WHERE contract_id = @contractId');

    if (contractRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy hợp đồng.' });
    }

    const contract = contractRes.recordset[0];
    if (contract.employer_id !== employerId) {
      return res.status(403).json({ message: 'Bạn không có quyền đánh giá hợp đồng này.' });
    }

    if (contract.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'Chỉ có thể đánh giá sau khi hợp đồng đã hoàn thành.' });
    }

    // 2. Check if already reviewed
    const reviewCheck = await pool.request()
      .input('contractId', sql.Int, contractId)
      .query('SELECT review_id FROM reviews WHERE contract_id = @contractId');

    if (reviewCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Bạn đã đánh giá hợp đồng này rồi.' });
    }

    // 3. Insert review & update freelancer aggregate rating
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // Insert review
      await tx.request()
        .input('contractId', sql.Int, contractId)
        .input('reviewerId', sql.Int, employerId)
        .input('revieweeId', sql.Int, contract.freelancer_id)
        .input('rating', sql.Int, ratingVal)
        .input('comment', sql.NVarChar, comment || null)
        .query(`
          INSERT INTO reviews (contract_id, from_user_id, to_user_id, rating, comment, status, created_at)
          VALUES (@contractId, @reviewerId, @revieweeId, @rating, @comment, 'VISIBLE', SYSUTCDATETIME())
        `);

      // Calculate new ratings aggregation for freelancer
      const ratingsRes = await tx.request()
        .input('freelancerId', sql.Int, contract.freelancer_id)
        .query('SELECT rating FROM reviews WHERE to_user_id = @freelancerId');

      const reviewsList = ratingsRes.recordset;
      const totalReviews = reviewsList.length;
      const totalSum = reviewsList.reduce((acc, curr) => acc + curr.rating, 0);
      const ratingAverage = totalReviews > 0 ? (totalSum / totalReviews) : 0;

      // Update freelancer_profiles safely using IF EXISTS
      await tx.request()
        .input('freelancerId', sql.Int, contract.freelancer_id)
        .input('ratingAverage', sql.Decimal(3, 2), ratingAverage)
        .input('totalReviews', sql.Int, totalReviews)
        .query(`
          IF EXISTS (SELECT 1 FROM freelancer_profiles WHERE freelancer_id = @freelancerId)
          BEGIN
            UPDATE freelancer_profiles
            SET rating_average = @ratingAverage, total_reviews = @totalReviews, updated_at = SYSUTCDATETIME()
            WHERE freelancer_id = @freelancerId
          END
          ELSE
          BEGIN
            INSERT INTO freelancer_profiles (freelancer_id, rating_average, total_reviews, availability_status, created_at)
            VALUES (@freelancerId, @ratingAverage, @totalReviews, 'AVAILABLE', SYSUTCDATETIME())
          END
        `);

      await tx.commit();
      res.status(201).json({ success: true, message: 'Gửi đánh giá thành công!' });
    } catch (txError) {
      await tx.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('Error in createContractReview:', error);
    res.status(500).json({ message: 'Lỗi server khi gửi đánh giá.' });
  }
};

