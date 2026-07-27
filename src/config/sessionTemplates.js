export const SESSION_TEMPLATES = {
  STANDARD_90_MIN: {
    id: 'STANDARD_90_MIN',
    name: 'Cricket Standard Team Training (90 Mins)',
    totalDuration: 90,
    minDuration: 75,
    maxDuration: 105,
    sessionType: 'STANDARD_SESSION',
    phases: [
      {
        phaseId: 'p_prep',
        phaseName: 'Preparation Phase',
        slotType: 'Warm-up',
        required: true,
        idealDuration: 15,
        minDuration: 10,
        maxDuration: 20
      },
      {
        phaseId: 'p_dev',
        phaseName: 'Development Phase',
        slotType: 'Development',
        required: true,
        idealDuration: 40,
        minDuration: 30,
        maxDuration: 55,
        structuralOptions: [
          { type: 'CONCURRENT_GROUPS', stationCount: 2, name: 'Concurrent Skill Groups / Stations' },
          { type: 'SERIAL_WHOLE_GROUP', name: 'Sequential Whole-Group Skill Blocks' },
          { type: 'SINGLE_WHOLE_GROUP', name: 'Single Whole-Group Skill Focus' }
        ]
      },
      {
        phaseId: 'p_app',
        phaseName: 'Application Phase',
        slotType: 'Game-Based Scenario',
        required: true,
        idealDuration: 25,
        minDuration: 15,
        maxDuration: 35
      },
      {
        phaseId: 'p_cooldown',
        phaseName: 'Cool-Down Phase',
        slotType: 'Warm-down',
        required: false,
        idealDuration: 10,
        minDuration: 5,
        maxDuration: 15
      }
    ]
  },
  EXPRESS_60_MIN: {
    id: 'EXPRESS_60_MIN',
    name: 'Cricket Express Team Training (60 Mins)',
    totalDuration: 60,
    minDuration: 45,
    maxDuration: 75,
    sessionType: 'STANDARD_SESSION',
    phases: [
      {
        phaseId: 'p_prep',
        phaseName: 'Preparation Phase',
        slotType: 'Warm-up',
        required: true,
        idealDuration: 10,
        minDuration: 10,
        maxDuration: 15
      },
      {
        phaseId: 'p_dev',
        phaseName: 'Development Phase',
        slotType: 'Development',
        required: true,
        idealDuration: 25,
        minDuration: 20,
        maxDuration: 35,
        structuralOptions: [
          { type: 'CONCURRENT_GROUPS', stationCount: 2, name: 'Concurrent Skill Groups / Stations' },
          { type: 'SERIAL_WHOLE_GROUP', name: 'Sequential Whole-Group Skill Blocks' },
          { type: 'SINGLE_WHOLE_GROUP', name: 'Single Whole-Group Skill Focus' }
        ]
      },
      {
        phaseId: 'p_app',
        phaseName: 'Application Phase',
        slotType: 'Game-Based Scenario',
        required: true,
        idealDuration: 20,
        minDuration: 10,
        maxDuration: 25
      },
      {
        phaseId: 'p_cooldown',
        phaseName: 'Cool-Down Phase',
        slotType: 'Warm-down',
        required: false,
        idealDuration: 5,
        minDuration: 5,
        maxDuration: 10
      }
    ]
  },
  NETS_SESSION: {
    id: 'NETS_SESSION',
    name: 'Cricket Nets Rotation Session',
    totalDuration: 90,
    minDuration: 30,
    maxDuration: 120,
    sessionType: 'NETS_SESSION',
    phases: [
      {
        phaseId: 'p_prep',
        phaseName: 'Preparation Phase',
        slotType: 'Warm-up',
        required: true,
        idealDuration: 10,
        minDuration: 10,
        maxDuration: 15
      },
      {
        phaseId: 'p_nets_rotations',
        phaseName: 'Net Lane Concurrent Stations & Rotation',
        slotType: 'Nets Rotation',
        required: true,
        idealDuration: 70,
        minDuration: 35,
        maxDuration: 95
      },
      {
        phaseId: 'p_cooldown',
        phaseName: 'Cool-Down Phase',
        slotType: 'Warm-down',
        required: false,
        idealDuration: 10,
        minDuration: 5,
        maxDuration: 15
      }
    ]
  }
};
