export const SAFETY_FRAMEWORK = {
  MANDATORY_HELMETS: {
    id: 'MANDATORY_HELMETS',
    ruleName: 'Mandatory Helmet Usage',
    description: 'Batters facing hard leather or fast bowling, and keepers standing up to the stumps, MUST wear BS7928:2013 approved helmets.',
    isProtectedNonOverridable: true
  },
  JUNIOR_CLOSE_FIELDING: {
    id: 'JUNIOR_CLOSE_FIELDING',
    ruleName: 'Junior Close-in Fielding Restriction',
    description: 'No junior fielder (under U15) is permitted to field within 10 meters of the bat in front of the wicket, except in slip cordon.',
    isProtectedNonOverridable: true
  },
  BOWLING_SPELL_CEILING: {
    id: 'BOWLING_SPELL_CEILING',
    ruleName: 'Fast Bowling Spell & Daily Workload Limits',
    description: 'Protects young pacers from stress fractures by limiting consecutive overs per spell and daily over ceilings.',
    isProtectedNonOverridable: true,
    unresolvedNotice: '[UNRESOLVED: Pending Source Confirmation for exact age group over numbers]'
  }
};
