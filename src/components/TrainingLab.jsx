import React, { useState, useEffect } from 'react';
import { COHORTS } from '../config/cohorts';
import { COACH_LEVELS } from '../config/coachLevels';
import { VENUE_MODELS } from '../config/venues';
import { ACTIVITY_CATEGORIES } from '../config/activityCategories';
import { generateTrainingPlan, calculateBattingCapacity } from '../engine/deterministicPlanner';
import { searchActivities } from '../data/retrievalIndex';
import ContextualTaggingModal from './ContextualTaggingModal';

export default function TrainingLab({
  squad = [],
  subscriptionTier,
  apiKey,
  selectedCoachLevel,
  activeRuleset,
  onSaveVideoClip
}) {
  // Preserved User Flow State:
  // 'attendance' | 'parameters' | 'review' | 'active_guided' | 'history'
  const [step, setStep] = useState('attendance');
  const [presentPlayerIds, setPresentPlayerIds] = useState([]);

  // Session Type State ('STANDARD_SESSION' | 'NETS_SESSION')
  const [sessionType, setSessionType] = useState('STANDARD_SESSION');

  // Parameters State
  const [selectedCohort, setSelectedCohort] = useState('U13_JUNIOR');
  const [selectedVenue, setSelectedVenue] = useState('NET_LANES_TURF');
  const [duration, setDuration] = useState(90);
  
  // Standard Multi-Select Focus Picker State
  const [selectedFocusIds, setSelectedFocusIds] = useState(['Batting', 'Ground Fielding']);

  // Nets Session Specific Parameters
  const [numberOfNets, setNumberOfNets] = useState(2);
  const [coachCount, setCoachCount] = useState(2);
  const [bowlingMachineAvailable, setBowlingMachineAvailable] = useState(false);
  const [openFieldAvailable, setOpenFieldAvailable] = useState(true);

  // Separate Focus Pickers for Nets Session
  const [batterFocuses, setBatterFocuses] = useState(['Batting']);
  const [bowlerFocuses, setBowlerFocuses] = useState(['Pace Bowling']);
  const [fieldingFocuses, setFieldingFocuses] = useState(['Ground Fielding']);
  const [requestedBattingMins, setRequestedBattingMins] = useState('');

  // Generated Plan & Diagnostics State
  const [activePlan, setActivePlan] = useState(null);
  const [generatedDrills, setGeneratedDrills] = useState([]);
  const [failureDiagnostics, setFailureDiagnostics] = useState(null);

  // Active Guided Coaching State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [currentRotationIndex, setCurrentRotationIndex] = useState(0);

  const [sessionHistory, setSessionHistory] = useState([]);

  // Initialize attendance checklist
  useEffect(() => {
    if (squad.length > 0 && presentPlayerIds.length === 0) {
      setPresentPlayerIds(squad.map(p => p.id));
    }
  }, [squad]);

  const togglePlayerAttendance = (id) => {
    setPresentPlayerIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  // Live Batting Time Capacity Calculator
  const netCapacity = calculateBattingCapacity({
    numberOfNets,
    totalDuration: duration,
    participantCount: presentPlayerIds.length || 10
  });

  // Step 3: Run Authoritative Planner Engine (Standard or Nets)
  const handleGeneratePlan = () => {
    setFailureDiagnostics(null);

    const result = generateTrainingPlan({
      sessionType,
      requestedDuration: duration,
      cohortId: selectedCohort,
      selectedFocusIds,
      numberOfNets,
      coachCount,
      bowlingMachineAvailable,
      openFieldAvailable,
      batterFocuses,
      bowlerFocuses,
      fieldingFocuses,
      requestedBattingMinutesPerPlayer: requestedBattingMins ? Number(requestedBattingMins) : null,
      coachLevelId: selectedCoachLevel,
      venueId: selectedVenue,
      participantCount: presentPlayerIds.length,
      activeRuleset
    });

    if (!result.success) {
      setFailureDiagnostics(result);
      return; // Stay on Parameters screen
    }

    setActivePlan(result.plan);
    setGeneratedDrills(result.plan.activities || []);
    setCurrentRotationIndex(0);
    setStep('review');
  };

  // Actionable Suggestion Click Handler
  const handleApplySuggestion = (suggestion) => {
    if (suggestion.type === 'CHANGE_VENUE' && suggestion.targetVenue) {
      setSelectedVenue(suggestion.targetVenue);
    } else if (suggestion.type === 'CHANGE_BATTING_MINS' && suggestion.targetMins) {
      setRequestedBattingMins(suggestion.targetMins.toString());
    } else if (suggestion.type === 'ADD_NET') {
      setNumberOfNets(prev => Math.min(4, prev + 1));
    } else if (suggestion.type === 'CHANGE_DURATION' && suggestion.targetDuration) {
      setDuration(suggestion.targetDuration);
    } else if (suggestion.type === 'REMOVE_FOCUS' && suggestion.targetFocus) {
      setSelectedFocusIds(prev => prev.filter(f => f !== suggestion.targetFocus));
    }
    setFailureDiagnostics(null);
  };

  // Save Session to History
  const handleEndAndSaveSession = () => {
    const newHistoryEntry = {
      id: 'sess_' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      sessionType,
      cohortId: selectedCohort,
      duration: activePlan?.totalElapsedTime || duration,
      presentCount: presentPlayerIds.length
    };
    setSessionHistory(prev => [newHistoryEntry, ...prev]);
    setIsTimerRunning(false);
    setTimerSeconds(0);
    setStep('attendance');
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
                <div 
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
                    justifyContent: 'space-between'
                  }}
                >
                  <span>#{player.jersey} {player.name}</span>
                  <span style={{ fontSize: '1.1rem' }}>{isPresent ? '✓' : '✗'}</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button className="btn btn-training" onClick={() => setStep('parameters')}>
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
              Select session type, venue, net availability, and tactical focus parameters.
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
                  onChange={() => setSessionType('STANDARD_SESSION')} 
                />
                <span>Standard Team Training</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input 
                  type="radio" 
                  name="sessionType" 
                  value="NETS_SESSION" 
                  checked={sessionType === 'NETS_SESSION'} 
                  onChange={() => setSessionType('NETS_SESSION')} 
                />
                <span>🏏 Cricket Nets Session</span>
              </label>
            </div>
          </div>

          {/* Structured Failure Diagnostics Display */}
          {failureDiagnostics && (
            <div style={{ padding: '20px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                <span style={{ fontSize: '1.3rem' }}>⚠️</span>
                <h3 className="scoreboard-font" style={{ margin: 0, fontSize: '1.2rem', color: '#ef4444' }}>
                  GENERATION FAILED
                </h3>
              </div>

              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Why:</strong>
                <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', fontSize: '0.85rem', color: '#ef4444', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {failureDiagnostics.primaryReasons?.map((reason, idx) => (
                    <li key={idx}>• {reason}</li>
                  ))}
                </ul>
              </div>

              {failureDiagnostics.suggestedChanges && failureDiagnostics.suggestedChanges.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(239,68,68,0.2)', paddingTop: '10px' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Try:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                    {failureDiagnostics.suggestedChanges.map((sug, idx) => (
                      <button 
                        key={idx}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Available Net Lanes</label>
                  <input type="number" min="1" max="4" value={numberOfNets} onChange={(e) => setNumberOfNets(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label>Available Coaches</label>
                  <input type="number" min="1" max="5" value={coachCount} onChange={(e) => setCoachCount(Number(e.target.value))} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={openFieldAvailable} onChange={(e) => setOpenFieldAvailable(e.target.checked)} />
                  <span>Open Field Space Available</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={bowlingMachineAvailable} onChange={(e) => setBowlingMachineAvailable(e.target.checked)} />
                  <span>Bowling Machine Available</span>
                </label>
              </div>

              {/* Dynamic Batting Time Capacity Recommendation Calculator */}
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
                  <label style={{ fontSize: '0.8rem' }}>Override Batting Allocation (Minutes per Batter)</label>
                  <input 
                    type="number" 
                    placeholder={`e.g. ${netCapacity.suggestedBattingMinutes}`} 
                    value={requestedBattingMins} 
                    onChange={(e) => setRequestedBattingMins(e.target.value)} 
                  />
                </div>
              </div>

              {/* SEPARATE BATTER, BOWLER & FIELDING FOCUS SELECTORS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label style={{ color: 'var(--color-match)' }}>🎯 Batter Focus</label>
                  <select value={batterFocuses[0]} onChange={(e) => setBatterFocuses([e.target.value])}>
                    <option value="Front Foot Drive">Front Foot Drive & V-Channel</option>
                    <option value="Short-Pitched Pull">Short Ball Pull & Hook</option>
                    <option value="Spin Footwork Sweep">Spin Footwork & Sweep</option>
                    <option value="Death Overs Power Hitting">Death Overs Power Hitting</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ color: 'var(--color-tactics)' }}>🎯 Bowler Focus</label>
                  <select value={bowlerFocuses[0]} onChange={(e) => setBowlerFocuses([e.target.value])}>
                    <option value="Pace Seam Control">Pace Seam Control & Top-of-Off Target</option>
                    <option value="Spin Dip & Drift">Spin Dip, Drift & Revolutions</option>
                    <option value="Death Yorker Execution">Death Yorker & Change-of-Pace Execution</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ color: 'var(--color-training)' }}>🎯 Off-Net Fielding Focus</label>
                  <select value={fieldingFocuses[0]} onChange={(e) => setFieldingFocuses([e.target.value])}>
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
              <div className="form-group">
                <label>Participant Cohort</label>
                <select value={selectedCohort} onChange={(e) => setSelectedCohort(e.target.value)}>
                  {Object.values(COHORTS).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Venue / Net Lanes Availability</label>
                <select value={selectedVenue} onChange={(e) => setSelectedVenue(e.target.value)}>
                  {VENUE_MODELS.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Total Session Duration ({duration} Minutes)</label>
            <input type="range" min="30" max="120" step="15" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
            <button className="btn btn-secondary" onClick={() => setStep('attendance')}>← Back</button>
            <button className="btn btn-training" onClick={handleGeneratePlan}>
              ⚡ Run Deterministic Planner Engine
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review Training Plan Screen */}
      {step === 'review' && activePlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activePlan.sessionType === 'NETS_SESSION' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--color-training)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span className="badge badge-ruleset" style={{ fontSize: '0.75rem', alignSelf: 'flex-start' }}>
                  CRICKET NETS SESSION — SINGLE BATTING TURN ARCHITECTURE
                </span>
                <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
                  Nets Rotation Overview
                </h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', fontSize: '0.85rem' }}>
                  <div>Total Players: <strong>{activePlan.participantCount}</strong></div>
                  <div>Net Lanes: <strong>{activePlan.numberOfNets} Nets</strong></div>
                  <div>Batting Allocation: <strong>{activePlan.effectiveBattingMinutes} mins/batter</strong></div>
                  <div>Rotation Groups: <strong>{activePlan.rotationCount} Groups</strong></div>
                </div>
              </div>

              {/* BATTING ALLOCATION SUMMARY TABLE */}
              <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 className="scoreboard-font" style={{ color: 'var(--color-match)', margin: 0, fontSize: '1.1rem' }}>
                  Batting Allocation Summary ({activePlan.battingSummary?.length} Batters — 1 Turn Each)
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', fontSize: '0.85rem' }}>
                  {activePlan.battingSummary?.map((bs, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-floor)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <strong>{bs.playerId}</strong> — {bs.allocatedMinutes} min — {bs.netName} — Rotation {bs.rotationNumber}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rotations Breakdown */}
              {activePlan.rotations.map((rot) => (
                <div key={rot.rotationNumber} style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h3 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0, fontSize: '1.1rem' }}>
                    ROTATION {rot.rotationNumber} — {rot.duration} MINUTES
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                    {rot.stations.map((st) => (
                      <div key={st.stationId} style={{ backgroundColor: 'var(--bg-floor)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '700', color: 'var(--color-training)', fontSize: '0.9rem' }}>{st.name}</span>
                          <span className="badge" style={{ background: 'rgba(58, 134, 255, 0.15)', color: 'var(--color-squad)' }}>{st.assignedGroup}</span>
                        </div>

                        {st.type === 'NET_LANE' ? (
                          <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div>🎯 <strong>Batter Focus:</strong> {st.batterFocus}</div>
                            <div>🏏 <strong>Batting Order (Single Turn):</strong> {st.batters.length > 0 ? st.batters.join(', ') : 'None (Group completed batting turn)'}</div>
                            <div>🎯 <strong>Bowler Focus:</strong> {st.bowlerFocus}</div>
                            <div>⚡ <strong>Bowlers / Target Work:</strong> {st.bowlers.join(', ')}</div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div>🎯 <strong>Fielding Focus:</strong> {st.fieldingFocus}</div>
                            <div>🏃 <strong>Fielders:</strong> {st.players.join(', ')}</div>
                            <div>📋 <strong>Drill:</strong> {st.activity?.title}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* STANDARD SESSION REVIEW VIEW */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
                Review Training Plan ({generatedDrills.length} Drills)
              </h2>

              {generatedDrills.map((drill, idx) => (
                <div key={`${drill.id}_${idx}`} style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>#{drill.id} - {drill.title}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{drill.setup}</p>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
            <button className="btn btn-secondary" onClick={() => setStep('parameters')}>← Adjust Parameters</button>
            <button className="btn btn-training" onClick={() => setStep('active_guided')}>
              ▶ Start Session (Guided Live Mode)
            </button>
          </div>
        </div>
      )}

      {/* Step 7: Guided Active Coaching Mode */}
      {step === 'active_guided' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', textAlign: 'center' }}>
          <div className="badge badge-ruleset" style={{ fontSize: '0.8rem' }}>GUIDED ACTIVE COACHING MODE</div>
          
          <div className="scoreboard-font" style={{ fontSize: '3.5rem', color: 'var(--color-training)' }}>
            {Math.floor(timerSeconds / 60).toString().padStart(2, '0')}:{(timerSeconds % 60).toString().padStart(2, '0')}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-training" onClick={() => setIsTimerRunning(!isTimerRunning)}>
              {isTimerRunning ? '⏸ Pause Timer' : '▶ Start Timer'}
            </button>
            {activePlan?.sessionType === 'NETS_SESSION' && (
              <button 
                className="btn btn-secondary" 
                onClick={() => setCurrentRotationIndex((prev) => (prev + 1) % activePlan.rotations.length)}
              >
                🔄 Next Rotation ({currentRotationIndex + 1}/{activePlan.rotations.length})
              </button>
            )}
          </div>

          {/* NETS ROTATION GUIDED STATUS CARD */}
          {activePlan?.sessionType === 'NETS_SESSION' ? (
            <div style={{ width: '100%', maxWidth: '560px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--color-training)', borderRadius: '14px', padding: '20px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: '700', color: 'var(--color-training)' }}>
                  ROTATION {currentRotationIndex + 1} OF {activePlan.rotations.length}
                </span>
                <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-match)' }}>
                  Single Turn Queue Active
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                {activePlan.rotations[currentRotationIndex]?.stations.map(st => (
                  <div key={st.stationId} style={{ background: 'var(--bg-floor)', padding: '10px', borderRadius: '8px' }}>
                    <strong>{st.name} ({st.assignedGroup}):</strong> {st.type === 'NET_LANE' ? `Batters (Single Turn): ${st.batters.join(', ') || 'Queue Completed'} | Bowlers: ${st.bowlers.join(', ')}` : `Fielding: ${st.players.join(', ')}`}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px', padding: '20px', textAlign: 'left' }}>
              <h4 style={{ margin: 0, color: 'var(--color-training)' }}>Active Drill: {generatedDrills[0]?.title}</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                {generatedDrills[0]?.setup}
              </p>
            </div>
          )}

          <button className="btn btn-secondary" onClick={handleEndAndSaveSession} style={{ marginTop: '20px' }}>
            End & Save Session Log
          </button>
        </div>
      )}
    </div>
  );
}
