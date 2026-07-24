import React, { useState, useRef } from 'react';
import { processVideoImport } from '../services/videoImportPipeline';
import ContextualTaggingModal from './ContextualTaggingModal';

export default function VideoAnalyser({
  squad = [],
  videoClips = [],
  setVideoClips,
  activeRuleset
}) {
  const [activeClip, setActiveClip] = useState(videoClips[0] || null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Ingestion Pipeline
  const handleImportVideo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const newClip = await processVideoImport(file, (info) => {
        setImportProgress(info.progress);
      });
      setVideoClips(prev => [newClip, ...prev]);
      setActiveClip(newClip);
      setIsImporting(false);
    } catch (err) {
      alert("Video Import Failed: " + err.message);
      setIsImporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="scoreboard-font" style={{ color: 'var(--color-video)', margin: 0 }}>
            Video Analyser & Telestrator
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Biomechanical stroke & bowling action analysis with timestamp annotations.
          </p>
        </div>

        <label className="btn btn-video">
          📹 Upload Video Clip
          <input type="file" accept="video/*" onChange={handleImportVideo} style={{ display: 'none' }} />
        </label>
      </div>

      {isImporting && (
        <div style={{ padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '8px', fontSize: '0.85rem' }}>
          Uploading & extracting metadata... ({importProgress}%)
        </div>
      )}

      {/* Main Video Player & Telestrator Canvas View */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        {activeClip ? (
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '16px', overflow: 'hidden', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--color-video)' }}>{activeClip.drillName}</h3>
              {activeRuleset && (
                <span className="badge badge-ruleset">Ruleset Context: {activeRuleset.season}</span>
              )}
            </div>

            <div style={{ position: 'relative', width: '100%', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden' }}>
              <video src={activeClip.videoUrl} controls style={{ width: '100%', maxHeight: '450px' }} />
            </div>
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-surface)', border: '1px dashed var(--border-medium)', borderRadius: '16px', color: 'var(--text-secondary)' }}>
            No video clips loaded. Upload a video clip to begin tactical analysis.
          </div>
        )}
      </div>
    </div>
  );
}
