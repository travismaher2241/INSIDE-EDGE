import React, { useState } from 'react';
import { createInitialMatchState, recordDelivery, undoLastDelivery, EXTRAS_TYPES, DISMISSAL_TYPES } from '../engine/cricketMatchEngine';
import ContextualTaggingModal from './ContextualTaggingModal';

export default function MatchDay({
  squad = [],
  activeMatchDef,
  activeRuleset,
  onSaveVideoClip
}) {
  const [matchState, setMatchState] = useState(() => 
    createInitialMatchState(activeMatchDef?.formatId || 'T20', activeMatchDef)
  );

  const [taggingOpen, setTaggingOpen] = useState(false);
  const [pendingVideo, setPendingVideo] = useState(null);

  const currentInnings = matchState.innings[matchState.currentInningsIndex];

  const handleDelivery = (runsBat = 0, extraType = EXTRAS_TYPES.NONE, wicketType = DISMISSAL_TYPES.NONE) => {
    const isByeOrLegBye = extraType === EXTRAS_TYPES.BYE || extraType === EXTRAS_TYPES.LEG_BYE;

    const updated = recordDelivery(matchState, {
      runsBat: isByeOrLegBye ? 0 : runsBat,
      runsExtra: isByeOrLegBye ? Math.max(1, runsBat) : 0,
      extraType,
      wicketType,
      bowlerId: matchState.activeBowlerId
    });
    setMatchState(updated);
  };

  const handleUndo = () => {
    const undone = undoLastDelivery(matchState);
    setMatchState(undone);
  };

  const handleMatchVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPendingVideo({
        videoUrl: url,
        fileName: file.name,
        drillName: `Match Day Ingestion - Innings ${matchState.currentInningsIndex + 1}`
      });
      setTaggingOpen(true);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Active Ruleset Indicator */}
      {activeRuleset && (
        <div style={{ padding: '8px 12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', fontSize: '0.8rem', color: '#f59e0b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Match Definition Overlay: <strong>{activeRuleset.name} ({activeRuleset.season})</strong></span>
          <span className="badge badge-ruleset">ACTIVE OVERLAY</span>
        </div>
      )}

      {/* Main Scoreboard Display */}
      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <span>Format: <strong>{matchState.matchDef?.formatId || 'T20'}</strong></span>
          <span>Innings {matchState.currentInningsIndex + 1} of 2</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '16px' }}>
          <div className="scoreboard-font" style={{ fontSize: '4.5rem', color: 'var(--color-match)', lineHeight: 1 }}>
            {currentInnings.totalRuns}/{currentInnings.totalWickets}
          </div>
          <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
            ({currentInnings.oversBowled}.{currentInnings.ballsInCurrentOver} / {matchState.matchDef?.maxOversPerInnings || 20} Ov)
          </div>
        </div>

        {matchState.isMatchComplete && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', padding: '10px', borderRadius: '8px', fontWeight: '700' }}>
            🏆 Match Result: {matchState.matchResultSummary}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-floor)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
          <div>Striker: <strong>{matchState.activeStrikerId || 'Batter 1'}</strong></div>
          <div>Non-Striker: <strong>{matchState.activeNonStrikerId || 'Batter 2'}</strong></div>
        </div>
      </div>

      {/* Delivery Control Panel */}
      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 className="scoreboard-font" style={{ color: 'var(--color-match)', margin: 0, fontSize: '1.1rem' }}>
          Delivery Recording Panel
        </h3>

        {/* Runs Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
          {[0, 1, 2, 3, 4, 6].map(runs => (
            <button key={runs} type="button" className="btn btn-match" onClick={() => handleDelivery(runs)} style={{ fontSize: '1.2rem', fontWeight: '800', padding: '12px' }}>
              {runs}
            </button>
          ))}
        </div>

        {/* Extras & Wicket Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => handleDelivery(0, EXTRAS_TYPES.WIDE)}>Wide (+1)</button>
          <button type="button" className="btn btn-secondary" onClick={() => handleDelivery(0, EXTRAS_TYPES.NO_BALL)}>No-Ball (+1)</button>
          <button type="button" className="btn btn-secondary" onClick={() => handleDelivery(1, EXTRAS_TYPES.BYE)}>Bye (+1)</button>
          <button type="button" className="btn btn-secondary" onClick={() => handleDelivery(1, EXTRAS_TYPES.LEG_BYE)}>Leg-Bye (+1)</button>
          <button type="button" className="btn btn-secondary" onClick={() => handleDelivery(0, EXTRAS_TYPES.NONE, DISMISSAL_TYPES.BOWLED)} style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
            ☝️ Wicket (Out)
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleUndo}>
            ↩ Undo Ball
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
          <label className="btn btn-secondary" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
            📹 Ingest Match Segment Video
            <input type="file" accept="video/*" onChange={handleMatchVideoUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {taggingOpen && pendingVideo && (
        <ContextualTaggingModal
          isOpen={taggingOpen}
          onClose={() => setTaggingOpen(false)}
          drillName={pendingVideo.drillName}
          squad={squad}
          onSave={(tagData) => {
            onSaveVideoClip({
              id: 'v_' + Date.now(),
              videoUrl: pendingVideo.videoUrl,
              fileName: pendingVideo.fileName,
              date: tagData.date,
              drillName: tagData.drillName,
              playerIds: tagData.playerIds,
              drawings: []
            });
            setTaggingOpen(false);
          }}
        />
      )}
    </div>
  );
}
