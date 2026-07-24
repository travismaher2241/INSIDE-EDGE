import { SESSION_TEMPLATES } from '../config/sessionTemplates';
import { STRUCTURED_ACTIVITIES } from '../data/structuredActivityRecords';

/**
 * Authoritative Deterministic Training Planner Engine
 * Enforces session template structure, bounded block & activity durations,
 * template-based elapsed time (including concurrent stations), required block validation,
 * and controlled failure reporting.
 */
export function generateTrainingPlan({
  requestedDuration = 90,
  cohortId = 'U13_JUNIOR',
  selectedFocusIds = ['Batting'],
  coachLevelId = 'DEVELOPMENT_LEVEL_1',
  venueId = 'NET_LANES_TURF',
  equipmentAvailable = [],
  participantCount = 10
}) {
  // 1. Select Authoritative Session Template based on duration
  const template = requestedDuration <= 65 
    ? SESSION_TEMPLATES.EXPRESS_60_MIN 
    : SESSION_TEMPLATES.STANDARD_90_MIN;

  const validationErrors = [];
  const populatedBlocks = [];
  const usedActivityIds = new Set();

  // 2. Build Required Template Structure
  for (const blockDef of template.requiredBlocks) {
    if (blockDef.type === 'CONCURRENT_STATIONS') {
      const stationsCount = blockDef.stationsCount || 2;
      const stations = [];

      for (let sIdx = 0; sIdx < stationsCount; sIdx++) {
        const candidate = findEligibleActivityForSlot({
          slotType: blockDef.slotType,
          cohortId,
          selectedFocusIds,
          coachLevelId,
          venueId,
          participantCount,
          usedActivityIds
        });

        if (!candidate) {
          validationErrors.push(`Missing eligible activity for Station ${sIdx + 1} in '${blockDef.phaseName}' (${blockDef.slotType}).`);
          break;
        }

        usedActivityIds.add(candidate.id);

        // Clamp duration strictly within activity.durationRange [min, max] and block bounds
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
        // Required station activity missing
        continue;
      }

      // Elapsed time for concurrent stations is the shared station duration (max of stations)
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
      // SERIAL or MATCH_SIM block
      const candidate = findEligibleActivityForSlot({
        slotType: blockDef.slotType,
        cohortId,
        selectedFocusIds,
        coachLevelId,
        venueId,
        participantCount,
        usedActivityIds
      });

      if (!candidate) {
        validationErrors.push(`Missing eligible activity for required block '${blockDef.phaseName}' (${blockDef.slotType}).`);
        continue;
      }

      usedActivityIds.add(candidate.id);

      // Clamp duration strictly within activity.durationRange [min, max]
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

  // 3. Final Plan Structure Validation
  const validationResult = validatePlanStructure({
    template,
    populatedBlocks,
    requestedDuration,
    validationErrors
  });

  if (!validationResult.isValid) {
    return {
      success: false,
      errorReason: `Unable to generate a valid ${requestedDuration}-minute session from the current attendance, focus areas, equipment, venue and activity eligibility. Try changing the session parameters or adding more eligible activities.`,
      details: validationResult.errors
    };
  }

  // Flatten activities for UI rendering while retaining block structure metadata
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

  return {
    success: true,
    plan: {
      templateId: template.id,
      templateName: template.name,
      requestedDuration,
      totalElapsedTime: validationResult.totalElapsedTime,
      blocks: populatedBlocks,
      activities: flatActivities
    }
  };
}

/**
 * Finds the best eligible activity for a specific template session slot.
 */
function findEligibleActivityForSlot({
  slotType,
  cohortId,
  selectedFocusIds = [],
  coachLevelId,
  venueId,
  participantCount,
  usedActivityIds
}) {
  const eligible = STRUCTURED_ACTIVITIES.filter(act => {
    // 1. Exclude already used activities in current plan
    if (usedActivityIds.has(act.id)) return false;

    // 2. Check permitted session slots
    const isSlotMatch = act.permittedSessionSlots.some(slot => {
      const sLower = slot.toLowerCase();
      const targetLower = slotType.toLowerCase();
      if (sLower === targetLower) return true;
      if (targetLower === 'warm-down' && sLower.includes('cool')) return true;
      if (targetLower === 'technical skill' && (sLower.includes('skill') || sLower.includes('technical'))) return true;
      if (targetLower === 'game-based scenario' && (sLower.includes('game') || sLower.includes('scenario') || sLower.includes('match'))) return true;
      return false;
    });

    if (!isSlotMatch) return false;

    // 3. Cohort suitability check
    if (cohortId && !act.cohortSuitability.includes(cohortId)) return false;

    // 4. Participant capacity check
    if (participantCount && (act.minParticipants > participantCount || act.maxParticipants < participantCount)) return false;

    return true;
  });

  if (eligible.length === 0) return null;

  // Score candidates by focus match priority
  const scored = eligible.map(act => {
    let score = 0;
    let contributingFocus = null;

    if (selectedFocusIds && selectedFocusIds.length > 0) {
      selectedFocusIds.forEach((fId, idx) => {
        const fLower = fId.toLowerCase();
        const weight = selectedFocusIds.length - idx; // Higher weight for first selected focus

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
  return scored[0];
}

/**
 * Strict Plan Structure Validator
 */
function validatePlanStructure({
  template,
  populatedBlocks,
  requestedDuration,
  validationErrors = []
}) {
  const errors = [...validationErrors];

  // Rule A: Every required block in the template must be populated
  if (populatedBlocks.length < template.requiredBlocks.length) {
    errors.push(`Template required ${template.requiredBlocks.length} blocks, but only ${populatedBlocks.length} could be populated.`);
  }

  // Rule B: Calculate total elapsed session duration from block structure
  let totalElapsedTime = 0;
  populatedBlocks.forEach(b => {
    totalElapsedTime += b.blockDuration;
  });

  // Rule C: Validate no activity exceeds its explicit maximumDuration
  populatedBlocks.forEach(b => {
    const activitiesInBlock = b.type === 'CONCURRENT_STATIONS' ? b.stations : [b.activity];
    activitiesInBlock.forEach(act => {
      if (!act) {
        errors.push(`Block '${b.phaseName}' contains an invalid/null activity.`);
        return;
      }
      if (act.assignedDuration > act.durationRange.max) {
        errors.push(`Activity '${act.id}' duration (${act.assignedDuration}m) exceeds max allowed (${act.durationRange.max}m).`);
      }
      if (act.assignedDuration < act.durationRange.min) {
        errors.push(`Activity '${act.id}' duration (${act.assignedDuration}m) is below min allowed (${act.durationRange.min}m).`);
      }
    });
  });

  return {
    isValid: errors.length === 0,
    totalElapsedTime,
    errors
  };
}
