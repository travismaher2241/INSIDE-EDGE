import React, { useState } from 'react';
import { COHORTS } from '../config/cohorts';
import { COACH_LEVELS } from '../config/coachLevels';

export default function OnboardingScreen({ onCompleteOnboarding }) {
  const [coachName, setCoachName] = useState('');
  const [teamName, setTeamName] = useState('Westside Cricket Club XI');
  const [selectedCohort, setSelectedCohort] = useState('U13_JUNIOR');
  const [selectedCoachLevel, setSelectedCoachLevel] = useState('DEVELOPMENT_LEVEL_1');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!coachName.trim()) return;
    onCompleteOnboarding({
      coachName: coachName.trim(),
      teamName: teamName.trim(),
      selectedCohort,
      selectedCoachLevel
    });
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-floor)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: '16px',
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div>
          <div className="badge badge-ruleset" style={{ marginBottom: '8px', display: 'inline-block' }}>
            ONBOARDING & CALIBRATION WIZARD
          </div>
          <h2 className="scoreboard-font" style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.5rem' }}>
            Welcome to Inside Edge
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            Calibrate your coaching profile and squad environment.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label>Coach Name</label>
            <input 
              type="text" 
              placeholder="e.g. Coach David" 
              value={coachName} 
              onChange={(e) => setCoachName(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label>Team / Organization Name</label>
            <input 
              type="text" 
              placeholder="e.g. St. Jude Cricket Club U13" 
              value={teamName} 
              onChange={(e) => setTeamName(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label>Primary Participant Cohort</label>
            <select value={selectedCohort} onChange={(e) => setSelectedCohort(e.target.value)}>
              {Object.values(COHORTS).map(cohort => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.name} {cohort.isUnresolved ? '(Rules Pending Confirmation)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Cricket Coach Accreditation Level</label>
            <select value={selectedCoachLevel} onChange={(e) => setSelectedCoachLevel(e.target.value)}>
              {Object.values(COACH_LEVELS).map(lvl => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name} (Max Stations: {lvl.maxConcurrentStations})
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-training" style={{ padding: '12px', fontSize: '1rem', marginTop: '12px' }}>
            Complete Setup & Launch Command Center
          </button>
        </form>
      </div>
    </div>
  );
}
