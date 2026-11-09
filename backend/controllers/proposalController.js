import { listProposals, moderateProposalStatus, acceptProposalAndCreateContract } from '../services/proposalService.js';
import { sql, poolPromise } from '../config/db.js';

const isValidIntegerId = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0;
};

export const getProposals = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      projectId: req.query.projectId,
      freelancerId: req.query.freelancerId,
      employerId: req.query.employerId,
      search: req.query.search,
      limit: req.query.limit || 25,
      offset: req.query.offset || 0
    };

    const result = await listProposals(filters);
    res.json({ success: true, total: result.total, proposals: result.proposals });
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({ message: 'Failed to fetch proposals.' });
  }
};

export const getSingleProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { role } = req.user;

    if (!isValidIntegerId(id)) {
      return res.status(400).json({ message: 'Mã đề xuất không hợp lệ.' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('proposalId', sql.Int, parseInt(id))
      .query(`
        SELECT p.*, pr.title as project_title, pr.employer_id, u.full_name as freelancer_name 
        FROM proposals p 
        JOIN projects pr ON p.project_id = pr.project_id 
        JOIN users u ON p.freelancer_id = u.user_id 
        WHERE p.proposal_id = @proposalId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đề xuất.' });
    }

    const proposal = result.recordset[0];

    // Authorization: Owner, Project Employer, or Admin
    if (proposal.freelancer_id !== userId && proposal.employer_id !== userId && role !== 'ADMIN') {
      return res.status(403).json({ message: 'Bạn không có quyền xem đề xuất này.' });
    }

    res.json({ success: true, proposal });
  } catch (error) {
    console.error('Error fetching single proposal:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy chi tiết đề xuất.' });
  }
};

export const updateProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const freelancerId = req.user.id;
    let { proposedPrice, deliveryTimeDays, coverLetter } = req.body;

    if (!isValidIntegerId(id)) {
      return res.status(400).json({ message: 'Mã đề xuất không hợp lệ.' });
    }

    if (!proposedPrice || !deliveryTimeDays) {
      return res.status(400).json({ message: 'Vui lòng cung cấp giá đề xuất và thời gian ước tính.' });
    }

    if (parseFloat(proposedPrice) <= 0) {
      return res.status(400).json({ message: 'Giá đề xuất phải lớn hơn 0 VNĐ.' });
    }

    const pool = await poolPromise;

    // Check existence, ownership, and status
    const checkResult = await pool.request()
      .input('proposalId', sql.Int, parseInt(id))
      .query('SELECT freelancer_id, status FROM proposals WHERE proposal_id = @proposalId');

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đề xuất.' });
    }

    const proposal = checkResult.recordset[0];
    if (proposal.freelancer_id !== freelancerId) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa đề xuất này.' });
    }

    if (proposal.status !== 'SUBMITTED' && proposal.status !== 'PENDING') {
      return res.status(400).json({ message: 'Không thể chỉnh sửa đề xuất đã được xử lý hoặc chấp nhận.' });
    }

    if (req.file) {
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      coverLetter = `${coverLetter || ''}\n\n----------------------------------------\n[Tệp đính kèm]: ${fileUrl}`;
    }

    await pool.request()
      .input('proposalId', sql.Int, parseInt(id))
      .input('proposedPrice', sql.Decimal(12, 2), parseFloat(proposedPrice))
      .input('deliveryTimeDays', sql.Int, parseInt(deliveryTimeDays))
      .input('coverLetter', sql.NVarChar, coverLetter || '')
      .query(`
        UPDATE proposals 
        SET proposed_price = @proposedPrice, 
            delivery_time_days = @deliveryTimeDays, 
            cover_letter = @coverLetter, 
            updated_at = SYSUTCDATETIME()
        WHERE proposal_id = @proposalId
      `);

    res.json({ success: true, message: 'Cập nhật đề xuất thành công!' });
  } catch (error) {
    console.error('Error updating proposal:', error);
    res.status(500).json({ message: 'Lỗi server khi cập nhật đề xuất.' });
  }
};

export const deleteProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const freelancerId = req.user.id;

    if (!isValidIntegerId(id)) {
      return res.status(400).json({ message: 'Mã đề xuất không hợp lệ.' });
    }

    const pool = await poolPromise;

    // Check existence, ownership, and status
    const checkResult = await pool.request()
      .input('proposalId', sql.Int, parseInt(id))
      .query('SELECT freelancer_id, status FROM proposals WHERE proposal_id = @proposalId');

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đề xuất.' });
    }

    const proposal = checkResult.recordset[0];
    if (proposal.freelancer_id !== freelancerId) {
      return res.status(403).json({ message: 'Bạn không có quyền rút đề xuất này.' });
    }

    if (proposal.status !== 'SUBMITTED' && proposal.status !== 'PENDING') {
      return res.status(400).json({ message: 'Không thể rút đề xuất đã được xử lý.' });
    }

    await pool.request()
      .input('proposalId', sql.Int, parseInt(id))
      .query('DELETE FROM proposals WHERE proposal_id = @proposalId');

    res.json({ success: true, message: 'Rút đề xuất thành công!' });
  } catch (error) {
    console.error('Error deleting proposal:', error);
    res.status(500).json({ message: 'Lỗi server khi rút đề xuất.' });
  }
};

export const patchProposalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const { role, roles } = req.user;

    if (!isValidIntegerId(id)) {
      return res.status(400).json({ message: 'Invalid proposal id.' });
    }

    if (!status || typeof status !== 'string') {
      return res.status(400).json({ message: 'Status is required.' });
    }

    const result = await moderateProposalStatus(id, status, userId, role, roles);
    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    res.json({ success: true, proposalId: result.data.proposalId, status: result.data.status });
  } catch (error) {
    console.error('Error updating proposal status:', error);
    res.status(500).json({ message: 'Failed to update proposal status.' });
  }
};

export const postAcceptProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { role, roles } = req.user;

    if (!isValidIntegerId(id)) {
      return res.status(400).json({ message: 'Invalid proposal id.' });
    }

    const result = await acceptProposalAndCreateContract(id, userId, role, roles);
    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    res.status(201).json({ success: true, contract: result.data });
  } catch (error) {
    console.error('Error accepting proposal:', error);
    res.status(500).json({ message: 'Failed to accept proposal.' });
  }
};
