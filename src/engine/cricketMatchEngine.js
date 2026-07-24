/**
 * Cricket Match-State Engine Model
 * Hierarchical Engine: Match -> Innings -> Over -> Delivery
 * Dynamically driven by EffectiveMatchDefinition configuration with Cricket Invariants
 */

export const DISMISSAL_TYPES = {
  NONE: 'NONE',
  BOWLED: 'BOWLED',
  CAUGHT: 'CAUGHT',
  LBW: 'LBW',
  RUN_OUT: 'RUN_OUT',
  STUMPED: 'STUMPED',
  HIT_WICKET: 'HIT_WICKET',
  RETIRED_HURT: 'RETIRED_HURT',
  OBSTRUCTING_FIELD: 'OBSTRUCTING_FIELD',
  HANDLED_BALL: 'HANDLED_BALL'
};

export const EXTRAS_TYPES = {
  NONE: 'NONE',
  WIDE: 'WIDE',
  NO_BALL: 'NO_BALL',
  BYE: 'BYE',
  LEG_BYE: 'LEG_BYE'
};

export function createInitialMatchState(matchFormatId = 'T20', effectiveMatchDef = null, homeTeamId = 't1', awayTeamId = 't2') {
  const matchDef = effectiveMatchDef || {
    formatId: matchFormatId || 'T20',
    maxOversPerInnings: 20,
    maxOversPerBowler: 4,
    ballsPerOver: 6,
    dismissalTypesAllowed: Object.values(DISMISSAL_TYPES),
    extrasAllowed: Object.values(EXTRAS_TYPES),
    inningsCompletionRules: 'TEN_WICKETS_OR_MAX_OVERS'
  };

  return {
    matchId: 'match_' + Date.now(),
    matchDef,
    currentInningsIndex: 0,
    innings: [
      createInitialInnings(1, homeTeamId, awayTeamId)
    ],
    activeStrikerId: null,
    activeNonStrikerId: null,
    activeBowlerId: null,
    bowlerSpellTracker: {},
    dismissedPlayerIds: [],
    deliveryHistoryStack: [],
    isMatchComplete: false,
    matchResultSummary: null
  };
}

function createInitialInnings(inningsNumber, battingTeamId, bowlingTeamId) {
  return {
    inningsNumber,
    battingTeamId,
    bowlingTeamId,
    totalRuns: 0,
    totalWickets: 0,
    totalExtras: 0,
    oversBowled: 0,
    ballsInCurrentOver: 0,
    overs: [createInitialOver(1)],
    isComplete: false,
    completionReason: null
  };
}

function createInitialOver(overNumber, bowlerId = null) {
  return {
    overNumber,
    bowlerId,
    deliveries: [],
    runsInOver: 0,
    wicketsInOver: 0,
    isComplete: false
  };
}

/**
 * Record a delivery transaction with strict cricket rules & schema validation
 */
export function recordDelivery(matchState, deliveryInput) {
  if (!matchState || matchState.isMatchComplete) return matchState;

  // Input Sanitization & Schema Validation
  const runsBat = Math.max(0, Math.min(6, Number(deliveryInput.runsBat) || 0));
  const runsExtra = Math.max(0, Math.min(6, Number(deliveryInput.runsExtra) || 0));
  const extraType = deliveryInput.extraType && Object.values(EXTRAS_TYPES).includes(deliveryInput.extraType)
    ? deliveryInput.extraType
    : EXTRAS_TYPES.NONE;
  const wicketType = deliveryInput.wicketType && Object.values(DISMISSAL_TYPES).includes(deliveryInput.wicketType)
    ? deliveryInput.wicketType
    : DISMISSAL_TYPES.NONE;

  // Strip history stack before deep cloning to prevent exponential nested stack memory leak
  const { deliveryHistoryStack = [], ...stateToClone } = matchState;
  const newState = JSON.parse(JSON.stringify(stateToClone));
  newState.deliveryHistoryStack = [...deliveryHistoryStack];

  const innings = newState.innings[newState.currentInningsIndex];
  if (innings.isComplete) return matchState;

  let currentOver = innings.overs[innings.overs.length - 1];
  if (currentOver.isComplete) {
    currentOver = createInitialOver(innings.overs.length + 1, deliveryInput.bowlerId || newState.activeBowlerId);
    innings.overs.push(currentOver);
  }

  const isWideOrNoBall = extraType === EXTRAS_TYPES.WIDE || extraType === EXTRAS_TYPES.NO_BALL;
  const isLegalBall = !isWideOrNoBall;

  // Single 1-run penalty for WIDE or NO_BALL (runsExtra represents additional runs run by batters)
  const extraPenalty = isWideOrNoBall ? 1 : 0;
  const totalDeliveryRuns = runsBat + runsExtra + extraPenalty;

  // Check Dismissal Legality (Bowled, Caught, LBW, Stumped illegal on No-Ball)
  let validWicketType = wicketType;
  if (extraType === EXTRAS_TYPES.NO_BALL && ['BOWLED', 'CAUGHT', 'LBW', 'STUMPED', 'HIT_WICKET'].includes(wicketType)) {
    console.warn(`[MatchEngine] Dismissal ${wicketType} is illegal on a No-Ball.`);
    validWicketType = DISMISSAL_TYPES.NONE;
  }

  const dismissedPlayerId = deliveryInput.dismissedPlayerId || newState.activeStrikerId;

  // Prevent duplicate dismissals of players already out
  if (validWicketType !== DISMISSAL_TYPES.NONE && validWicketType !== DISMISSAL_TYPES.RETIRED_HURT) {
    if (newState.dismissedPlayerIds.includes(dismissedPlayerId)) {
      validWicketType = DISMISSAL_TYPES.NONE;
    }
  }

  const deliveryRecord = {
    deliveryIndex: currentOver.deliveries.length + 1,
    isLegalBall,
    runsBat,
    runsExtra,
    extraType,
    wicketType: validWicketType,
    dismissedPlayerId: validWicketType !== DISMISSAL_TYPES.NONE ? dismissedPlayerId : null,
    strikerId: newState.activeStrikerId,
    nonStrikerId: newState.activeNonStrikerId,
    bowlerId: deliveryInput.bowlerId || newState.activeBowlerId,
    totalDeliveryRuns
  };

  currentOver.deliveries.push(deliveryRecord);
  currentOver.runsInOver += totalDeliveryRuns;
  innings.totalRuns += totalDeliveryRuns;

  if (extraType !== EXTRAS_TYPES.NONE) {
    innings.totalExtras += runsExtra + extraPenalty;
  }

  // Wicket Processing
  if (validWicketType !== DISMISSAL_TYPES.NONE && validWicketType !== DISMISSAL_TYPES.RETIRED_HURT) {
    currentOver.wicketsInOver += 1;
    innings.totalWickets += 1;
    newState.dismissedPlayerIds.push(dismissedPlayerId);
  }

  // Legal Ball Count & Over Progress
  if (isLegalBall) {
    innings.ballsInCurrentOver += 1;
    if (innings.ballsInCurrentOver >= newState.matchDef.ballsPerOver) {
      currentOver.isComplete = true;
      innings.oversBowled += 1;
      innings.ballsInCurrentOver = 0;
      
      const bowlerId = deliveryInput.bowlerId || newState.activeBowlerId;
      if (bowlerId) {
        if (!newState.bowlerSpellTracker[bowlerId]) {
          newState.bowlerSpellTracker[bowlerId] = { oversInSpell: 0, totalOversToday: 0 };
        }
        newState.bowlerSpellTracker[bowlerId].oversInSpell += 1;
        newState.bowlerSpellTracker[bowlerId].totalOversToday += 1;
      }
    }
  }

  // Strike Rotation Logic
  const runsForRotation = (extraType === EXTRAS_TYPES.BYE || extraType === EXTRAS_TYPES.LEG_BYE) ? runsExtra : runsBat;
  const isOddRuns = runsForRotation % 2 !== 0;
  const isOverEnd = currentOver.isComplete;

  if ((isOddRuns && !isOverEnd) || (!isOddRuns && isOverEnd)) {
    const temp = newState.activeStrikerId;
    newState.activeStrikerId = newState.activeNonStrikerId;
    newState.activeNonStrikerId = temp;
  }

  // Innings Chase & Completion Validation
  const firstInnings = newState.innings[0];
  const maxOvers = newState.matchDef.maxOversPerInnings;

  if (newState.currentInningsIndex === 1) {
    const targetRuns = firstInnings.totalRuns + 1;
    if (innings.totalRuns >= targetRuns) {
      innings.isComplete = true;
      innings.completionReason = 'TARGET_ACHIEVED';
      newState.isMatchComplete = true;
      const wicketsRemaining = 10 - innings.totalWickets;
      newState.matchResultSummary = `Chasing Team won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? '' : 's'}`;
    }
  }

  if (!innings.isComplete) {
    if (innings.totalWickets >= 10 || innings.oversBowled >= maxOvers) {
      innings.isComplete = true;
      innings.completionReason = innings.totalWickets >= 10 ? 'ALL_OUT' : 'OVERS_EXPIRED';

      if (newState.currentInningsIndex === 0) {
        // Switch to 2nd Innings
        newState.currentInningsIndex = 1;
        newState.innings.push(createInitialInnings(2, innings.bowlingTeamId, innings.battingTeamId));
      } else {
        newState.isMatchComplete = true;
        if (innings.totalRuns > firstInnings.totalRuns) {
          const wicketsRemaining = 10 - innings.totalWickets;
          newState.matchResultSummary = `Team 2 won by ${wicketsRemaining} wickets`;
        } else if (firstInnings.totalRuns > innings.totalRuns) {
          const runsMargin = firstInnings.totalRuns - innings.totalRuns;
          newState.matchResultSummary = `Team 1 won by ${runsMargin} runs`;
        } else {
          newState.matchResultSummary = 'Match Tied';
        }
      }
    }
  }

  newState.deliveryHistoryStack.push(stateToClone);
  return newState;
}

/**
 * Reverts match state to previous delivery
 */
export function undoLastDelivery(matchState) {
  if (matchState && matchState.deliveryHistoryStack && matchState.deliveryHistoryStack.length > 0) {
    const previousState = matchState.deliveryHistoryStack[matchState.deliveryHistoryStack.length - 1];
    const newStack = matchState.deliveryHistoryStack.slice(0, -1);
    return {
      ...previousState,
      deliveryHistoryStack: newStack
    };
  }
  return matchState;
}

/**
 * Calculates individual player statistics
 */
export function calculatePlayerStats(matchState) {
  const stats = { batting: {}, bowling: {} };
  if (!matchState || !matchState.innings) return stats;

  matchState.innings.forEach(innings => {
    innings.overs.forEach(over => {
      over.deliveries.forEach(del => {
        // Batting stats
        if (del.strikerId) {
          if (!stats.batting[del.strikerId]) {
            stats.batting[del.strikerId] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false };
          }
          if (del.isLegalBall || del.extraType === EXTRAS_TYPES.NO_BALL) {
            stats.batting[del.strikerId].balls += 1;
          }
          stats.batting[del.strikerId].runs += del.runsBat;
          if (del.runsBat === 4) stats.batting[del.strikerId].fours += 1;
          if (del.runsBat === 6) stats.batting[del.strikerId].sixes += 1;
        }

        if (del.wicketType !== DISMISSAL_TYPES.NONE && del.dismissedPlayerId) {
          if (!stats.batting[del.dismissedPlayerId]) {
            stats.batting[del.dismissedPlayerId] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false };
          }
          stats.batting[del.dismissedPlayerId].isOut = true;
        }

        // Bowling stats
        if (del.bowlerId) {
          if (!stats.bowling[del.bowlerId]) {
            stats.bowling[del.bowlerId] = { overs: '0.0', runs: 0, wickets: 0, legalBalls: 0 };
          }
          if (del.isLegalBall) stats.bowling[del.bowlerId].legalBalls += 1;

          // Cricket rule: Byes and Leg-Byes are NOT charged to the bowler!
          const isByeOrLegBye = del.extraType === EXTRAS_TYPES.BYE || del.extraType === EXTRAS_TYPES.LEG_BYE;
          if (!isByeOrLegBye) {
            stats.bowling[del.bowlerId].runs += del.totalDeliveryRuns;
          }

          if (del.wicketType !== DISMISSAL_TYPES.NONE && del.wicketType !== DISMISSAL_TYPES.RUN_OUT && del.wicketType !== DISMISSAL_TYPES.RETIRED_HURT) {
            stats.bowling[del.bowlerId].wickets += 1;
          }

          const bCount = stats.bowling[del.bowlerId].legalBalls;
          stats.bowling[del.bowlerId].overs = `${Math.floor(bCount / 6)}.${bCount % 6}`;
        }
      });
    });
  });

  return stats;
}
