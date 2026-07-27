import React, { useState } from 'react';
import { COHORTS } from '../config/cohorts';
import { VENUE_MODELS, resolveFacilityCapabilities } from '../config/venues';
import { CENTRE_WICKET_SCENARIOS } from '../config/sessionTemplates';
import { generateTrainingPlan, calculateBattingCapacity } from '../engine/deterministicPlanner';

export default function TrainingLab({
  squad = [],
  _subscriptionTier,
  selectedCoachLevel,
  activeRuleset,
  _onSaveVideoClip
}) {
  // Product Flow Steps: 'attendance' | 'parameters' | 'review' | 'active_guided' | 'history'
  const [step, setStep] = useState('attendance');

  // Checked-in Player IDs (Default to all roster members present)
  const [presentPlayerIds, setPresentPlayerIds] = useState(() => squad.map(p => p.id));

  // Training Type State ('NETS_SESSION' | 'CENTRE_WICKET_PRACTICE')
  const [sessionType, setSessionType] = useState('NETS_SESSION');

  // Parameters State
  const [selectedCohort, setSelectedCohort] = useState('U13_JUNIOR');
  const [selectedVenue, setSelectedVenue] = useState('COMBINED_FACILITY');
  const [duration, setDuration] = useState(90);
  
  // Combined Facility Features
  const [hasNetLanes, setHasNetLanes] = useState(true);
  const [numberOfNets, setNumberOfNets] = useState(2);
  const [openFieldAvailable, setOpenFieldAvailable] = useState(true);
  const [hasCentreWicket, setHasCentreWicket] = useState(true);
  const [hasIndoorArea, setHasIndoorArea] = useState(false);
  const [coachCount, setCoachCount] = useState(2);
  const [bowlingMachineAvailable, setBowlingMachineAvailable] = useState(false);

  // Focus Pickers
  const [batterFocuses, setBatterFocuses] = useState(['Front Foot Drive']);
  const [bowlerFocuses, setBowlerFocuses] = useState(['Pace Seam Control']);
  const [fieldingFocuses, setFieldingFocuses] = useState(['Ground Fielding']);
  const [tacticalFocuses, setTacticalFocuses] = useState(['Defending Short Boundary']);
  const [requestedBattingMins, setRequestedBattingMins] = useState('');

  // Centre Wicket Scenario State
  const [scenarioObjective, setScenarioObjective] = useState('DEATH_OVERS');

  // Generated Plan & Diagnostics State
  const [activePlan, setActivePlan] = useState(null);
  const [failureDiagnostics, setFailureDiagnostics] = useState(null);

  // Late Arrival Modal State
  const [isLateModalOpen, setIsLateModalOpen] = useState(false);
  const [lateName, setLateName] = useState('');

  const togglePlayerAttendance = (id) => {
    setPresentPlayerIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
    clearDiagnostics();
  };

  const clearDiagnostics = () => {
    setFailureDiagnostics(null);
  };

  // Handle Venue Dropdown Selection
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
    participantCount: presentPlayerIds.length || 10
  });

  // Run Deterministic Planner Engine
  const handleGeneratePlan = () => {
    setFailureDiagnostics(null);

    const facilityFeatures = {
      hasNetLanes,
      netLanesCount: numberOfNets,
      hasOpenField: openFieldAvailable,
      hasCentreWicket,
      hasIndoorArea
    };

    const result = generateTrainingPlan({
      sessionType,
      requestedDuration: duration,
      cohortId: selectedCohort,
      scenarioObjective,
      numberOfNets,
      coachCount,
      bowlingMachineAvailable,
      openFieldAvailable,
      facilityFeatures,
      batterFocuses,
      bowlerFocuses,
      fieldingFocuses,
      tacticalFocuses,
      squad: squad.filter(p => presentPlayerIds.includes(p.id)),
      requestedBattingMinutesPerPlayer: requestedBattingMins ? Number(requestedBattingMins) : null,
      coachLevelId: selectedCoachLevel,
      venueId: selectedVenue,
      participantCount: presentPlayerIds.length,
      activeRuleset
    });

    if (!result.success) {
      setFailureDiagnostics(result);
      return;
    }

    setActivePlan(result.plan);
    setStep('review');
  };

  // Apply Actionable Suggestion Click Handler
  const handleApplySuggestion = (suggestion) => {
    if (suggestion.type === 'ENABLE_FACILITY') {
      setOpenFieldAvailable(true);
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
      setPresentPlayerIds(squad.map(p => p.id));
    }
    setFailureDiagnostics(null);
  };

  // Late Arrival Player Injection
  const handleAddLatePlayer = (e) => {
    e.preventDefault();
    if (!lateName.trim()) return;
    const newId = 'p_late_' + Date.now();
    const newPlayer = {
      id: newId,
      name: lateName.trim(),
      jersey: squad.length + 1,
      role: 'Batter'
    };
    squad.push(newPlayer);
    setPresentPlayerIds(prev => [...prev, newId]);
    setLateName('');
    setIsLateModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Active Ruleset Banner */}
      {activeRuleset && (
        <div style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', fontSize: '0.8rem', color: '#10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Using: <strong>{activeRuleset.name}</strong></span>
          <span className="badge badge-ruleset">ACTIVE RULESET OVERLAY</span>
        </div>
      )}

      {/* Step 1: Attendance Checklist */}
      {step === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
              Step 1: Attendance Checklist ({presentPlayerIds.length}/{squad.length} Present)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Check in present players to calibrate group capacity.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
            {squad.map(player => {
              const isPresent = presentPlayerIds.includes(player.id);
              return (
                <button 
                  type="button"
                  key={player.id}
                  onClick={() => togglePlayerAttendance(player.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: `1px solid ${isPresent ? 'var(--color-training)' : 'var(--border-light)'}`,
                    background: isPresent ? 'var(--color-training-glow)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: 'var(--text-primary)',
                    textAlign: 'left'
                  }}
                  aria-pressed={isPresent}
                >
                  <span>#{player.jersey} {player.name}</span>
                  <span style={{ fontSize: '1.1rem' }}>{isPresent ? '✓' : '✗'}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button type="button" className="btn btn-training" onClick={() => setStep('parameters')}>
              Next: Configure Parameters →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Parameters Setup */}
      {step === 'parameters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px' }}>
          <div>
            <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
              Step 2: Session Parameters
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Select training type, scenario goals, net lane configuration, and focus priorities.
            </p>
          </div>

          {/* Training Type Selector (Section 6 UI Requirement) */}
          <div className="form-group" style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
            <label style={{ color: 'var(--color-training)', marginBottom: '8px', fontWeight: '700' }}>Training Type</label>
            <div style={{ display: 'flex', gap: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input 
                  type="radio" 
                  name="sessionType" 
                  value="NETS_SESSION" 
                  checked={sessionType === 'NETS_SESSION'} 
                  onChange={() => { setSessionType('NETS_SESSION'); clearDiagnostics(); }} 
                />
                <span>🏏 Nets Session</span>
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
                  GENERATION DIAGNOSTICS
                </h3>
              </div>

              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Root Rejection Reasons:</strong>
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

          {/* NETS SESSION PARAMETERS */}
          {sessionType === 'NETS_SESSION' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
                <label htmlFor="param-venue" style={{ color: 'var(--color-training)' }}>Training Facility Base Location</label>
                <select id="param-venue" value={selectedVenue} onChange={(e) => handleVenueChange(e.target.value)}>
                  {VENUE_MODELS.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label htmlFor="param-nets">Available Net Lanes</label>
                  <input id="param-nets" type="number" min="1" max="4" value={numberOfNets} onChange={(e) => { setNumberOfNets(Number(e.target.value)); clearDiagnostics(); }} />
                </div>
                <div className="form-group">
                  <label htmlFor="param-coaches">Available Coaches</label>
                  <input id="param-coaches" type="number" min="1" max="5" value={coachCount} onChange={(e) => { setCoachCount(Number(e.target.value)); clearDiagnostics(); }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label htmlFor="param-cohort">Participant Cohort</label>
                  <select id="param-cohort" value={selectedCohort} onChange={(e) => { setSelectedCohort(e.target.value); clearDiagnostics(); }}>
                    {Object.values(COHORTS).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="param-duration-nets">Total Session Duration (Mins)</label>
                  <input id="param-duration-nets" type="number" min="30" max="120" value={duration} onChange={(e) => { setDuration(Number(e.target.value)); clearDiagnostics(); }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={openFieldAvailable} onChange={(e) => { setOpenFieldAvailable(e.target.checked); clearDiagnostics(); }} />
                  <span>Off-Net Fielding Space Available</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={bowlingMachineAvailable} onChange={(e) => { setBowlingMachineAvailable(e.target.checked); clearDiagnostics(); }} />
                  <span>Bowling Machine Available</span>
                </label>
              </div>

              <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--color-training)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ color: 'var(--color-training)', margin: 0, fontWeight: '700' }}>
                    Single Batting Allocation Capacity
                  </label>
                  <span className="badge" style={{ background: 'var(--color-training-glow)', color: 'var(--color-training)' }}>
                    Suggested: {netCapacity.suggestedBattingMinutes} mins / batter
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Rule: Every designated batter receives exactly 1 batting turn (no repeat batting).
                </p>

                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label htmlFor="param-bat-mins" style={{ fontSize: '0.8rem' }}>Override Batting Allocation (Minutes per Batter)</label>
                  <input 
                    id="param-bat-mins"
                    type="number" 
                    placeholder={`e.g. ${netCapacity.suggestedBattingMinutes}`} 
                    value={requestedBattingMins} 
                    onChange={(e) => { setRequestedBattingMins(e.target.value); clearDiagnostics(); }} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label htmlFor="param-batter-focus" style={{ color: 'var(--color-match)' }}>🎯 Batter Focus</label>
                  <select id="param-batter-focus" value={batterFocuses[0]} onChange={(e) => { setBatterFocuses([e.target.value]); clearDiagnostics(); }}>
                    <option value="Front Foot Drive">Front Foot Drive & V-Channel</option>
                    <option value="Short-Pitched Pull">Short Ball Pull & Hook</option>
                    <option value="Spin Footwork Sweep">Spin Footwork & Sweep</option>
                    <option value="Death Overs Power Hitting">Death Overs Power Hitting</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="param-bowler-focus" style={{ color: 'var(--color-tactics)' }}>🎯 Bowler Focus</label>
                  <select id="param-bowler-focus" value={bowlerFocuses[0]} onChange={(e) => { setBowlerFocuses([e.target.value]); clearDiagnostics(); }}>
                    <option value="Pace Seam Control">Pace Seam Control & Top-of-Off Target</option>
                    <option value="Spin Dip & Drift">Spin Dip, Drift & Revolutions</option>
                    <option value="Death Yorker Execution">Death Yorker & Change-of-Pace Execution</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="param-fielding-focus" style={{ color: 'var(--color-training)' }}>🎯 Off-Net Fielding Focus</label>
                  <select id="param-fielding-focus" value={fieldingFocuses[0]} onChange={(e) => { setFieldingFocuses([e.target.value]); clearDiagnostics(); }}>
                    <option value="Ground Fielding">Ground Fielding & Direct-Hits</option>
                    <option value="High Catching">High Catching & Boundary Relays</option>
                    <option value="Slip Catching">Attacking Slip Cordon Reaction</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* CENTRE WICKET PRACTICE PARAMETERS */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label htmlFor="param-scenario" style={{ color: 'var(--color-training)', fontWeight: '700' }}>
                  🏟️ Match / Scenario Objective
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
                  <input id="param-duration-cw" type="number" min="30" max="120" value={duration} onChange={(e) => { setDuration(Number(e.target.value)); clearDiagnostics(); }} />
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
              ⚡ Generate Session Plan
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review View */}
      {step === 'review' && activePlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
                {activePlan.templateName} ({activePlan.totalElapsedTime} Mins)
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Validated for {presentPlayerIds.length} players.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('parameters')}>
                ⚙️ Adjust Parameters
              </button>
              <button type="button" className="btn btn-training" onClick={() => setStep('active_guided')}>
                🚀 Start Guided Session
              </button>
            </div>
          </div>

          {/* Render Plan Structure */}
          {activePlan.sessionType === 'NETS_SESSION' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--color-training)', borderRadius: '10px', fontSize: '0.85rem' }}>
                <strong>Single-Turn Batting Allocation Summary ({activePlan.battingSummary?.length || 0} Batters):</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginTop: '8px' }}>
                  {activePlan.battingSummary?.map((b, idx) => (
                    <div key={idx} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', fontSize: '0.8rem' }}>
                      👤 <strong>{b.name}</strong>: {b.allocatedMinutes}m in {b.netName} (Rot {b.rotationNumber})
                    </div>
                  ))}
                </div>
              </div>

              {activePlan.rotations?.map((rot, rIdx) => (
                <div key={rIdx} style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
                  <h4 style={{ color: 'var(--color-training)', margin: '0 0 10px 0' }}>
                    Rotation {rot.rotationNumber} ({rot.duration} Mins)
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                    {rot.stations.map((st, sIdx) => (
                      <div key={sIdx} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '8px', fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: '700', color: 'var(--color-match)', marginBottom: '4px' }}>
                          {st.name} ({st.assignedGroup})
                        </div>
                        {st.type === 'NET_LANE' ? (
                          <>
                            <div>🏏 <strong>Batters:</strong> {st.batters.join(', ') || 'None'} ({st.batterFocus})</div>
                            <div>⚾ <strong>Bowlers:</strong> {st.bowlers.join(', ') || 'Target Machine'} ({st.bowlerFocus})</div>
                          </>
                        ) : (
                          <div>🛡️ <strong>Fielders:</strong> {st.players.join(', ')} ({st.fieldingFocus})</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* CENTRE WICKET REVIEW DISPLAY */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--color-training)', borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 6px 0', color: 'var(--color-training)' }}>
                  🏟️ {activePlan.scenarioTitle}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {activePlan.scenarioDescription}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px', fontSize: '0.8rem' }}>
                  <span className="badge" style={{ background: 'var(--color-training-glow)', color: 'var(--color-training)' }}>
                    🎯 Batting: {activePlan.primaryBattingFocus}
                  </span>
                  <span className="badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                    🎯 Bowling: {activePlan.primaryBowlingFocus}
                  </span>
                  <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
                    🎯 Tactical: {activePlan.primaryTacticalFocus}
                  </span>
                </div>
              </div>

              {/* Player Live Role Coverage Matrix */}
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
                  Live Player Role Assignment Matrix ({activePlan.playerRoleCoverage?.length || 0} Players)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                  {activePlan.playerRoleCoverage?.map((pr, idx) => (
                    <div key={idx} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '8px', fontSize: '0.8rem' }}>
                      👤 <strong>#{pr.jersey} {pr.name}</strong>
                      <div style={{ color: 'var(--color-training)', fontWeight: '600', marginTop: '2px' }}>
                        {pr.role} {pr.position ? `(${pr.position})` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scenario Phase Blocks */}
              {activePlan.blocks?.map((block, bIdx) => (
                <div key={bIdx} style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 className="scoreboard-font" style={{ margin: 0, color: 'var(--color-training)' }}>
                      {block.phaseName} ({block.phaseDuration} Mins)
                    </h3>
                    <span className="badge">{block.type}</span>
                  </div>

                  {block.activities?.map((act, aIdx) => (
                    <div key={aIdx} style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {act.title}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Category: {act.activityCategory} | Focus: 🎯 {act.contributingFocus}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Active Guided Coaching Session */}
      {step === 'active_guided' && activePlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
                Active Guided Coaching — {activePlan.templateName}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Real-time scenario tracking and late arrival management.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsLateModalOpen(true)}>
                ➕ Late Arrival Check-in
              </button>
              <button type="button" className="btn btn-training" onClick={() => setStep('history')}>
                🏁 Complete & Save Session
              </button>
            </div>
          </div>

          <div style={{ padding: '20px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--color-training)', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--color-training)' }}>
              Active Session Flow View
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Session in progress with {presentPlayerIds.length} checked-in participants.
            </p>
          </div>
        </div>
      )}

      {/* Step 5: History View */}
      {step === 'history' && (
        <div style={{ padding: '20px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
          <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
            Session Saved to Workstation History
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            The session plan and attendance record have been saved locally.
          </p>
          <button type="button" className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={() => setStep('attendance')}>
            ↺ Start New Session
          </button>
        </div>
      )}

      {/* Late Arrival Check-in Modal */}
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
