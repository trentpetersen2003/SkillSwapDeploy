const SKILL_FAMILY_SYNONYMS = {
  "programming-language": [
    "python",
    "py",
    "java",
    "javascript",
    "js",
    "typescript",
    "ts",
    "go",
    "golang",
    "rust",
    "kotlin",
    "csharp",
    "c#",
    "cpp",
    "c++",
  ],
  "frontend-framework": ["react", "react js", "reactjs", "vue", "angular"],
  "backend-runtime": ["node", "node js", "node.js", "nodejs"],
  "backend-framework": ["express", "expressjs", "backend api", "api development", "rest api development"],
  "data-query": ["sql", "structured query language", "postgres", "postgresql", "mysql"],
  "design-tool": ["figma", "adobe xd"],
  "visual-design": ["illustration", "branding", "ui design", "user interface design", "graphic design", "brand design"],
  "ux-content": ["ux writing", "user experience writing", "content design", "microcopy"],
  communication: ["public speaking", "presentation skills"],
  "career-coaching": ["interview prep", "interview preparation", "interview coaching", "resume review"],
  "product-management": ["product strategy", "roadmap planning", "product roadmap", "agile coaching", "product discovery"],
  fitness: ["strength training", "workout coaching", "fitness planning", "training plan"],
  wellness: ["meal planning", "nutrition planning", "motivation coaching", "healthy meal planning"],
  music: ["guitar", "music theory"],
  math: ["calculus"],
  "ml-ai": ["machine learning", "ml", "machine learning basics"],
  "game-dev": ["unity", "unity basics", "game development", "game dev"],
  "qa-testing": ["api testing", "integration testing", "test automation", "qa testing"],
  architecture: ["system design", "backend architecture", "systems design"],
  "language-learning": ["spanish conversation", "conversational spanish", "spanish speaking"],
  "inclusive-design": ["accessibility", "a11y", "web accessibility", "wcag"],
  "spreadsheet-analysis": ["excel", "spreadsheet modeling", "data analysis"],
  productivity: ["timeboxing", "time management", "focus planning"],
};

const LOW_CONFIDENCE_MATCH_THRESHOLD = 0.35;
const TELEMETRY_TOP_LIMIT = 50;
const matchingTelemetry = {
  unmatchedWantedSkills: new Map(),
  unmatchedTeachSkills: new Map(),
  lowConfidencePairs: new Map(),
  totalEvaluations: 0,
  lastUpdatedAt: null,
};

// Build skill family alias lookup payload.
function buildSkillFamilyAliasLookup() {
  const aliases = {};

  Object.entries(SKILL_FAMILY_SYNONYMS).forEach(([family, terms]) => {
    terms.forEach((term) => {
      aliases[normalizeSkillKey(term)] = family;
    });
  });

  return aliases;
}

const SKILL_FAMILY_ALIASES = buildSkillFamilyAliasLookup();

// Run normalize text logic.
function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

// Run normalize skill key logic.
function normalizeSkillKey(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

// Run tokenize skill logic.
function tokenizeSkill(value) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

// Parse utc offset to minutes input.
function parseUtcOffsetToMinutes(timeZone) {
  const match = String(timeZone || "").match(/^UTC([+-])(\d{2}):(\d{2})$/i);
  if (!match) {
    return null;
  }

  const sign = match[1] === "+" ? 1 : -1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return sign * (hours * 60 + minutes);
}

// Parse time token to minutes input.
function parseTimeTokenToMinutes(token) {
  const match = String(token || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();

  if (period === "PM" && hours !== 12) {
    hours += 12;
  }
  if (period === "AM" && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

// Parse time range input.
function parseTimeRange(range) {
  const [startToken, endToken] = String(range || "").split("-").map((part) => part.trim());
  const start = parseTimeTokenToMinutes(startToken);
  const end = parseTimeTokenToMinutes(endToken);

  if (start === null || end === null || end <= start) {
    return null;
  }

  return { start, end };
}

// Get local day and minutes data.
function getLocalDayAndMinutes(date, offsetMinutes) {
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);

  return {
    day: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][shifted.getUTCDay()],
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

// Check whether user available at .
function isUserAvailableAt(user, scheduledDate, durationMinutes) {
  if (!user?.timeZone || !Array.isArray(user.availability) || user.availability.length === 0) {
    return false;
  }

  const offsetMinutes = parseUtcOffsetToMinutes(user.timeZone);
  if (offsetMinutes === null) {
    return false;
  }

  const localStart = getLocalDayAndMinutes(scheduledDate, offsetMinutes);
  const localEndMinutes = localStart.minutes + durationMinutes;

  if (localEndMinutes > 24 * 60) {
    return false;
  }

  return user.availability.some((slot) => {
    if (slot.day !== localStart.day) {
      return false;
    }

    const parsedRange = parseTimeRange(slot.timeRange);
    if (!parsedRange) {
      return false;
    }

    return (
      localStart.minutes >= parsedRange.start &&
      localEndMinutes <= parsedRange.end
    );
  });
}

// Run round up to interval logic.
function roundUpToInterval(date, intervalMinutes) {
  const intervalMs = intervalMinutes * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / intervalMs) * intervalMs);
}

// Get date range end data.
function getDateRangeEnd(daysAhead) {
  const end = new Date();
  end.setDate(end.getDate() + daysAhead);
  return end;
}

// Run to skill shape logic.
function toSkillShape(skill) {
  if (!skill) {
    return { name: "", normalized: "", family: null, category: "" };
  }

  const name = typeof skill === "string" ? skill : skill.skillName || "";
  const category = typeof skill === "string" ? "" : skill.category || "";
  const normalizedText = normalizeText(name);
  const normalized = normalizeSkillKey(name);

  return {
    name,
    normalizedText,
    normalized,
    tokens: tokenizeSkill(name),
    family: SKILL_FAMILY_ALIASES[normalized] || null,
    category: normalizeText(category),
  };
}

// Run compute token similarity logic.
function computeTokenSimilarity(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) {
    return 0;
  }

  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  const intersectionCount = [...aSet].filter((token) => bSet.has(token)).length;

  if (intersectionCount === 0) {
    return 0;
  }

  const unionCount = new Set([...aSet, ...bSet]).size;
  return intersectionCount / unionCount;
}

// Run increment map counter logic.
function incrementMapCounter(map, key) {
  if (!key) {
    return;
  }

  map.set(key, (map.get(key) || 0) + 1);
}

// Run top entries logic.
function topEntries(map, limit = TELEMETRY_TOP_LIMIT) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

// Run pair similarity logic.
function pairSimilarity(a, b) {
  if (!a.normalized || !b.normalized) {
    return 0;
  }

  if (a.normalized === b.normalized) {
    return 1;
  }

  if (a.normalized.length >= 5 && b.normalized.length >= 5) {
    if (a.normalized.includes(b.normalized) || b.normalized.includes(a.normalized)) {
      return 0.8;
    }
  }

  if (a.family && b.family && a.family === b.family) {
    return 0.75;
  }

  const tokenSimilarity = computeTokenSimilarity(a.tokens || [], b.tokens || []);
  if (tokenSimilarity >= 0.5) {
    return Math.max(0.6, tokenSimilarity);
  }

  if (a.category && b.category && a.category === b.category) {
    return 0.35;
  }

  return 0;
}

// Run best set similarity logic.
function bestSetSimilarity(sourceSkills, targetSkills) {
  if (!sourceSkills.length || !targetSkills.length) {
    return { average: 0, matches: [] };
  }

  const matches = sourceSkills.map((sourceSkill) => {
    let best = 0;
    let bestTarget = null;
    targetSkills.forEach((targetSkill) => {
      const score = pairSimilarity(sourceSkill, targetSkill);
      if (score > best) {
        best = score;
        bestTarget = targetSkill;
      }
    });

    return {
      sourceSkill,
      bestTarget,
      similarity: best,
    };
  });

  const sum = matches.reduce((acc, value) => acc + value.similarity, 0);
  return {
    average: sum / matches.length,
    matches,
  };
}

// Run format telemetry skill logic.
function formatTelemetrySkill(skill) {
  if (!skill) {
    return "";
  }

  return skill.normalizedText || skill.name || skill.normalized || "";
}

// Run record skill telemetry logic.
function recordSkillTelemetry(learnMatches, teachMatches) {
  const all = [...learnMatches, ...teachMatches];

  all.forEach((match) => {
    const sourceSkill = formatTelemetrySkill(match.sourceSkill);
    const bestTarget = formatTelemetrySkill(match.bestTarget);

    if (!sourceSkill) {
      return;
    }

    if (match.similarity < LOW_CONFIDENCE_MATCH_THRESHOLD) {
      if (learnMatches.includes(match)) {
        incrementMapCounter(matchingTelemetry.unmatchedWantedSkills, sourceSkill);
      } else {
        incrementMapCounter(matchingTelemetry.unmatchedTeachSkills, sourceSkill);
      }
    }

    if (bestTarget) {
      const pairKey = `${sourceSkill} -> ${bestTarget}`;
      if (match.similarity < 0.75) {
        incrementMapCounter(matchingTelemetry.lowConfidencePairs, pairKey);
      }
    }
  });

  matchingTelemetry.totalEvaluations += 1;
  matchingTelemetry.lastUpdatedAt = new Date().toISOString();
}

// Run compute skill score logic.
function computeSkillScore(currentUser, candidateUser) {
  const currentTeaches = (currentUser.skills || []).map(toSkillShape);
  const currentWants = (currentUser.skillsWanted || []).map(toSkillShape);
  const candidateTeaches = (candidateUser.skills || []).map(toSkillShape);
  const candidateWants = (candidateUser.skillsWanted || []).map(toSkillShape);

  const learnMatchData = bestSetSimilarity(currentWants, candidateTeaches);
  const teachMatchData = bestSetSimilarity(currentTeaches, candidateWants);

  recordSkillTelemetry(learnMatchData.matches, teachMatchData.matches);

  return {
    score: Math.round(((learnMatchData.average * 0.6) + (teachMatchData.average * 0.4)) * 100),
    currentWants,
    candidateTeaches,
    currentTeaches,
    candidateWants,
    learnMatches: learnMatchData.matches,
    teachMatches: teachMatchData.matches,
  };
}

// Run compute availability score logic.
function computeAvailabilityScore(currentUser, candidateUser) {
  const durationMinutes = 60;
  const daysAhead = 14;
  const intervalMinutes = 30;

  let overlapMinutes = 0;
  const overlapDays = new Set();
  let cursor = roundUpToInterval(new Date(), intervalMinutes);
  const rangeEnd = getDateRangeEnd(daysAhead);

  while (cursor <= rangeEnd) {
    if (
      isUserAvailableAt(currentUser, cursor, durationMinutes) &&
      isUserAvailableAt(candidateUser, cursor, durationMinutes)
    ) {
      overlapMinutes += durationMinutes;

      const currentOffset = parseUtcOffsetToMinutes(currentUser.timeZone);
      if (currentOffset !== null) {
        const localStart = getLocalDayAndMinutes(cursor, currentOffset);
        overlapDays.add(localStart.day);
      }
    }

    cursor = new Date(cursor.getTime() + intervalMinutes * 60 * 1000);
  }

  const hasOverlap = overlapMinutes > 0;
  const score = hasOverlap ? Math.min(100, Math.round((overlapMinutes / 180) * 100)) : 0;

  return { score, overlapMinutes, overlapDays: overlapDays.size, hasOverlap };
}

// Run compute timezone score logic.
function computeTimezoneScore(currentUser, candidateUser) {
  const currentOffset = parseUtcOffsetToMinutes(currentUser.timeZone);
  const candidateOffset = parseUtcOffsetToMinutes(candidateUser.timeZone);

  if (currentOffset === null || candidateOffset === null) {
    return { score: 50, gapHours: null };
  }

  const gapHours = Math.abs(currentOffset - candidateOffset) / 60;
  const score = Math.max(0, Math.round(100 - gapHours * 10));
  return { score, gapHours: Number(gapHours.toFixed(2)) };
}

// Run compute reliability score logic.
function computeReliabilityScore(candidateReliability) {
  if (!candidateReliability || candidateReliability.score === null || candidateReliability.score === undefined) {
    return 40;
  }

  return Number(candidateReliability.score);
}

// Build match reasons payload.
function buildMatchReasons({
  currentUser,
  candidateUser,
  skillData,
  availabilityData,
  timezoneData,
  candidateReliability,
}) {
  const reasons = [];

  const exactWantedMatches = [];
  skillData.currentWants.forEach((wantedSkill) => {
    const exact = skillData.candidateTeaches.find(
      (candidateSkill) => candidateSkill.normalized && candidateSkill.normalized === wantedSkill.normalized
    );
    if (exact) {
      exactWantedMatches.push(wantedSkill.name);
    }
  });

  if (exactWantedMatches.length > 0) {
    reasons.push(`Teaches skills you want: ${exactWantedMatches.slice(0, 2).join(", ")}`);
  } else if (skillData.score >= 55) {
    reasons.push("Strong skill-family compatibility in your learning goals");
  } else if (skillData.score >= 30) {
    reasons.push("Some category overlap in teach/learn preferences");
  }

  if (availabilityData.overlapDays > 0) {
    reasons.push(
      `Availability overlap on ${availabilityData.overlapDays} day${availabilityData.overlapDays > 1 ? "s" : ""}`
    );
  }

  if (timezoneData.gapHours !== null && timezoneData.gapHours <= 3) {
    reasons.push(`Timezone-friendly (${timezoneData.gapHours} hour difference)`);
  }

  if (candidateReliability && candidateReliability.score !== null && candidateReliability.score !== undefined) {
    reasons.push(`Reliability score ${candidateReliability.score} (${candidateReliability.tier})`);
  }

  if (reasons.length === 0) {
    reasons.push(
      `${candidateUser.name || candidateUser.username || "This user"} is a potential match based on profile proximity`
    );
  }

  return reasons.slice(0, 3);
}

// Run compute match logic.
function computeMatch(currentUser, candidateUser, candidateReliability = null) {
  const skillData = computeSkillScore(currentUser, candidateUser);
  const availabilityData = computeAvailabilityScore(currentUser, candidateUser);
  const timezoneData = computeTimezoneScore(currentUser, candidateUser);
  const reliabilityScore = computeReliabilityScore(candidateReliability);

  const matchScore = Math.round(
    skillData.score * 0.55 +
      availabilityData.score * 0.2 +
      timezoneData.score * 0.1 +
      reliabilityScore * 0.15
  );

  const reasons = buildMatchReasons({
    currentUser,
    candidateUser,
    skillData,
    availabilityData,
    timezoneData,
    candidateReliability,
  });

  return {
    matchScore,
    matchReasons: reasons,
    matchBreakdown: {
      skillScore: skillData.score,
      availabilityScore: availabilityData.score,
      timezoneScore: timezoneData.score,
      reliabilityScore,
    },
    hasScheduleableOverlap: availabilityData.hasOverlap,
  };
}

// Run rank candidates logic.
function rankCandidates(currentUser, candidates, reliabilityByUserId = {}) {
  const enriched = (candidates || []).map((candidate) => {
    const candidateObject =
      candidate && typeof candidate.toObject === "function"
        ? candidate.toObject()
        : { ...candidate };

    const candidateId = String(candidateObject._id || candidateObject.id || "");
    const reliability = reliabilityByUserId[candidateId] || null;
    const match = computeMatch(currentUser, candidateObject, reliability);

    return {
      ...candidateObject,
      ...match,
      reliability,
    };
  });

  const scheduleableOnly = enriched.filter((candidate) => candidate.hasScheduleableOverlap);

  scheduleableOnly.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }

    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  return scheduleableOnly;
}

// Get matching telemetry snapshot data.
function getMatchingTelemetrySnapshot() {
  return {
    totalEvaluations: matchingTelemetry.totalEvaluations,
    lastUpdatedAt: matchingTelemetry.lastUpdatedAt,
    unmatchedWantedSkills: topEntries(matchingTelemetry.unmatchedWantedSkills),
    unmatchedTeachSkills: topEntries(matchingTelemetry.unmatchedTeachSkills),
    lowConfidencePairs: topEntries(matchingTelemetry.lowConfidencePairs),
  };
}

// Run reset matching telemetry logic.
function resetMatchingTelemetry() {
  matchingTelemetry.unmatchedWantedSkills.clear();
  matchingTelemetry.unmatchedTeachSkills.clear();
  matchingTelemetry.lowConfidencePairs.clear();
  matchingTelemetry.totalEvaluations = 0;
  matchingTelemetry.lastUpdatedAt = null;
}

module.exports = {
  computeMatch,
  rankCandidates,
  normalizeSkillKey,
  parseUtcOffsetToMinutes,
  getMatchingTelemetrySnapshot,
  resetMatchingTelemetry,
};
