import { fetchDisputes, getDisputeById, updateDisputeStatus, isAllowedDecision } from '../repositories/disputeRepository.js';

const normalizeStatus = (status) => {
  return typeof status === 'string' ? status.trim().toUpperCase() : null;
};

export const listDisputes = async (filters) => {
  return fetchDisputes(filters);
};

export const getDisputeDetails = async (disputeId) => {
  const dispute = await getDisputeById(disputeId);
  if (!dispute) {
    return { status: 404, error: 'Dispute not found.' };
  }

  return { status: 200, data: dispute };
};

export const resolveDispute = async (disputeId, decision) => {
  if (!isAllowedDecision(decision)) {
    return { status: 400, error: 'Decision must be one of REFUND_EMPLOYER, PAY_FREELANCER, SPLIT_PAYMENT, or NO_ACTION.' };
  }

  const dispute = await getDisputeById(disputeId);
  if (!dispute) {
    return { status: 404, error: 'Dispute not found.' };
  }

  if (dispute.status !== 'OPEN') {
    return { status: 400, error: 'Only OPEN disputes can be resolved.' };
  }

  await updateDisputeStatus(disputeId, 'RESOLVED', decision.trim().toUpperCase());
  return { status: 200, data: { disputeId: Number(disputeId), status: 'RESOLVED', decision: decision.trim().toUpperCase() } };
};

export const closeDispute = async (disputeId) => {
  const dispute = await getDisputeById(disputeId);
  if (!dispute) {
    return { status: 404, error: 'Dispute not found.' };
  }

  if (dispute.status !== 'OPEN') {
    return { status: 400, error: 'Only OPEN disputes can be closed.' };
  }

  await updateDisputeStatus(disputeId, 'CLOSED');
  return { status: 200, data: { disputeId: Number(disputeId), status: 'CLOSED' } };
};
