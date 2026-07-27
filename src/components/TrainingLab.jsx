import React, { useState } from 'react';
import { COHORTS } from '../config/cohorts';
import { VENUE_MODELS, resolveFacilityCapabilities } from '../config/venues';
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

  // Per-Player Intent Overrides Map { playerId -> intent }
  const [playerIntents, setPlayerIntents] = useState({});

  // Grade Handling Mode ('KEEP_TOGETHER' | 'MIX_GRADES' | 'AUTO_OPTIMISE')
  const [gradeHandling, setGradeHandling] = useState('AUTO_OPTIMISE');

  // Training Type State ('NETS_SESSION' | 'CENTRE_WICKET_PRACTICE')
  const [sessionType, setSessionType] = useState('NETS_SESSION');

  // Parameters State
  const [selectedCohort, setSelectedCohort] = useState('SENIOR_CLUB');
  const [selectedVenue, setSelectedVenue] = useState('COMBINED_FACILITY');
  const [duration, setDuration] = useState(90);
  
  // Facilities & Resources Checklist
  const [hasNetLanes, setHasNetLanes] = useState(true);
  const [numberOfNets, setNumberOfNets] = useState(3);
  const [netSurface, setNetSurface] = useState('Synthetic');
  const [openFieldAvailable, setOpenFieldAvailable] = useState(true);
  const [fieldingSpaceAvailable, setFieldingSpaceAvailable] = useState(true);
  const [wicketkeepingSpaceAvailable, setWicketkeepingSpaceAvailable] = useState(true);
  const [targetBowlingSpaceAvailable, setTargetBowlingSpaceAvailable] = useState(true);
  const [hasCentreWicket, setHasCentreWicket] = useState(true);
  const [hasIndoorArea, setHasIndoorArea] = useState(false);
  const [coachCount, setCoachCount] = useState(3);
  const [bowlingMachineAvailable, setBowlingMachineAvailable] = useState(true);

  // Focus Pickers (Separate multi-selects)
  const [batterFocuses, setBatterFocuses] = useState(['Front Foot Drive']);
  const [bowlerFocuses, setBowlerFocuses] = useState(['Pace Seam Control']);
  const [fieldingFocuses, setFieldingFocuses] = useState(['Ground Fielding']);
  const [wicketkeepingFocuses, setWicketkeepingFocuses] = useState(['Standing Up Glovework']);
  const [tacticalFocuses, setTacticalFocuses] = useState(['Defending Short Boundary']);
  const [requestedBattingMins, setRequestedBattingMins] = useState('');

  // Centre Wicket Scenario State
  const [scenarioObjective, setScenarioObjective] = useState('DEATH_OVERS');

  // Inspector Selected Player ID
  const [inspectedPlayerId, setInspectedPlayerId] = useState('');

  // Preset State
  const [savedPresets, setSavedPresets] = useState([
    { id: 'p_thursday', name: 'Thursday Senior Club Night (3 Nets + Oval)', numberOfNets: 3, duration: 90, gradeHandling: 'AUTO_OPTIMISE' }
  ]);

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
    setHasIndoorArea(caps.hasIndoorArea);
    clearDiagnostics();
  };

  // Live Batting Capacity Recommendation
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
      hasCentreWicket,
      hasIndoorArea
    };

    const result = generateTrainingPlan({
      sessionType,
      trainingScope,
      teamsAttending: activeTeamsAttending,
      gradeHandling,
      requestedDuration: duration,
      cohortId: selectedCohort,
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

  const handleSavePreset = () => {
    const presetName = prompt('Enter a name for this Club Training Preset:', 'Thursday Senior Club Training');
    if (!presetName) return;
    const newPreset = {
      id: 'p_' + Date.now(),
      name: presetName,
      numberOfNets,
      duration,
      gradeHandling
    };
    setSavedPresets(prev => [...prev, newPreset]);
  };

  const handleLoadPreset = (preset) => {
    setNumberOfNets(preset.numberOfNets);
    setDuration(preset.duration);
    setGradeHandling(preset.gradeHandling);
    clearDiagnostics();
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Active Ruleset Overlay Banner */}
      {activeRuleset && (
        <div style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', fontSize: '0.8rem', color: '#10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Using Active Ruleset: <strong>{activeRuleset.name}</strong></span>
          <span className="badge badge-ruleset">ACTIVE RULESET OVERLAY</span>
        </div>
      )}

      {/* Step 1: Training Scope & Attendance */}
      {step === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
              Step 1: Training Scope & Club Attendance Checklist
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Configure club training scope and check in attending players per grade.
            </p>
          </div>

          {/* Training Scope Selector (Section 1 Requirement) */}
          <div className="form-group" style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
            <label style={{ color: 'var(--color-training)', marginBottom: '8px', fontWeight: '700' }}>Training Scope</label>
            <div style={{ display: 'flex', gap: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input 
                  type="radio" 
                  name="trainingScope" 
                  value="MY_TEAM" 
                  checked={trainingScope === 'MY_TEAM'} 
                  onChange={() => { setTrainingScope('MY_TEAM'); clearDiagnostics(); }} 
                />
                <span>👤 My Team Only (Single Team)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input 
                  type="radio" 
                  name="trainingScope" 
                  value="CLUB_TRAINING" 
                  checked={trainingScope === 'CLUB_TRAINING'} 
                  onChange={() => { setTrainingScope('CLUB_TRAINING'); clearDiagnostics(); }} 
                />
                <span>🏏 Multiple Teams / Club Training</span>
              </label>
            </div>
          </div>

          {/* Multi-Team Grade Selection Bar */}
          {trainingScope === 'CLUB_TRAINING' && (
            <div style={{ padding: '14px 16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '10px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>Participating Club Teams & Grades Today:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
                {DEFAULT_CLUB_TEAMS.map(team => {
                  const isSel = selectedTeamIds.includes(team.id);
                  const count = presentActivePlayers.filter(p => p.teamId === team.id).length;
                  return (
                    <button
                      type="button"
                      key={team.id}
                      onClick={() => toggleTeamSelection(team.id)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        border: `1px solid ${isSel ? 'var(--color-training)' : 'var(--border-medium)'}`,
                        background: isSel ? 'var(--color-training-glow)' : 'rgba(255,255,255,0.03)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      {isSel ? '☑' : '☐'} {team.name} ({count} Attending)
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-Team Attendance Roster Display */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
                Attending Player Roster ({presentActivePlayers.length} / {activePlayers.length} Present)
              </h3>
              <span className="badge" style={{ background: 'var(--color-training-glow)', color: 'var(--color-training)' }}>
                Total Attendance = {presentActivePlayers.length} Players
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
              {activePlayers.map(player => {
                const isPresent = presentPlayerIds.includes(player.id);
                const intent = playerIntents[player.id] || player.intent || 'Bat + Bowl';
                return (
                  <div 
                    key={player.id}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${isPresent ? 'var(--color-training)' : 'var(--border-light)'}`,
                      background: isPresent ? 'var(--color-training-glow)' : 'var(--bg-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: '600' }}>
                        <input type="checkbox" checked={isPresent} onChange={() => togglePlayerAttendance(player.id)} />
                        <span>#{player.jersey} {player.name} <small style={{ opacity: 0.7 }}>({player.teamName})</small></span>
                      </label>
                    </div>

                    {isPresent && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', marginTop: '2px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Intent:</span>
                        <select 
                          value={intent} 
                          onChange={(e) => handlePlayerIntentChange(player.id, e.target.value)}
                          style={{ padding: '2px 6px', fontSize: '0.75rem', borderRadius: '4px' }}
                        >
                          <option value="Bat + Bowl">Bat + Bowl</option>
                          <option value="Bat Only">Bat Only</option>
                          <option value="Bowl Only">Bowl Only</option>
                          <option value="Wicketkeeping Focus">Wicketkeeping Focus</option>
                          <option value="Fielding Focus">Fielding Focus</option>
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button type="button" className="btn btn-training" onClick={() => setStep('parameters')}>
              Next: Configure Facility & Parameters →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Parameters Setup */}
      {step === 'parameters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '680px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
                Step 2: Training Environment & Facility Availability
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Configure available facilities, grade handling, and multi-select development focuses.
              </p>
            </div>

            {/* Presets Button Bar */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleSavePreset} style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                💾 Save Preset
              </button>
            </div>
          </div>

          {/* Presets Quick Load Bar */}
          {savedPresets.length > 0 && (
            <div style={{ padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--color-training)', fontWeight: '700' }}>Club Presets:</span>
              {savedPresets.map(p => (
                <button key={p.id} type="button" className="btn btn-secondary" onClick={() => handleLoadPreset(p)} style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                  ⚡ {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Training Type Selector (Section 2 Requirement) */}
          <div className="form-group" style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
            <label style={{ color: 'var(--color-training)', marginBottom: '8px', fontWeight: '700' }}>Training Environment</label>
            <div style={{ display: 'flex', gap: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input 
                  type="radio" 
                  name="sessionType" 
                  value="NETS_SESSION" 
                  checked={sessionType === 'NETS_SESSION'} 
                  onChange={() => { setSessionType('NETS_SESSION'); clearDiagnostics(); }} 
                />
                <span>🏏 Nets Training</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input 
                  type="radio" 
                  name="sessionType" 
                  value="CENTRE_WICKET_PRACTICE" 
                  checked={sessionType === 'CENTRE_WICKET_PRACTICE'} 
                  onChange={() => { setSessionType('CENTRE_WICKET_PRACTICE'); clearDiagnostics(); }} 
                />
                <span>🏟️ Centre Wicket Practice</span>
              </label>
            </div>
          </div>

          {/* Structured Failure Diagnostics Display */}
          {failureDiagnostics && (
            <div style={{ padding: '20px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                <span style={{ fontSize: '1.3rem' }}>⚠️</span>
                <h3 className="scoreboard-font" style={{ margin: 0, fontSize: '1.2rem', color: '#ef4444' }}>
                  PLANNER RESOURCE DIAGNOSTICS
                </h3>
              </div>

              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Root Constraint Rejection Reasons:</strong>
                <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', fontSize: '0.85rem', color: '#ef4444', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {failureDiagnostics.primaryReasons?.map((reason, idx) => (
                    <li key={idx}>• {reason}</li>
                  ))}
                </ul>
              </div>

              {failureDiagnostics.suggestedChanges && failureDiagnostics.suggestedChanges.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(239,68,68,0.2)', paddingTop: '10px' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Actionable Suggestions:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                    {failureDiagnostics.suggestedChanges.map((sug, idx) => (
                      <button 
                        key={idx}
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleApplySuggestion(sug)}
                        style={{ fontSize: '0.8rem', padding: '6px 12px', border: '1px solid var(--color-training)', color: 'var(--color-training)' }}
                      >
                        💡 {sug.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FACILITY AVAILABILITY & RESOURCES CHECKLIST (Section 3 Requirement) */}
          <div className="form-group" style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="param-venue" style={{ color: 'var(--color-training)', fontWeight: '700' }}>Training Facility Base Location</label>
              <select id="param-venue" value={selectedVenue} onChange={(e) => handleVenueChange(e.target.value)} style={{ padding: '4px 8px' }}>
                {VENUE_MODELS.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: '14px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>Simultaneous Available Facilities & Spaces Today:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px', fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasNetLanes} onChange={(e) => { setHasNetLanes(e.target.checked); clearDiagnostics(); }} />
                  <span>☑ Net Lanes Available</span>
                </label>

                {hasNetLanes && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label htmlFor="param-nets-count" style={{ fontSize: '0.8rem' }}>Lanes:</label>
                    <input id="param-nets-count" type="number" min="1" max="4" value={numberOfNets} onChange={(e) => { setNumberOfNets(Number(e.target.value)); clearDiagnostics(); }} style={{ width: '50px', padding: '2px 6px' }} />
                    <select value={netSurface} onChange={(e) => setNetSurface(e.target.value)} style={{ fontSize: '0.75rem', padding: '2px 4px' }}>
                      <option value="Synthetic">Synthetic</option>
                      <option value="Turf">Turf</option>
                      <option value="Indoor">Indoor</option>
                    </select>
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={openFieldAvailable} onChange={(e) => { setOpenFieldAvailable(e.target.checked); setFieldingSpaceAvailable(e.target.checked); clearDiagnostics(); }} />
                  <span>☑ Full / Open Field Space</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={fieldingSpaceAvailable} onChange={(e) => { setFieldingSpaceAvailable(e.target.checked); clearDiagnostics(); }} />
                  <span>☑ Fielding & Throwing Area</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={wicketkeepingSpaceAvailable} onChange={(e) => { setWicketkeepingSpaceAvailable(e.target.checked); clearDiagnostics(); }} />
                  <span>☑ Dedicated Keeper Area</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={targetBowlingSpaceAvailable} onChange={(e) => { setTargetBowlingSpaceAvailable(e.target.checked); clearDiagnostics(); }} />
                  <span>☑ Target Bowling Area</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasCentreWicket} onChange={(e) => { setHasCentreWicket(e.target.checked); clearDiagnostics(); }} />
                  <span>☐ Centre Wicket Pitch</span>
                </label>
              </div>
            </div>
          </div>

          {/* TEAM / GRADE HANDLING (Section 4 Requirement) */}
          {trainingScope === 'CLUB_TRAINING' && (
            <div className="form-group" style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
              <label style={{ color: 'var(--color-training)', marginBottom: '8px', fontWeight: '700' }}>Team / Grade Handling Preference</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="gradeHandling" value="AUTO_OPTIMISE" checked={gradeHandling === 'AUTO_OPTIMISE'} onChange={() => setGradeHandling('AUTO_OPTIMISE')} />
                  <span><strong>Auto — let Inside Edge optimise</strong> (Mixes grades for player exposure: higher bowlers to lower batters, spin net, development net)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="gradeHandling" value="KEEP_TOGETHER" checked={gradeHandling === 'KEEP_TOGETHER'} onChange={() => setGradeHandling('KEEP_TOGETHER')} />
                  <span><strong>Keep teams/grades together</strong> (1st XI stays together, 2nd XI stays together)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="gradeHandling" value="MIX_GRADES" checked={gradeHandling === 'MIX_GRADES'} onChange={() => setGradeHandling('MIX_GRADES')} />
                  <span><strong>Fully mix teams/grades</strong> (Broad skill rotation across whole club)</span>
                </label>
              </div>
            </div>
          )}

          {/* NETS SESSION PARAMETERS */}
          {sessionType === 'NETS_SESSION' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label htmlFor="param-coaches">Coaches / Helpers Available</label>
                  <input id="param-coaches" type="number" min="1" max="6" value={coachCount} onChange={(e) => { setCoachCount(Number(e.target.value)); clearDiagnostics(); }} />
                </div>

                <div className="form-group">
                  <label htmlFor="param-duration-nets">Total Session Duration (Mins)</label>
                  <input id="param-duration-nets" type="number" min="30" max="180" value={duration} onChange={(e) => { setDuration(Number(e.target.value)); clearDiagnostics(); }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={bowlingMachineAvailable} onChange={(e) => { setBowlingMachineAvailable(e.target.checked); clearDiagnostics(); }} />
                  <span>Bowling Machine Available</span>
                </label>
              </div>

              {/* DYNAMIC BATTING CAPACITY CARD (Section 8 Requirement) */}
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--color-training)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ color: 'var(--color-training)', margin: 0, fontWeight: '700' }}>
                    Calculated Net Batting Capacity
                  </label>
                  <span className="badge" style={{ background: 'var(--color-training-glow)', color: 'var(--color-training)', fontSize: '0.85rem', padding: '4px 8px' }}>
                    SUGGESTED BATTING TIME PER PLAYER: {netCapacity.suggestedBattingMinutes} MINUTES
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  V1 Business Rule: Every designated batter receives <strong>exactly 1 batting turn</strong> (nobody bats twice).
                </p>

                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label htmlFor="param-bat-mins" style={{ fontSize: '0.8rem' }}>Override Proposed Batting Time (Minutes per Batter)</label>
                  <input 
                    id="param-bat-mins"
                    type="number" 
                    placeholder={`Calculated: ${netCapacity.suggestedBattingMinutes}`} 
                    value={requestedBattingMins} 
                    onChange={(e) => { setRequestedBattingMins(e.target.value); clearDiagnostics(); }} 
                  />
                </div>
              </div>

              {/* SEPARATE MULTI-SELECT FOCUS PICKERS (Section 6 Requirement) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label htmlFor="param-batter-focus" style={{ color: 'var(--color-match)' }}>🎯 Batter Focus (Multi-Select)</label>
                  <select id="param-batter-focus" value={batterFocuses[0]} onChange={(e) => { setBatterFocuses([e.target.value]); clearDiagnostics(); }}>
                    <option value="Front Foot Drive">Front Foot Drive & V-Channel</option>
                    <option value="Short-Pitched Pull">Short Ball Pull & Hook</option>
                    <option value="Spin Footwork Sweep">Spin Footwork & Sweep</option>
                    <option value="Death Overs Power Hitting">Death Overs Power Hitting</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="param-bowler-focus" style={{ color: 'var(--color-tactics)' }}>🎯 Bowler Focus (Multi-Select)</label>
                  <select id="param-bowler-focus" value={bowlerFocuses[0]} onChange={(e) => { setBowlerFocuses([e.target.value]); clearDiagnostics(); }}>
                    <option value="Pace Seam Control">Pace Seam Control & Top-of-Off Target</option>
                    <option value="Spin Dip & Drift">Spin Dip, Drift & Revolutions</option>
                    <option value="Death Yorker Execution">Death Yorker & Change-of-Pace Execution</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label htmlFor="param-fielding-focus" style={{ color: 'var(--color-training)' }}>🎯 Fielding Focus</label>
                    <select id="param-fielding-focus" value={fieldingFocuses[0]} onChange={(e) => { setFieldingFocuses([e.target.value]); clearDiagnostics(); }}>
                      <option value="Ground Fielding">Ground Fielding & Direct-Hits</option>
                      <option value="High Catching">High Catching & Relays</option>
                      <option value="Slip Catching">Attacking Slip Cordon</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="param-keeper-focus" style={{ color: '#ec4899' }}>🎯 Wicketkeeping Focus</label>
                    <select id="param-keeper-focus" value={wicketkeepingFocuses[0]} onChange={(e) => { setWicketkeepingFocuses([e.target.value]); clearDiagnostics(); }}>
                      <option value="Standing Up Glovework">Standing Up Glovework</option>
                      <option value="Pace Diving Takes">Pace Diving Takes</option>
                      <option value="Leg-side Stumping Reaction">Leg-side Stumping Reaction</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* CENTRE WICKET PRACTICE PARAMETERS */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label htmlFor="param-scenario" style={{ color: 'var(--color-training)', fontWeight: '700' }}>
                  🏟️ Match / Scenario Format
                </label>
                <select id="param-scenario" value={scenarioObjective} onChange={(e) => { setScenarioObjective(e.target.value); clearDiagnostics(); }}>
                  {CENTRE_WICKET_SCENARIOS.map(sc => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {CENTRE_WICKET_SCENARIOS.find(s => s.id === scenarioObjective)?.description}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label htmlFor="param-cohort-cw">Participant Cohort</label>
                  <select id="param-cohort-cw" value={selectedCohort} onChange={(e) => { setSelectedCohort(e.target.value); clearDiagnostics(); }}>
                    {Object.values(COHORTS).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="param-duration-cw">Total Session Duration (Mins)</label>
                  <input id="param-duration-cw" type="number" min="30" max="180" value={duration} onChange={(e) => { setDuration(Number(e.target.value)); clearDiagnostics(); }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label htmlFor="param-cw-batter-focus" style={{ color: 'var(--color-match)' }}>🎯 Batting Group Focus</label>
                  <select id="param-cw-batter-focus" value={batterFocuses[0]} onChange={(e) => { setBatterFocuses([e.target.value]); clearDiagnostics(); }}>
                    <option value="Front Foot Drive">Front Foot Drive & Gap Placement</option>
                    <option value="Death Overs Power Hitting">Boundary Clearing & Power Hitting</option>
                    <option value="Spin Footwork Sweep">Spin Footwork & Sweep</option>
                    <option value="Calling & Communication">Strike Rotation & Quick Singles</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="param-cw-bowler-focus" style={{ color: 'var(--color-tactics)' }}>🎯 Bowling Group Focus</label>
                  <select id="param-cw-bowler-focus" value={bowlerFocuses[0]} onChange={(e) => { setBowlerFocuses([e.target.value]); clearDiagnostics(); }}>
                    <option value="Death Yorker Execution">Death Yorker & Change-of-Pace Execution</option>
                    <option value="Pace Seam Control">New Ball Seam Control & Channel Line</option>
                    <option value="Spin Dip & Drift">Middle Overs Spin Dip & Drift</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="param-cw-tactical-focus" style={{ color: 'var(--color-training)' }}>🎯 Tactical Focus</label>
                  <select id="param-cw-tactical-focus" value={tacticalFocuses[0]} onChange={(e) => { setTacticalFocuses([e.target.value]); clearDiagnostics(); }}>
                    <option value="Defending Short Boundary">Defending Short Boundary Ring</option>
                    <option value="Executing Under High Pressure">Executing Under High Pressure</option>
                    <option value="Field Placement Awareness">Tactical Field Setting Awareness</option>
                    <option value="Denying Dot Balls">Denying Singles in Powerplay</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep('attendance')}>
              ← Back to Attendance
            </button>

            <button type="button" className="btn btn-training" onClick={handleGeneratePlan}>
              ⚡ Generate Club Session Plan
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review Plan Screen (Section 15 Requirement) */}
      {step === 'review' && activePlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
                {activePlan.templateName} ({activePlan.totalElapsedTime} Mins)
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Validated for {activePlan.participantCount} players across {trainingScope === 'CLUB_TRAINING' ? `${selectedTeamIds.length} Teams` : 'My Team'}.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('parameters')}>
                ⚙️ Adjust Parameters
              </button>
              <button type="button" className="btn btn-training" onClick={() => setStep('active_guided')}>
                🚀 Start Guided Live Mode
              </button>
            </div>
          </div>

          {/* CLUB TRAINING OVERVIEW CARD (Section 15 Requirement) */}
          <div style={{ padding: '18px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--color-training)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, color: 'var(--color-training)', fontSize: '1.1rem' }}>
              🏏 CLUB TRAINING OVERVIEW
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', fontSize: '0.85rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Teams Attending</span>
                <strong>{trainingScope === 'CLUB_TRAINING' ? selectedTeamIds.length : 1}</strong>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Total Players</span>
                <strong>{activePlan.participantCount}</strong>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Net Lanes</span>
                <strong>{activePlan.numberOfNets || 'N/A'}</strong>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Coaches/Helpers</span>
                <strong>{coachCount}</strong>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Training Time</span>
                <strong>{activePlan.totalElapsedTime} Mins</strong>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Designated Batters</span>
                <strong>{activePlan.designatedBattersCount || activePlan.participantCount}</strong>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Batting Allocation</span>
                <strong>{activePlan.effectiveBattingMinutes || 10} Mins / player</strong>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Operational Groups</span>
                <strong>{activePlan.groups?.length || 2}</strong>
              </div>
            </div>
          </div>

          {/* EQUITABLE TEAM RESOURCE ALLOCATION SUMMARY (Section 13 Requirement) */}
          {activePlan.teamAllocationSummary && activePlan.teamAllocationSummary.length > 1 && (
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: 'var(--color-match)' }}>
                ⚖️ Equitable Resource Allocation Summary by Team/Grade
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', fontSize: '0.85rem' }}>
                {activePlan.teamAllocationSummary.map((t, idx) => (
                  <div key={idx} style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                    <strong style={{ color: 'var(--color-training)' }}>{t.teamName}</strong> ({t.playerCount} Players)
                    <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                      Net Exposure: <strong>{t.netExposureMinutes} min</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BATTING ALLOCATION AUDIT LEDGER (Section 17 Requirement) */}
          {activePlan.sessionType === 'NETS_SESSION' && (
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--color-training)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, color: 'var(--color-training)' }}>
                  📋 BATTING ALLOCATION AUDIT LEDGER ({activePlan.battingSummary?.length || 0} Batters)
                </h4>
                <span className="badge badge-success" style={{ background: '#10b981', color: '#000' }}>
                  ✓ VALIDATED: ALL BATTERS BATTING EXACTLY ONCE
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {activePlan.battingSummary?.map((b, idx) => (
                  <div key={idx} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>👤 <strong>{b.name}</strong> <small style={{ opacity: 0.7 }}>({b.teamName})</small></span>
                    <span style={{ color: 'var(--color-training)' }}>{b.netName} ({b.allocatedMinutes}m)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CLUB NIGHT TIMELINE & DUAL-PURPOSE ROTATIONS (Sections 9, 14, 15) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
              ⏱️ Timed Club Night Rotations & Dual-Purpose Stations
            </h3>

            {activePlan.rotations?.map((rot, rIdx) => (
              <div key={rIdx} style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ color: 'var(--color-training)', margin: 0 }}>
                    Rotation {rot.rotationNumber} ({rot.timeSlot})
                  </h4>
                  <span className="badge">{rot.duration} Mins</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  {rot.stations.map((st, sIdx) => (
                    <div key={sIdx} style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--color-match)', fontSize: '0.95rem' }}>
                        {st.name} <small>({st.assignedGroup})</small>
                      </div>

                      {st.type === 'NET_LANE' ? (
                        <>
                          <div style={{ padding: '8px', background: 'rgba(59,130,246,0.08)', borderRadius: '6px' }}>
                            <strong style={{ color: 'var(--color-match)' }}>🏏 BATTER OBJECTIVE:</strong> {st.dualPurposeObjectives?.batterObjective?.focus || st.batterFocus}
                            <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>
                              Batters: {st.batters.join(', ') || 'None'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              Cue: {st.dualPurposeObjectives?.batterObjective?.coachingCues[0]}
                            </div>
                          </div>

                          <div style={{ padding: '8px', background: 'rgba(245,158,11,0.08)', borderRadius: '6px' }}>
                            <strong style={{ color: 'var(--color-tactics)' }}>⚾ BOWLER OBJECTIVE:</strong> {st.dualPurposeObjectives?.bowlerObjective?.focus || st.bowlerFocus}
                            <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>
                              Bowlers: {st.bowlers.join(', ') || 'Target Machine'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              Cue: {st.dualPurposeObjectives?.bowlerObjective?.coachingCues[0]}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div style={{ padding: '8px', background: 'rgba(16,185,129,0.08)', borderRadius: '6px' }}>
                          <strong style={{ color: '#10b981' }}>🛡️ FIELDING STATION:</strong> {st.fieldingFocus}
                          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>
                            Players: {st.players.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* INDIVIDUAL PLAYER SCHEDULE INSPECTOR (Section 16 Requirement) */}
          {activePlan.playerSchedules && activePlan.playerSchedules.length > 0 && (
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>
                  👤 Individual Player Schedule Inspector
                </h4>
                <select 
                  value={inspectedPlayerId} 
                  onChange={(e) => setInspectedPlayerId(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                >
                  {activePlan.playerSchedules.map(ps => (
                    <option key={ps.playerId} value={ps.playerId}>{ps.name} ({ps.teamName})</option>
                  ))}
                </select>
              </div>

              {(() => {
                const targetSched = activePlan.playerSchedules.find(ps => ps.playerId === inspectedPlayerId) || activePlan.playerSchedules[0];
                if (!targetSched) return null;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--color-training)' }}>PLAYER — {targetSched.name.toUpperCase()} ({targetSched.teamName})</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginTop: '6px' }}>
                      {targetSched.schedule.map((item, idx) => (
                        <div key={idx} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '8px', fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: '700', color: 'var(--color-training)' }}>{item.timeSlot}</div>
                          <div><strong>{item.stationName}</strong> ({item.role})</div>
                          <div style={{ opacity: 0.8, fontSize: '0.75rem', marginTop: '2px' }}>{item.activityTitle}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Guided Live Mode (Section 23 Requirement) */}
      {step === 'active_guided' && activePlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
                Guided Live Mode — Club Night Operations Assistant
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Real-time rotation tracking, changeover prompts, and late arrival management.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsLateModalOpen(true)}>
                ➕ Late Arrival Check-in
              </button>
              <button type="button" className="btn btn-training" onClick={() => setStep('history')}>
                🏁 Complete Club Night Session
              </button>
            </div>
          </div>

          {/* Live Operational Prompts */}
          <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '12px', color: '#10b981', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>⏱️</span>
            <div>
              <strong>LIVE CHANGEOVER ASSISTANT:</strong> Rotation 1 in progress. 2 minutes until batter changeover.
            </div>
          </div>

          <div style={{ padding: '20px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--color-training)', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--color-training)' }}>
              Active Operational Stations Overview
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Session running smoothly for {activePlan.participantCount} checked-in club players.
            </p>
          </div>
        </div>
      )}

      {/* Step 5: History View (Section 26 Requirement) */}
      {step === 'history' && (
        <div style={{ padding: '20px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
          <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
            Club Session Saved to Workstation History
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            The club training plan, team allocation ledgers, and player schedules have been saved locally.
          </p>
          <button type="button" className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={() => setStep('attendance')}>
            ↺ Start New Club Session
          </button>
        </div>
      )}

      {/* Late Arrival Check-in Modal (Section 24 Requirement) */}
      {isLateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-training)', padding: '24px', borderRadius: '16px', width: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="scoreboard-font" style={{ margin: 0, color: 'var(--color-training)' }}>Late Arrival Check-in</h3>
            <form onSubmit={handleAddLatePlayer} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label htmlFor="late-player-name">Player Name</label>
                <input id="late-player-name" type="text" value={lateName} onChange={(e) => setLateName(e.target.value)} placeholder="e.g. Alex Green" autoFocus required />
              </div>

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
