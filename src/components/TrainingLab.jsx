import React, { useState, useEffect } from 'react';
import { COHORTS } from '../config/cohorts';
import { COACH_LEVELS } from '../config/coachLevels';
import { VENUE_MODELS } from '../config/venues';
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
  const [focus, setFocus] = useState('Batting');

  // Generated Plan State
  const [generatedDrills, setGeneratedDrills] = useState([]);
  const [isAiEnhanced, setIsAiEnhanced] = useState(false);

  // Active Guided Timer State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Late Arrival Modal
  const [isLateModalOpen, setIsLateModalOpen] = useState(false);
  const [lateName, setLateName] = useState('');

  // Video Tagging Modal
  const [taggingOpen, setTaggingOpen] = useState(false);
  const [taggingDrillName, setTaggingDrillName] = useState('');

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

  // Step 3: Local Deterministic Planner
  const handleGeneratePlan = () => {
    // Execute Local Deterministic Planner
    const candidates = searchActivities({
      cohortId: selectedCohort,
      focus,
      coachLevelId: selectedCoachLevel,
      maxParticipants: presentPlayerIds.length
    });

    const selected = candidates.length > 0 ? candidates : searchActivities({ focus: 'All Round' });
    setGeneratedDrills(selected);
    setStep('review');
  };

  // Step 5: Replace Drill
  const handleReplaceDrill = (drillId) => {
    const candidates = searchActivities({ focus: 'All Round' });
    const replacement = candidates.find(c => c.id !== drillId) || candidates[0];
    setGeneratedDrills(prev => prev.map(d => d.id === drillId ? replacement : d));
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
          <div>
            <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
              Step 2: Session Parameters
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Configure cohort, venue, net availability, and tactical focus.
            </p>
          </div>

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

          <div className="form-group">
            <label>Tactical / Technical Focus</label>
            <select value={focus} onChange={(e) => setFocus(e.target.value)}>
              <option value="Batting">Batting (V-Channel & Front Foot Drives)</option>
              <option value="Pace Bowling">Pace Bowling (Seam Control & Length Spot)</option>
              <option value="Spin Bowling">Spin Bowling (Drift & Revolutions)</option>
              <option value="Ground Fielding">Ground Fielding & Relays</option>
              <option value="Match Simulation">Match Simulation & Death Overs</option>
            </select>
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
      {step === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0 }}>
                Step 4: Review Training Plan ({generatedDrills.length} Drills)
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Deterministic plan calculated for {duration} mins.
              </p>
            </div>
            <button className="btn btn-secondary" onClick={() => setIsAiEnhanced(!isAiEnhanced)} style={{ fontSize: '0.75rem' }}>
              {isAiEnhanced ? '✨ Text AI Enhanced' : '✨ Enhance Text Wording'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {generatedDrills.map((drill, idx) => (
              <div key={drill.id} style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge" style={{ background: 'var(--color-training-glow)', color: 'var(--color-training)' }}>
                    Block {idx + 1}: {drill.permittedSessionSlots?.[0] || 'Activity'}
                  </span>
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
            <h4 style={{ margin: 0, color: 'var(--color-training)' }}>Active Drill: {generatedDrills[0]?.title}</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              {generatedDrills[0]?.setup}
            </p>
          </div>

          <button className="btn btn-secondary" onClick={() => setStep('attendance')} style={{ marginTop: '20px' }}>
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
