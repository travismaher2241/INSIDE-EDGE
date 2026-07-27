import { describe, it, expect } from 'vitest';
import { generateTrainingPlan } from '../engine/deterministicPlanner';
import { generateNetsSessionPlan } from '../engine/cricketNetsPlanner';
import { DEFAULT_ROSTER } from '../data/defaultRoster';

describe('Phase 2 - Training Planners Verification & Invariants', () => {

  // H1 Fix: Shipped default 11-player roster MUST generate a valid standard plan!
  it('1. Default 11-player roster generates a valid standard 90-minute plan', () => {
    const res = generateTrainingPlan({
      sessionType: 'STANDARD_SESSION',
      requestedDuration: 90,
      cohortId: 'U13_JUNIOR',
      selectedFocusIds: ['Batting', 'Ground Fielding'],
      participantCount: DEFAULT_ROSTER.length // 11 players
    });

    expect(res.success).toBe(true);
    expect(res.plan.blocks.length).toBe(4);
    expect(res.plan.activities.length).toBeGreaterThan(0);
  });

  // H1 Fix: Shipped default 11-player roster 2 nets 90m generates a valid nets plan!
  it('2. Default 11-player roster generates a valid 2-nets 90-minute plan with real roster names', () => {
    const res = generateTrainingPlan({
      sessionType: 'NETS_SESSION',
      requestedDuration: 90,
      numberOfNets: 2,
      participantCount: DEFAULT_ROSTER.length,
      squad: DEFAULT_ROSTER
    });

    expect(res.success).toBe(true);
    expect(res.plan.battingSummary.length).toBe(11);
    expect(res.plan.battingSummary[0].name).toBe(DEFAULT_ROSTER[0].name);
  });

  // Duration Scaling Invariant
  it('3. Scaled durations (60, 90, 120 mins) match requested duration within tolerance', () => {
    [60, 90, 120].forEach(dur => {
      const res = generateTrainingPlan({
        sessionType: 'STANDARD_SESSION',
        requestedDuration: dur,
        participantCount: 10
      });
      expect(res.success).toBe(true);
      expect(Math.abs(res.plan.totalElapsedTime - dur)).toBeLessThanOrEqual(15);
    });
  });

  // Participant Matrix Testing (0, 1, 10, 11, 12, 17, 18, 30)
  it('4. Handles participant matrix (0, 1, 10, 11, 12, 17, 18, 30) safely', () => {
    // Zero attendance should fail gracefully with diagnostic
    const zeroRes = generateTrainingPlan({ sessionType: 'STANDARD_SESSION', participantCount: 0 });
    expect(zeroRes.success).toBe(false);
    expect(zeroRes.primaryReasons[0]).toContain('zero');

    // Valid participant counts should generate plans
    [1, 10, 11, 12, 17, 18, 30].forEach(count => {
      const res = generateTrainingPlan({
        sessionType: 'NETS_SESSION',
        requestedDuration: 90,
        numberOfNets: count > 15 ? 3 : 2,
        participantCount: count,
        openFieldAvailable: true
      });
      expect(res.success).toBe(true);
      expect(res.plan.battingSummary.length).toBe(count);
    });
  });

  // Nets Matrix (1, 2, 3, 4 Nets)
  it('5. Generates valid single-turn nets plans across 1 to 4 nets', () => {
    [1, 2, 3, 4].forEach(netCount => {
      const res = generateNetsSessionPlan({
        numberOfNets: netCount,
        totalDuration: 90,
        participantCount: 12
      });
      expect(res.success).toBe(true);
      expect(res.plan.numberOfNets).toBe(netCount);
    });
  });

  // Insufficient Net Capacity Validation
  it('6. Rejects 23-minute rotation with impossible per-batter allocation', () => {
    const res = generateNetsSessionPlan({
      numberOfNets: 1,
      totalDuration: 30,
      participantCount: 12,
      requestedBattingMinutesPerPlayer: 15
    });
    expect(res.success).toBe(false);
    expect(res.userMessage).toContain('not enough net time');
  });

});
