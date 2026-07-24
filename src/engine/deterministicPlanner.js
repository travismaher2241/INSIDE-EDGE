import { SESSION_TEMPLATES } from '../config/sessionTemplates';
import { STRUCTURED_ACTIVITIES } from '../data/structuredActivityRecords';
import { VENUE_MODELS } from '../config/venues';

/**
 * Diagnostic Rejection Codes Taxonomy
 */
export const REJECTION_CODES = {
  COHORT_NOT_ELIGIBLE: 'COHORT_NOT_ELIGIBLE',
  COACH_LEVEL_TOO_LOW: 'COACH_LEVEL_TOO_LOW',
  TOO_FEW_PARTICIPANTS: 'TOO_FEW_PARTICIPANTS',
  TOO_MANY_PARTICIPANTS: 'TOO_MANY_PARTICIPANTS',
  VENUE_NOT_SUPPORTED: 'VENUE_NOT_SUPPORTED',
  NETS_REQUIRED: 'NETS_REQUIRED',
  OPEN_SPACE_REQUIRED: 'OPEN_SPACE_REQUIRED',
  EQUIPMENT_MISSING: 'EQUIPMENT_MISSING',
  SAFETY_RULE_BLOCK: 'SAFETY_RULE_BLOCK',
  SESSION_SLOT_NOT_ALLOWED: 'SESSION_SLOT_NOT_ALLOWED',
  FOCUS_NOT_COVERED: 'FOCUS_NOT_COVERED',
  DURATION_TOO_SHORT: 'DURATION_TOO_SHORT',
  DURATION_TOO_LONG: 'DURATION_TOO_LONG',
  NO_ACTIVITY_FOR_REQUIRED_BLOCK: 'NO_ACTIVITY_FOR_REQUIRED_BLOCK',
  NO_VALID_REPLACEMENT: 'NO_VALID_REPLACEMENT',
  TEMPLATE_CANNOT_FIT_DURATION: 'TEMPLATE_CANNOT_FIT_DURATION',
  LOCAL_RULESET_RESTRICTION: 'LOCAL_RULESET_RESTRICTION',
  UNKNOWN_OR_UNRESOLVED_RULE: 'UNKNOWN_OR_UNRESOLVED_RULE'
};

/**
 * Authoritative Deterministic Training Planner Engine
 * Includes Structured Diagnostics, Focus Coverage Analysis, and Actionable Suggestions.
 */
export function generateTrainingPlan({
  requestedDuration = 90,
  cohortId = 'U13_JUNIOR',
  selectedFocusIds = ['Batting'],
  coachLevelId = 'DEVELOPMENT_LEVEL_1',
  venueId = 'NET_LANES_TURF',
  equipmentAvailable = [],
  participantCount = 10,
  activeRuleset = null
}) {
  const template = requestedDuration <= 65 
    ? SESSION_TEMPLATES.EXPRESS_60_MIN 
    : SESSION_TEMPLATES.STANDARD_90_MIN;

  const failedBlocks = [];
  const populatedBlocks = [];
  const usedActivityIds = new Set();
  const allRejections = [];

  for (const blockDef of template.requiredBlocks) {
    if (blockDef.type === 'CONCURRENT_STATIONS') {
      const stationsCount = blockDef.stationsCount || 2;
      const stations = [];

      for (let sIdx = 0; sIdx < stationsCount; sIdx++) {
        const { candidate, rejections } = evaluateCandidatesForSlot({
          slotType: blockDef.slotType,
          cohortId,
          selectedFocusIds,
          coachLevelId,
          venueId,
          equipmentAvailable,
          participantCount,
          usedActivityIds,
          activeRuleset
        });

        allRejections.push(...rejections);

        if (!candidate) {
          failedBlocks.push({
            blockId: blockDef.blockId,
            phaseName: blockDef.phaseName,
            slotType: blockDef.slotType,
            stationNumber: sIdx + 1,
            reason: `No eligible activity found for station ${sIdx + 1} (${blockDef.slotType})`
          });
          break;
        }

        usedActivityIds.add(candidate.id);

        const targetDuration = Math.min(blockDef.idealDuration, candidate.durationRange.max);
        const assignedDuration = Math.max(candidate.durationRange.min, Math.min(candidate.durationRange.max, targetDuration));

        stations.push({
          ...candidate,
          assignedDuration,
          stationNumber: sIdx + 1,
          contributingFocus: candidate.contributingFocus || (selectedFocusIds && selectedFocusIds[0]) || candidate.activityCategory
        });
      }

      if (stations.length < stationsCount) {
        continue;
      }

      const sharedStationDuration = Math.max(...stations.map(s => s.assignedDuration));

      populatedBlocks.push({
        blockId: blockDef.blockId,
        phaseName: blockDef.phaseName,
        slotType: blockDef.slotType,
        type: 'CONCURRENT_STATIONS',
        blockDuration: sharedStationDuration,
        stations
      });

    } else {
      const { candidate, rejections } = evaluateCandidatesForSlot({
        slotType: blockDef.slotType,
        cohortId,
        selectedFocusIds,
        coachLevelId,
        venueId,
        equipmentAvailable,
        participantCount,
        usedActivityIds,
        activeRuleset
      });

      allRejections.push(...rejections);

      if (!candidate) {
        failedBlocks.push({
          blockId: blockDef.blockId,
          phaseName: blockDef.phaseName,
          slotType: blockDef.slotType,
          reason: `Required block '${blockDef.phaseName}' (${blockDef.slotType}) could not be populated`
        });
        continue;
      }

      usedActivityIds.add(candidate.id);

      const targetDuration = Math.min(blockDef.idealDuration, candidate.durationRange.max);
      const assignedDuration = Math.max(candidate.durationRange.min, Math.min(candidate.durationRange.max, targetDuration));

      populatedBlocks.push({
        blockId: blockDef.blockId,
        phaseName: blockDef.phaseName,
        slotType: blockDef.slotType,
        type: blockDef.type,
        blockDuration: assignedDuration,
        activity: {
          ...candidate,
          assignedDuration,
          contributingFocus: candidate.contributingFocus || (selectedFocusIds && selectedFocusIds[0]) || candidate.activityCategory
        }
      });
    }
  }

  const focusCoverage = analyzeFocusCoverage({
    selectedFocusIds,
    cohortId,
    coachLevelId,
    venueId,
    equipmentAvailable,
    participantCount,
    activeRuleset
  });

  const isComplete = populatedBlocks.length === template.requiredBlocks.length;

  if (!isComplete || failedBlocks.length > 0) {
    const rejectionSummary = summarizeRejections(allRejections);
    const primaryReasons = buildPrimaryReasons({
      failedBlocks,
      focusCoverage,
      venueId,
      participantCount,
      cohortId,
      requestedDuration,
      template,
      rejectionSummary,
      activeRuleset
    });

    const suggestions = generateActionableSuggestions({
      venueId,
      selectedFocusIds,
      focusCoverage,
      participantCount,
      cohortId,
      coachLevelId,
      requestedDuration,
      rejectionSummary,
      activeRuleset
    });

    return {
      success: false,
      requestedDuration,
      failedBlocks,
      focusCoverage,
      rejectionSummary,
      primaryReasons,
      suggestedChanges: suggestions,
      userMessage: `Unable to generate a valid ${requestedDuration}-minute session plan due to parameter constraints.`,
      technicalDetails: allRejections
    };
  }

  const flatActivities = [];
  populatedBlocks.forEach(b => {
    if (b.type === 'CONCURRENT_STATIONS') {
      b.stations.forEach(st => {
        flatActivities.push({
          ...st,
          phaseName: b.phaseName,
          blockType: b.type,
          blockDuration: b.blockDuration
        });
      });
    } else {
      flatActivities.push({
        ...b.activity,
        phaseName: b.phaseName,
        blockType: b.type,
        blockDuration: b.blockDuration
      });
    }
  });

  let totalElapsedTime = 0;
  populatedBlocks.forEach(b => totalElapsedTime += b.blockDuration);

  return {
    success: true,
    plan: {
      templateId: template.id,
      templateName: template.name,
      requestedDuration,
      totalElapsedTime,
      blocks: populatedBlocks,
      activities: flatActivities
    }
  };
}

function evaluateCandidatesForSlot({
  slotType,
  cohortId,
  selectedFocusIds = [],
  coachLevelId,
  venueId,
  equipmentAvailable = [],
  participantCount,
  usedActivityIds,
  activeRuleset
}) {
  const rejections = [];
  const eligible = [];

  STRUCTURED_ACTIVITIES.forEach(act => {
    if (usedActivityIds.has(act.id)) {
      return;
    }

    const isSlotMatch = act.permittedSessionSlots.some(slot => {
      const sLower = slot.toLowerCase();
      const targetLower = slotType.toLowerCase();
      if (sLower === targetLower) return true;
      if (targetLower === 'warm-down' && sLower.includes('cool')) return true;
      if (targetLower === 'technical skill' && (sLower.includes('skill') || sLower.includes('technical'))) return true;
      if (targetLower === 'game-based scenario' && (sLower.includes('game') || sLower.includes('scenario') || sLower.includes('match'))) return true;
      return false;
    });

    if (!isSlotMatch) {
      rejections.push({
        activityId: act.id,
        activityTitle: act.title,
        code: REJECTION_CODES.SESSION_SLOT_NOT_ALLOWED,
        reason: `Activity slot '${act.permittedSessionSlots.join(', ')}' does not permit '${slotType}'`
      });
      return;
    }

    if (cohortId && !act.cohortSuitability.includes(cohortId)) {
      rejections.push({
        activityId: act.id,
        activityTitle: act.title,
        code: REJECTION_CODES.COHORT_NOT_ELIGIBLE,
        reason: `Activity is not suitable for cohort '${cohortId}'`
      });
      return;
    }

    if (participantCount < act.minParticipants) {
      rejections.push({
        activityId: act.id,
        activityTitle: act.title,
        code: REJECTION_CODES.TOO_FEW_PARTICIPANTS,
        reason: `Requires min ${act.minParticipants} participants, but only ${participantCount} checked in`
      });
      return;
    }
    if (participantCount > act.maxParticipants) {
      rejections.push({
        activityId: act.id,
        activityTitle: act.title,
        code: REJECTION_CODES.TOO_MANY_PARTICIPANTS,
        reason: `Exceeds max ${act.maxParticipants} participants for current group size (${participantCount})`
      });
      return;
    }

    if (venueId && act.venueRequirements && act.venueRequirements.length > 0) {
      if (!act.venueRequirements.includes(venueId)) {
        const isNetReq = act.venueRequirements.some(v => v.includes('NET'));
        const isOvalReq = act.venueRequirements.some(v => v.includes('OVAL'));
        const code = isNetReq ? REJECTION_CODES.NETS_REQUIRED : (isOvalReq ? REJECTION_CODES.OPEN_SPACE_REQUIRED : REJECTION_CODES.VENUE_NOT_SUPPORTED);
        rejections.push({
          activityId: act.id,
          activityTitle: act.title,
          code,
          reason: `Requires venue '${act.venueRequirements.join('/')}', but selected venue is '${venueId}'`
        });
        return;
      }
    }

    if (equipmentAvailable.length > 0 && act.equipmentRequirements) {
      const missing = act.equipmentRequirements.filter(eq => !equipmentAvailable.includes(eq));
      if (missing.length > 0) {
        rejections.push({
          activityId: act.id,
          activityTitle: act.title,
          code: REJECTION_CODES.EQUIPMENT_MISSING,
          reason: `Missing required equipment: ${missing.join(', ')}`
        });
        return;
      }
    }

    if (activeRuleset && activeRuleset.conflicts) {
      const conflict = activeRuleset.conflicts.find(c => c.targetActivityId === act.id);
      if (conflict) {
        rejections.push({
          activityId: act.id,
          activityTitle: act.title,
          code: REJECTION_CODES.LOCAL_RULESET_RESTRICTION,
          reason: `Restricted by active ruleset '${activeRuleset.name}'`
        });
        return;
      }
    }

    eligible.push(act);
  });

  if (eligible.length === 0) {
    return { candidate: null, rejections };
  }

  const scored = eligible.map(act => {
    let score = 0;
    let contributingFocus = null;

    if (selectedFocusIds && selectedFocusIds.length > 0) {
      selectedFocusIds.forEach((fId, idx) => {
        const fLower = fId.toLowerCase();
        const weight = selectedFocusIds.length - idx;

        if (act.activityCategory.toLowerCase().includes(fLower)) {
          score += 5 * weight;
          if (!contributingFocus) contributingFocus = fId;
        }
        if (act.primarySkills.some(s => s.toLowerCase().includes(fLower))) {
          score += 3 * weight;
          if (!contributingFocus) contributingFocus = fId;
        }
        if (act.tacticalConcepts.some(t => t.toLowerCase().includes(fLower))) {
          score += 2 * weight;
          if (!contributingFocus) contributingFocus = fId;
        }
      });
    }

    return {
      ...act,
      score,
      contributingFocus: contributingFocus || (selectedFocusIds && selectedFocusIds[0]) || act.activityCategory
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return { candidate: scored[0], rejections };
}

function analyzeFocusCoverage({
  selectedFocusIds = [],
  cohortId,
  coachLevelId,
  venueId,
  equipmentAvailable = [],
  participantCount,
  activeRuleset
}) {
  return selectedFocusIds.map(focusId => {
    const matchingActs = STRUCTURED_ACTIVITIES.filter(act => {
      const fLower = focusId.toLowerCase();
      return act.activityCategory.toLowerCase().includes(fLower) ||
             act.primarySkills.some(s => s.toLowerCase().includes(fLower)) ||
             act.tacticalConcepts.some(t => t.toLowerCase().includes(fLower));
    });

    const eligibleMatching = matchingActs.filter(act => {
      if (cohortId && !act.cohortSuitability.includes(cohortId)) return false;
      if (participantCount < act.minParticipants || participantCount > act.maxParticipants) return false;
      if (venueId && act.venueRequirements && act.venueRequirements.length > 0 && !act.venueRequirements.includes(venueId)) return false;
      return true;
    });

    let primaryRejection = null;
    let rejectionReason = null;

    if (eligibleMatching.length === 0 && matchingActs.length > 0) {
      const sample = matchingActs[0];
      if (venueId && sample.venueRequirements && !sample.venueRequirements.includes(venueId)) {
        primaryRejection = REJECTION_CODES.VENUE_NOT_SUPPORTED;
        rejectionReason = `No eligible activities for selected venue (${venueId})`;
      } else if (participantCount < sample.minParticipants || participantCount > sample.maxParticipants) {
        primaryRejection = REJECTION_CODES.TOO_FEW_PARTICIPANTS;
        rejectionReason = `Participant count (${participantCount}) outside activity bounds (${sample.minParticipants}-${sample.maxParticipants})`;
      } else {
        primaryRejection = REJECTION_CODES.COHORT_NOT_ELIGIBLE;
        rejectionReason = `No eligible activities for cohort ${cohortId}`;
      }
    }

    return {
      focusId,
      totalCount: matchingActs.length,
      eligibleCount: eligibleMatching.length,
      isEligible: eligibleMatching.length > 0,
      primaryRejection,
      rejectionReason
    };
  });
}

function summarizeRejections(rejections) {
  const summary = {};
  rejections.forEach(r => {
    if (!summary[r.code]) {
      summary[r.code] = { code: r.code, count: 0, sampleReason: r.reason };
    }
    summary[r.code].count += 1;
  });
  return Object.values(summary);
}

function buildPrimaryReasons({
  failedBlocks,
  focusCoverage,
  venueId,
  participantCount,
  cohortId,
  requestedDuration,
  template,
  rejectionSummary,
  activeRuleset
}) {
  const reasons = [];

  failedBlocks.forEach(fb => {
    reasons.push(`${fb.phaseName} block (${fb.slotType}) could not be populated.`);
  });

  focusCoverage.filter(f => !f.isEligible).forEach(f => {
    reasons.push(`No eligible '${f.focusId}' activities are available for venue ${venueId}.`);
  });

  if (activeRuleset) {
    reasons.push(`Active local ruleset '${activeRuleset.name}' restricted candidate activities.`);
  }

  if (reasons.length === 0) {
    const venueRej = rejectionSummary.find(s => 
      s.code === REJECTION_CODES.VENUE_NOT_SUPPORTED || 
      s.code === REJECTION_CODES.OPEN_SPACE_REQUIRED ||
      s.code === REJECTION_CODES.NETS_REQUIRED
    );
    if (venueRej) {
      reasons.push(`Selected venue '${venueId}' restricts required open-space / game-based activities.`);
    } else {
      reasons.push(`Insufficient eligible activities matching your selected attendance (${participantCount}), cohort (${cohortId}), and venue (${venueId}).`);
    }
  }

  return reasons;
}

function generateActionableSuggestions({
  venueId,
  selectedFocusIds,
  focusCoverage,
  participantCount,
  cohortId,
  coachLevelId,
  requestedDuration,
  rejectionSummary,
  activeRuleset
}) {
  const suggestions = [];

  const hasVenueRejection = rejectionSummary.some(r => 
    r.code === REJECTION_CODES.VENUE_NOT_SUPPORTED || 
    r.code === REJECTION_CODES.OPEN_SPACE_REQUIRED ||
    r.code === REJECTION_CODES.NETS_REQUIRED
  );
  if (hasVenueRejection && venueId !== 'FULL_OVAL') {
    suggestions.push({
      type: 'CHANGE_VENUE',
      label: 'Change venue to Full Oval',
      targetVenue: 'FULL_OVAL'
    });
  }

  const ineligibleFocuses = focusCoverage.filter(f => !f.isEligible);
  ineligibleFocuses.forEach(f => {
    suggestions.push({
      type: 'REMOVE_FOCUS',
      label: `Remove '${f.focusId}' focus`,
      targetFocus: f.focusId
    });
  });

  if (requestedDuration > 60) {
    suggestions.push({
      type: 'CHANGE_DURATION',
      label: 'Switch to Express 60-Minute Session',
      targetDuration: 60
    });
  }

  return suggestions;
}
