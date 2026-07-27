import { STRUCTURED_ACTIVITIES } from '../data/structuredActivityRecords';

/**
 * Cricket Nets Session Architecture & Single-Turn Batting Rotation Engine
 * Built for Australian Community Cricket Clubs (Multi-Team & Single-Team Planning)
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
  trainingScope = 'MY_TEAM', // 'MY_TEAM' | 'CLUB_TRAINING'
  teamsAttending = [],
  gradeHandling = 'AUTO_OPTIMISE', // 'KEEP_TOGETHER' | 'MIX_GRADES' | 'AUTO_OPTIMISE'
  numberOfNets = 2,
  totalDuration = 90,
  _coachCount = 2,
  _bowlingMachineAvailable = false,
  openFieldAvailable = true,
  _fieldingSpaceAvailable = true,
  _wicketkeepingSpaceAvailable = true,
  _targetBowlingSpaceAvailable = true,
  _equipmentAvailable = [],
  batterFocuses = ['Front Foot Drive'],
  bowlerFocuses = ['Pace Seam Control'],
  fieldingFocuses = ['Ground Fielding'],
  _wicketkeepingFocuses = ['Standing Up Glovework'],
  _cohortId = 'U13_JUNIOR',
  _coachLevelId = 'DEVELOPMENT_LEVEL_1',
  participantCount = 12,
  squad = [],
  requestedBattingMinutesPerPlayer = null,
  _activeRuleset = null
}) {
  // 1. Input Validation
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

  // 2. Calculate Capacity & Batting Allocation
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
  const totalRequestedNetMinutes = effectiveBattingMinutes * participantCount;

  if (totalRequestedNetMinutes > capacity.totalNetMinutes || effectiveBattingMinutes < 4) {
    return {
      success: false,
      userMessage: `${participantCount} designated batters cannot each receive ${effectiveBattingMinutes} minutes with ${numberOfNets} net(s) and ${capacity.usableNetBlockMinutes} available net minutes.`,
      primaryReasons: [
        `${participantCount} designated batters cannot each receive ${effectiveBattingMinutes} minutes with ${numberOfNets} net(s) and ${capacity.usableNetBlockMinutes} available net minutes.`
      ],
      suggestedChanges: [
        { type: 'CHANGE_BATTING_MINS', label: `Reduce batting time per player to ${capacity.suggestedBattingMinutes} mins`, targetMins: capacity.suggestedBattingMinutes },
        { type: 'ADD_NET', label: 'Increase available net lanes' },
        { type: 'CHANGE_DURATION', label: 'Increase net-session duration', targetDuration: totalDuration + 30 }
      ]
    };
  }

  // 3. Initialize Player Roster & Profile Intents
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
        role: 'All Rounder',
        intent: 'Bat + Bowl',
        teamId: teamsAttending[0]?.teamId || 'team_1'
      });
    }
  }

  const players = activeRoster.map(p => ({
    playerId: p.id,
    name: p.name || `Player ${p.jersey}`,
    jersey: p.jersey,
    role: p.role || 'All Rounder',
    intent: p.intent || 'Bat + Bowl',
    teamId: p.teamId || 'team_1',
    teamName: teamsAttending.find(t => t.teamId === p.teamId)?.teamName || 'Squad Team',
    requiresBattingTime: p.intent !== 'Bowl Only' && p.intent !== 'Wicketkeeping Focus',
    targetBattingMinutes: effectiveBattingMinutes,
    allocatedBattingMinutes: 0,
    battingSlotId: null,
    hasBatted: false,
    battingAppearances: 0
  }));

  const playerMap = new Map(players.map(p => [p.playerId, p]));
  const designatedBattersCount = players.filter(p => p.requiresBattingTime).length;

  // 4. Determine Operational Station & Rotation Structure
  const requiresFieldingStation = participantCount > (numberOfNets * 5) && openFieldAvailable;
  const stationCount = requiresFieldingStation ? numberOfNets + 1 : numberOfNets;
  const rotationCount = stationCount;

  // Group Allocation by Grade Handling Preference
  const groups = [];
  if (gradeHandling === 'KEEP_TOGETHER' && teamsAttending.length > 1) {
    teamsAttending.forEach((team, tIdx) => {
      const teamPlayerIds = players.filter(p => p.teamId === team.teamId).map(p => p.playerId);
      if (teamPlayerIds.length > 0) {
        groups.push({
          groupId: `Group_${team.shortName || team.teamName || String.fromCharCode(65 + tIdx)}`,
          teamName: team.teamName,
          size: teamPlayerIds.length,
          players: teamPlayerIds
        });
      }
    });
  }

  if (groups.length === 0) {
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
  }

  // 5. Select Structured Activities for Off-Net Stations
  const fieldingActivity = STRUCTURED_ACTIVITIES.find(act => 
    fieldingFocuses.some(f => act.activityCategory.toLowerCase().includes(f.toLowerCase()) || act.primarySkills.some(s => s.toLowerCase().includes(f.toLowerCase())))
  ) || STRUCTURED_ACTIVITIES[3];

  const targetBowlingActivity = {
    id: 'ACT_TARGET_BOWLING',
    title: 'Target Bowling & Crease Precision',
    activityCategory: 'Bowling',
    focus: bowlerFocuses[0] || 'Pace Seam Control',
    coachingCues: ['Upright seam release', 'Repeatable foot placement', 'Hit 4th stump target zone'],
    successIndicators: ['70%+ deliveries pitching in target box']
  };

  // 6. Build Rotations & Assign Single Batting Allocations
  const prepDuration = 10;
  const _cooldownDuration = 10;
  const rotationDuration = Math.floor(capacity.usableNetBlockMinutes / rotationCount);
  const rotations = [];
  const battingLedger = [];
  const playerSchedules = new Map(players.map(p => [p.playerId, { playerId: p.playerId, name: p.name, teamName: p.teamName, schedule: [] }]));

  let currentStartMins = prepDuration;

  for (let rIdx = 0; rIdx < rotationCount; rIdx++) {
    const stations = [];
    const rotTimeSlot = `${currentStartMins}:00 - ${currentStartMins + rotationDuration}:00`;

    for (let nIdx = 0; nIdx < numberOfNets; nIdx++) {
      const assignedGroupIndex = (rIdx + nIdx) % groups.length;
      const assignedGroup = groups[assignedGroupIndex];

      const primaryBatterFocus = batterFocuses[nIdx % batterFocuses.length] || 'Front Foot Drive';
      const primaryBowlerFocus = bowlerFocuses[nIdx % bowlerFocuses.length] || 'Pace Seam Control';

      const groupUnbatted = assignedGroup.players.filter(pid => {
        const p = playerMap.get(pid);
        return p && p.requiresBattingTime && !p.hasBatted;
      });

      const battersToAssign = [...groupUnbatted];
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

          const ledgerEntry = {
            playerId: playerObj.playerId,
            name: playerObj.name,
            teamId: playerObj.teamId,
            teamName: playerObj.teamName,
            netLaneId: `net_${nIdx + 1}`,
            netName: `Net ${nIdx + 1}`,
            rotationNumber: rIdx + 1,
            startMinutes: currentStartMins + (bIdx * effectiveBattingMinutes),
            allocatedMinutes: effectiveBattingMinutes,
            completed: false
          };

          battingLedger.push(ledgerEntry);

          const sched = playerSchedules.get(pid);
          if (sched) {
            sched.schedule.push({
              timeSlot: rotTimeSlot,
              stationName: `Net ${nIdx + 1}`,
              role: 'Batter',
              activityTitle: `Batting Allocation (${effectiveBattingMinutes} mins)`,
              details: `Focus: ${primaryBatterFocus}`
            });
          }
        }
      });

      const bowlerPids = assignedGroup.players.filter(pid => !batters.includes(playerMap.get(pid)?.name));
      const bowlers = bowlerPids.map(pid => playerMap.get(pid)?.name || pid);
      
      bowlerPids.forEach(pid => {
        const sched = playerSchedules.get(pid);
        if (sched) {
          sched.schedule.push({
            timeSlot: rotTimeSlot,
            stationName: `Net ${nIdx + 1}`,
            role: 'Bowler',
            activityTitle: `Bowling Spell (${primaryBowlerFocus})`,
            details: `Focus: ${primaryBowlerFocus} Target Execution`
          });
        }
      });

      const keeper = bowlerPids.length >= 2 ? playerMap.get(bowlerPids[bowlerPids.length - 1])?.name : null;
      const isBowlingOnlyStation = batters.length === 0;

      const dualPurposeObjectives = {
        ...(isBowlingOnlyStation ? {} : {
          batterObjective: {
            focus: primaryBatterFocus,
            coachingCues: [`Focus on ${primaryBatterFocus}`, 'High front elbow & head over contact line', 'Late ball sight'],
            successIndicators: ['Clean contact into V-Channel', 'Zero edges to slip cordon']
          }
        }),
        bowlerObjective: {
          focus: primaryBowlerFocus,
          coachingCues: [`Focus on ${primaryBowlerFocus}`, 'Upright seam & tight wrist release', 'Repeatable 4th stump line'],
          successIndicators: ['70%+ deliveries in top-of-off target zone']
        }
      };

      stations.push({
        stationId: `net_${nIdx + 1}`,
        name: isBowlingOnlyStation ? `Net ${nIdx + 1} (Bowling Target Station)` : `Net ${nIdx + 1}`,
        type: 'NET_LANE',
        hasBatters: !isBowlingOnlyStation,
        batterFocus: isBowlingOnlyStation ? null : primaryBatterFocus,
        bowlerFocus: primaryBowlerFocus,
        assignedGroup: assignedGroup.groupId,
        batters,
        bowlers,
        keeper,
        battingOrder,
        dualPurposeObjectives,
        secondaryActivity: targetBowlingActivity
      });
    }

    if (requiresFieldingStation) {
      const fieldingGroupIndex = (rIdx + numberOfNets) % groups.length;
      const fieldingGroup = groups[fieldingGroupIndex];
      const fieldingPlayerNames = fieldingGroup.players.map(pid => playerMap.get(pid)?.name || pid);

      fieldingGroup.players.forEach(pid => {
        const sched = playerSchedules.get(pid);
        if (sched) {
          sched.schedule.push({
            timeSlot: rotTimeSlot,
            stationName: 'Off-Net Fielding Station',
            role: 'Fielder',
            activityTitle: fieldingActivity.title,
            details: `Focus: ${fieldingFocuses[0] || 'Ground Fielding'}`
          });
        }
      });

      stations.push({
        stationId: 'fielding_station',
        name: 'Off-Net Fielding & Skill Station',
        type: 'FIELDING_STATION',
        fieldingFocus: fieldingFocuses[0] || 'Ground Fielding',
        assignedGroup: fieldingGroup.groupId,
        players: fieldingPlayerNames,
        activity: fieldingActivity
      });
    }

    rotations.push({
      rotationNumber: rIdx + 1,
      timeSlot: rotTimeSlot,
      duration: rotationDuration,
      stations
    });

    currentStartMins += rotationDuration;
  }

  // 7. Validate Business Rule: EVERY PLAYER DESIGNATED TO BAT RECEIVES EXACTLY 1 TURN
  const unallocatedBatters = players.filter(p => p.requiresBattingTime && p.battingAppearances === 0);
  const repeatBatters = players.filter(p => p.battingAppearances > 1);

  if (unallocatedBatters.length > 0 || repeatBatters.length > 0) {
    return {
      success: false,
      userMessage: `Validation failed: ${unallocatedBatters.length} batter(s) received 0 batting turns, and ${repeatBatters.length} received duplicate turns.`,
      primaryReasons: [
        unallocatedBatters.length > 0 ? `${unallocatedBatters.map(p => p.name).join(', ')} did not receive a batting allocation.` : '',
        repeatBatters.length > 0 ? `${repeatBatters.map(p => p.name).join(', ')} received more than one batting allocation.` : ''
      ].filter(Boolean),
      suggestedChanges: [
        { type: 'CHANGE_BATTING_MINS', label: `Reduce batting time per player to ${capacity.suggestedBattingMinutes} mins`, targetMins: capacity.suggestedBattingMinutes },
        { type: 'ADD_NET', label: 'Increase available net lanes' }
      ]
    };
  }

  // 8. Equitable Team Resource Allocation Summary (Section 13 Requirement)
  const teamAllocationSummary = (teamsAttending.length > 0 ? teamsAttending : [{ teamId: 'team_1', teamName: 'Squad' }]).map(team => {
    const teamPlayers = players.filter(p => p.teamId === team.teamId || teamsAttending.length === 0);
    const teamBatters = teamPlayers.filter(p => p.hasBatted);
    const netMins = teamBatters.length * effectiveBattingMinutes;

    return {
      teamId: team.teamId,
      teamName: team.teamName || team.name,
      playerCount: teamPlayers.length,
      batterCount: teamBatters.length,
      netExposureMinutes: netMins,
      avgBattingMinutesPerPlayer: teamPlayers.length > 0 ? Math.round(netMins / teamPlayers.length) : 0
    };
  });

  // 9. Club Training Timeline (Section 14 Requirement)
  const timeline = [
    {
      timeSlot: '0:00 - 0:10',
      phaseName: 'Whole-Group Preparation',
      activity: 'Dynamic Warm-Up & Movement Prep',
      details: 'All attending players complete squad mobility & throwing arm prep.'
    },
    ...rotations.map(r => ({
      timeSlot: r.timeSlot,
      phaseName: `Rotation ${r.rotationNumber} (${r.duration} Mins)`,
      activity: `Net Lanes & Concurrent Stations`,
      details: `${r.stations.length} active operational stations running in parallel.`
    })),
    {
      timeSlot: `${currentStartMins}:00 - ${currentStartMins + 10}:00`,
      phaseName: 'Cool-Down & Club Debrief',
      activity: 'Post-Training Debrief & Gear Pack-Up',
      details: 'Coaches review key targets and announce matchday selections.'
    }
  ];

  const totalElapsedTime = 10 + (rotationDuration * rotationCount) + 10;

  return {
    success: true,
    plan: {
      templateId: 'NETS_SESSION',
      templateName: 'Cricket Club Nets Rotation Session',
      sessionType: 'NETS_SESSION',
      trainingScope,
      gradeHandling,
      requestedDuration: totalDuration,
      totalElapsedTime,
      numberOfNets,
      participantCount,
      designatedBattersCount,
      suggestedBattingMinutes: capacity.suggestedBattingMinutes,
      effectiveBattingMinutes,
      rotationCount,
      requiresFieldingStation,
      groups,
      rotations,
      timeline,
      battingLedger,
      battingSummary: battingLedger,
      teamAllocationSummary,
      playerSchedules: Array.from(playerSchedules.values()),
      playerAllocations: Array.from(playerMap.values())
    }
  };
}

/**
 * Dynamic Late Arrival / Absence Recalculation (Section 24 Requirement)
 * Preserves completed batting turns, never gives anyone a second turn, recalculates remaining schedule.
 */
export function recalculateNetsPlanOnLateArrival({
  currentPlan,
  latePlayer,
  _remainingDuration = 45
}) {
  if (!currentPlan || !currentPlan.plan) return currentPlan;

  const existingPlan = currentPlan.plan;
  const updatedAllocations = [...existingPlan.playerAllocations];

  const alreadyExists = updatedAllocations.find(p => p.playerId === latePlayer.id || p.name.toLowerCase() === latePlayer.name.toLowerCase());
  if (alreadyExists) return currentPlan;

  const newPlayerObj = {
    playerId: latePlayer.id || `p_late_${Date.now()}`,
    name: latePlayer.name,
    jersey: latePlayer.jersey || updatedAllocations.length + 1,
    role: latePlayer.role || 'Batter',
    intent: 'Bat + Bowl',
    teamId: latePlayer.teamId || 'team_1',
    teamName: latePlayer.teamName || 'Squad Team',
    requiresBattingTime: true,
    targetBattingMinutes: existingPlan.effectiveBattingMinutes,
    allocatedBattingMinutes: existingPlan.effectiveBattingMinutes,
    battingSlotId: `late_net1`,
    hasBatted: true,
    battingAppearances: 1
  };

  updatedAllocations.push(newPlayerObj);

  const updatedLedger = [...existingPlan.battingLedger, {
    playerId: newPlayerObj.playerId,
    name: newPlayerObj.name,
    teamId: newPlayerObj.teamId,
    teamName: newPlayerObj.teamName,
    netLaneId: 'net_1',
    netName: 'Net 1 (Late Arrival)',
    rotationNumber: existingPlan.rotationCount,
    startMinutes: existingPlan.totalElapsedTime - 15,
    allocatedMinutes: existingPlan.effectiveBattingMinutes,
    completed: false
  }];

  return {
    ...currentPlan,
    plan: {
      ...existingPlan,
      participantCount: existingPlan.participantCount + 1,
      battingLedger: updatedLedger,
      battingSummary: updatedLedger,
      playerAllocations: updatedAllocations
    }
  };
}
