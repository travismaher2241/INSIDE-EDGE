import React, { useState } from 'react';
import { COHORTS } from '../config/cohorts';
import { VENUE_MODELS, resolveFacilityCapabilities } from '../config/venues';
import { ACTIVITY_CATEGORIES } from '../config/activityCategories';
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

  // Session Type State ('STANDARD_SESSION' | 'NETS_SESSION')
  const [sessionType, setSessionType] = useState('STANDARD_SESSION');

  // Parameters State
  const [selectedCohort, setSelectedCohort] = useState('U13_JUNIOR');
  const [selectedVenue, setSelectedVenue] = useState('COMBINED_FACILITY');
  const [duration, setDuration] = useState(90);
  
  // Combined Facility Features
  const [hasNetLanes, setHasNetLanes] = useState(true);
  const [numberOfNets, setNumberOfNets] = useState(2);
  const [openFieldAvailable, setOpenFieldAvailable] = useState(true);
  const [hasCentreWicket, setHasCentreWicket] = useState(false);
  const [hasIndoorArea, setHasIndoorArea] = useState(false);
  const [coachCount, setCoachCount] = useState(2);
  const [bowlingMachineAvailable, setBowlingMachineAvailable] = useState(false);

  // Standard Multi-Select Focus Picker State
  const [selectedFocusIds, setSelectedFocusIds] = useState(['Batting', 'Ground Fielding']);
  const [focusToAdd, setFocusToAdd] = useState('');

  // Separate Focus Pickers for Nets Session
  const [batterFocuses, setBatterFocuses] = useState(['Batting']);
  const [bowlerFocuses, setBowlerFocuses] = useState(['Pace Bowling']);
  const [fieldingFocuses, setFieldingFocuses] = useState(['Ground Fielding']);
  const [requestedBattingMins, setRequestedBattingMins] = useState('');

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

  // Handle Venue Dropdown Selection (Auto-populates feature defaults)
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

  // Add/Remove Focus Handlers
  const handleAddStandardFocus = (focusName) => {
    if (focusName && !selectedFocusIds.includes(focusName)) {
      setSelectedFocusIds(prev => [...prev, focusName]);
    }
    setFocusToAdd('');
    clearDiagnostics();
  };

  const handleRemoveStandardFocus = (focusName) => {
    setSelectedFocusIds(prev => prev.filter(f => f !== focusName));
    clearDiagnostics();
  };

  const availableUnselectedFocuses = ACTIVITY_CATEGORIES.filter(cat => !selectedFocusIds.includes(cat));

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
      selectedFocusIds,
      numberOfNets,
      coachCount,
      bowlingMachineAvailable,
      openFieldAvailable,
      facilityFeatures,
      batterFocuses,
      bowlerFocuses,
      fieldingFocuses,
      squad,
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
    } else if (suggestion.type === 'REMOVE_FOCUS' && suggestion.targetFocus) {
      setSelectedFocusIds(prev => prev.filter(f => f !== suggestion.targetFocus));
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
              Step 2: Session Parameters & Available Facilities
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Select session type, facility capabilities, net availability, and tactical focus priorities.
            </p>
          </div>

          {/* Session Type Selector */}
          <div className="form-group" style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
            <label style={{ color: 'var(--color-training)', marginBottom: '8px' }}>Session Template Architecture</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input 
                  type="radio" 
                  name="sessionType" 
                  value="STANDARD_SESSION" 
                  checked={sessionType === 'STANDARD_SESSION'} 
                  onChange={() => { setSessionType('STANDARD_SESSION'); clearDiagnostics(); }} 
                />
                <span>Standard Team Training (Flexible Phases)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input 
                  type="radio" 
                  name="sessionType" 
                  value="NETS_SESSION" 
                  checked={sessionType === 'NETS_SESSION'} 
                  onChange={() => { setSessionType('NETS_SESSION'); clearDiagnostics(); }} 
                />
                <span>🏏 Cricket Nets Rotation Session</span>
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

          {/* COMBINED FACILITY & VENUE CONFIGURATION */}
          <div className="form-group" style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
            <label htmlFor="param-venue" style={{ color: 'var(--color-training)' }}>Training Facility Base Location</label>
            <select id="param-venue" value={selectedVenue} onChange={(e) => handleVenueChange(e.target.value)}>
              {VENUE_MODELS.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>

            <div style={{ marginTop: '14px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>Available Facility Features Today:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px', fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasNetLanes} onChange={(e) => { setHasNetLanes(e.target.checked); clearDiagnostics(); }} />
                  <span>☑ Net Lanes Enclosure</span>
                </label>

                {hasNetLanes && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label htmlFor="param-nets-count" style={{ fontSize: '0.8rem' }}>Lanes:</label>
                    <input id="param-nets-count" type="number" min="1" max="4" value={numberOfNets} onChange={(e) => { setNumberOfNets(Number(e.target.value)); clearDiagnostics(); }} style={{ width: '60px', padding: '4px 8px' }} />
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={openFieldAvailable} onChange={(e) => { setOpenFieldAvailable(e.target.checked); clearDiagnostics(); }} />
                  <span>☑ Full / Open Field Space</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasCentreWicket} onChange={(e) => { setHasCentreWicket(e.target.checked); clearDiagnostics(); }} />
                  <span>☐ Centre Wicket Pitch</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasIndoorArea} onChange={(e) => { setHasIndoorArea(e.target.checked); clearDiagnostics(); }} />
                  <span>☐ Indoor Fielding Area</span>
                </label>
              </div>
            </div>
          </div>

          {/* NETS SESSION PARAMETERS */}
          {sessionType === 'NETS_SESSION' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label htmlFor="param-coaches">Available Coaches</label>
                  <input id="param-coaches" type="number" min="1" max="5" value={coachCount} onChange={(e) => { setCoachCount(Number(e.target.value)); clearDiagnostics(); }} />
                </div>

                <div className="form-group">
                  <label htmlFor="param-duration-nets">Total Session Duration (Mins)</label>
                  <input id="param-duration-nets" type="number" min="30" max="120" value={duration} onChange={(e) => { setDuration(Number(e.target.value)); clearDiagnostics(); }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
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
            /* STANDARD SESSION PARAMETERS */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                  <label htmlFor="param-duration-std">Session Duration (Mins)</label>
                  <input id="param-duration-std" type="number" min="30" max="120" value={duration} onChange={(e) => { setDuration(Number(e.target.value)); clearDiagnostics(); }} />
                </div>
              </div>

              {/* Standard Session Multi-Select Focus Picker */}
              <div className="form-group" style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
                <label style={{ color: 'var(--color-training)', marginBottom: '8px' }}>
                  Tactical / Technical Focus Priorities ({selectedFocusIds.length} Selected)
                </label>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {selectedFocusIds.map(fId => (
                    <span 
                      key={fId}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        backgroundColor: 'var(--color-training-glow)',
                        border: '1px solid var(--color-training)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                      }}
                    >
                      🎯 {fId}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveStandardFocus(fId)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', padding: '0 2px' }}
                        aria-label={`Remove ${fId}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select 
                    id="param-add-focus"
                    value={focusToAdd}
                    onChange={(e) => {
                      setFocusToAdd(e.target.value);
                      if (e.target.value) handleAddStandardFocus(e.target.value);
                    }}
                    style={{ flex: 1, fontSize: '0.85rem' }}
                  >
                    <option value="">+ Add Training Focus Priority...</option>
                    {availableUnselectedFocuses.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
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

      {/* Step 3: Review & Replace Drills View */}
      {step === 'review' && activePlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
                {activePlan.templateName} ({activePlan.totalElapsedTime} Mins)
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Deterministic plan validated for {presentPlayerIds.length} players across active facility features.
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

          {/* Render Plan Structure (Phases / Net Rotations) */}
          {activePlan.sessionType === 'NETS_SESSION' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--color-training)', borderRadius: '10px', fontSize: '0.85rem' }}>
                <strong>Single-Turn Batting Allocation Summary ({activePlan.battingSummary.length} Batters):</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginTop: '8px' }}>
                  {activePlan.battingSummary.map((b, idx) => (
                    <div key={idx} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', fontSize: '0.8rem' }}>
                      👤 <strong>{b.name}</strong>: {b.allocatedMinutes}m in {b.netName} (Rot {b.rotationNumber})
                    </div>
                  ))}
                </div>
              </div>

              {activePlan.rotations.map((rot, rIdx) => (
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
                            {st.secondaryActivity && (
                              <div style={{ marginTop: '4px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                📌 Secondary Activity: {st.secondaryActivity.title}
                              </div>
                            )}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {activePlan.blocks.map((block, bIdx) => (
                <div key={bIdx} style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 className="scoreboard-font" style={{ margin: 0, color: 'var(--color-training)' }}>
                      {block.phaseName} ({block.phaseDuration} Mins)
                    </h3>
                    <span className="badge">{block.type}</span>
                  </div>

                  {block.type === 'CONCURRENT_STATIONS' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                      {block.stations.map((st, sIdx) => (
                        <div key={sIdx} style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            Station {st.stationNumber}: {st.title}
                          </h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                            Category: {st.activityCategory} | Focus: 🎯 {st.contributingFocus}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    block.activities?.map((act, aIdx) => (
                      <div key={aIdx} style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {act.title}
                        </h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                          Category: {act.activityCategory} | Focus: 🎯 {act.contributingFocus}
                        </p>
                      </div>
                    ))
                  )}
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
                Real-time phase tracking and late arrival management.
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
