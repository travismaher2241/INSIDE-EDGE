export const BASE_MATCH_DEFINITIONS = {
  T20: {
    formatId: 'T20',
    name: 'Twenty20 Match (T20)',
    maxOversPerInnings: 20,
    maxOversPerBowler: 4,
    ballsPerOver: 6,
    fieldingRestrictions: {
      powerplayOvers: 6,
      maxOutfieldersPowerplay: 2,
      maxOutfieldersNonPowerplay: 5
    },
    dismissalTypesAllowed: ['BOWLED', 'CAUGHT', 'LBW', 'RUN_OUT', 'STUMPED', 'HIT_WICKET'],
    extrasAllowed: ['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY'],
    inningsCompletionRules: 'TEN_WICKETS_OR_MAX_OVERS'
  },
  ONE_DAY_50: {
    formatId: 'ONE_DAY_50',
    name: 'One-Day 50 Overs Match',
    maxOversPerInnings: 50,
    maxOversPerBowler: 10,
    ballsPerOver: 6,
    fieldingRestrictions: {
      powerplayOvers: 10,
      maxOutfieldersPowerplay: 2,
      maxOutfieldersNonPowerplay: 5
    },
    dismissalTypesAllowed: ['BOWLED', 'CAUGHT', 'LBW', 'RUN_OUT', 'STUMPED', 'HIT_WICKET'],
    extrasAllowed: ['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY'],
    inningsCompletionRules: 'TEN_WICKETS_OR_MAX_OVERS'
  },
  STAGE_1_JUNIOR_LIMITED: {
    formatId: 'STAGE_1_JUNIOR_LIMITED',
    name: 'Junior Stage 1 (Pairs / Limited Overs)',
    maxOversPerInnings: 15,
    maxOversPerBowler: 3,
    ballsPerOver: 6,
    fieldingRestrictions: {
      powerplayOvers: 0,
      maxOutfieldersPowerplay: 9,
      maxOutfieldersNonPowerplay: 9
    },
    dismissalTypesAllowed: ['BOWLED', 'CAUGHT', 'RUN_OUT'],
    extrasAllowed: ['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE'],
    inningsCompletionRules: 'FIXED_PAIR_OVERS_UNLIMITED_WICKETS' // Batters do not leave on wicket; lose runs instead
  }
};
