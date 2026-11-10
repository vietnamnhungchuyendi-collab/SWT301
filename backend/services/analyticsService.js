import * as analyticsRepository from '../repositories/analyticsRepository.js';

const fillMissingMonths = (data, key) => {
  const now = new Date();
  const result = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const existing = data.find(item => item.month === monthStr);
    result.push({
      month: monthStr,
      [key]: existing ? Number(existing[key]) : 0
    });
  }
  return result;
};

const resolvePeriod = (period) => {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'month': {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
      break;
    }
    case 'year': {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    }
    default:
      return { startDate: null, endDate: null };
  }

  return { startDate, endDate };
};

export const getAnalytics = async ({ period = null, startDate = null, endDate = null } = {}) => {
  let resolvedStart = startDate;
  let resolvedEnd = endDate;

  // If period is provided, resolve it to date range (overrides custom dates)
  if (period) {
    const resolved = resolvePeriod(period);
    resolvedStart = resolved.startDate;
    resolvedEnd = resolved.endDate;
  }

  const [
    overview,
    monthlyRevenue,
    monthlyProjects,
    monthlyUsers,
    projectStatusDistribution,
    contractStatusDistribution,
    topCategories,
    topSkills
  ] = await Promise.all([
    analyticsRepository.getOverviewStats(resolvedStart, resolvedEnd),
    analyticsRepository.getMonthlyRevenue(resolvedStart, resolvedEnd),
    analyticsRepository.getMonthlyProjects(resolvedStart, resolvedEnd),
    analyticsRepository.getMonthlyUsers(resolvedStart, resolvedEnd),
    analyticsRepository.getProjectStatusDistribution(resolvedStart, resolvedEnd),
    analyticsRepository.getContractStatusDistribution(resolvedStart, resolvedEnd),
    analyticsRepository.getTopCategories(resolvedStart, resolvedEnd),
    analyticsRepository.getTopSkills(resolvedStart, resolvedEnd)
  ]);

  return {
    overview,
    monthlyRevenue: fillMissingMonths(monthlyRevenue, 'amount'),
    monthlyProjects: fillMissingMonths(monthlyProjects, 'count'),
    monthlyUsers: fillMissingMonths(monthlyUsers, 'count'),
    projectStatusDistribution: projectStatusDistribution.map(item => ({
      status: item.status,
      count: item.count
    })),
    contractStatusDistribution: contractStatusDistribution.map(item => ({
      status: item.status,
      count: item.count
    })),
    topCategories,
    topSkills
  };
};