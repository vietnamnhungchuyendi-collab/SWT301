import * as recommendationRepository from '../repositories/recommendationRepository.js';
import { callGeminiAPI } from '../utils/geminiHelper.js';


/* ─────────────── LAYER 1: SKILL MATCHING ─────────────── */

const calculateSkillMatch = (freelancerSkills, projectSkills) => {
  if (!projectSkills.length) return { score: 0, reasons: [] };

  const flSkillNames = new Set(freelancerSkills.map(s => s.skill_name.toLowerCase()));
  let matchedCount = 0;
  const matchedSkills = [];

  for (const ps of projectSkills) {
    if (flSkillNames.has(ps.skill_name.toLowerCase())) {
      matchedCount++;
      matchedSkills.push(ps.skill_name);
    }
  }

  const score = Math.round((matchedCount / projectSkills.length) * 100);
  const reasons = matchedCount > 0
    ? [`Khớp ${matchedCount}/${projectSkills.length} kỹ năng yêu cầu`]
    : ['Không khớp trực tiếp kỹ năng nào'];

  return { score, reasons };
};

/* ─────────────── LAYER 2: HISTORICAL PREFERENCE ─────────────── */

const calculateHistoricalPreference = (
  freelancer,
  freelancerSkills,
  employerHistory,
  employerProjectSkills,
  projectCategoryId
) => {
  const reasons = [];
  let bonusPoints = 0;
  const maxBonus = 100;

  if (!employerHistory.length) {
    return { score: 50, reasons: [] };
  }

  // Check if freelancer was previously hired by this employer
  const previouslyHired = employerHistory.some(h => h.freelancer_id === freelancer.user_id);
  if (previouslyHired) {
    bonusPoints += 30;
    reasons.push('Đã từng hợp tác thành công với nhà tuyển dụng này');
  }

  // Check category preference
  const categoryMatches = employerHistory.filter(h => h.category_id === projectCategoryId).length;
  if (categoryMatches > 0) {
    const categoryScore = Math.min(categoryMatches * 10, 20);
    bonusPoints += categoryScore;
  }

  // Check skill preference
  if (employerProjectSkills.length > 0) {
    const empSkillNames = new Set(employerProjectSkills.map(s => s.skill_name.toLowerCase()));
    const flSkillNames = new Set(freelancerSkills.map(s => s.skill_name.toLowerCase()));
    const commonSkills = [...empSkillNames].filter(s => flSkillNames.has(s));
    if (commonSkills.length > 0) {
      const skillBonus = Math.min(commonSkills.length * 10, 20);
      bonusPoints += skillBonus;
      reasons.push(`Sở hữu các kỹ năng chìa khóa (${commonSkills.slice(0, 3).join(', ')})`);
    }
  }

  // Check rating preference with CONCRETE STATS
  const flRating = freelancer.rating_average ? Number(freelancer.rating_average).toFixed(1) : '5.0';
  const flReviews = freelancer.total_reviews || freelancer.completed_projects || 0;
  if (freelancer.rating_average >= 4.0 || flReviews > 0) {
    bonusPoints += 15;
    reasons.push(`Đạt ${flRating}/5.0★ (${flReviews > 0 ? `đã hoàn thành ${flReviews} dự án` : 'hồ sơ đánh giá uy tín'})`);
  }

  // Check experience preference with CONCRETE YEARS STAT
  const flExp = freelancer.experience_years || 1;
  bonusPoints += 15;
  reasons.push(`Có ${flExp} năm kinh nghiệm thực chiến trong nghề`);

  return { score: Math.min(bonusPoints, maxBonus), reasons };
};

/* ─────────────── LAYER 3: PROPOSAL QUALITY ─────────────── */

const calculateProposalQuality = (freelancer, proposals) => {
  const reasons = [];
  let score = 50; // Base score

  const flProposals = proposals.filter(p => p.freelancer_id === freelancer.user_id);
  if (!flProposals.length) {
    return { score: 50, reasons: ['Chưa có lịch sử đề xuất'] };
  }

  const p = flProposals[0];

  // Acceptance rate
  const total = p.total_proposals || 0;
  const accepted = p.accepted_proposals || 0;
  if (total > 0) {
    const acceptanceRate = (accepted / total) * 100;
    if (acceptanceRate > 50) {
      score += 20;
      reasons.push(`Tỷ lệ nhận đề xuất cao (${Math.round(acceptanceRate)}%)`);
    }
  }

  // Delivery feasibility
  if (p.avg_delivery_days) {
    const deliveryDays = Math.round(p.avg_delivery_days);
    if (deliveryDays <= 7) {
      score += 15;
      reasons.push('Thời gian bàn giao nhanh (trung bình ' + deliveryDays + ' ngày)');
    } else if (deliveryDays <= 30) {
      score += 10;
      reasons.push('Thời gian bàn giao hợp lý (trung bình ' + deliveryDays + ' ngày)');
    }
  }

  // Proposal completeness - based on having cover letter content
  const hasPortfolioDescription = freelancer.portfolio_summary && freelancer.portfolio_summary.length > 50;
  if (hasPortfolioDescription) {
    score += 15;
    reasons.push('Hồ sơ năng lực và mô tả dự án rất chi tiết');
  }

  return { score: Math.min(score, 100), reasons };
};

/* ─────────────── LAYER 4: SEMANTIC MATCHING ─────────────── */

const calculateSemanticMatch = (freelancer, freelancerSkills, project, portfolios, cvText = '') => {
  const reasons = [];
  let score = 50;

  // Build project text vector
  const projectText = [
    project.title || '',
    project.description || '',
    project.category_name || ''
  ].join(' ').toLowerCase();

  // Build freelancer text vector
  const freelancerPortfolios = portfolios.filter(p => p.freelancer_id === freelancer.user_id);
  const portfolioTexts = freelancerPortfolios.map(p => `${p.title} ${p.description}`).join(' ');
  const freelancerText = [
    freelancer.headline || '',
    freelancer.portfolio_summary || '',
    portfolioTexts,
    cvText
  ].join(' ').toLowerCase();

  if (!freelancerText.trim()) {
    return { score: 30, reasons: ['Thông tin hồ sơ năng lực còn hạn chế'] };
  }

  // Tokenize and compute keyword overlap
  const projectTokens = new Set(projectText.split(/\s+/).filter(t => t.length > 3));
  const freelancerTokens = freelancerText.split(/\s+/).filter(t => t.length > 3);
  const freelancerTokenSet = new Set(freelancerTokens);

  let overlapCount = 0;
  for (const token of projectTokens) {
    if (freelancerTokenSet.has(token)) overlapCount++;
  }

  if (projectTokens.size > 0) {
    const overlapRatio = overlapCount / projectTokens.size;
    score += Math.round(overlapRatio * 40);

    if (overlapRatio > 0.3) {
      reasons.push('Hồ sơ năng lực rất khớp với mô tả dự án');
    } else if (overlapRatio > 0.1) {
      reasons.push('Hồ sơ năng lực khớp một phần với yêu cầu dự án');
    } else {
      reasons.push('Hồ sơ năng lực có các từ khóa liên quan');
    }
  }

  // Add freelancer skill coverage in semantic analysis
  const skillNames = freelancerSkills.map(s => s.skill_name.toLowerCase());
  const projectHasRelatedSkills = skillNames.some(skill =>
    projectText.includes(skill)
  );
  if (projectHasRelatedSkills) {
    score += 10;
    if (reasons.length === 0) {
      reasons.push('Kỹ năng cá nhân phù hợp với lĩnh vực dự án');
    }
  }

  if (reasons.length === 0) {
    reasons.push('Độ tương đồng ngữ nghĩa trung bình');
  }

  return { score: Math.min(score, 100), reasons };
};

/* ─────────────── AI ENHANCEMENT: GEMINI ANALYSIS ─────────────── */

const analyzeWithGemini = async (project, projectSkills, topFreelancers, skillsByFreelancer) => {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS;
  if (!geminiKey || topFreelancers.length === 0) return {};

  try {
    const candidatesSummary = topFreelancers.map((fl, idx) => {
      const flSkills = (skillsByFreelancer[fl.user_id] || []).map(s => s.skill_name).join(', ');
      let cvSummary = '';
      if (fl.cv_ai_evaluation) {
        try {
          const cv = JSON.parse(fl.cv_ai_evaluation);
          cvSummary = cv.quickSummary || '';
        } catch { }
      }
      return `[${idx + 1}] ID:${fl.user_id} | ${fl.full_name} | Kỹ năng: ${flSkills || 'N/A'} | Kinh nghiệm: ${fl.experience_years || 0} năm | ${cvSummary}`;
    }).join('\n');

    const requiredSkills = projectSkills.map(s => s.skill_name).join(', ');

    const systemInstruction = `Bạn là chuyên gia tuyển dụng AI của hệ thống FJMS. Nhiệm vụ: phân tích danh sách ứng viên và đưa ra nhận xét NGẮN GỌN (1-2 câu) cho từng người so với yêu cầu dự án. 
Yêu cầu định dạng trả về:
- Trả về JSON thuần túy (không markdown) theo format: { "comments": { "ID_ứng_viên": "nhận xét ngắn gọn bằng tiếng Việt" } }
- Tuyệt đối không sử dụng ký tự nháy kép đôi (") trong nội dung nhận xét, nếu cần hãy dùng nháy đơn (').`;

    const userPrompt = `
--- DỰ ÁN ---
Tiêu đề: ${project.title}
Mô tả: ${(project.description || '').substring(0, 400)}
Kỹ năng yêu cầu: ${requiredSkills || 'N/A'}

--- DANH SÁCH ỨNG VIÊN ---
${candidatesSummary}
    `.trim();

    const responseText = await callGeminiAPI(userPrompt, systemInstruction, "application/json", 0.2);
    let text = responseText.trim();
    if (text) {
      // Clear markdown code blocks if any
      if (text.startsWith('```')) {
        text = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      text = text.trim();
      try {
        const parsed = JSON.parse(text);
        return parsed.comments || {};
      } catch (parseErr) {
        console.error('[AI Recommendation] Lỗi parse JSON kết quả Gemini:', parseErr, text);
        return {};
      }
    }
  } catch (err) {
    console.error('[AI Recommendation] Lỗi khi gọi Gemini:', err.message);
  }
  return {};
};

const calculateMatchScore = (freelancer, flSkills, project, portfolios) => {
  // 1. Skill Match Score (40%)
  const projectSkillList = (project.required_skills || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const flSkillNames = new Set(flSkills.map(s => s.skill_name.toLowerCase()));
  
  let matchedSkillsCount = 0;
  if (projectSkillList.length > 0) {
    projectSkillList.forEach(ps => {
      if (flSkillNames.has(ps) || [...flSkillNames].some(fs => fs.includes(ps) || ps.includes(fs))) {
        matchedSkillsCount++;
      }
    });
  }
  const skillScore = projectSkillList.length > 0
    ? Math.round((matchedSkillsCount / projectSkillList.length) * 100)
    : 80;

  // 2. Semantic Keyword Overlap (40%)
  const projectText = `${project.title} ${project.description} ${project.category_name || ''}`.toLowerCase();
  const projectTokens = new Set(projectText.split(/\s+/).filter(t => t.length > 3));
  
  let cvText = '';
  if (freelancer.cv_ai_evaluation) {
    try {
      const cv = typeof freelancer.cv_ai_evaluation === 'string' ? JSON.parse(freelancer.cv_ai_evaluation) : freelancer.cv_ai_evaluation;
      cvText = `${cv.headline || ''} ${cv.quickSummary || ''} ${(cv.strengths || []).join(' ')}`.toLowerCase();
    } catch {}
  }
  
  const freelancerPortfolios = portfolios.filter(p => p.freelancer_id === freelancer.user_id);
  const portfolioTexts = freelancerPortfolios.map(p => `${p.title} ${p.description}`).join(' ');
  const freelancerText = [
    freelancer.headline || '',
    freelancer.portfolio_summary || '',
    portfolioTexts,
    cvText
  ].join(' ').toLowerCase();

  let tokenMatches = 0;
  if (projectTokens.size > 0) {
    for (const t of projectTokens) {
      if (freelancerText.includes(t)) tokenMatches++;
    }
  }
  const semanticScore = projectTokens.size > 0
    ? Math.round((tokenMatches / projectTokens.size) * 100)
    : 70;

  // 3. Budget & Experience Fit (20%)
  let budgetFitScore = 70;
  const projMax = parseFloat(project.budget_max || 0);
  const flHourlyRate = parseFloat(freelancer.hourly_rate || 0);
  if (projMax > 0 && flHourlyRate > 0) {
    budgetFitScore = 90;
  }

  const rawScore = Math.round(skillScore * 0.40 + semanticScore * 0.40 + budgetFitScore * 0.20);
  const finalScore = Math.min(Math.max(rawScore, 10), 98);
  return { finalScore, skillScore, semanticScore, budgetFitScore };
};

/* ─────────────── MAIN RECOMMENDATION ENGINE ─────────────── */

export const getRecommendations = async (projectId) => {
  // 1. Fetch project details
  const project = await recommendationRepository.getProjectDetails(projectId);
  if (!project) {
    throw new Error('PROJECT_NOT_FOUND');
  }

  // 2. Fetch project skills
  const projectSkills = await recommendationRepository.getProjectSkills(projectId);

  // 3. Fetch employer history
  const [employerHistory, employerProjectSkills] = await Promise.all([
    recommendationRepository.getEmployerHistory(project.employer_id),
    recommendationRepository.getEmployerProjectSkills(project.employer_id)
  ]);

  // 4. Fetch all active freelancers
  const freelancers = await recommendationRepository.getFreelancersForProject(projectId);
  if (!freelancers.length) return [];

  // 5. Batch fetch freelancer data and specific project proposals to sync scores
  const projectProposalsResult = await recommendationRepository.getProjectProposalsAIEvaluation(projectId);

  const proposalsMap = {};
  projectProposalsResult.forEach(p => {
    proposalsMap[p.freelancer_id] = p.ai_evaluation;
  });

  const freelancerIds = freelancers.map(f => f.user_id);
  const [allFreelancerSkills, allProposals, allContracts, allPortfolios] = await Promise.all([
    recommendationRepository.getFreelancerSkills(freelancerIds),
    recommendationRepository.getFreelancerProposals(freelancerIds),
    recommendationRepository.getFreelancerContracts(freelancerIds),
    recommendationRepository.getFreelancerPortfolios(freelancerIds)
  ]);

  // 6. Organize data by freelancer
  const skillsByFreelancer = {};
  allFreelancerSkills.forEach(s => {
    if (!skillsByFreelancer[s.freelancer_id]) skillsByFreelancer[s.freelancer_id] = [];
    skillsByFreelancer[s.freelancer_id].push(s);
  });

  const contractsByFreelancer = {};
  allContracts.forEach(c => {
    contractsByFreelancer[c.freelancer_id] = c;
  });

  // 7. Calculate scores for each freelancer
  const scored = freelancers.map(freelancer => {
    // Parse and combine CV skills to match the Freelancer dashboard algorithm inputs
    let combinedSkillNames = (skillsByFreelancer[freelancer.user_id] || []).map(s => s.skill_name);
    if (freelancer.cv_ai_evaluation) {
      try {
        const cv = typeof freelancer.cv_ai_evaluation === 'string'
          ? JSON.parse(freelancer.cv_ai_evaluation)
          : freelancer.cv_ai_evaluation;
        if (Array.isArray(cv.skills)) {
          combinedSkillNames = [...new Set([...combinedSkillNames, ...cv.skills])];
        }
      } catch {}
    }
    const flSkills = combinedSkillNames.map(name => ({ skill_name: name }));

    // Layer 1: Skill Matching (40%)
    const { score: skillScore, reasons: skillReasons } = calculateSkillMatch(flSkills, projectSkills);

    // Layer 2: Historical Preference (20%)
    const { score: historyScore, reasons: historyReasons } = calculateHistoricalPreference(
      freelancer, flSkills, employerHistory, employerProjectSkills, project.category_id
    );

    // Layer 3: Proposal Quality (20%)
    const { score: proposalScore, reasons: proposalReasons } = calculateProposalQuality(freelancer, allProposals);

    // Use unified match score helper
    const scoreObj = calculateMatchScore(freelancer, flSkills, project, allPortfolios);
    let finalScore = scoreObj.finalScore;
    const semanticScore = scoreObj.semanticScore;
    const semanticReasons = [];

    // Override score if freelancer has already submitted a proposal for this project
    const existingAiEval = proposalsMap[freelancer.user_id];
    if (existingAiEval) {
      try {
        const parsed = typeof existingAiEval === 'string' ? JSON.parse(existingAiEval) : existingAiEval;
        if (parsed && typeof parsed.matchScore === 'number') {
          finalScore = parsed.matchScore;
        }
      } catch {}
    }

    // Combine unique reasons
    const allReasons = [...new Set([...skillReasons, ...historyReasons, ...proposalReasons, ...semanticReasons])];

    // Parse CV insights if available
    let cvInsights = null;
    if (freelancer.cv_ai_evaluation) {
      try {
        cvInsights = typeof freelancer.cv_ai_evaluation === 'string'
          ? JSON.parse(freelancer.cv_ai_evaluation)
          : freelancer.cv_ai_evaluation;
      } catch { }
    }

    return {
      userId: freelancer.user_id,
      fullName: freelancer.full_name,
      avatarUrl: freelancer.avatar_url,
      headline: freelancer.headline,
      rating: freelancer.rating_average || 0,
      totalReviews: freelancer.total_reviews || 0,
      experienceYears: freelancer.experience_years || 0,
      hourlyRate: freelancer.hourly_rate || 0,
      availabilityStatus: freelancer.availability_status,
      recommendationScore: finalScore,
      scoreBreakdown: {
        skillMatch: skillScore,
        historicalPreference: historyScore,
        proposalQuality: proposalScore,
        semanticMatch: semanticScore
      },
      recommendationReasons: allReasons.slice(0, 5),
      cvInsights // NEW: pre-analyzed CV data from DB
    };
  });

  // 8. Sort by score descending, take top 10
  const top10 = scored
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, 10);

  // 9. AI Enhancement: Call Gemini ONCE for personalized comments on all top candidates
  const topFreelancerData = top10
    .map(r => freelancers.find(f => Number(f.user_id) === Number(r.userId)))
    .filter(Boolean);
  const aiComments = await analyzeWithGemini(project, projectSkills, topFreelancerData, skillsByFreelancer);

  // Attach AI comments to results
  for (const rec of top10) {
    rec.aiComment = aiComments[String(rec.userId)] || null;
  }

  return top10;
};

export const getProjectRecommendationsForFreelancer = async (userId) => {
  const freelancer = await recommendationRepository.getSingleFreelancerProfile(userId);
  if (!freelancer) return [];

  const openProjects = await recommendationRepository.getAllOpenProjectsWithSkills();
  if (!openProjects.length) return [];

  // Batch fetch portfolios for the freelancer
  const allPortfolios = await recommendationRepository.getFreelancerPortfolios([userId]);

  // Combine freelancer system skills and CV skills if parsed
  let allFlSkills = [...(freelancer.skills || [])];
  let cvText = '';
  if (freelancer.cv_ai_evaluation) {
    try {
      const cv = typeof freelancer.cv_ai_evaluation === 'string'
        ? JSON.parse(freelancer.cv_ai_evaluation)
        : freelancer.cv_ai_evaluation;
      cvText = `${cv.headline || ''} ${cv.quickSummary || ''} ${(cv.strengths || []).join(' ')}`.toLowerCase();
      if (Array.isArray(cv.skills)) {
        allFlSkills = [...new Set([...allFlSkills, ...cv.skills])];
      }
    } catch {}
  }

  const flSkills = allFlSkills.map(name => ({ skill_name: name }));
  const flSkillsSet = new Set(allFlSkills.map(s => s.toLowerCase().trim()));
  const profileText = [
    freelancer.headline || '',
    freelancer.bio || '',
    cvText
  ].join(' ').toLowerCase();

  const flHourlyRate = parseFloat(freelancer.hourly_rate || 0);
  const flExpYears = parseInt(freelancer.experience_years || 1, 10);

  const scoredProjects = openProjects.map(p => {
    // 1. Skill Match Score (40%)
    const projectSkillList = (p.required_skills || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    let matchedSkills = [];
    if (projectSkillList.length > 0) {
      matchedSkills = projectSkillList.filter(ps => 
        [...flSkillsSet].some(fs => fs.includes(ps) || ps.includes(fs))
      );
    }

    // 2. Semantic Keyword Overlap (40%)
    const projText = `${p.title} ${p.description} ${p.category_name || ''}`.toLowerCase();
    const projTokens = new Set(projText.split(/\s+/).filter(t => t.length > 3));
    let tokenMatches = 0;
    for (const t of projTokens) {
      if (profileText.includes(t)) tokenMatches++;
    }

    // 3. Budget & Experience Fit (20%)
    const projMax = parseFloat(p.budget_max || 0);

    // Call unified match helper
    const scoreObj = calculateMatchScore(freelancer, flSkills, p, allPortfolios);
    const finalScore = scoreObj.finalScore;

    // Dynamic AI Reason Generation (Varied per project)
    const reasons = [];
    if (matchedSkills.length > 0) {
      reasons.push(`Trùng khớp ${matchedSkills.length}/${projectSkillList.length || 1} kỹ năng yêu cầu (${matchedSkills.slice(0, 3).join(', ')})`);
    } else if (p.category_name) {
      reasons.push(`Phù hợp với chuyên môn danh mục ${p.category_name}`);
    }

    const titleSnippet = (p.title || '').length > 28 ? (p.title || '').substring(0, 28) + '...' : (p.title || '');
    if (tokenMatches >= 3) {
      reasons.push(`Nội dung dự án "${titleSnippet}" trùng khớp từ khóa chuyên môn trong CV`);
    } else {
      reasons.push(`Yêu cầu dự án phù hợp với hồ sơ năng lực của bạn`);
    }

    if (projMax > 10000000) {
      reasons.push(`Ngân sách cao (${(projMax / 1000000).toFixed(0)} triệu VNĐ) tương thích số năm kinh nghiệm (${flExpYears} năm)`);
    } else if (projMax > 0) {
      reasons.push(`Mức thầu ${projMax.toLocaleString('vi-VN')} VNĐ phù hợp với chi phí kỳ vọng`);
    } else {
      reasons.push(`Mức thầu thỏa thuận linh hoạt theo năng lực của bạn`);
    }

    return {
      projectId: p.project_id,
      title: p.title,
      description: p.description,
      budgetMin: p.budget_min,
      budgetMax: p.budget_max,
      budgetType: p.budget_type,
      categoryName: p.category_name,
      companyName: p.company_name,
      avatarUrl: p.avatar_url,
      requiredSkills: p.required_skills,
      createdAt: p.created_at,
      matchScore: finalScore,
      matchReasons: reasons
    };
  });

  // Return top recommended projects sorted by match score
  return scoredProjects
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 8);
};