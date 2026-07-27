export const SESSION_TEMPLATES = {
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
  },
  CENTRE_WICKET_PRACTICE: {
    id: 'CENTRE_WICKET_PRACTICE',
    name: 'Cricket Centre Wicket Scenario Practice',
    totalDuration: 90,
    minDuration: 30,
    maxDuration: 120,
    sessionType: 'CENTRE_WICKET_PRACTICE',
    phases: [
      {
        phaseId: 'p_prep',
        phaseName: 'Preparation & Scenario Briefing',
        slotType: 'Warm-up',
        required: true,
        idealDuration: 10,
        minDuration: 10,
        maxDuration: 15
      },
      {
        phaseId: 'p_scenario_primary',
        phaseName: 'Primary Match Scenario Phase',
        slotType: 'Game-Based Scenario',
        required: true,
        idealDuration: 40,
        minDuration: 25,
        maxDuration: 55
      },
      {
        phaseId: 'p_scenario_secondary',
        phaseName: 'Secondary Tactical / Role-Swap Phase',
        slotType: 'Development',
        required: true,
        idealDuration: 30,
        minDuration: 20,
        maxDuration: 40
      },
      {
        phaseId: 'p_cooldown',
        phaseName: 'Cool-Down & Tactical Debrief',
        slotType: 'Warm-down',
        required: false,
        idealDuration: 10,
        minDuration: 5,
        maxDuration: 15
      }
    ]
  },
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
  }
};

export const CENTRE_WICKET_SCENARIOS = [
  {
    id: 'NEW_BALL_PHASE',
    name: 'New-Ball Phase (First 6 Overs)',
    description: 'Seam & Swing Control vs Attacking Slip Cordon. Batters focus on leaving outside off and straight V drives.',
    recommendedOvers: 6,
    defaultBattingFocus: 'Front Foot Drive',
    defaultBowlingFocus: 'Pace Seam Control',
    defaultTacticalFocus: 'Attacking Slip Cordon'
  },
  {
    id: 'MIDDLE_OVERS',
    name: 'Middle Overs Spin & Strike Rotation',
    description: 'Ring Placement & Gap Running against spin and pace change-ups.',
    recommendedOvers: 8,
    defaultBattingFocus: 'Spin Footwork Sweep',
    defaultBowlingFocus: 'Spin Dip & Drift',
    defaultTacticalFocus: 'Denying Dot Balls'
  },
  {
    id: 'DEATH_OVERS',
    name: 'Death Overs Power Hitting & Yorker Execution',
    description: 'Boundary Clearing & Death Yorker Execution (Last 5 overs scenario).',
    recommendedOvers: 5,
    defaultBattingFocus: 'Death Overs Power Hitting',
    defaultBowlingFocus: 'Death Yorker Execution',
    defaultTacticalFocus: 'Defending Short Boundary'
  },
  {
    id: 'CHASE_SCENARIO',
    name: 'Target Chase Under Pressure',
    description: 'Batting team requires 36 runs off 24 balls with 4 wickets in hand.',
    recommendedOvers: 4,
    defaultBattingFocus: 'Gap Placement',
    defaultBowlingFocus: 'Death Yorker Execution',
    defaultTacticalFocus: 'Executing Under High Pressure'
  },
  {
    id: 'DEFEND_TOTAL',
    name: 'Defend-a-Total Scenario',
    description: 'Bowling team defends 18 runs off final 12 balls with 5 outfielders in ring/boundary.',
    recommendedOvers: 2,
    defaultBattingFocus: 'Death Overs Power Hitting',
    defaultBowlingFocus: 'Pace Seam Control',
    defaultTacticalFocus: 'Defending Short Boundary'
  },
  {
    id: 'WICKET_PRESERVATION',
    name: 'Wicket Preservation & Partnership Building',
    description: 'Survive 4 overs without losing a wicket while maintaining a minimum 4 runs per over rate.',
    recommendedOvers: 4,
    defaultBattingFocus: 'V-Channel Placement',
    defaultBowlingFocus: 'Pace Seam Control',
    defaultTacticalFocus: 'Partnership Communication'
  },
  {
    id: 'STRIKE_ROTATION',
    name: 'Strike Rotation & Quick Single Challenge',
    description: 'Every dot ball incurs +2 point penalty; batters must drop and run quick singles into ring.',
    recommendedOvers: 4,
    defaultBattingFocus: 'Calling & Communication',
    defaultBowlingFocus: 'Pace Seam Control',
    defaultTacticalFocus: 'Denying Dot Balls'
  },
  {
    id: 'FIELD_SETTING',
    name: 'Tactical Field Setting & Boundary Cutting',
    description: 'Captain sets custom field restrictions to cut off batter strong zones.',
    recommendedOvers: 4,
    defaultBattingFocus: 'Gap Placement',
    defaultBowlingFocus: 'Spin Dip & Drift',
    defaultTacticalFocus: 'Field Placement Awareness'
  }
];
