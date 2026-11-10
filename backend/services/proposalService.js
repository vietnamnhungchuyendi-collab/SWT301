import { sql, poolPromise } from '../config/db.js';
import { getProposalById, fetchProposals, proposalExistsForContract, createContract, updateProposalStatus } from '../repositories/proposalRepository.js';

const normalizeProposalId = (proposalId) => {
  const parsed = parseInt(proposalId, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const allowedStatuses = ['ACCEPTED', 'REJECTED', 'SHORTLISTED', 'SUBMITTED', 'WITHDRAWN', 'CANCELED'];

export const listProposals = async (filters) => {
  return fetchProposals(filters);
};

export const moderateProposalStatus = async (proposalId, status, userId, role, roles = []) => {
  const normalizedId = normalizeProposalId(proposalId);
  if (!normalizedId) {
    return { status: 400, error: 'Invalid proposal id.' };
  }

  if (!status || typeof status !== 'string') {
    return { status: 400, error: 'Status is required.' };
  }

  const normalizedStatus = status.trim().toUpperCase();
  if (!allowedStatuses.includes(normalizedStatus)) {
    return { status: 400, error: 'Invalid status.' };
  }

  const proposal = await getProposalById(normalizedId);
  if (!proposal) {
    return { status: 404, error: 'Proposal not found.' };
  }

  const isAdmin = role === 'ADMIN' || (Array.isArray(roles) && roles.includes('ADMIN'));
  if (!isAdmin && proposal.employer_id !== userId) {
    return { status: 403, error: 'Unauthorized to update this proposal.' };
  }

  await updateProposalStatus(normalizedId, normalizedStatus);
  return { status: 200, data: { proposalId: normalizedId, status: normalizedStatus } };
};

export const acceptProposalAndCreateContract = async (proposalId, userId, role, roles = []) => {
  const normalizedId = normalizeProposalId(proposalId);
  if (!normalizedId) {
    return { status: 400, error: 'Invalid proposal id.' };
  }

  const proposal = await getProposalById(normalizedId);
  if (!proposal) {
    return { status: 404, error: 'Proposal not found.' };
  }

  const isAdmin = role === 'ADMIN' || (Array.isArray(roles) && roles.includes('ADMIN'));
  if (!isAdmin && proposal.employer_id !== userId) {
    return { status: 403, error: 'Unauthorized to accept this proposal.' };
  }

  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    const alreadyContracted = await proposalExistsForContract({
      proposalId: normalizedId,
      projectId: proposal.project_id,
      freelancerId: proposal.freelancer_id,
      employerId: proposal.employer_id
    }, tx);

    if (alreadyContracted) {
      await tx.rollback();
      return { status: 409, error: 'A contract already exists for this proposal or freelancer.' };
    }

    const contractTitle = `Contract for ${proposal.project_title}`;
    const contract = await createContract({
      projectId: proposal.project_id,
      employerId: proposal.employer_id,
      freelancerId: proposal.freelancer_id,
      proposalId: normalizedId,
      totalAmount: proposal.proposed_price,
      contractTitle
    }, tx);

    await updateProposalStatus(normalizedId, 'ACCEPTED', tx);

    // Delete all other proposals for this project as requested
    await tx.request()
      .input('projectId', sql.Int, proposal.project_id)
      .input('proposalId', sql.Int, normalizedId)
      .query('DELETE FROM proposals WHERE project_id = @projectId AND proposal_id <> @proposalId');

    await tx.commit();
    return { status: 201, data: contract };
  } catch (error) {
    try {
      await tx.rollback();
    } catch (rollbackError) {
      console.error('Rollback failure:', rollbackError);
    }
    throw error;
  }
};
