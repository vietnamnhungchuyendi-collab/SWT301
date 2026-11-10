/**
 * @deprecated
 * This service is deprecated. Use reportService.js instead.
 * 
 * Reason: Legacy violation system has been replaced by the new Report System.
 * - OLD: /api/admin/violations (uses reported_user_id, project_id)
 * - NEW: /api/v1/admin/reports (uses entity_type, entity_id)
 * 
 * This file is kept for reference only and will be removed in the next major version.
 * Do NOT add new functionality here.
 * 
 * @see reportService.js
 */

import * as violationRepository from '../repositories/violationRepository.js';

export const getViolations = async ({ search, reportType, status, page = 1, limit = 10 }) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const lim = Math.max(parseInt(limit, 10) || 10, 1);
  const offset = (pageNum - 1) * lim;

  const result = await violationRepository.fetchViolationsWithFilters({
    search,
    reportType,
    status,
    limit: lim,
    offset
  });

  const totalPages = Math.ceil(result.total / lim) || 1;

  return {
    violations: result.violations,
    total: result.total,
    page: pageNum,
    limit: lim,
    totalPages
  };
};

export const getViolationDetails = async (id) => {
  const report = await violationRepository.getViolationById(id);
  if (!report) {
    throw new Error('VIOLATION_NOT_FOUND');
  }

  return {
    report_id: report.report_id,
    project_id: report.project_id,
    message_id: report.message_id,
    review_id: report.review_id,
    report_type: report.report_type,
    reason: report.reason,
    status: report.status,
    created_at: report.created_at,
    resolved_at: report.resolved_at,
    reporter: {
      user_id: report.reporter_id,
      full_name: report.reporter_name,
      email: report.reporter_email,
      status: report.reporter_status
    },
    reported_user: {
      user_id: report.reported_user_id,
      full_name: report.reported_name,
      email: report.reported_email,
      status: report.reported_status
    },
    target: {
      entity_type: report.entity_type || 'USER',
      entity_id: report.entity_id || null,
      project_title: report.target_project_title || null,
      owner_id: report.owner_id || null,
      metadata: report.metadata ? JSON.parse(report.metadata) : null
    }
  };
};

export const resolveViolation = async (id, action) => {
  const report = await violationRepository.getViolationById(id);
  if (!report) throw new Error('VIOLATION_NOT_FOUND');
  if (report.status !== 'PENDING') throw new Error('VIOLATION_ALREADY_PROCESSED');

  const allowedActions = ['WARN', 'SUSPEND_USER', 'BAN_USER', 'NO_ACTION'];
  if (!allowedActions.includes(action)) throw new Error('INVALID_ACTION');

  if (action === 'WARN') {
    await violationRepository.updateViolationStatus(id, 'RESOLVED');
    await violationRepository.createNotification(
      report.reported_user_id,
      `Bạn nhận được một cảnh báo vi phạm liên quan đến báo cáo #${id}: ${report.reason}`
    );
  } else if (action === 'SUSPEND_USER') {
    await violationRepository.updateUserStatus(report.reported_user_id, 'SUSPENDED');
    await violationRepository.updateViolationStatus(id, 'RESOLVED');
    await violationRepository.createNotification(
      report.reported_user_id,
      `Tài khoản của bạn đã bị tạm khóa (SUSPENDED) do vi phạm chính sách liên quan đến báo cáo #${id}.`
    );
  } else if (action === 'BAN_USER') {
    await violationRepository.updateUserStatus(report.reported_user_id, 'BANNED');
    await violationRepository.updateViolationStatus(id, 'RESOLVED');
    await violationRepository.createNotification(
      report.reported_user_id,
      `Tài khoản của bạn đã bị khóa vĩnh viễn (BANNED) do vi phạm nghiêm trọng chính sách liên quan đến báo cáo #${id}.`
    );
  } else if (action === 'NO_ACTION') {
    await violationRepository.updateViolationStatus(id, 'RESOLVED');
  }

  return { success: true };
};

export const dismissViolation = async (id) => {
  const report = await violationRepository.getViolationById(id);
  if (!report) throw new Error('VIOLATION_NOT_FOUND');
  if (report.status !== 'PENDING') throw new Error('VIOLATION_ALREADY_PROCESSED');
  await violationRepository.updateViolationStatus(id, 'DISMISSED');
  return { success: true };
};

export const createViolationReport = async ({ reporterId, reportedUserId, projectId, messageId, reviewId, reportType, reason }) => {
  if (!reporterId || !reportedUserId || !reportType || !reason) throw new Error('MISSING_FIELDS');
  await violationRepository.createViolationReport({ reporterId, reportedUserId, projectId, messageId, reviewId, reportType, reason });
  return { success: true };
};