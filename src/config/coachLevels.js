export const COACH_LEVELS = {
  COMMUNITY_FOUNDATION: {
    id: 'COMMUNITY_FOUNDATION',
    name: 'Community / Foundation',
    maxConcurrentStations: 2,
    maxTacticalComplexity: 1,
    supervisionRequirement: 'Direct'
  },
  DEVELOPMENT_LEVEL_1: {
    id: 'DEVELOPMENT_LEVEL_1',
    name: 'Development (Level 1)',
    maxConcurrentStations: 3,
    maxTacticalComplexity: 2,
    supervisionRequirement: 'General'
  },
  ADVANCED_LEVEL_2: {
    id: 'ADVANCED_LEVEL_2',
    name: 'Advanced (Level 2)',
    maxConcurrentStations: 4,
    maxTacticalComplexity: 3,
    supervisionRequirement: 'Independent'
  },
  HIGH_PERFORMANCE_LEVEL_3: {
    id: 'HIGH_PERFORMANCE_LEVEL_3',
    name: 'High Performance (Level 3)',
    maxConcurrentStations: 6,
    maxTacticalComplexity: 4,
    supervisionRequirement: 'Mastery'
  }
};

export const DEFAULT_COACH_LEVEL_ID = 'DEVELOPMENT_LEVEL_1';
