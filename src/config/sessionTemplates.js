export const SESSION_TEMPLATES = {
  STANDARD_90_MIN: {
    id: 'STANDARD_90_MIN',
    totalDuration: 90,
    structure: [
      { phase: 'Warm-up', durationPct: 0.15, type: 'SERIAL' },
      { phase: 'Technical Skill', durationPct: 0.35, type: 'CONCURRENT_STATIONS' },
      { phase: 'Game-Based Scenario', durationPct: 0.35, type: 'MATCH_SIM' },
      { phase: 'Warm-down', durationPct: 0.15, type: 'SERIAL' }
    ]
  },
  EXPRESS_60_MIN: {
    id: 'EXPRESS_60_MIN',
    totalDuration: 60,
    structure: [
      { phase: 'Warm-up', durationPct: 0.15, type: 'SERIAL' },
      { phase: 'Technical Skill', durationPct: 0.40, type: 'CONCURRENT_STATIONS' },
      { phase: 'Game-Based Scenario', durationPct: 0.30, type: 'MATCH_SIM' },
      { phase: 'Warm-down', durationPct: 0.15, type: 'SERIAL' }
    ]
  }
};
