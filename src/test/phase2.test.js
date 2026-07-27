import { describe, it, expect } from 'vitest';
import { generateTrainingPlan } from '../engine/deterministicPlanner';
import { generateNetsSessionPlan } from '../engine/cricketNetsPlanner';
import { generateCentreWicketPlan } from '../engine/centreWicketPlanner';
import { DEFAULT_ROSTER } from '../data/defaultRoster';

describe('Phase 2 - Training Planners Verification & Invariants', () => {

  // Shipped default 11-player roster MUST generate a valid Centre Wicket plan!
  it('1. Default 11-player roster generates a valid Centre Wicket 90-minute plan', () => {
    const res = generateTrainingPlan({
      sessionType: 'CENTRE_WICKET_PRACTICE',
      requestedDuration: 90,
      cohortId: 'U13_JUNIOR',
      scenarioObjective: 'DEATH_OVERS',
      participantCount: DEFAULT_ROSTER.length, // 11 players
      squad: DEFAULT_ROSTER
    });

    expect(res.success).toBe(true);
    expect(res.plan.playerRoleCoverage.length).toBe(11);
    expect(res.plan.activities.length).toBeGreaterThan(0);
  });

  // Shipped default 11-player roster 2 nets 90m generates a valid nets plan!
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
        sessionType: 'CENTRE_WICKET_PRACTICE',
        requestedDuration: dur,
        participantCount: 10
      });
      expect(res.success).toBe(true);
      expect(Math.abs(res.plan.totalElapsedTime - dur)).toBeLessThanOrEqual(15);
    });
  });

  // Centre Wicket Controlled Scenario Architecture
  it('4. Centre Wicket Practice does not require net lanes or net station rotation logic', () => {
    const res = generateCentreWicketPlan({
      totalDuration: 90,
      scenarioObjective: 'NEW_BALL_PHASE',
      participantCount: 11
    });

    expect(res.success).toBe(true);
    expect(res.plan.numberOfNets).toBeUndefined();
    expect(res.plan.rotations).toBeUndefined();
  });

  it('5. Generates Centre Wicket scenario play with live roles for striker, non-striker, keeper, bowlers, and fielders', () => {
    const res = generateCentreWicketPlan({
      totalDuration: 90,
      scenarioObjective: 'MIDDLE_OVERS',
      participantCount: 12,
      squad: DEFAULT_ROSTER
    });

    expect(res.success).toBe(true);
    expect(res.plan.strikerName).toBeDefined();
    expect(res.plan.nonStrikerName).toBeDefined();
    expect(res.plan.wicketkeeperName).toBeDefined();
    expect(res.plan.playerRoleCoverage.length).toBe(12);
  });

  // Participant Matrix Testing (0, 1, 10, 11, 12, 17, 18, 30)
  it('6. Handles participant matrix (0, 1, 10, 11, 12, 17, 18, 30) safely', () => {
    const zeroRes = generateTrainingPlan({ sessionType: 'NETS_SESSION', participantCount: 0 });
    expect(zeroRes.success).toBe(false);
    expect(zeroRes.primaryReasons[0]).toContain('zero');

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
  it('7. Generates valid single-turn nets plans across 1 to 4 nets', () => {
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
  it('8. Rejects 23-minute rotation with impossible per-batter allocation', () => {
    const res = generateNetsSessionPlan({
      numberOfNets: 1,
      totalDuration: 30,
      participantCount: 12,
      requestedBattingMinutesPerPlayer: 15
    });
    expect(res.success).toBe(false);
    expect(res.userMessage).toContain('cannot each receive');
  });

});
