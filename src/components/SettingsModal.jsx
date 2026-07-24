import React, { useState } from 'react';
import { COACH_LEVELS } from '../config/coachLevels';
import { processUploadedRuleDocument } from '../services/competitionRulesEngine';

export default function SettingsModal({
  isOpen,
  onClose,
  apiKey,
  setApiKey,
  subscriptionTier,
  setSubscriptionTier,
  selectedCoachLevel,
  setSelectedCoachLevel,
  syncQueue,
  clearSyncQueue,
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
      // Read file text
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
            Command Center Settings
          </h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Subscription Gating Selector */}
          <div className="form-group" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
            <label>Subscription Tier (Capability Simulator)</label>
            <select 
              value={subscriptionTier} 
              onChange={(e) => setSubscriptionTier(e.target.value)}
              style={{ fontWeight: '600', color: 'var(--color-match)' }}
            >
              <option value="Free">Free Tier (Roster & 2 AI Enhancements)</option>
              <option value="Pro">Pro Tier (Unlimited AI Text + RAG Uploads)</option>
              <option value="Ultra">Ultra Tier (Tactics Board + Local Rules Engine + Video Telestrator)</option>
              <option value="Club">B2B Club Tier (Organizational Roster Sync)</option>
            </select>
          </div>

          {/* Coach Accreditation Level Calibration */}
          <div className="form-group" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
            <label>Cricket Coach Accreditation Level</label>
            <select 
              value={selectedCoachLevel} 
              onChange={(e) => setSelectedCoachLevel(e.target.value)}
            >
              {Object.values(COACH_LEVELS).map(lvl => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name} (Max Stations: {lvl.maxConcurrentStations})
                </option>
              ))}
            </select>
          </div>

          {/* Local Competition Rules Uploader */}
          <div className="form-group" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
            <label>Local Competition By-Laws & Playing Conditions</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
              <input 
                type="file" 
                accept=".pdf,.docx,.txt" 
                onChange={handleDocumentUpload} 
                disabled={isProcessingDoc}
                style={{ fontSize: '0.8rem' }}
              />
              {activeRuleset && (
                <button className="btn btn-secondary" onClick={onOpenRulesReview} style={{ padding: '6px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  Review Active Rules ({activeRuleset.season})
                </button>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Upload local association by-laws (PDF/DOCX/TXT) to create a versioned local ruleset overlay.
            </p>
          </div>

          {/* Gemini API Key (Dev Only) */}
          <div className="form-group" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
            <label>Google AI Studio API Key (Development Only)</label>
            <input 
              type="password" 
              placeholder="AI25_..." 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)} 
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Dev/Test only. Inside Edge runs 100% offline using local deterministic planning logic.
            </p>
          </div>

          {/* Offline Sync Log */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label>Offline Sync Transaction Log ({syncQueue.length})</label>
              {syncQueue.length > 0 && (
                <button className="btn btn-secondary" onClick={clearSyncQueue} style={{ padding: '2px 8px', fontSize: '0.7rem', color: '#ef4444' }}>
                  Clear Queue
                </button>
              )}
            </div>
            <div style={{ backgroundColor: 'var(--bg-floor)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '12px', height: '100px', overflowY: 'auto', fontSize: '0.75rem' }}>
              {syncQueue.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No pending offline transactions.</p>
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

        </div>
      </div>
    </div>
  );
}
