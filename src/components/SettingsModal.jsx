import React, { useState } from 'react';
import { COACH_LEVELS } from '../config/coachLevels';
import { processUploadedRuleDocument } from '../services/competitionRulesEngine';

export default function SettingsModal({
  isOpen,
  onClose,
  subscriptionTier,
  setSubscriptionTier,
  selectedCoachLevel,
  setSelectedCoachLevel,
  syncQueue,
  clearSyncQueue,
  onResetData,
  activeRuleset,
  onRulesetCreated,
  onOpenRulesReview
}) {
  if (!isOpen) return null;

  const [isProcessingDoc, setIsProcessingDoc] = useState(false);

  const handleDocumentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessingDoc(true);
    try {
      const text = await file.text();
      const newRuleset = await processUploadedRuleDocument(file, text);
      onRulesetCreated(newRuleset);
      setIsProcessingDoc(false);
      onOpenRulesReview();
    } catch (err) {
      alert("Error parsing rule document: " + err.message);
      setIsProcessingDoc(false);
    }
  };

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="scoreboard-font" style={{ color: 'var(--text-primary)', margin: 0 }}>
            Workstation Settings & Controls
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close Settings">✕</button>
        </div>

        <div className="modal-body">
          {/* Workstation Profile Tier */}
          <div className="form-group" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
            <label htmlFor="settings-tier">Application Capability Tier</label>
            <select 
              id="settings-tier"
              value={subscriptionTier} 
              onChange={(e) => setSubscriptionTier(e.target.value)}
              style={{ fontWeight: '600', color: 'var(--color-match)' }}
            >
              <option value="Workstation Pro">Workstation Pro (Local Deterministic Engine + Video Analyser)</option>
              <option value="Club Enterprise">Club Enterprise (Multi-Squad Operations)</option>
            </select>
          </div>

          {/* Coach Accreditation Level */}
          <div className="form-group" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
            <label htmlFor="settings-accreditation">Cricket Coach Accreditation Level</label>
            <select 
              id="settings-accreditation"
              value={selectedCoachLevel} 
              onChange={(e) => setSelectedCoachLevel(e.target.value)}
            >
              {Object.values(COACH_LEVELS).map(lvl => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name} (Max Concurrent Stations: {lvl.maxConcurrentStations})
                </option>
              ))}
            </select>
          </div>

          {/* Local Competition Rules Uploader */}
          <div className="form-group" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
            <label htmlFor="settings-rule-doc">Local Competition By-Laws & Playing Conditions</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
              <input 
                id="settings-rule-doc"
                type="file" 
                accept=".txt,.json" 
                onChange={handleDocumentUpload} 
                disabled={isProcessingDoc}
                style={{ fontSize: '0.8rem' }}
              />
              {activeRuleset && (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={onOpenRulesReview} 
                  style={{ padding: '6px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                >
                  Review Active Rules ({activeRuleset.season})
                </button>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Upload local by-laws text or JSON ruleset specification to create a local ruleset overlay.
            </p>
          </div>

          {/* Local Transaction Log */}
          <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label>Local Workstation Audit Log ({syncQueue.length} entries)</label>
              {syncQueue.length > 0 && (
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  onClick={clearSyncQueue} 
                  style={{ padding: '2px 8px', fontSize: '0.7rem', color: '#ef4444' }}
                >
                  Clear Log
                </button>
              )}
            </div>
            <div style={{ backgroundColor: 'var(--bg-floor)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '12px', height: '90px', overflowY: 'auto', fontSize: '0.75rem' }}>
              {syncQueue.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No local transactions logged.</p>
              ) : (
                syncQueue.map(tx => (
                  <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '4px 0' }}>
                    <span>{tx.actionType}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{tx.timestamp.split('T')[1].slice(0, 8)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Danger Zone: Data Reset & Account Deletion */}
          <div style={{ paddingTop: '8px' }}>
            <label style={{ color: '#ef4444', fontWeight: '700' }}>Local Workstation Data Management</label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Permanently reset all local squad, training, rules, and video metadata stored on this workstation.
            </p>
            <button 
              type="button"
              className="btn btn-secondary" 
              onClick={onResetData}
              style={{ color: '#ef4444', border: '1px solid #ef4444', marginTop: '8px', fontSize: '0.8rem' }}
            >
              ⚠️ Reset Local Application Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
