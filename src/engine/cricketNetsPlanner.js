import { STRUCTURED_ACTIVITIES } from '../data/structuredActivityRecords';
import { REJECTION_CODES } from '../config/rejectionCodes';

/**
 * Cricket Nets Session Architecture & Single-Turn Batting Rotation Engine
 *
 * Inside Edge V1 Business Rule:
 * NO PLAYER BATS TWICE IN THE SAME GENERATED NETS SESSION.
 * ONE DESIGNATED BATTER = ONE BATTING TURN PER GENERATED NETS SESSION.
 */

export function calculateBattingCapacity({
  numberOfNets = 2,
  totalDuration = 90,
  participantCount = 12,
  changeoverMinutesPerBatter = 1
}) {
  if (participantCount <= 0 || numberOfNets <= 0 || totalDuration < 30) {
    return {
      usableNetBlockMinutes: 0,
      totalNetMinutes: 0,
      suggestedBattingMinutes: 0,
      maxFitBattingMinutes: 0,
      invalid: true
    };
  }

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
  squad = [],
  requestedBattingMinutesPerPlayer = null,
  activeRuleset = null
}) {
  // Input Validation
  if (!participantCount || participantCount <= 0) {
    return {
      success: false,
      userMessage: 'Session planning requires at least 1 checked-in participant.',
      primaryReasons: ['Participant attendance is zero.'],
      suggestedChanges: [{ type: 'ADD_ATTENDANCE', label: 'Check in present players' }]
    };
  }

  if (!numberOfNets || numberOfNets <= 0) {
    return {
      success: false,
      userMessage: 'At least 1 net lane is required for a Nets Session.',
      primaryReasons: ['No net lanes selected.'],
      suggestedChanges: [{ type: 'ADD_NET', label: 'Set Net Lanes to 1 or more' }]
    };
  }

  // 1. Calculate Capacity & Batting Allocation
  const capacity = calculateBattingCapacity({
    numberOfNets,
    totalDuration,
    participantCount
  });

  if (capacity.invalid) {
    return {
      success: false,
      userMessage: 'Invalid session duration or parameter configuration.',
      primaryReasons: ['Duration must be at least 30 minutes.']
    };
  }

  const effectiveBattingMinutes = requestedBattingMinutesPerPlayer || capacity.suggestedBattingMinutes;

  // Validation: Check if 1 batting allocation per batter can fit within available net time
  const totalRequestedNetMinutes = effectiveBattingMinutes * participantCount;
  if (totalRequestedNetMinutes > capacity.totalNetMinutes || effectiveBattingMinutes < 5) {
    return {
      success: false,
      userMessage: `With ${participantCount} batters, ${numberOfNets} net(s) and the current session duration (${totalDuration}m), there is not enough net time to give every batter one batting allocation.`,
      primaryReasons: [
        `With ${participantCount} batters, ${numberOfNets} net(s) and the current session duration, there is not enough net time to give every batter one batting allocation.`
      ],
      suggestedChanges: [
        { type: 'CHANGE_BATTING_MINS', label: `Reduce batting time per player to ${capacity.suggestedBattingMinutes} mins`, targetMins: capacity.suggestedBattingMinutes },
        { type: 'ADD_NET', label: 'Increase available net lanes' },
        { type: 'CHANGE_DURATION', label: 'Increase net-session duration', targetDuration: totalDuration + 30 }
      ]
    };
  }

  // 2. Initialize Player Tracking using Real Roster Identities
  const activeRoster = (squad && squad.length >= participantCount)
    ? squad.slice(0, participantCount)
    : Array.from({ length: participantCount }, (_, i) => ({
        id: `p_${i + 1}`,
        name: `Player ${i + 1}`,
        jersey: i + 1,
        role: 'All Rounder'
      }));

  const players = activeRoster.map(p => ({
    playerId: p.id,
    name: p.name || `Player ${p.jersey}`,
    jersey: p.jersey,
    role: p.role || 'All Rounder',
    requiresBattingTime: true,
    targetBattingMinutes: effectiveBattingMinutes,
    allocatedBattingMinutes: 0,
    battingSlotId: null,
    hasBatted: false,
    battingAppearances: 0
  }));

  const playerMap = new Map(players.map(p => [p.playerId, p]));

  // 3. Determine Station & Rotation Structure
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

    const startIndex = groups.reduce((acc, g) => acc + g.size, 0);
    const groupPlayers = players.slice(startIndex, startIndex + size).map(p => p.playerId);

    groups.push({
      groupId: `Group_${String.fromCharCode(65 + gIdx)}`,
      size,
      players: groupPlayers
    });
  }

  // 4. Select Fielding Activity if fielding station is active
  let fieldingActivity = null;
  if (requiresFieldingStation) {
    const candidateFielding = STRUCTURED_ACTIVITIES.find(act => 
      act.permittedSessionSlots.includes('Game-Based Scenario') ||
      fieldingFocuses.some(f => act.activityCategory.toLowerCase().includes(f.toLowerCase()) || act.primarySkills.some(s => s.toLowerCase().includes(f.toLowerCase())))
    ) || STRUCTURED_ACTIVITIES[3];

    fieldingActivity = {
      ...candidateFielding,
      selectedFocus: fieldingFocuses[0] || 'Ground Fielding'
    };
  }

  // 5. Build Rotations & Assign Single Batting Allocations
  const rotationDuration = Math.floor(capacity.usableNetBlockMinutes / rotationCount);
  const rotations = [];
  const battingSummary = [];

  for (let rIdx = 0; rIdx < rotationCount; rIdx++) {
    const stations = [];

    for (let nIdx = 0; nIdx < numberOfNets; nIdx++) {
      const assignedGroupIndex = (rIdx + nIdx) % rotationCount;
      const assignedGroup = groups[assignedGroupIndex];

      const primaryBatterFocus = batterFocuses[nIdx % batterFocuses.length] || 'Front Foot Drive';
      const primaryBowlerFocus = bowlerFocuses[nIdx % bowlerFocuses.length] || 'Pace Seam Control';

      // Pick all unbatted members of the assigned group for this net visit
      const groupUnbatted = assignedGroup.players.filter(pid => {
        const p = playerMap.get(pid);
        return p && !p.hasBatted;
      });

      const battersToAssign = [...groupUnbatted];

      // Mark assigned batters as having batted (EXACTLY 1 ALLOCATION)
      const batters = [];
      const battingOrder = [];

      battersToAssign.forEach((pid, bIdx) => {
        const playerObj = playerMap.get(pid);
        if (playerObj && !playerObj.hasBatted) {
          playerObj.hasBatted = true;
          playerObj.battingAppearances = 1;
          playerObj.allocatedBattingMinutes = effectiveBattingMinutes;
          playerObj.battingSlotId = `rot${rIdx + 1}_net${nIdx + 1}_slot${bIdx + 1}`;

          batters.push(playerObj.name);
          battingOrder.push({
            player: playerObj.name,
            order: bIdx + 1,
            allocatedMinutes: effectiveBattingMinutes
          });

          battingSummary.push({
            playerId: playerObj.playerId,
            name: playerObj.name,
            allocatedMinutes: effectiveBattingMinutes,
            netName: `Net ${nIdx + 1}`,
            rotationNumber: rIdx + 1
          });
        }
      });

      // Remaining group members act as Bowlers / Keeper
      const bowlerPids = assignedGroup.players.filter(pid => {
        const p = playerMap.get(pid);
        return !batters.includes(p.name);
      });
      const bowlers = bowlerPids.map(pid => playerMap.get(pid)?.name || pid);
      const keeper = bowlers.length >= 2 ? bowlers[bowlers.length - 1] : null;

      // Productive secondary bowling activity when net batters complete their turn
      const secondaryActivity = {
        id: `BOWLING_WORK_${nIdx + 1}`,
        title: `${primaryBowlerFocus} Target Execution`,
        focus: primaryBowlerFocus,
        type: 'TARGET_BOWLING',
        setup: `Bowlers execute ${primaryBowlerFocus} targets with automated crease marker feedback.`
      };

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
        battingOrder,
        secondaryActivity,
        coachingCues: {
          batterCues: [`Focus on ${primaryBatterFocus}`, 'High front elbow', 'Head over contact line'],
          bowlerCues: [`Focus on ${primaryBowlerFocus}`, 'Upright seam release', 'Target top of off stump']
        }
      });
    }

    // Assign group to Off-Net Fielding Station if active
    if (requiresFieldingStation) {
      const fieldingGroupIndex = (rIdx + numberOfNets) % rotationCount;
      const fieldingGroup = groups[fieldingGroupIndex];
      const fieldingPlayerNames = fieldingGroup.players.map(pid => playerMap.get(pid)?.name || pid);

      stations.push({
        stationId: 'fielding_station',
        name: 'Off-Net Fielding Station',
        type: 'FIELDING_STATION',
        fieldingFocus: fieldingFocuses[0] || 'Ground Fielding',
        assignedGroup: fieldingGroup.groupId,
        players: fieldingPlayerNames,
        activity: fieldingActivity
      });
    }

    rotations.push({
      rotationNumber: rIdx + 1,
      duration: rotationDuration,
      stations
    });
  }

  // 6. HARD VALIDATION RULE: Every required batter MUST have EXACTLY ONE batting allocation
  const unallocatedPlayers = players.filter(p => p.requiresBattingTime && p.battingAppearances === 0);
  const repeatBatters = players.filter(p => p.battingAppearances > 1);

  if (unallocatedPlayers.length > 0 || repeatBatters.length > 0) {
    return {
      success: false,
      userMessage: `Validation failed: ${unallocatedPlayers.length} batter(s) received 0 batting turns, and ${repeatBatters.length} received duplicate turns.`,
      primaryReasons: [
        unallocatedPlayers.length > 0 ? `${unallocatedPlayers.map(p => p.name).join(', ')} did not receive a batting allocation.` : '',
        repeatBatters.length > 0 ? `${repeatBatters.map(p => p.name).join(', ')} received more than one batting allocation.` : ''
      ].filter(Boolean),
      suggestedChanges: [
        { type: 'CHANGE_BATTING_MINS', label: `Reduce batting time per player to ${capacity.suggestedBattingMinutes} mins`, targetMins: capacity.suggestedBattingMinutes },
        { type: 'ADD_NET', label: 'Increase available net lanes' }
      ]
    };
  }

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
      rotations,
      battingSummary,
      playerAllocations: Array.from(playerMap.values())
    }
  };
}
