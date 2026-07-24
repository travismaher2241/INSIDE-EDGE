export const SESSION_TEMPLATES = {
  STANDARD_90_MIN: {
    id: 'STANDARD_90_MIN',
    name: 'Standard 90-Minute Session',
    totalDuration: 90,
    minDuration: 80,
    maxDuration: 100,
    sessionType: 'STANDARD_SESSION',
    requiredBlocks: [
      {
        blockId: 'b_warmup',
        phaseName: 'Warm-up & Movement Prep',
        slotType: 'Warm-up',
        type: 'SERIAL',
        minDuration: 10,
        idealDuration: 15,
        maxDuration: 20
      },
      {
        blockId: 'b_tech_stations',
        phaseName: 'Technical Skill Stations',
        slotType: 'Technical Skill',
        type: 'CONCURRENT_STATIONS',
        minDuration: 20,
        idealDuration: 30,
        maxDuration: 40,
        stationsCount: 2
      },
      {
        blockId: 'b_game_scenario',
        phaseName: 'Game-Based Scenario',
        slotType: 'Game-Based Scenario',
        type: 'MATCH_SIM',
        minDuration: 20,
        idealDuration: 35,
        maxDuration: 45
      },
      {
        blockId: 'b_cooldown',
        phaseName: 'Warm-down & Recovery Debrief',
        slotType: 'Warm-down',
        type: 'SERIAL',
        minDuration: 5,
        idealDuration: 10,
        maxDuration: 15
      }
    ]
  },
  EXPRESS_60_MIN: {
    id: 'EXPRESS_60_MIN',
    name: 'Express 60-Minute Session',
    totalDuration: 60,
    minDuration: 55,
    maxDuration: 65,
    sessionType: 'STANDARD_SESSION',
    requiredBlocks: [
      {
        blockId: 'b_warmup',
        phaseName: 'Warm-up & Movement Prep',
        slotType: 'Warm-up',
        type: 'SERIAL',
        minDuration: 10,
        idealDuration: 10,
        maxDuration: 15
      },
      {
        blockId: 'b_tech_stations',
        phaseName: 'Technical Skill Stations',
        slotType: 'Technical Skill',
        type: 'CONCURRENT_STATIONS',
        minDuration: 15,
        idealDuration: 25,
        maxDuration: 30,
        stationsCount: 2
      },
      {
        blockId: 'b_game_scenario',
        phaseName: 'Game-Based Scenario',
        slotType: 'Game-Based Scenario',
        type: 'MATCH_SIM',
        minDuration: 15,
        idealDuration: 20,
        maxDuration: 25
      },
      {
        blockId: 'b_cooldown',
        phaseName: 'Warm-down & Recovery Debrief',
        slotType: 'Warm-down',
        type: 'SERIAL',
        minDuration: 5,
        idealDuration: 5,
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
    requiredBlocks: [
      {
        blockId: 'b_warmup',
        phaseName: 'Warm-up & Movement Prep',
        slotType: 'Warm-up',
        type: 'SERIAL',
        minDuration: 10,
        idealDuration: 10,
        maxDuration: 15
      },
      {
        blockId: 'b_nets_rotations',
        phaseName: 'Net Lane Concurrent Stations & Rotation',
        slotType: 'Nets Rotation',
        type: 'NETS_ROTATION_BLOCK',
        minDuration: 35,
        idealDuration: 70,
        maxDuration: 95
      },
      {
        blockId: 'b_cooldown',
        phaseName: 'Warm-down & Recovery Debrief',
        slotType: 'Warm-down',
        type: 'SERIAL',
        minDuration: 5,
        idealDuration: 10,
        maxDuration: 15
      }
    ]
  }
};
