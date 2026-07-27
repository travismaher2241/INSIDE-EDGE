import { SESSION_TEMPLATES } from '../config/sessionTemplates';
import { STRUCTURED_ACTIVITIES } from '../data/structuredActivityRecords';
import { REJECTION_CODES } from '../config/rejectionCodes';
import { resolveFacilityCapabilities } from '../config/venues';
import { generateNetsSessionPlan, calculateBattingCapacity } from './cricketNetsPlanner';
import { generateCentreWicketPlan } from './centreWicketPlanner';

export { calculateBattingCapacity, REJECTION_CODES, generateNetsSessionPlan, generateCentreWicketPlan };

/**
 * Unified Deterministic Training Planner Entry Point
 * Routes generation to NetsSessionPlanner, CentreWicketPlanner, or Standard Phase Engine
 */
export function generateTrainingPlan(params = {}) {
  const { sessionType } = params;

  if (sessionType === 'NETS_SESSION') {
    return generateNetsSessionPlan(params);
  }

  if (sessionType === 'CENTRE_WICKET_PRACTICE') {
    return generateCentreWicketPlan(params);
  }

  return _generateStandardTrainingPlan(params);
}

/**
 * Flexible Phase-Based Standard Session Engine
 */
function _generateStandardTrainingPlan({
  requestedDuration = 90,
  cohortId = 'U13_JUNIOR',
  selectedFocusIds = ['Batting'],
  coachLevelId = 'DEVELOPMENT_LEVEL_1',
  venueId = 'COMBINED_FACILITY',
  facilityFeatures = {},
  equipmentAvailable = [],
  participantCount = 10,
  activeRuleset = null
}) {
  if (participantCount <= 0) {
    return {
      success: false,
      userMessage: 'Session planning requires at least 1 checked-in participant.',
      primaryReasons: ['Participant attendance is zero.'],
      suggestedChanges: [{ type: 'ADD_ATTENDANCE', label: 'Check in present players' }]
    };
  }

  const facilityCapabilities = resolveFacilityCapabilities(venueId, facilityFeatures);

  const template = requestedDuration <= 65 
    ? SESSION_TEMPLATES.EXPRESS_60_MIN 
    : SESSION_TEMPLATES.STANDARD_90_MIN;

  const durationScaleFactor = requestedDuration / (template ? template.totalDuration : 90);

  const populatedPhases = [];
  const usedActivityIds = new Set();
  const allRejections = [];
  const failedPhases = [];

  if (!template) {
    return {
      success: false,
      userMessage: `Unable to generate a valid ${requestedDuration}-minute training session.`,
      primaryReasons: ['No suitable session template found.']
    };
  }

  for (const phaseDef of template.phases) {
    if (phaseDef.phaseId === 'p_prep') {
      const { candidate, rejections } = evaluateCandidatesForSlot({
        slotType: 'Warm-up',
        cohortId,
        selectedFocusIds,
        _coachLevelId: coachLevelId,
        facilityCapabilities,
        equipmentAvailable,
        participantCount,
        usedActivityIds,
        activeRuleset
      });

      allRejections.push(...rejections);

      if (!candidate && phaseDef.required) {
        failedPhases.push({
          phaseId: phaseDef.phaseId,
          phaseName: phaseDef.phaseName,
          reason: 'No eligible Warm-up activity found matching constraints.'
        });
        break;
      }

      if (candidate) {
        usedActivityIds.add(candidate.id);
        const rawTarget = Math.round(phaseDef.idealDuration * durationScaleFactor);
        const assignedDuration = Math.max(candidate.durationRange.min, Math.min(candidate.durationRange.max, rawTarget));

        populatedPhases.push({
          phaseId: phaseDef.phaseId,
          phaseName: phaseDef.phaseName,
          type: 'SERIAL_WHOLE_GROUP',
          phaseDuration: assignedDuration,
          activities: [{
            ...candidate,
            assignedDuration,
            contributingFocus: candidate.contributingFocus || selectedFocusIds[0] || candidate.activityCategory
          }]
        });
      }

    } else if (phaseDef.phaseId === 'p_dev') {
      let devPhaseSuccess = false;
      let devPhasePopulated = null;

      for (const structOpt of phaseDef.structuralOptions) {
        if (structOpt.type === 'CONCURRENT_GROUPS') {
          const stationsCount = structOpt.stationCount || 2;
          const effectiveStationParticipants = Math.max(1, Math.ceil(participantCount / stationsCount));
          const stationActivities = [];
          const tempUsed = new Set(usedActivityIds);
          let allStationsValid = true;

          for (let sIdx = 0; sIdx < stationsCount; sIdx++) {
            const targetFocus = selectedFocusIds[sIdx % selectedFocusIds.length] || selectedFocusIds[0];
            const { candidate, rejections } = evaluateCandidatesForSlot({
              slotType: 'Development',
              cohortId,
              selectedFocusIds: [targetFocus],
              _coachLevelId: coachLevelId,
              facilityCapabilities,
              equipmentAvailable,
              participantCount: effectiveStationParticipants,
              usedActivityIds: tempUsed,
              activeRuleset
            });

            allRejections.push(...rejections);

            if (!candidate) {
              allStationsValid = false;
              break;
            }

            tempUsed.add(candidate.id);
            const rawTarget = Math.round(phaseDef.idealDuration * durationScaleFactor);
            const stationDuration = Math.max(candidate.durationRange.min, Math.min(candidate.durationRange.max, rawTarget));

            stationActivities.push({
              ...candidate,
              assignedDuration: stationDuration,
              stationNumber: sIdx + 1,
              contributingFocus: targetFocus || candidate.activityCategory
            });
          }

          if (allStationsValid && stationActivities.length === stationsCount) {
            stationActivities.forEach(act => usedActivityIds.add(act.id));
            devPhaseSuccess = true;
            devPhasePopulated = {
              phaseId: phaseDef.phaseId,
              phaseName: phaseDef.phaseName,
              type: 'CONCURRENT_GROUPS',
              phaseDuration: Math.max(...stationActivities.map(s => s.assignedDuration)),
              stations: stationActivities
            };
            break;
          }

        } else if (structOpt.type === 'SERIAL_WHOLE_GROUP') {
          const serialActivities = [];
          const tempUsed = new Set(usedActivityIds);
          let allSerialValid = true;
          const blockCount = Math.min(2, selectedFocusIds.length);

          for (let bIdx = 0; bIdx < blockCount; bIdx++) {
            const targetFocus = selectedFocusIds[bIdx];
            const { candidate, rejections } = evaluateCandidatesForSlot({
              slotType: 'Development',
              cohortId,
              selectedFocusIds: [targetFocus],
              _coachLevelId: coachLevelId,
              facilityCapabilities,
              equipmentAvailable,
              participantCount,
              usedActivityIds: tempUsed,
              activeRuleset
            });

            allRejections.push(...rejections);

            if (!candidate) {
              allSerialValid = false;
              break;
            }

            tempUsed.add(candidate.id);
            const rawTarget = Math.round((phaseDef.idealDuration / blockCount) * durationScaleFactor);
            const blockDuration = Math.max(candidate.durationRange.min, Math.min(candidate.durationRange.max, rawTarget));

            serialActivities.push({
              ...candidate,
              assignedDuration: blockDuration,
              contributingFocus: targetFocus || candidate.activityCategory
            });
          }

          if (allSerialValid && serialActivities.length > 0) {
            serialActivities.forEach(act => usedActivityIds.add(act.id));
            devPhaseSuccess = true;
            devPhasePopulated = {
              phaseId: phaseDef.phaseId,
              phaseName: phaseDef.phaseName,
              type: 'SERIAL_WHOLE_GROUP',
              phaseDuration: serialActivities.reduce((acc, s) => acc + s.assignedDuration, 0),
              activities: serialActivities
            };
            break;
          }

        } else if (structOpt.type === 'SINGLE_WHOLE_GROUP') {
          const { candidate, rejections } = evaluateCandidatesForSlot({
            slotType: 'Development',
            cohortId,
            selectedFocusIds,
            _coachLevelId: coachLevelId,
            facilityCapabilities,
            equipmentAvailable,
            participantCount,
            usedActivityIds,
            activeRuleset
          });

          allRejections.push(...rejections);

          if (candidate) {
            usedActivityIds.add(candidate.id);
            const rawTarget = Math.round(phaseDef.idealDuration * durationScaleFactor);
            const assignedDuration = Math.max(candidate.durationRange.min, Math.min(candidate.durationRange.max, rawTarget));

            devPhaseSuccess = true;
            devPhasePopulated = {
              phaseId: phaseDef.phaseId,
              phaseName: phaseDef.phaseName,
              type: 'SINGLE_WHOLE_GROUP',
              phaseDuration: assignedDuration,
              activities: [{
                ...candidate,
                assignedDuration,
                contributingFocus: candidate.contributingFocus || selectedFocusIds[0] || candidate.activityCategory
              }]
            };
            break;
          }
        }
      }

      if (devPhaseSuccess && devPhasePopulated) {
        populatedPhases.push(devPhasePopulated);
      } else {
        failedPhases.push({
          phaseId: phaseDef.phaseId,
          phaseName: phaseDef.phaseName,
          reason: 'Development phase could not be populated using concurrent, serial, or single whole-group structures.'
        });
        break;
      }

    } else if (phaseDef.phaseId === 'p_app') {
      const { candidate, rejections } = evaluateCandidatesForSlot({
        slotType: 'Game-Based Scenario',
        cohortId,
        selectedFocusIds,
        _coachLevelId: coachLevelId,
        facilityCapabilities,
        equipmentAvailable,
        participantCount,
        usedActivityIds,
        activeRuleset
      });

      allRejections.push(...rejections);

      if (!candidate && phaseDef.required) {
        failedPhases.push({
          phaseId: phaseDef.phaseId,
          phaseName: phaseDef.phaseName,
          reason: 'Application Phase (Game-Based Scenario) could not be populated matching constraints.'
        });
        break;
      }

      if (candidate) {
        usedActivityIds.add(candidate.id);
        const rawTarget = Math.round(phaseDef.idealDuration * durationScaleFactor);
        const assignedDuration = Math.max(candidate.durationRange.min, Math.min(candidate.durationRange.max, rawTarget));

        populatedPhases.push({
          phaseId: phaseDef.phaseId,
          phaseName: phaseDef.phaseName,
          type: 'MATCH_SIM',
          phaseDuration: assignedDuration,
          activities: [{
            ...candidate,
            assignedDuration,
            contributingFocus: candidate.contributingFocus || selectedFocusIds[0] || candidate.activityCategory
          }]
        });
      }

    } else if (phaseDef.phaseId === 'p_cooldown') {
      const { candidate } = evaluateCandidatesForSlot({
        slotType: 'Warm-down',
        cohortId,
        selectedFocusIds,
        _coachLevelId: coachLevelId,
        facilityCapabilities,
        equipmentAvailable,
        participantCount,
        usedActivityIds,
        activeRuleset
      });

      if (candidate) {
        usedActivityIds.add(candidate.id);
        const rawTarget = Math.round(phaseDef.idealDuration * durationScaleFactor);
        const assignedDuration = Math.max(candidate.durationRange.min, Math.min(candidate.durationRange.max, rawTarget));

        populatedPhases.push({
          phaseId: phaseDef.phaseId,
          phaseName: phaseDef.phaseName,
          type: 'SERIAL_WHOLE_GROUP',
          phaseDuration: assignedDuration,
          activities: [{
            ...candidate,
            assignedDuration,
            contributingFocus: candidate.contributingFocus || candidate.activityCategory
          }]
        });
      }
    }
  }

  const focusCoverage = analyzeFocusCoverage({
    selectedFocusIds,
    cohortId,
    _coachLevelId: coachLevelId,
    facilityCapabilities,
    equipmentAvailable,
    participantCount,
    activeRuleset
  });

  const isComplete = failedPhases.length === 0;

  if (!isComplete) {
    const rejectionSummary = summarizeRejections(allRejections);
    const primaryReasons = buildPrimaryReasons({
      failedPhases,
      focusCoverage,
      facilityCapabilities,
      participantCount,
      cohortId,
      rejectionSummary,
      activeRuleset
    });

    const suggestions = generateActionableSuggestions({
      facilityCapabilities,
      _selectedFocusIds: selectedFocusIds,
      focusCoverage,
      _participantCount: participantCount,
      _cohortId: cohortId,
      _coachLevelId: coachLevelId,
      requestedDuration,
      rejectionSummary,
      _activeRuleset: activeRuleset
    });

    return {
      success: false,
      requestedDuration,
      failedPhases,
      focusCoverage,
      rejectionSummary,
      primaryReasons,
      suggestedChanges: suggestions,
      userMessage: `Unable to generate a valid ${requestedDuration}-minute training session with current facility and parameter settings.`,
      technicalDetails: allRejections
    };
  }

  const flatActivities = [];
  populatedPhases.forEach(ph => {
    if (ph.type === 'CONCURRENT_GROUPS') {
      ph.stations.forEach(st => {
        flatActivities.push({
          ...st,
          phaseName: ph.phaseName,
          blockType: ph.type,
          blockDuration: ph.phaseDuration
        });
      });
    } else if (ph.activities) {
      ph.activities.forEach(act => {
        flatActivities.push({
          ...act,
          phaseName: ph.phaseName,
          blockType: ph.type,
          blockDuration: ph.phaseDuration
        });
      });
    }
  });

  let totalElapsedTime = 0;
  populatedPhases.forEach(ph => totalElapsedTime += ph.phaseDuration);

  return {
    success: true,
    plan: {
      templateId: template.id,
      templateName: template.name,
      sessionType: 'STANDARD_SESSION',
      requestedDuration,
      totalElapsedTime,
      blocks: populatedPhases,
      phases: populatedPhases,
      activities: flatActivities
    }
  };
}

function evaluateCandidatesForSlot({
  slotType,
  cohortId,
  selectedFocusIds = [],
  _coachLevelId,
  facilityCapabilities,
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
      if (targetLower === 'warm-up' && (sLower.includes('warm') || sLower.includes('prep'))) return true;
      if (targetLower === 'development' && (sLower.includes('dev') || sLower.includes('skill') || sLower.includes('tech'))) return true;
      if (targetLower === 'game-based scenario' && (sLower.includes('game') || sLower.includes('scenario') || sLower.includes('match'))) return true;
      if (targetLower === 'warm-down' && (sLower.includes('cool') || sLower.includes('down') || sLower.includes('cond'))) return true;
      return false;
    });

    if (!isSlotMatch) {
      rejections.push({
        activityId: act.id,
        activityTitle: act.title,
        code: REJECTION_CODES.SESSION_SLOT_NOT_ALLOWED,
        reason: `Activity '${act.title}' (${act.permittedSessionSlots.join(', ')}) does not match slot type '${slotType}'`
      });
      return;
    }

    if (cohortId && !act.cohortSuitability.includes(cohortId)) {
      rejections.push({
        activityId: act.id,
        activityTitle: act.title,
        code: REJECTION_CODES.COHORT_NOT_ELIGIBLE,
        reason: `Activity '${act.title}' is not suitable for cohort '${cohortId}'`
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

    if (facilityCapabilities && act.venueRequirements && act.venueRequirements.length > 0) {
      const requiresNets = act.venueRequirements.some(v => v.includes('NET'));
      const requiresOpenField = act.venueRequirements.some(v => v.includes('OVAL') || v.includes('FIELD') || v === 'COMBINED_FACILITY') && !act.venueRequirements.includes('NET_LANES_TURF') && !act.venueRequirements.includes('NET_LANES_SYNTHETIC');

      let venueValid = true;
      if (requiresNets && !facilityCapabilities.hasNetLanes) venueValid = false;
      if (requiresOpenField && !facilityCapabilities.hasOpenField) venueValid = false;
      if (act.venueRequirements.length === 1 && act.venueRequirements[0] === 'INDOOR_FACILITY' && !facilityCapabilities.hasIndoorArea && !facilityCapabilities.hasNetLanes) venueValid = false;

      if (!venueValid) {
        const code = requiresNets ? REJECTION_CODES.NETS_REQUIRED : (requiresOpenField ? REJECTION_CODES.OPEN_SPACE_REQUIRED : REJECTION_CODES.VENUE_NOT_SUPPORTED);
        const reason = requiresOpenField && !facilityCapabilities.hasOpenField
          ? `${act.activityCategory} requires open training space. Net lanes alone do not provide a valid area for '${act.title}'.`
          : `Requires facility capabilities matching '${act.venueRequirements.join('/')}', which are not available today.`;

        rejections.push({
          activityId: act.id,
          activityTitle: act.title,
          code,
          reason
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
      contributingFocus: contributingFocus || selectedFocusIds[0] || act.activityCategory
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return { candidate: scored[0], rejections };
}

function analyzeFocusCoverage({
  selectedFocusIds = [],
  cohortId,
  _coachLevelId,
  facilityCapabilities,
  _equipmentAvailable = [],
  participantCount,
  _activeRuleset
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
      
      if (facilityCapabilities && act.venueRequirements && act.venueRequirements.length > 0) {
        const requiresNets = act.venueRequirements.some(v => v.includes('NET'));
        const requiresOpenField = act.venueRequirements.some(v => v.includes('OVAL') || v.includes('FIELD') || v === 'COMBINED_FACILITY') && !act.venueRequirements.includes('NET_LANES_TURF') && !act.venueRequirements.includes('NET_LANES_SYNTHETIC');

        let venueValid = true;
        if (requiresNets && !facilityCapabilities.hasNetLanes) venueValid = false;
        if (requiresOpenField && !facilityCapabilities.hasOpenField) venueValid = false;
        if (!venueValid) return false;
      }
      return true;
    });

    let primaryRejection = null;
    let rejectionReason = null;

    if (eligibleMatching.length === 0 && matchingActs.length > 0) {
      const sample = matchingActs[0];
      const requiresOpenField = sample.venueRequirements.some(v => v.includes('OVAL') || v.includes('FIELD') || v === 'COMBINED_FACILITY') && !sample.venueRequirements.includes('NET_LANES_TURF') && !sample.venueRequirements.includes('NET_LANES_SYNTHETIC');
      if (requiresOpenField && !facilityCapabilities.hasOpenField) {
        primaryRejection = REJECTION_CODES.OPEN_SPACE_REQUIRED;
        rejectionReason = `${focusId} requires open training space. Net lanes alone do not provide a valid area for the selected fielding activities.`;
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
  failedPhases,
  focusCoverage,
  facilityCapabilities,
  participantCount,
  cohortId,
  rejectionSummary,
  activeRuleset
}) {
  const reasons = [];

  failedPhases.forEach(fp => {
    reasons.push(`${fp.phaseName} could not be populated: ${fp.reason}`);
  });

  focusCoverage.filter(f => !f.isEligible).forEach(f => {
    if (f.rejectionReason) {
      reasons.push(f.rejectionReason);
    } else {
      reasons.push(`No eligible '${f.focusId}' activities are available for your current facility features.`);
    }
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
      if (!facilityCapabilities.hasOpenField) {
        reasons.push(`Ground Fielding requires open training space. Net lanes alone do not provide a valid area for the selected fielding activities.`);
      } else {
        reasons.push(`Facility capabilities restrict required open-space or net-lane activities.`);
      }
    } else {
      reasons.push(`Insufficient eligible activities matching your selected attendance (${participantCount}), cohort (${cohortId}), and facility options.`);
    }
  }

  return reasons;
}

function generateActionableSuggestions({
  facilityCapabilities,
  _selectedFocusIds,
  focusCoverage,
  _participantCount,
  _cohortId,
  _coachLevelId,
  requestedDuration,
  rejectionSummary,
  _activeRuleset
}) {
  const suggestions = [];

  const needsOpenSpace = focusCoverage.some(f => !f.isEligible && f.primaryRejection === REJECTION_CODES.OPEN_SPACE_REQUIRED);
  if (needsOpenSpace && !facilityCapabilities.hasOpenField) {
    suggestions.push({
      type: 'ENABLE_FACILITY',
      label: "Enable 'Full/open field space' in facility options or select a venue with open field space.",
      targetFeature: 'hasOpenField'
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

  const hasDurationRejection = rejectionSummary.some(r => r.code === REJECTION_CODES.DURATION_TOO_LONG || r.code === REJECTION_CODES.DURATION_TOO_SHORT);
  if (hasDurationRejection && requestedDuration > 60) {
    suggestions.push({
      type: 'CHANGE_DURATION',
      label: 'Switch to Express 60-Minute Session',
      targetDuration: 60
    });
  }

  return suggestions;
}
