import React, { useState } from 'react';
import { resolveFacilityCapabilities } from '../config/venues';
import { CENTRE_WICKET_SCENARIOS } from '../config/sessionTemplates';
import { DEFAULT_CLUB_TEAMS } from '../data/clubTeams';
import { generateTrainingPlan, calculateBattingCapacity } from '../engine/deterministicPlanner';
import { recalculateNetsPlanOnLateArrival } from '../engine/cricketNetsPlanner';

export default function TrainingLab({
  squad = [],
  _subscriptionTier,
  selectedCoachLevel,
  activeRuleset,
  _onSaveVideoClip
}) {
  // Product Flow Steps: 'attendance' | 'parameters' | 'review' | 'active_guided' | 'history'
  const [step, setStep] = useState('attendance');

  // Training Scope: 'MY_TEAM' | 'CLUB_TRAINING'
  const [trainingScope, setTrainingScope] = useState('CLUB_TRAINING');

  // Multi-Team Selection State
  const [selectedTeamIds, setSelectedTeamIds] = useState(['team_1st_xi', 'team_2nd_xi', 'team_3rd_xi']);

  // Combined Squad Initialization from DEFAULT_CLUB_TEAMS or prop squad
  const [combinedRoster] = useState(() => {
    const all = [];
    DEFAULT_CLUB_TEAMS.forEach(team => {
      team.defaultPlayers.forEach(p => all.push({ ...p, teamName: team.shortName }));
    });
    if (squad && squad.length > 0) {
      squad.forEach(p => {
        if (!all.some(ap => ap.id === p.id)) {
          all.push({ ...p, teamId: 'team_1st_xi', teamName: '1st XI' });
        }
      });
    }
    return all;
  });

  // Checked-in Player IDs (Default to all roster members present)
  const [presentPlayerIds, setPresentPlayerIds] = useState(() => combinedRoster.map(p => p.id));

  // Toggle for Collapsed Individual Attendance Editor (Section 1 Progressive Disclosure)
  const [showIndividualAttendance, setShowIndividualAttendance] = useState(false);

  // Per-Player Intent Overrides Map { playerId -> intent }
  const [playerIntents, setPlayerIntents] = useState({});

  // Grade Handling Mode ('KEEP_TOGETHER' | 'MIX_GRADES' | 'AUTO_OPTIMISE')
  const [gradeHandling] = useState('AUTO_OPTIMISE');

  // Training Type State ('NETS_SESSION' | 'CENTRE_WICKET_PRACTICE')
  const [sessionType, setSessionType] = useState('NETS_SESSION');

  // Parameters State
  const [_selectedCohort] = useState('SENIOR_CLUB');
  const [selectedVenue, setSelectedVenue] = useState('COMBINED_FACILITY');
  const [duration, setDuration] = useState(90);
  
  // Facilities & Resources Checklist (Simplified Section 2)
  const [hasNetLanes, setHasNetLanes] = useState(true);
  const [numberOfNets, setNumberOfNets] = useState(3);
  const [netSurface, setNetSurface] = useState('Synthetic');
  const [openFieldAvailable, setOpenFieldAvailable] = useState(true);
  const [fieldingSpaceAvailable, setFieldingSpaceAvailable] = useState(true);
  const [wicketkeepingSpaceAvailable, setWicketkeepingSpaceAvailable] = useState(true);
  const [targetBowlingSpaceAvailable, setTargetBowlingSpaceAvailable] = useState(true);
  const [hasCentreWicket, setHasCentreWicket] = useState(true);
  const [coachCount, setCoachCount] = useState(3);
  const [bowlingMachineAvailable, setBowlingMachineAvailable] = useState(true);

  // Focus Pickers (Section 3)
  const [batterFocuses, setBatterFocuses] = useState(['Front Foot Drive']);
  const [bowlerFocuses, setBowlerFocuses] = useState(['Pace Seam Control']);
  const [fieldingFocuses, setFieldingFocuses] = useState(['Ground Fielding']);
  const [wicketkeepingFocuses] = useState(['Standing Up Glovework']);
  const [tacticalFocuses] = useState(['Defending Short Boundary']);
  const [requestedBattingMins, setRequestedBattingMins] = useState('');

  // Centre Wicket Scenario State
  const [scenarioObjective, setScenarioObjective] = useState('DEATH_OVERS');

  // Progressive Disclosure Expand States (Sections 5, 6, 7)
  const [expandedStations, setExpandedStations] = useState({});
  const [showTeamAllocation, setShowTeamAllocation] = useState(false);
  const [showBattingLedger, setShowBattingLedger] = useState(false);
  const [showPlayerSchedules, setShowPlayerSchedules] = useState(false);
  const [showPlannerDetails, setShowPlannerDetails] = useState(false);
  const [inspectedPlayerId, setInspectedPlayerId] = useState('');

  // Generated Plan & Diagnostics State
  const [activePlan, setActivePlan] = useState(null);
  const [failureDiagnostics, setFailureDiagnostics] = useState(null);

  // Late Arrival Modal State
  const [isLateModalOpen, setIsLateModalOpen] = useState(false);
  const [lateName, setLateName] = useState('');

  // Filter Active Players by Selected Teams
  const activePlayers = combinedRoster.filter(p => 
    trainingScope === 'MY_TEAM' ? p.teamId === 'team_1st_xi' : selectedTeamIds.includes(p.teamId)
  );

  const presentActivePlayers = activePlayers.filter(p => presentPlayerIds.includes(p.id));

  const togglePlayerAttendance = (id) => {
    setPresentPlayerIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
    clearDiagnostics();
  };

  const toggleTeamSelection = (teamId) => {
    setSelectedTeamIds(prev =>
      prev.includes(teamId) ? prev.filter(tid => tid !== teamId) : [...prev, teamId]
    );
    clearDiagnostics();
  };

  const handlePlayerIntentChange = (playerId, intent) => {
    setPlayerIntents(prev => ({ ...prev, [playerId]: intent }));
    clearDiagnostics();
  };

  const toggleStationExpanded = (stationKey) => {
    setExpandedStations(prev => ({ ...prev, [stationKey]: !prev[stationKey] }));
  };

  const clearDiagnostics = () => {
    setFailureDiagnostics(null);
  };

  const handleVenueChange = (vId) => {
    setSelectedVenue(vId);
    const caps = resolveFacilityCapabilities(vId);
    setHasNetLanes(caps.hasNetLanes);
    if (caps.netLanesCount > 0) setNumberOfNets(caps.netLanesCount);
    setOpenFieldAvailable(caps.hasOpenField);
    setHasCentreWicket(caps.hasCentreWicket);
    clearDiagnostics();
  };

  // Live Batting Capacity Calculation
  const netCapacity = calculateBattingCapacity({
    numberOfNets,
    totalDuration: duration,
    participantCount: presentActivePlayers.length || 28
  });

  // Run Deterministic Planner Engine
  const handleGeneratePlan = () => {
    setFailureDiagnostics(null);

    const activeSquadWithIntents = presentActivePlayers.map(p => ({
      ...p,
      intent: playerIntents[p.id] || p.intent || 'Bat + Bowl'
    }));

    const activeTeamsAttending = DEFAULT_CLUB_TEAMS.filter(t => selectedTeamIds.includes(t.id)).map(t => ({
      teamId: t.id,
      teamName: t.name,
      shortName: t.shortName,
      attendanceCount: presentActivePlayers.filter(p => p.teamId === t.id).length,
      roster: activeSquadWithIntents.filter(p => p.teamId === t.id)
    }));

    const facilityFeatures = {
      hasNetLanes,
      netLanesCount: numberOfNets,
      netSurface,
      hasOpenField: openFieldAvailable,
      fieldingSpaceAvailable,
      wicketkeepingSpaceAvailable,
      targetBowlingSpaceAvailable,
      hasCentreWicket
    };

    const result = generateTrainingPlan({
      sessionType,
      trainingScope,
      teamsAttending: activeTeamsAttending,
      gradeHandling,
      requestedDuration: duration,
      cohortId: _selectedCohort,
      scenarioObjective,
      numberOfNets,
      coachCount,
      bowlingMachineAvailable,
      openFieldAvailable,
      fieldingSpaceAvailable,
      wicketkeepingSpaceAvailable,
      targetBowlingSpaceAvailable,
      facilityFeatures,
      batterFocuses,
      bowlerFocuses,
      fieldingFocuses,
      wicketkeepingFocuses,
      tacticalFocuses,
      squad: activeSquadWithIntents,
      requestedBattingMinutesPerPlayer: requestedBattingMins ? Number(requestedBattingMins) : null,
      coachLevelId: selectedCoachLevel,
      venueId: selectedVenue,
      participantCount: presentActivePlayers.length,
      activeRuleset
    });

    if (!result.success) {
      setFailureDiagnostics(result);
      return;
    }

    setActivePlan(result.plan);
    if (result.plan.playerSchedules && result.plan.playerSchedules.length > 0) {
      setInspectedPlayerId(result.plan.playerSchedules[0].playerId);
    }
    setStep('review');
  };

  const handleApplySuggestion = (suggestion) => {
    if (suggestion.type === 'ENABLE_FACILITY') {
      setOpenFieldAvailable(true);
      setFieldingSpaceAvailable(true);
    } else if (suggestion.type === 'CHANGE_VENUE' && suggestion.targetVenue) {
      handleVenueChange(suggestion.targetVenue);
    } else if (suggestion.type === 'CHANGE_BATTING_MINS' && suggestion.targetMins) {
      setRequestedBattingMins(suggestion.targetMins.toString());
    } else if (suggestion.type === 'ADD_NET') {
      setNumberOfNets(prev => Math.min(4, prev + 1));
      setHasNetLanes(true);
    } else if (suggestion.type === 'CHANGE_DURATION' && suggestion.targetDuration) {
      setDuration(suggestion.targetDuration);
    } else if (suggestion.type === 'ADD_ATTENDANCE') {
      setPresentPlayerIds(combinedRoster.map(p => p.id));
    }
    setFailureDiagnostics(null);
  };

  const handleAddLatePlayer = (e) => {
    e.preventDefault();
    if (!lateName.trim()) return;
    const newPlayer = {
      id: 'p_late_' + Date.now(),
      name: lateName.trim(),
      jersey: presentActivePlayers.length + 1,
      role: 'Batter',
      teamId: selectedTeamIds[0] || 'team_1st_xi',
      teamName: '1st XI'
    };
    
    if (activePlan) {
      const updated = recalculateNetsPlanOnLateArrival({
        currentPlan: { plan: activePlan },
        latePlayer: newPlayer
      });
      setActivePlan(updated.plan);
    }
    setPresentPlayerIds(prev => [...prev, newPlayer.id]);
    setLateName('');
    setIsLateModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '780px', margin: '0 auto' }}>
      {/* Active Ruleset Overlay Banner */}
      {activeRuleset && (
        <div style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', fontSize: '0.8rem', color: '#10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Using Active Ruleset: <strong>{activeRuleset.name}</strong></span>
          <span className="badge badge-ruleset">ACTIVE RULESET</span>
        </div>
      )}

      {/* STEP 1: ATTENDANCE (SIMPLIFIED - SECTION 1 REQUIREMENT) */}
      {step === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0, fontSize: '1.4rem' }}>
              Step 1: Squad Attendance
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Select participating club teams or edit attendance.
            </p>
          </div>

          {/* Scope Selector */}
          <div style={{ display: 'flex', gap: '16px', padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input type="radio" name="scope" value="MY_TEAM" checked={trainingScope === 'MY_TEAM'} onChange={() => { setTrainingScope('MY_TEAM'); clearDiagnostics(); }} />
              <span>My Team Only</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input type="radio" name="scope" value="CLUB_TRAINING" checked={trainingScope === 'CLUB_TRAINING'} onChange={() => { setTrainingScope('CLUB_TRAINING'); clearDiagnostics(); }} />
              <span>Multiple Teams / Club Training</span>
            </label>
          </div>

          {/* High-Level Team Attendance Cards (Section 1 Requirement) */}
          <div style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Participating Teams & Grades:</label>

            {trainingScope === 'CLUB_TRAINING' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {DEFAULT_CLUB_TEAMS.map(team => {
                  const isSel = selectedTeamIds.includes(team.id);
                  const count = presentActivePlayers.filter(p => p.teamId === team.id).length;
                  return (
                    <div key={team.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0, fontWeight: '600' }}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleTeamSelection(team.id)} />
                        <span>☑ {team.name}</span>
                      </label>
                      <span className="badge" style={{ background: isSel ? 'var(--color-training-glow)' : 'transparent', color: isSel ? 'var(--color-training)' : 'var(--text-secondary)' }}>
                        {isSel ? `${count} attending` : 'Off'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontWeight: '600' }}>
                ☑ 1st XI — {presentActivePlayers.length} attending
              </div>
            )}

            {/* Total Attendance Counter */}
            <div style={{ padding: '12px 16px', background: 'var(--color-training-glow)', border: '1px solid var(--color-training)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: 'var(--color-training)', fontSize: '1rem' }}>TOTAL ATTENDANCE</strong>
              <span className="scoreboard-font" style={{ fontSize: '1.3rem', color: 'var(--color-training)' }}>
                {presentActivePlayers.length} Players
              </span>
            </div>

            {/* Secondary Action: Edit Individual Attendance */}
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowIndividualAttendance(!showIndividualAttendance)}
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                {showIndividualAttendance ? '▲ Hide Individual Attendance' : '▼ Edit Individual Attendance & Intents'}
              </button>
            </div>

            {/* Collapsed Individual Roster & Intent Overrides (Section 1 Requirement) */}
            {showIndividualAttendance && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                {activePlayers.map(player => {
                  const isPresent = presentPlayerIds.includes(player.id);
                  const intent = playerIntents[player.id] || player.intent || 'Bat + Bowl';
                  return (
                    <div key={player.id} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0, fontWeight: '600' }}>
                        <input type="checkbox" checked={isPresent} onChange={() => togglePlayerAttendance(player.id)} />
                        <span>#{player.jersey} {player.name} ({player.teamName})</span>
                      </label>
                      {isPresent && (
                        <select value={intent} onChange={(e) => handlePlayerIntentChange(player.id, e.target.value)} style={{ padding: '2px 4px', fontSize: '0.75rem', marginTop: '2px' }}>
                          <option value="Bat + Bowl">Bat + Bowl</option>
                          <option value="Bat Only">Bat Only</option>
                          <option value="Bowl Only">Bowl Only</option>
                          <option value="Wicketkeeping Focus">Wicketkeeping Focus</option>
                          <option value="Fielding Focus">Fielding Focus</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-training" onClick={() => setStep('parameters')}>
              Next: Facilities & Focus →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 & 3: FACILITIES & TRAINING FOCUS (SIMPLIFIED - SECTIONS 2 & 3 REQUIREMENT) */}
      {step === 'parameters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0, fontSize: '1.4rem' }}>
              Step 2: Facilities & Training Focus
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Configure available nets, training space, and development priorities.
            </p>
          </div>

          {/* Training Type */}
          <div style={{ display: 'flex', gap: '16px', padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input type="radio" name="sessionType" value="NETS_SESSION" checked={sessionType === 'NETS_SESSION'} onChange={() => { setSessionType('NETS_SESSION'); clearDiagnostics(); }} />
              <span>🏏 Nets Training</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input type="radio" name="sessionType" value="CENTRE_WICKET_PRACTICE" checked={sessionType === 'CENTRE_WICKET_PRACTICE'} onChange={() => { setSessionType('CENTRE_WICKET_PRACTICE'); clearDiagnostics(); }} />
              <span>🏟️ Centre Wicket Practice</span>
            </label>
          </div>

          {/* Failure Diagnostics Display */}
          {failureDiagnostics && (
            <div style={{ padding: '16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '10px', fontSize: '0.85rem', color: '#ef4444' }}>
              <strong>⚠️ PLANNER RESOURCE DIAGNOSTIC:</strong>
              <ul style={{ margin: '4px 0 8px 0', paddingLeft: '18px' }}>
                {failureDiagnostics.primaryReasons?.map((r, idx) => <li key={idx}>{r}</li>)}
              </ul>
              {failureDiagnostics.suggestedChanges?.map((sug, idx) => (
                <button key={idx} type="button" className="btn btn-secondary" onClick={() => handleApplySuggestion(sug)} style={{ fontSize: '0.75rem', padding: '4px 8px', marginRight: '6px', marginTop: '4px' }}>
                  💡 {sug.label}
                </button>
              ))}
            </div>
          )}

          {/* SIMPLIFIED FACILITIES (Section 2 Requirement) */}
          {sessionType === 'NETS_SESSION' ? (
            <div style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="nets-avail" style={{ fontSize: '0.85rem', fontWeight: '700' }}>NETS AVAILABLE</label>
                  <input id="nets-avail" type="number" min="1" max="4" value={numberOfNets} onChange={(e) => { setNumberOfNets(Number(e.target.value)); clearDiagnostics(); }} style={{ width: '100%', marginTop: '4px' }} />
                </div>

                <div>
                  <label htmlFor="net-type" style={{ fontSize: '0.85rem', fontWeight: '700' }}>NET TYPE</label>
                  <select id="net-type" value={netSurface} onChange={(e) => setNetSurface(e.target.value)} style={{ width: '100%', marginTop: '4px' }}>
                    <option value="Synthetic">Synthetic</option>
                    <option value="Turf">Turf</option>
                    <option value="Indoor">Indoor</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>ADDITIONAL SPACE TODAY:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px', fontSize: '0.85rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={openFieldAvailable} onChange={(e) => setOpenFieldAvailable(e.target.checked)} />
                    <span>☐ Open Field</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={fieldingSpaceAvailable} onChange={(e) => setFieldingSpaceAvailable(e.target.checked)} />
                    <span>☐ Fielding Area</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={wicketkeepingSpaceAvailable} onChange={(e) => setWicketkeepingSpaceAvailable(e.target.checked)} />
                    <span>☐ Wicketkeeping Area</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={targetBowlingSpaceAvailable} onChange={(e) => setTargetBowlingSpaceAvailable(e.target.checked)} />
                    <span>☐ Bowling Target Area</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                <div>
                  <label htmlFor="coaches-count" style={{ fontSize: '0.85rem', fontWeight: '700' }}>COACHES / HELPERS</label>
                  <input id="coaches-count" type="number" min="1" max="6" value={coachCount} onChange={(e) => setCoachCount(Number(e.target.value))} style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={bowlingMachineAvailable} onChange={(e) => setBowlingMachineAvailable(e.target.checked)} />
                    <span>Bowling Machine</span>
                  </label>
                </div>
              </div>

              {/* Batting Capacity Hint */}
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--color-training)' }}>
                💡 Calculated Suggested Batting Time: <strong>{netCapacity.suggestedBattingMinutes} mins / player</strong>
              </div>
            </div>
          ) : (
            /* Centre Wicket Format */
            <div style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label htmlFor="cw-format" style={{ fontSize: '0.85rem', fontWeight: '700' }}>MATCH / SCENARIO FORMAT</label>
              <select id="cw-format" value={scenarioObjective} onChange={(e) => setScenarioObjective(e.target.value)} style={{ width: '100%' }}>
                {CENTRE_WICKET_SCENARIOS.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
              </select>
            </div>
          )}

          {/* SIMPLIFIED TRAINING FOCUS (Section 3 Requirement) */}
          <div style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label htmlFor="bf-sel" style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-match)' }}>BATTING FOCUS</label>
              <select id="bf-sel" value={batterFocuses[0]} onChange={(e) => setBatterFocuses([e.target.value])} style={{ width: '100%', marginTop: '4px' }}>
                <option value="Front Foot Drive">Front Foot Drive & V-Channel</option>
                <option value="Short-Pitched Pull">Short Ball Pull & Hook</option>
                <option value="Spin Footwork Sweep">Spin Footwork & Sweep</option>
                <option value="Death Overs Power Hitting">Death Overs Power Hitting</option>
              </select>
            </div>

            <div>
              <label htmlFor="bwf-sel" style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-tactics)' }}>BOWLING FOCUS</label>
              <select id="bwf-sel" value={bowlerFocuses[0]} onChange={(e) => setBowlerFocuses([e.target.value])} style={{ width: '100%', marginTop: '4px' }}>
                <option value="Pace Seam Control">Pace Seam Control & Top-of-Off</option>
                <option value="Spin Dip & Drift">Spin Dip, Drift & Revolutions</option>
                <option value="Death Yorker Execution">Death Yorker & Change-of-Pace</option>
              </select>
            </div>

            <div>
              <label htmlFor="ff-sel" style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-training)' }}>FIELDING FOCUS</label>
              <select id="ff-sel" value={fieldingFocuses[0]} onChange={(e) => setFieldingFocuses([e.target.value])} style={{ width: '100%', marginTop: '4px' }}>
                <option value="Ground Fielding">Ground Fielding & Direct-Hits</option>
                <option value="High Catching">High Catching & Boundary Relays</option>
                <option value="Slip Catching">Attacking Slip Cordon</option>
              </select>
            </div>

            <div>
              <label htmlFor="sess-len" style={{ fontSize: '0.85rem', fontWeight: '700' }}>SESSION LENGTH (MINUTES)</label>
              <input id="sess-len" type="number" min="30" max="180" value={duration} onChange={(e) => setDuration(Number(e.target.value))} style={{ width: '100%', marginTop: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep('attendance')}>
              ← Back
            </button>

            <button type="button" className="btn btn-training" onClick={handleGeneratePlan} style={{ fontSize: '1rem', padding: '10px 20px' }}>
              ⚡ GENERATE CLUB SESSION
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: HIGH-LEVEL REVIEW SCREEN (SECTIONS 4, 5, 6, 7, 8, 9, 10 REQUIREMENT) */}
      {step === 'review' && activePlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0, fontSize: '1.4rem' }}>
              TONIGHT'S TRAINING PLAN
            </h2>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('parameters')}>
                ⚙️ Adjust
              </button>
              <button type="button" className="btn btn-training" onClick={() => setStep('active_guided')}>
                🚀 Start Guided Live
              </button>
            </div>
          </div>

          {/* HIGH-LEVEL SUMMARY CARD (Section 4 Requirement) */}
          <div style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--color-training)', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.9rem', fontWeight: '600' }}>
            <span>👥 <strong>{activePlan.participantCount} players</strong></span>
            <span>|</span>
            <span>🏏 <strong>{activePlan.numberOfNets || 1} nets</strong></span>
            <span>|</span>
            <span>⏱️ <strong>{activePlan.totalElapsedTime} minutes</strong></span>
            <span>|</span>
            <span>🏏 <strong>{activePlan.designatedBattersCount || activePlan.participantCount} batters</strong></span>
            <span>|</span>
            <span>⏳ <strong>{activePlan.effectiveBattingMinutes || 10} min batting allocation</strong></span>
            <span>|</span>
            <span>👥 <strong>{activePlan.groups?.length || 2} groups</strong></span>
          </div>

          {/* SIMPLE CHRONOLOGICAL TIMELINE & ROTATION STATIONS (Section 4 & 5 Requirement) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activePlan.rotations?.map((rot, rIdx) => (
              <div key={rIdx} style={{ padding: '14px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ color: 'var(--color-training)', margin: 0, fontSize: '1rem' }}>
                    Rotation {rot.rotationNumber} ({rot.timeSlot})
                  </h4>
                  <span className="badge">{rot.duration} Mins</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {rot.stations.map((st, sIdx) => {
                    const stationKey = `rot${rIdx}_st${sIdx}`;
                    const isExpanded = !!expandedStations[stationKey];
                    const isBowlingOnly = st.hasBatters === false || (st.type === 'NET_LANE' && (!st.batters || st.batters.length === 0));

                    return (
                      <div key={sIdx} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '8px', fontSize: '0.85rem' }}>
                        {/* Collapsed View (Section 5 Requirement) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: '700', color: 'var(--color-match)', fontSize: '0.95rem' }}>
                              {st.name} — {st.assignedGroup}
                            </div>

                            {st.type === 'NET_LANE' ? (
                              <div style={{ marginTop: '4px', lineHeight: '1.4' }}>
                                {/* FIX EMPTY NET ROLE PRESENTATION (Section 8 Requirement) */}
                                {!isBowlingOnly && (
                                  <div>🏏 <strong>Batters:</strong> {st.batters.join(', ') || 'None'}</div>
                                )}
                                <div>⚾ <strong>Bowling Group:</strong> {st.bowlers.length} players</div>
                                {!isBowlingOnly && st.batterFocus && (
                                  <div>🎯 <strong>Batting Focus:</strong> {st.batterFocus}</div>
                                )}
                                {st.bowlerFocus && (
                                  <div>🎯 <strong>Bowling Focus:</strong> {st.bowlerFocus}</div>
                                )}
                              </div>
                            ) : (
                              <div style={{ marginTop: '4px' }}>
                                🛡️ <strong>Players:</strong> {st.players?.length} fielders | Focus: {st.fieldingFocus}
                              </div>
                            )}
                          </div>

                          <button 
                            type="button" 
                            className="btn btn-secondary"
                            onClick={() => toggleStationExpanded(stationKey)}
                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          >
                            {isExpanded ? '▲ Hide Details' : '▼ View Details'}
                          </button>
                        </div>

                        {/* Expanded View (Section 5 Requirement) */}
                        {isExpanded && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                            {st.type === 'NET_LANE' && (
                              <>
                                <div><strong>Full Bowling Roster:</strong> {st.bowlers.join(', ') || 'Target Machine'}</div>
                                {st.keeper && <div><strong>Wicketkeeper:</strong> {st.keeper}</div>}
                                {st.dualPurposeObjectives?.batterObjective && (
                                  <div style={{ color: 'var(--color-match)' }}>
                                    <strong>Batting Cue:</strong> {st.dualPurposeObjectives.batterObjective.coachingCues[0]}
                                  </div>
                                )}
                                {st.dualPurposeObjectives?.bowlerObjective && (
                                  <div style={{ color: 'var(--color-tactics)' }}>
                                    <strong>Bowling Cue:</strong> {st.dualPurposeObjectives.bowlerObjective.coachingCues[0]}
                                  </div>
                                )}
                              </>
                            )}

                            {st.type === 'FIELDING_STATION' && (
                              <div><strong>Fielding Roster:</strong> {st.players?.join(', ')}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* PROGRESSIVE COLLAPSED ANALYTICS (Sections 6, 7 & 11) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>

            {/* Optional Player Schedule Finder (Section 7 Requirement) */}
            <div style={{ padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '10px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowPlayerSchedules(!showPlayerSchedules)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>🔍 Find Player Schedule</span>
                <span>{showPlayerSchedules ? '▲' : '▼'}</span>
              </button>

              {showPlayerSchedules && activePlan.playerSchedules && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <select value={inspectedPlayerId} onChange={(e) => setInspectedPlayerId(e.target.value)} style={{ padding: '6px' }}>
                    {activePlan.playerSchedules.map(ps => <option key={ps.playerId} value={ps.playerId}>{ps.name} ({ps.teamName})</option>)}
                  </select>

                  {(() => {
                    const ps = activePlan.playerSchedules.find(p => p.playerId === inspectedPlayerId) || activePlan.playerSchedules[0];
                    if (!ps) return null;
                    return (
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', fontSize: '0.85rem' }}>
                        <strong style={{ color: 'var(--color-training)' }}>{ps.name} ({ps.teamName}) Schedule:</strong>
                        <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px', fontSize: '0.8rem' }}>
                          {ps.schedule.map((item, idx) => (
                            <li key={idx}><strong>{item.timeSlot}:</strong> {item.stationName} — {item.role} ({item.activityTitle})</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Collapsed Team Resource Allocation (Section 6 Requirement) */}
            {activePlan.teamAllocationSummary && (
              <div style={{ padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowTeamAllocation(!showTeamAllocation)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>⚖️ View Team Resource Allocation Summary</span>
                  <span>{showTeamAllocation ? '▲' : '▼'}</span>
                </button>

                {showTeamAllocation && (
                  <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', fontSize: '0.8rem' }}>
                    {activePlan.teamAllocationSummary.map((t, idx) => (
                      <div key={idx} style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                        <strong>{t.teamName}:</strong> {t.netExposureMinutes} min net exposure ({t.playerCount} players)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Collapsed Batting Allocation Audit Ledger (Section 6 Requirement) */}
            {activePlan.battingSummary && (
              <div style={{ padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowBattingLedger(!showBattingLedger)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>📋 View Batting Allocation Ledger ({activePlan.battingSummary.length} Batters)</span>
                  <span>{showBattingLedger ? '▲' : '▼'}</span>
                </button>

                {showBattingLedger && (
                  <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px', fontSize: '0.8rem' }}>
                    {activePlan.battingSummary.map((b, idx) => (
                      <div key={idx} style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                        👤 <strong>{b.name}</strong>: {b.netName} ({b.allocatedMinutes}m)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Collapsed Planner Details (Section 6 Requirement) */}
            <div style={{ padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '10px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowPlannerDetails(!showPlannerDetails)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>⚙️ View Planner Details & Diagnostics</span>
                <span>{showPlannerDetails ? '▲' : '▼'}</span>
              </button>

              {showPlannerDetails && (
                <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Template: {activePlan.templateName} | Type: {activePlan.sessionType} | Rotation Count: {activePlan.rotationCount || 1}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* STEP 5: GUIDED LIVE MODE */}
      {step === 'active_guided' && activePlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0, fontSize: '1.3rem' }}>
              Guided Live Mode
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsLateModalOpen(true)}>
                ➕ Late Arrival
              </button>
              <button type="button" className="btn btn-training" onClick={() => setStep('history')}>
                🏁 Finish Session
              </button>
            </div>
          </div>

          <div style={{ padding: '14px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: '10px', color: '#10b981', fontSize: '0.85rem' }}>
            ⏱️ <strong>LIVE CHANGEOVER ASSISTANT:</strong> Rotation 1 in progress. 2 minutes until batter changeover.
          </div>
        </div>
      )}

      {/* STEP 6: HISTORY */}
      {step === 'history' && (
        <div style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
          <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
            Session Saved
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            The session plan has been saved to workstation history.
          </p>
          <button type="button" className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={() => setStep('attendance')}>
            ↺ Start New Session
          </button>
        </div>
      )}

      {/* Late Arrival Check-in Modal */}
      {isLateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-training)', padding: '24px', borderRadius: '16px', width: '340px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 className="scoreboard-font" style={{ margin: 0, color: 'var(--color-training)' }}>Late Arrival Check-in</h3>
            <form onSubmit={handleAddLatePlayer} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="text" value={lateName} onChange={(e) => setLateName(e.target.value)} placeholder="e.g. Alex Green" autoFocus required style={{ padding: '8px' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsLateModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-training">Check In</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
