import { STRUCTURED_ACTIVITIES } from './structuredActivityRecords';

/**
 * Retrieval & Indexing Layer for Deterministic Planner Querying
 */
export function searchActivities({ cohortId, focus, coachLevelId, maxParticipants }) {
  return STRUCTURED_ACTIVITIES.filter(act => {
    // Cohort Check
    if (cohortId && !act.cohortSuitability.includes(cohortId)) return false;
    
    // Participant Capacity Check
    if (maxParticipants && (act.minParticipants > maxParticipants || act.maxParticipants < maxParticipants)) return false;

    // Focus / Keyword Match
    if (focus && focus !== 'All Round') {
      const matchCategory = act.activityCategory.toLowerCase().includes(focus.toLowerCase());
      const matchSkill = act.primarySkills.some(s => s.toLowerCase().includes(focus.toLowerCase()));
      const matchTactics = act.tacticalConcepts.some(t => t.toLowerCase().includes(focus.toLowerCase()));
      if (!matchCategory && !matchSkill && !matchTactics) return false;
    }

    return true;
  });
}
