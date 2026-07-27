import { STRUCTURED_ACTIVITIES } from '../data/structuredActivityRecords';
import { CENTRE_WICKET_SCENARIOS } from '../config/sessionTemplates';

/**
 * Cricket Centre Wicket Scenario Practice Planner Engine
 * Organised around controlled match/scenario play on a centre wicket pitch.
 * Strictly avoids net-lane counts, net queues, or net station rotation logic.
 */

export function generateCentreWicketPlan({
  totalDuration,
  requestedDuration,
  participantCount = 11,
  squad = [],
  teamsAttending = [],
  scenarioObjective = 'DEATH_OVERS',
  batterFocuses = ['Power Hitting'],
  bowlerFocuses = ['Death Yorker Execution'],
  tacticalFocuses = ['Defending Short Boundary'],
  _cohortId = 'U13_JUNIOR',
  _coachLevelId = 'DEVELOPMENT_LEVEL_1',
  _equipmentAvailable = [],
  _activeRuleset = null
}) {
  const sessionDuration = totalDuration || requestedDuration || 90;

  // Input Validation
  if (!participantCount || participantCount <= 0) {
    return {
      success: false,
      userMessage: 'Session planning requires at least 1 checked-in participant.',
      primaryReasons: ['Participant attendance is zero.'],
      suggestedChanges: [{ type: 'ADD_ATTENDANCE', label: 'Check in present players' }]
    };
  }

  if (participantCount < 4) {
    return {
      success: false,
      userMessage: 'Centre Wicket Practice requires at least 4 participants (Striker, Non-Striker, Bowler, Keeper).',
      primaryReasons: ['At least 4 participants required for Centre Wicket scenario play.'],
      suggestedChanges: [{ type: 'ADD_ATTENDANCE', label: 'Check in present players' }]
    };
  }

  // 1. Resolve Scenario Details
  const scenario = CENTRE_WICKET_SCENARIOS.find(s => s.id === scenarioObjective) || CENTRE_WICKET_SCENARIOS[2];
  const primaryBattingFocus = batterFocuses[0] || scenario.defaultBattingFocus;
  const primaryBowlingFocus = bowlerFocuses[0] || scenario.defaultBowlingFocus;
  const primaryTacticalFocus = tacticalFocuses[0] || scenario.defaultTacticalFocus;

  // 2. Initialize Player Roster and Roles
  let activeRoster = [];
  if (squad && squad.length >= participantCount) {
    activeRoster = squad.slice(0, participantCount);
  } else if (teamsAttending && teamsAttending.length > 0) {
    teamsAttending.forEach(team => {
      if (team.roster && team.roster.length > 0) {
        activeRoster.push(...team.roster);
      }
    });
    activeRoster = activeRoster.slice(0, participantCount);
  }

  if (activeRoster.length < participantCount) {
    const diff = participantCount - activeRoster.length;
    for (let i = 0; i < diff; i++) {
      const pNum = activeRoster.length + 1;
      activeRoster.push({
        id: `p_${pNum}`,
        name: `Player ${pNum}`,
        jersey: pNum,
        role: 'All Rounder'
      });
    }
  }

  const striker = activeRoster[0];
  const nonStriker = activeRoster[1];
  const keeperCandidate = activeRoster.find((p, idx) => idx >= 2 && p.role?.toLowerCase().includes('keeper')) || activeRoster[2] || activeRoster[0];

  const fieldPositions = [
    'Point', 'Cover', 'Mid-Off', 'Mid-On', 'Mid-Wicket', 
    'Square Leg', 'Gully', 'Fine Leg', 'Deep Mid-Wicket', 'Third Man', 'Extra Cover'
  ];

  let fielderPosIdx = 0;
  const playerRoleCoverage = activeRoster.map((p, idx) => {
    let assignedRole = 'Fielder';
    let position = null;

    if (p.id === striker.id) {
      assignedRole = 'Batter (Striker)';
    } else if (p.id === nonStriker.id) {
      assignedRole = 'Batter (Non-Striker)';
    } else if (p.id === keeperCandidate.id) {
      assignedRole = 'Wicketkeeper';
      position = 'Wicketkeeper';
    } else if (idx === 3 || idx === 4) {
      assignedRole = 'Bowler';
      position = 'Bowling Crease';
    } else if (idx >= 5 && idx <= 7) {
      assignedRole = 'Next Batter';
      position = 'Batting Bench';
    } else {
      assignedRole = 'Fielder';
      position = fieldPositions[fielderPosIdx % fieldPositions.length];
      fielderPosIdx++;
    }

    return {
      playerId: p.id,
      name: p.name || `Player ${p.jersey}`,
      jersey: p.jersey,
      role: assignedRole,
      position: position || 'Fielding Ring'
    };
  });

  // 3. Assemble Scenario Phases & Duration Scaling
  const prepDuration = Math.min(15, Math.max(10, Math.round(sessionDuration * 0.15)));
  const cooldownDuration = Math.min(15, Math.max(5, Math.round(sessionDuration * 0.10)));
  const totalScenarioDuration = sessionDuration - prepDuration - cooldownDuration;

  const primaryScenarioDuration = Math.round(totalScenarioDuration * 0.55);
  const secondaryScenarioDuration = totalScenarioDuration - primaryScenarioDuration;

  // 4. Select Matching Structured Activities
  const prepActivity = STRUCTURED_ACTIVITIES.find(a => a.permittedSessionSlots.includes('Warm-up')) || STRUCTURED_ACTIVITIES[0];
  const primaryScenarioActivity = STRUCTURED_ACTIVITIES.find(a => a.id === 'MS-001' || a.activityCategory === 'Match Simulation') || STRUCTURED_ACTIVITIES[4];
  const secondaryScenarioActivity = STRUCTURED_ACTIVITIES.find(a => a.id === 'GF-001' || a.activityCategory === 'Ground Fielding') || STRUCTURED_ACTIVITIES[3];
  const cooldownActivity = STRUCTURED_ACTIVITIES.find(a => a.permittedSessionSlots.includes('Warm-down')) || STRUCTURED_ACTIVITIES[5];

  const blocks = [
    {
      phaseId: 'p_prep',
      phaseName: 'Preparation & Scenario Briefing',
      type: 'SERIAL_WHOLE_GROUP',
      phaseDuration: prepDuration,
      activities: [{
        ...prepActivity,
        assignedDuration: prepDuration,
        contributingFocus: 'Warm-up & Scenario Prep'
      }]
    },
    {
      phaseId: 'p_scenario_primary',
      phaseName: `Primary Scenario: ${scenario.name}`,
      type: 'CONTROLLED_MATCH_SCENARIO',
      phaseDuration: primaryScenarioDuration,
      activities: [{
        ...primaryScenarioActivity,
        assignedDuration: primaryScenarioDuration,
        contributingFocus: primaryBattingFocus,
        scenarioObjective: scenario.id,
        scenarioTitle: scenario.name,
        scenarioDescription: scenario.description,
        primaryBattingFocus,
        primaryBowlingFocus,
        primaryTacticalFocus
      }]
    },
    {
      phaseId: 'p_scenario_secondary',
      phaseName: 'Secondary Tactical & Role-Swap Phase',
      type: 'TACTICAL_ROLE_SWAP',
      phaseDuration: secondaryScenarioDuration,
      activities: [{
        ...secondaryScenarioActivity,
        assignedDuration: secondaryScenarioDuration,
        contributingFocus: primaryTacticalFocus,
        primaryBattingFocus,
        primaryBowlingFocus,
        primaryTacticalFocus
      }]
    },
    {
      phaseId: 'p_cooldown',
      phaseName: 'Cool-Down & Tactical Debrief',
      type: 'SERIAL_WHOLE_GROUP',
      phaseDuration: cooldownDuration,
      activities: [{
        ...cooldownActivity,
        assignedDuration: cooldownDuration,
        contributingFocus: 'Post-Scenario Tactical Review'
      }]
    }
  ];

  const flatActivities = [];
  blocks.forEach(b => {
    b.activities.forEach(act => {
      flatActivities.push({
        ...act,
        phaseName: b.phaseName,
        blockType: b.type,
        blockDuration: b.phaseDuration
      });
    });
  });

  const timeline = [
    { timeSlot: `0:00 - 0:${prepDuration}`, phaseName: 'Preparation & Scenario Briefing', activity: 'Dynamic Warm-Up', details: 'Field briefing & captain scenario targets.' },
    { timeSlot: `0:${prepDuration} - 0:${prepDuration + primaryScenarioDuration}`, phaseName: `Primary Scenario (${scenario.name})`, activity: 'Centre Wicket Scenario', details: `Batting Focus: ${primaryBattingFocus} | Bowling: ${primaryBowlingFocus}` },
    { timeSlot: `0:${prepDuration + primaryScenarioDuration} - 0:${prepDuration + totalScenarioDuration}`, phaseName: 'Secondary Tactical Phase', activity: 'Role-Swap & Boundary Defense', details: `Tactical Focus: ${primaryTacticalFocus}` },
    { timeSlot: `0:${prepDuration + totalScenarioDuration} - 0:${sessionDuration}`, phaseName: 'Cool-Down & Debrief', activity: 'Squad Debrief', details: 'Scenario review & stats analysis.' }
  ];

  const playerSchedules = activeRoster.map((p, idx) => {
    const roleInfo = playerRoleCoverage[idx];
    return {
      playerId: p.id,
      name: p.name,
      teamName: p.teamName || 'Squad',
      schedule: [
        { timeSlot: `0:00 - 0:${prepDuration}`, stationName: 'Centre Pitch', role: 'Squad Member', activityTitle: 'Scenario Briefing', details: 'Warm-up & Targets' },
        { timeSlot: `0:${prepDuration} - 0:${prepDuration + primaryScenarioDuration}`, stationName: 'Centre Wicket Pitch', role: roleInfo.role, activityTitle: scenario.name, details: `Position: ${roleInfo.position || 'Fielding Ring'}` },
        { timeSlot: `0:${prepDuration + primaryScenarioDuration} - 0:${prepDuration + totalScenarioDuration}`, stationName: 'Centre Pitch & Outfield', role: 'Role Swap Position', activityTitle: 'Tactical Phase', details: `Focus: ${primaryTacticalFocus}` },
        { timeSlot: `0:${prepDuration + totalScenarioDuration} - 0:${sessionDuration}`, stationName: 'Centre Pitch', role: 'Squad Member', activityTitle: 'Debrief', details: 'Post-Scenario Review' }
      ]
    };
  });

  const totalElapsedTime = prepDuration + primaryScenarioDuration + secondaryScenarioDuration + cooldownDuration;

  return {
    success: true,
    plan: {
      templateId: 'CENTRE_WICKET_PRACTICE',
      templateName: 'Cricket Centre Wicket Scenario Practice',
      sessionType: 'CENTRE_WICKET_PRACTICE',
      requestedDuration: sessionDuration,
      totalElapsedTime,
      participantCount,
      scenarioObjective: scenario.id,
      scenarioTitle: scenario.name,
      scenarioDescription: scenario.description,
      primaryBattingFocus,
      primaryBowlingFocus,
      primaryTacticalFocus,
      strikerName: striker.name,
      nonStrikerName: nonStriker.name,
      wicketkeeperName: keeperCandidate.name,
      battingOrder: activeRoster.map(p => p.name),
      playerRoleCoverage,
      timeline,
      playerSchedules,
      blocks,
      activities: flatActivities
    }
  };
}
