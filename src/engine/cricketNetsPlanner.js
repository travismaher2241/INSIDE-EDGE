import { STRUCTURED_ACTIVITIES } from '../data/structuredActivityRecords';
import { REJECTION_CODES } from './deterministicPlanner';

/**
 * Cricket Nets Session Architecture & Rotation Engine
 * Calculates usable net capacity, dynamic batting time per player,
 * dual-focus net lanes (Batter Focus + Bowler Focus), large group rotations,
 * off-net fielding stations, and odd participant allocations.
 */

export function calculateBattingCapacity({
  numberOfNets = 2,
  totalDuration = 90,
  participantCount = 12,
  changeoverMinutesPerBatter = 1
}) {
  const warmUpMinutes = 10;
  const coolDownMinutes = 10;
  const usableNetBlockMinutes = Math.max(20, totalDuration - warmUpMinutes - coolDownMinutes);
  const totalNetMinutes = numberOfNets * usableNetBlockMinutes;

  const netTimeWithoutChangeovers = totalNetMinutes - (participantCount * changeoverMinutesPerBatter);
  const suggestedBattingMinutes = Math.max(5, Math.floor(netTimeWithoutChangeovers / Math.max(1, participantCount)));

  return {
    usableNetBlockMinutes,
    totalNetMinutes,
    suggestedBattingMinutes,
    maxFitBattingMinutes: Math.floor(totalNetMinutes / Math.max(1, participantCount))
  };
}

export function generateNetsSessionPlan({
  numberOfNets = 2,
  totalDuration = 90,
  coachCount = 2,
  bowlingMachineAvailable = false,
  openFieldAvailable = true,
  equipmentAvailable = [],
  batterFocuses = ['Batting'],
  bowlerFocuses = ['Pace Bowling'],
  fieldingFocuses = ['Ground Fielding'],
  cohortId = 'U13_JUNIOR',
  coachLevelId = 'DEVELOPMENT_LEVEL_1',
  participantCount = 12,
  requestedBattingMinutesPerPlayer = null,
  activeRuleset = null
}) {
  // 1. Calculate Net Capacity & Batting Allocation
  const capacity = calculateBattingCapacity({
    numberOfNets,
    totalDuration,
    participantCount
  });

  const effectiveBattingMinutes = requestedBattingMinutesPerPlayer || capacity.suggestedBattingMinutes;

  // Validation: Check if requested batting allocation exceeds net capacity
  const totalRequestedNetMinutes = effectiveBattingMinutes * participantCount;
  if (totalRequestedNetMinutes > capacity.totalNetMinutes + 5) {
    return {
      success: false,
      userMessage: `Requested batting allocation of ${effectiveBattingMinutes} mins per batter (${totalRequestedNetMinutes} net-mins total) exceeds available net capacity (${capacity.totalNetMinutes} net-mins).`,
      primaryReasons: [
        `Requested ${effectiveBattingMinutes} mins/batter requires ${totalRequestedNetMinutes} net-minutes, but ${numberOfNets} net(s) over ${capacity.usableNetBlockMinutes} mins provide only ${capacity.totalNetMinutes} net-minutes.`
      ],
      suggestedChanges: [
        { type: 'CHANGE_BATTING_MINS', label: `Use suggested ${capacity.suggestedBattingMinutes} mins/batter`, targetMins: capacity.suggestedBattingMinutes },
        { type: 'ADD_NET', label: 'Increase number of net lanes' }
      ]
    };
  }

  // 2. Determine Group Structure (Nets + Fielding Station)
  const requiresFieldingStation = participantCount > (numberOfNets * 5) && openFieldAvailable;
  const stationCount = requiresFieldingStation ? numberOfNets + 1 : numberOfNets;
  const rotationCount = stationCount;

  // Split participants into groups (supports odd numbers)
  const groups = [];
  const baseGroupSize = Math.floor(participantCount / rotationCount);
  let remainder = participantCount % rotationCount;

  for (let gIdx = 0; gIdx < rotationCount; gIdx++) {
    const size = baseGroupSize + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;

    const groupPlayers = [];
    for (let pIdx = 0; pIdx < size; pIdx++) {
      groupPlayers.push(`Player_${groups.reduce((acc, g) => acc + g.size, 0) + pIdx + 1}`);
    }

    groups.push({
      groupId: `Group_${String.fromCharCode(65 + gIdx)}`, // Group A, Group B, Group C...
      size,
      players: groupPlayers
    });
  }

  // 3. Find Fielding Activity if fielding station is active
  let fieldingActivity = null;
  if (requiresFieldingStation) {
    const candidateFielding = STRUCTURED_ACTIVITIES.find(act => 
      act.permittedSessionSlots.includes('Game-Based Scenario') ||
      fieldingFocuses.some(f => act.activityCategory.toLowerCase().includes(f.toLowerCase()) || act.primarySkills.some(s => s.toLowerCase().includes(f.toLowerCase())))
    ) || STRUCTURED_ACTIVITIES[3]; // Fallback to GF-001

    fieldingActivity = {
      ...candidateFielding,
      selectedFocus: fieldingFocuses[0] || 'Ground Fielding'
    };
  }

  // 4. Build Rotations
  const rotationDuration = Math.floor(capacity.usableNetBlockMinutes / rotationCount);
  const rotations = [];

  for (let rIdx = 0; rIdx < rotationCount; rIdx++) {
    const stations = [];

    // Assign groups to Net Lanes & Fielding Station per rotation
    for (let nIdx = 0; nIdx < numberOfNets; nIdx++) {
      const assignedGroupIndex = (rIdx + nIdx) % rotationCount;
      const assignedGroup = groups[assignedGroupIndex];

      // Dual Focus Setup for Net Lane
      const primaryBatterFocus = batterFocuses[nIdx % batterFocuses.length] || 'Front Foot Drive';
      const primaryBowlerFocus = bowlerFocuses[nIdx % bowlerFocuses.length] || 'Pace Seam Control';

      // Divide group into Batters and Bowlers/Keepers
      const batterCount = Math.max(1, Math.floor(assignedGroup.size / 2));
      const batters = assignedGroup.players.slice(0, batterCount);
      const bowlers = assignedGroup.players.slice(batterCount);
      const keeper = bowlers.length >= 2 ? bowlers[bowlers.length - 1] : null;

      stations.push({
        stationId: `net_${nIdx + 1}`,
        name: `Net ${nIdx + 1}`,
        type: 'NET_LANE',
        batterFocus: primaryBatterFocus,
        bowlerFocus: primaryBowlerFocus,
        assignedGroup: assignedGroup.groupId,
        batters,
        bowlers,
        keeper,
        battingOrder: batters.map((b, bIdx) => ({ player: b, order: bIdx + 1, estMinutes: effectiveBattingMinutes })),
        coachingCues: {
          batterCues: [`Focus on ${primaryBatterFocus}`, 'High front elbow', 'Head over contact line'],
          bowlerCues: [`Focus on ${primaryBowlerFocus}`, 'Upright seam release', 'Target top of off stump']
        }
      });
    }

    // Assign group to Fielding Station if active
    if (requiresFieldingStation) {
      const fieldingGroupIndex = (rIdx + numberOfNets) % rotationCount;
      const fieldingGroup = groups[fieldingGroupIndex];

      stations.push({
        stationId: 'fielding_station',
        name: 'Off-Net Fielding Station',
        type: 'FIELDING_STATION',
        fieldingFocus: fieldingFocuses[0] || 'Ground Fielding',
        assignedGroup: fieldingGroup.groupId,
        players: fieldingGroup.players,
        activity: fieldingActivity
      });
    }

    rotations.push({
      rotationNumber: rIdx + 1,
      duration: rotationDuration,
      stations
    });
  }

  // 5. Total Elapsed Time (Template-based concurrent time)
  const totalElapsedTime = 10 + (rotationDuration * rotationCount) + 10;

  return {
    success: true,
    plan: {
      templateId: 'NETS_SESSION',
      templateName: 'Cricket Nets Rotation Session',
      sessionType: 'NETS_SESSION',
      requestedDuration: totalDuration,
      totalElapsedTime,
      numberOfNets,
      participantCount,
      suggestedBattingMinutes: capacity.suggestedBattingMinutes,
      effectiveBattingMinutes,
      rotationCount,
      requiresFieldingStation,
      groups,
      rotations
    }
  };
}
