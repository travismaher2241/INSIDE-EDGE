import { STRUCTURED_ACTIVITIES } from './structuredActivityRecords';

/**
 * Retrieval & Indexing Layer for Deterministic Planner Querying
 * Supports Multi-Select Focus Pickers (`selectedFocusIds: string[]`)
 */
export function searchActivities({ cohortId, focus, selectedFocusIds = [], _coachLevelId, maxParticipants }) {
  const targetFocuses = (selectedFocusIds && selectedFocusIds.length > 0)
    ? selectedFocusIds
    : (focus && focus !== 'All Round' ? [focus] : []);

  // Filter candidates by hard constraints (cohort, capacity)
  const candidates = STRUCTURED_ACTIVITIES.filter(act => {
    // Cohort Check
    if (cohortId && !act.cohortSuitability.includes(cohortId)) return false;

    // Participant Capacity Check
    if (maxParticipants && (act.minParticipants > maxParticipants || act.maxParticipants < maxParticipants)) return false;

    return true;
  });

  // Score & Tag Candidate Activities based on Multi-Focus Match Priority
  const scored = candidates.map(act => {
    let matchScore = 0;
    let matchedFocus = null;

    if (targetFocuses.length > 0) {
      targetFocuses.forEach(fId => {
        const fLower = fId.toLowerCase();
        const catMatch = act.activityCategory.toLowerCase().includes(fLower);
        const skillMatch = act.primarySkills.some(s => s.toLowerCase().includes(fLower));
        const tacticMatch = act.tacticalConcepts.some(t => t.toLowerCase().includes(fLower));

        if (catMatch || skillMatch || tacticMatch) {
          matchScore += catMatch ? 3 : (skillMatch ? 2 : 1);
          if (!matchedFocus) {
            matchedFocus = fId;
          }
        }
      });
    }

    return {
      ...act,
      matchScore,
      contributingFocus: matchedFocus || (targetFocuses[0] || act.activityCategory)
    };
  });

  // Sort by match score descending (highest priority focus matches first)
  scored.sort((a, b) => b.matchScore - a.matchScore);

  return scored;
}
