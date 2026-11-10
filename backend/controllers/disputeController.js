import { listDisputes, getDisputeDetails, resolveDispute, closeDispute } from '../services/disputeService.js';

const parseIntId = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const getDisputes = async (req, res) => {
  try {
    const filters = {
      status: req.query.status
    };

    const result = await listDisputes(filters);
    return res.json({ success: true, total: result.total, disputes: result.disputes });
  } catch (error) {
    console.error('Error fetching disputes:', error);
    return res.status(500).json({ message: 'Failed to fetch disputes.' });
  }
};

export const getDisputeById = async (req, res) => {
  try {
    const disputeId = parseIntId(req.params.id);
    if (!disputeId) {
      return res.status(400).json({ message: 'Invalid dispute id.' });
    }

    const result = await getDisputeDetails(disputeId);
    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.json({ success: true, dispute: result.data });
  } catch (error) {
    console.error('Error fetching dispute detail:', error);
    return res.status(500).json({ message: 'Failed to fetch dispute details.' });
  }
};

export const patchResolveDispute = async (req, res) => {
  try {
    const disputeId = parseIntId(req.params.id);
    const { decision } = req.body;

    if (!disputeId) {
      return res.status(400).json({ message: 'Invalid dispute id.' });
    }

    if (!decision || typeof decision !== 'string') {
      return res.status(400).json({ message: 'Decision is required to resolve a dispute.' });
    }

    const result = await resolveDispute(disputeId, decision);
    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.json({ success: true, disputeId: result.data.disputeId, status: result.data.status, decision: result.data.decision });
  } catch (error) {
    console.error('Error resolving dispute:', error);
    return res.status(500).json({ message: 'Failed to resolve dispute.' });
  }
};

export const patchCloseDispute = async (req, res) => {
  try {
    const disputeId = parseIntId(req.params.id);
    if (!disputeId) {
      return res.status(400).json({ message: 'Invalid dispute id.' });
    }

    const result = await closeDispute(disputeId);
    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }

    return res.json({ success: true, disputeId: result.data.disputeId, status: result.data.status });
  } catch (error) {
    console.error('Error closing dispute:', error);
    return res.status(500).json({ message: 'Failed to close dispute.' });
  }
};
