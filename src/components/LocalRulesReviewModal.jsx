import React from 'react';
import { RULESET_STATUS } from '../models/CompetitionRuleset';

export default function LocalRulesReviewModal({
  isOpen,
  onClose,
  activeRuleset,
  onApproveRule,
  onRejectRule,
  onActivateRuleset
}) {
  if (!isOpen || !activeRuleset) return null;

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="badge badge-ruleset" style={{ fontSize: '0.65rem' }}>LOCAL COMPETITION RULESET REVIEW</span>
            <h3 className="scoreboard-font" style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.2rem' }}>
              {activeRuleset.name}
            </h3>
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
            <span>Source: <strong>{activeRuleset.sourceDocumentName}</strong></span>
            <span>Season: <strong>{activeRuleset.season}</strong></span>
            <span>Status: <strong style={{ color: 'var(--color-match)' }}>{activeRuleset.status}</strong></span>
          </div>

          {/* Safety Conflicts */}
          {activeRuleset.conflicts && activeRuleset.conflicts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ fontSize: '0.85rem', color: '#ef4444', textTransform: 'uppercase' }}>
                ⚠️ Protected Safety Conflicts ({activeRuleset.conflicts.length})
              </h4>
              {activeRuleset.conflicts.map(c => (
                <div key={c.conflictId} style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', fontSize: '0.8rem' }}>
                  <strong style={{ color: '#ef4444' }}>BLOCKED:</strong> {c.description}
                  <div style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-secondary)' }}>
                    Safety controls cannot be weakened by local competition by-laws.
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Unresolved Rules */}
          {activeRuleset.unresolvedRules && activeRuleset.unresolvedRules.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ fontSize: '0.85rem', color: '#f59e0b', textTransform: 'uppercase' }}>
                ❓ Unresolved Ambiguous Provisions ({activeRuleset.unresolvedRules.length})
              </h4>
              {activeRuleset.unresolvedRules.map(u => (
                <div key={u.unresolvedId} style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', fontSize: '0.8rem' }}>
                  <span className="badge badge-unresolved" style={{ fontSize: '0.65rem', marginBottom: '4px', display: 'inline-block' }}>{u.notice}</span>
                  <div>{u.description}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '4px' }}>
                    "{u.supportingText}"
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Extracted Rules Candidate Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--color-training)', textTransform: 'uppercase' }}>
              Extracted Candidate Rules ({activeRuleset.extractedRules.length})
            </h4>
            {activeRuleset.extractedRules.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No candidate rules extracted from document text.</p>
            ) : (
              activeRuleset.extractedRules.map(rule => (
                <div key={rule.ruleId} style={{ padding: '12px', background: 'var(--bg-floor)', border: '1px solid var(--border-light)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {rule.ruleType} → <span style={{ color: 'var(--color-match)' }}>{rule.proposedValue}</span>
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        className="btn" 
                        onClick={() => onApproveRule(rule.ruleId)}
                        style={{ padding: '2px 8px', fontSize: '0.7rem', background: rule.status === 'CONFIRMED' ? 'var(--color-tactics)' : 'rgba(255,255,255,0.1)', color: 'white' }}
                      >
                        {rule.status === 'CONFIRMED' ? 'Approved ✓' : 'Approve'}
                      </button>
                      <button 
                        className="btn" 
                        onClick={() => onRejectRule(rule.ruleId)}
                        style={{ padding: '2px 8px', fontSize: '0.7rem', background: rule.status === 'REJECTED' ? '#ef4444' : 'rgba(255,255,255,0.1)', color: 'white' }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <strong>Provenance:</strong> {rule.pageSection} — <em>"{rule.supportingText}"</em>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            <button 
              className="btn btn-training" 
              onClick={onActivateRuleset}
              disabled={activeRuleset.status === RULESET_STATUS.ACTIVE}
            >
              {activeRuleset.status === RULESET_STATUS.ACTIVE ? 'Ruleset Currently Active' : 'Activate Ruleset Overlay'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
