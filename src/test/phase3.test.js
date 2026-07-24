import { describe, it, expect } from 'vitest';
import { createInitialMatchState, recordDelivery, calculatePlayerStats, EXTRAS_TYPES, DISMISSAL_TYPES } from '../engine/cricketMatchEngine';

describe('Phase 3 - Match Engine Correctness & Delivery Invariants', () => {

  it('1. Integrated Wide Extras Contract: 1 Wide delivery = exactly 1 extra run', () => {
    let state = createInitialMatchState();
    state.activeStrikerId = 'b1';
    state.activeBowlerId = 'bw1';

    state = recordDelivery(state, {
      runsBat: 0,
      runsExtra: 0,
      extraType: EXTRAS_TYPES.WIDE,
      bowlerId: 'bw1'
    });

    const innings = state.innings[0];
    expect(innings.totalRuns).toBe(1);
    expect(innings.totalExtras).toBe(1);

    const stats = calculatePlayerStats(state);
    expect(stats.bowling['bw1'].runs).toBe(1);
    // Wides do NOT increment legal balls
    expect(stats.bowling['bw1'].legalBalls).toBe(0);
  });

  it('2. Byes and Leg-Byes do NOT add to bowler conceded runs', () => {
    let state = createInitialMatchState();
    state.activeStrikerId = 'b1';
    state.activeBowlerId = 'bw1';

    state = recordDelivery(state, {
      runsBat: 0,
      runsExtra: 2,
      extraType: EXTRAS_TYPES.BYE,
      bowlerId: 'bw1'
    });

    const innings = state.innings[0];
    expect(innings.totalRuns).toBe(2);
    expect(innings.totalExtras).toBe(2);

    const stats = calculatePlayerStats(state);
    // Bowler runs should stay 0 for Byes!
    expect(stats.bowling['bw1'].runs).toBe(0);
    expect(stats.bowling['bw1'].legalBalls).toBe(1);
    expect(stats.bowling['bw1'].overs).toBe('0.1');
  });

  it('3. Calculates bowler overs format correctly (e.g. 4 legal balls = 0.4 overs)', () => {
    let state = createInitialMatchState();
    state.activeBowlerId = 'bw1';

    for (let i = 0; i < 4; i++) {
      state = recordDelivery(state, { runsBat: 1, bowlerId: 'bw1' });
    }

    const stats = calculatePlayerStats(state);
    expect(stats.bowling['bw1'].legalBalls).toBe(4);
    expect(stats.bowling['bw1'].overs).toBe('0.4');
  });

  it('4. Rejects illegal dismissals (Bowled, Caught, LBW) on a No-Ball delivery', () => {
    let state = createInitialMatchState();
    state.activeStrikerId = 'b1';

    state = recordDelivery(state, {
      runsBat: 0,
      runsExtra: 0,
      extraType: EXTRAS_TYPES.NO_BALL,
      wicketType: DISMISSAL_TYPES.BOWLED,
      dismissedPlayerId: 'b1'
    });

    const innings = state.innings[0];
    // Dismissal on No-Ball must be rejected! Wickets should be 0.
    expect(innings.totalWickets).toBe(0);
    expect(state.dismissedPlayerIds.length).toBe(0);
  });

  it('5. Completes chase in 2nd innings automatically with correct result summary', () => {
    let state = createInitialMatchState('T20', {
      formatId: 'T20',
      maxOversPerInnings: 20,
      maxOversPerBowler: 4,
      ballsPerOver: 6,
      dismissalTypesAllowed: Object.values(DISMISSAL_TYPES),
      extrasAllowed: Object.values(EXTRAS_TYPES),
      inningsCompletionRules: 'TEN_WICKETS_OR_MAX_OVERS'
    });

    // 1st Innings: 10 runs
    for (let i = 0; i < 10; i++) {
      state = recordDelivery(state, { runsBat: 1 });
    }
    // Complete 1st Innings with 10 wickets
    for (let i = 0; i < 10; i++) {
      state = recordDelivery(state, { wicketType: DISMISSAL_TYPES.BOWLED, dismissedPlayerId: `b_${i}` });
    }

    expect(state.currentInningsIndex).toBe(1); // 2nd Innings active

    // Score 11 runs in 2nd Innings to reach target (10 + 1 = 11)
    for (let i = 0; i < 2; i++) {
      state = recordDelivery(state, { runsBat: 6 });
    }

    expect(state.isMatchComplete).toBe(true);
    expect(state.matchResultSummary).toContain('won by 10 wickets');
  });

});
