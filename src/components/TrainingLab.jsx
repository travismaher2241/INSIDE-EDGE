import React, { useState, useEffect } from 'react';
import { COHORTS } from '../config/cohorts';
import { COACH_LEVELS } from '../config/coachLevels';
import { VENUE_MODELS } from '../config/venues';
import { ACTIVITY_CATEGORIES } from '../config/activityCategories';
import { generateTrainingPlan } from '../engine/deterministicPlanner';
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

  // Parameters State
  const [selectedCohort, setSelectedCohort] = useState('U13_JUNIOR');
  const [selectedVenue, setSelectedVenue] = useState('NET_LANES_TURF');
  const [duration, setDuration] = useState(90);
  
  // Multi-Select Focus Picker State (selectedFocusIds: string[])
  const [selectedFocusIds, setSelectedFocusIds] = useState(['Batting', 'Ground Fielding']);
  const [focusToAdd, setFocusToAdd] = useState('');

  // Generated Plan & Validation Error State
  const [activePlan, setActivePlan] = useState(null);
  const [generatedDrills, setGeneratedDrills] = useState([]);
  const [generationError, setGenerationError] = useState(null);
  const [isAiEnhanced, setIsAiEnhanced] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);

  // Active Guided Timer State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Late Arrival Modal
  const [isLateModalOpen, setIsLateModalOpen] = useState(false);
  const [lateName, setLateName] = useState('');

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

  // Multi-Select Focus Handlers
  const handleAddFocus = (focusName) => {
    if (!focusName || selectedFocusIds.includes(focusName)) return;
    setSelectedFocusIds(prev => [...prev, focusName]);
    setFocusToAdd('');
  };

  const handleRemoveFocus = (focusName) => {
    if (selectedFocusIds.length <= 1) {
      alert("At least one training focus must remain selected.");
      return;
    }
    setSelectedFocusIds(prev => prev.filter(f => f !== focusName));
  };

  const availableUnselectedFocuses = ACTIVITY_CATEGORIES.filter(cat => !selectedFocusIds.includes(cat));

  // Step 3: Run Authoritative Deterministic Planner Engine
  const handleGeneratePlan = () => {
    setGenerationError(null);

    const result = generateTrainingPlan({
      requestedDuration: duration,
      cohortId: selectedCohort,
      selectedFocusIds,
      coachLevelId: selectedCoachLevel,
      venueId: selectedVenue,
      participantCount: presentPlayerIds.length
    });

    if (!result.success) {
      setGenerationError(result.errorReason);
      return;
    }

    setActivePlan(result.plan);
    setGeneratedDrills(result.plan.activities);
    setStep('review');
  };

  // Step 5: Replace Drill preserving multi-focus intent and template structure
  const handleReplaceDrill = (drillId) => {
    const candidates = searchActivities({
      cohortId: selectedCohort,
      selectedFocusIds,
      maxParticipants: presentPlayerIds.length
    });
    const replacement = candidates.find(c => c.id !== drillId && !generatedDrills.some(d => d.id === c.id)) || candidates[0];
    setGeneratedDrills(prev => prev.map(d => d.id === drillId ? { ...replacement, phaseName: d.phaseName, assignedDuration: d.assignedDuration, contributingFocus: d.contributingFocus } : d));
  };

  // Save Session to History
  const handleEndAndSaveSession = () => {
    const newHistoryEntry = {
      id: 'sess_' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      cohortId: selectedCohort,
      selectedFocusIds: [...selectedFocusIds],
      duration: activePlan?.totalElapsedTime || duration,
      drillCount: generatedDrills.length,
      presentCount: presentPlayerIds.length
    };
    setSessionHistory(prev => [newHistoryEntry, ...prev]);
    setIsTimerRunning(false);
    setTimerSeconds(0);
    setStep('attendance');
  };

  // Late Arrival Hot-Injection
  const handleAddLatePlayer = (e) => {
    e.preventDefault();
    if (!lateName.trim()) return;
    setPresentPlayerIds(prev => [...prev, 'p_late_' + Date.now()]);
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
              Configure cohort, venue, duration, and target multi-select training focus priorities.
            </p>
          </div>

          {/* Validation Failure Error Banner */}
          {generationError && (
            <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '12px', color: '#ef4444', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⚠️</span> Generation Failure
              </div>
              {generationError}
            </div>
          )}

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

          <div className="form-group">
            <label>Total Session Duration ({duration} Minutes)</label>
            <input type="range" min="30" max="120" step="15" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>

          {/* Multi-Select Focus Picker */}
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
                    onClick={() => handleRemoveFocus(fId)}
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
                value={focusToAdd}
                onChange={(e) => {
                  setFocusToAdd(e.target.value);
                  if (e.target.value) handleAddFocus(e.target.value);
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

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
            <button className="btn btn-secondary" onClick={() => setStep('attendance')}>← Back</button>
            <button className="btn btn-training" onClick={handleGeneratePlan}>
              ⚡ Run Deterministic Planner Engine
            </button>
          </div>
        </div>
      )}

      {/* Step 4 & 5: Review Activities & Replacements */}
      {step === 'review' && activePlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div className="badge badge-ruleset" style={{ fontSize: '0.7rem', marginBottom: '4px' }}>
                TEMPLATE: {activePlan.templateName} ({activePlan.totalElapsedTime}m Elapsed)
              </div>
              <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
                Step 4: Review Training Plan ({generatedDrills.length} Drills)
              </h2>
            </div>
            <button className="btn btn-secondary" onClick={() => setIsAiEnhanced(!isAiEnhanced)} style={{ fontSize: '0.75rem' }}>
              {isAiEnhanced ? '✨ Text AI Enhanced' : '✨ Enhance Text Wording'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {generatedDrills.map((drill, idx) => (
              <div key={`${drill.id}_${idx}`} style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="badge" style={{ background: 'var(--color-training-glow)', color: 'var(--color-training)' }}>
                      Block {idx + 1}: {drill.phaseName || drill.permittedSessionSlots?.[0]} ({drill.assignedDuration || 15}m)
                    </span>
                    <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-match)' }}>
                      Contributes to: {drill.contributingFocus}
                    </span>
                  </div>
                  <button className="btn btn-secondary" onClick={() => handleReplaceDrill(drill.id)} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                    🔄 Replace Activity
                  </button>
                </div>

                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>#{drill.id} - {drill.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{drill.setup}</p>

                <div style={{ fontSize: '0.8rem', background: 'var(--bg-floor)', padding: '10px', borderRadius: '6px' }}>
                  <strong>Coaching Cues:</strong>
                  <ul style={{ paddingLeft: '18px', marginTop: '4px' }}>
                    {drill.coachingPointsCues?.map((cue, cIdx) => <li key={cIdx}>{cue}</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>

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
            <button className="btn btn-secondary" onClick={() => setIsLateModalOpen(true)}>
              ➕ Hot-Inject Late Player
            </button>
          </div>

          <div style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px', padding: '20px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, color: 'var(--color-training)' }}>Active Drill: {generatedDrills[0]?.title}</h4>
              <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-match)' }}>
                {generatedDrills[0]?.contributingFocus}
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {generatedDrills[0]?.setup}
            </p>
          </div>

          <button className="btn btn-secondary" onClick={handleEndAndSaveSession} style={{ marginTop: '20px' }}>
            End & Save Session Log
          </button>
        </div>
      )}

      {/* Late Player Modal */}
      {isLateModalOpen && (
        <div className="overlay-backdrop" onClick={() => setIsLateModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>Hot-Inject Late Arrival Player</h3>
              <button className="icon-btn" onClick={() => setIsLateModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleAddLatePlayer} className="modal-body">
              <div className="form-group">
                <label>Player Name</label>
                <input type="text" value={lateName} onChange={(e) => setLateName(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-training">Inject Player into Active Groups</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
