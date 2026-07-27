import { describe, it, expect } from 'vitest';
import { safeStorageGet, safeStorageSet } from '../services/storage';

describe('Phase 7 - Complete Application Flows & State Persistence', () => {

  it('1. Persists coach onboarding profile accurately', () => {
    const profile = {
      coachName: 'Coach David',
      teamName: 'St. Jude Cricket Club U13',
      selectedCohort: 'U13_JUNIOR',
      selectedCoachLevel: 'DEVELOPMENT_LEVEL_1'
    };

    safeStorageSet('coach_profile', profile);

    const retrieved = safeStorageGet('coach_profile');
    expect(retrieved.coachName).toBe('Coach David');
    expect(retrieved.teamName).toBe('St. Jude Cricket Club U13');
  });

  it('2. Retains session history log across sessions', () => {
    const historyLog = [
      { id: 'sess_1', date: '2026-07-24', template: 'NETS_SESSION', participants: 11 }
    ];

    safeStorageSet('session_history', historyLog);

    const retrieved = safeStorageGet('session_history');
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].template).toBe('NETS_SESSION');
  });

});
