/**
 * Cricket Match-State Engine Model
 * Hierarchical Engine: Match -> Innings -> Over -> Delivery
 * Dynamically driven by EffectiveMatchDefinition configuration
 */

export function createInitialMatchState(matchFormatId = 'T20', effectiveMatchDef = null, homeTeamId = 't1', awayTeamId = 't2') {
  const matchDef = effectiveMatchDef || {
    formatId: 'T20',
    maxOversPerInnings: 20,
    maxOversPerBowler: 4,
    ballsPerOver: 6,
    dismissalTypesAllowed: ['BOWLED', 'CAUGHT', 'LBW', 'RUN_OUT', 'STUMPED'],
    extrasAllowed: ['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE'],
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
    bowlerSpellTracker: {}, // { bowlerId: { oversInSpell: 0, totalOversToday: 0 } }
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
 * Record a delivery transaction
 */
export function recordDelivery(matchState, deliveryInput) {
  if (matchState.isMatchComplete) return matchState;

  const newState = JSON.parse(JSON.stringify(matchState));
  const innings = newState.innings[newState.currentInningsIndex];
  if (innings.isComplete) return matchState;

  let currentOver = innings.overs[innings.overs.length - 1];
  if (currentOver.isComplete) {
    currentOver = createInitialOver(innings.overs.length + 1, deliveryInput.bowlerId);
    innings.overs.push(currentOver);
  }

  const runsBat = deliveryInput.runsBat || 0;
  const runsExtra = deliveryInput.runsExtra || 0;
  const extraType = deliveryInput.extraType || 'NONE'; // WIDE, NO_BALL, BYE, LEG_BYE
  const wicketType = deliveryInput.wicketType || 'NONE';
  const dismissedPlayerId = deliveryInput.dismissedPlayerId || null;

  const isWideOrNoBall = extraType === 'WIDE' || extraType === 'NO_BALL';
  const isLegalBall = !isWideOrNoBall;

  const totalDeliveryRuns = runsBat + runsExtra + (isWideOrNoBall ? 1 : 0);

  const deliveryRecord = {
    deliveryIndex: currentOver.deliveries.length + 1,
    isLegalBall,
    runsBat,
    runsExtra,
    extraType,
    wicketType,
    dismissedPlayerId,
    strikerId: newState.activeStrikerId,
    nonStrikerId: newState.activeNonStrikerId,
    bowlerId: deliveryInput.bowlerId || newState.activeBowlerId,
    totalDeliveryRuns
  };

  currentOver.deliveries.push(deliveryRecord);
  currentOver.runsInOver += totalDeliveryRuns;
  innings.totalRuns += totalDeliveryRuns;

  if (extraType !== 'NONE') {
    innings.totalExtras += runsExtra + (isWideOrNoBall ? 1 : 0);
  }

  // Wicket Processing
  if (wicketType !== 'NONE') {
    currentOver.wicketsInOver += 1;
    innings.totalWickets += 1;
  }

  // Legal Ball Count & Over Progress
  if (isLegalBall) {
    innings.ballsInCurrentOver += 1;
    if (innings.ballsInCurrentOver >= newState.matchDef.ballsPerOver) {
      currentOver.isComplete = true;
      innings.oversBowled += 1;
      innings.ballsInCurrentOver = 0;
      
      // Update Bowler Spell Tracker
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
  // Rotate on odd runs scored off bat/byes/leg-byes, OR end of over (unless both occur)
  const runsForRotation = (extraType === 'BYE' || extraType === 'LEG_BYE') ? runsExtra : runsBat;
  const isOddRuns = runsForRotation % 2 !== 0;
  const isOverEnd = currentOver.isComplete;

  if ((isOddRuns && !isOverEnd) || (!isOddRuns && isOverEnd)) {
    const temp = newState.activeStrikerId;
    newState.activeStrikerId = newState.activeNonStrikerId;
    newState.activeNonStrikerId = temp;
  }

  // Check Innings Completion Driven by MatchDefinition
  const maxOvers = newState.matchDef.maxOversPerInnings;
  const rules = newState.matchDef.inningsCompletionRules;

  if (rules === 'TEN_WICKETS_OR_MAX_OVERS') {
    if (innings.totalWickets >= 10 || innings.oversBowled >= maxOvers) {
      innings.isComplete = true;
      innings.completionReason = innings.totalWickets >= 10 ? 'ALL_OUT' : 'OVERS_EXPIRED';
      if (newState.currentInningsIndex === 0) {
        // Prepare 2nd Innings
        newState.currentInningsIndex = 1;
        newState.innings.push(createInitialInnings(2, innings.bowlingTeamId, innings.battingTeamId));
      } else {
        newState.isMatchComplete = true;
        newState.matchResultSummary = 'Match Completed';
      }
    }
  }

  // Save to history stack for undo capability
  newState.deliveryHistoryStack.push(matchState);

  return newState;
}

/**
 * Reverts match state to previous delivery
 */
export function undoLastDelivery(matchState) {
  if (matchState.deliveryHistoryStack && matchState.deliveryHistoryStack.length > 0) {
    return matchState.deliveryHistoryStack[matchState.deliveryHistoryStack.length - 1];
  }
  return matchState;
}

/**
 * Calculates individual player statistics
 */
export function calculatePlayerStats(matchState) {
  const stats = { batting: {}, bowling: {} };
  
  matchState.innings.forEach(innings => {
    innings.overs.forEach(over => {
      over.deliveries.forEach(del => {
        // Batting stats
        if (del.strikerId) {
          if (!stats.batting[del.strikerId]) {
            stats.batting[del.strikerId] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false };
          }
          if (del.isLegalBall || del.extraType === 'NO_BALL') {
            stats.batting[del.strikerId].balls += 1;
          }
          stats.batting[del.strikerId].runs += del.runsBat;
          if (del.runsBat === 4) stats.batting[del.strikerId].fours += 1;
          if (del.runsBat === 6) stats.batting[del.strikerId].sixes += 1;
        }

        if (del.wicketType !== 'NONE' && del.dismissedPlayerId) {
          if (!stats.batting[del.dismissedPlayerId]) {
            stats.batting[del.dismissedPlayerId] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false };
          }
          stats.batting[del.dismissedPlayerId].isOut = true;
        }

        // Bowling stats
        if (del.bowlerId) {
          if (!stats.bowling[del.bowlerId]) {
            stats.bowling[del.bowlerId] = { overs: 0, runs: 0, wickets: 0, legalBalls: 0 };
          }
          if (del.isLegalBall) stats.bowling[del.bowlerId].legalBalls += 1;
          stats.bowling[del.bowlerId].runs += del.totalDeliveryRuns;
          if (del.wicketType !== 'NONE' && del.wicketType !== 'RUN_OUT') {
            stats.bowling[del.bowlerId].wickets += 1;
          }
        }
      });
    });
  });

  return stats;
}
