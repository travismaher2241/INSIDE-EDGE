import { useState, useEffect } from 'react';
import { processVideoImport, revokeVideoObjectUrl } from '../services/videoImportPipeline';
import { getVideoBlob, deleteVideoBlob } from '../services/dbStorage';

export default function VideoAnalyser({
  _squad = [],
  videoClips = [],
  setVideoClips,
  activeRuleset
}) {
  const [activeClip, setActiveClip] = useState(videoClips[0] || null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Rehydrate video Blob URLs from IndexedDB on clip load
  useEffect(() => {
    async function rehydrateClips() {
      if (!videoClips || videoClips.length === 0) return;

      const updatedClips = await Promise.all(
        videoClips.map(async (clip) => {
          if (!clip.videoUrl || clip.videoUrl.startsWith('blob:')) {
            const blob = await getVideoBlob(clip.id || clip.clipId);
            if (blob) {
              const freshUrl = URL.createObjectURL(blob);
              return { ...clip, videoUrl: freshUrl };
            }
          }
          return clip;
        })
      );

      setVideoClips(updatedClips);
      if (!activeClip && updatedClips.length > 0) {
        setActiveClip(updatedClips[0]);
      }
    }

    rehydrateClips();
  }, []);

  // Video File Ingestion Pipeline
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

  const handleDeleteClip = async (clipId) => {
    const clip = videoClips.find(c => (c.id || c.clipId) === clipId);
    if (clip) {
      revokeVideoObjectUrl(clip.videoUrl);
      await deleteVideoBlob(clipId);
      const remaining = videoClips.filter(c => (c.id || c.clipId) !== clipId);
      setVideoClips(remaining);
      if (activeClip && (activeClip.id || activeClip.clipId) === clipId) {
        setActiveClip(remaining[0] || null);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="scoreboard-font" style={{ color: 'var(--color-video)', margin: 0 }}>
            Video Analyser & Workstation Storage
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Biomechanical stroke & bowling action analysis with local IndexedDB binary clip persistence.
          </p>
        </div>

        <label className="btn btn-video" style={{ cursor: 'pointer' }}>
          📹 Upload Video Clip
          <input type="file" accept="video/*" onChange={handleImportVideo} style={{ display: 'none' }} />
        </label>
      </div>

      {isImporting && (
        <div style={{ padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '8px', fontSize: '0.85rem' }}>
          Uploading & storing video clip in IndexedDB... ({importProgress}%)
        </div>
      )}

      {/* Main Video Player & Clip List */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        {activeClip ? (
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '16px', overflow: 'hidden', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--color-video)' }}>{activeClip.drillName}</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {activeRuleset && (
                  <span className="badge badge-ruleset">Ruleset Context: {activeRuleset.season}</span>
                )}
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  onClick={() => handleDeleteClip(activeClip.id || activeClip.clipId)}
                  style={{ color: '#ef4444', fontSize: '0.8rem', padding: '4px 8px' }}
                >
                  Delete Clip
                </button>
              </div>
            </div>

            <div style={{ position: 'relative', width: '100%', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden' }}>
              <video src={activeClip.videoUrl} controls style={{ width: '100%', maxHeight: '450px' }} />
            </div>

            {/* Video Clip Library Selector */}
            {videoClips.length > 1 && (
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Workstation Video Library ({videoClips.length} Clips Saved)
                </h4>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {videoClips.map(clip => {
                    const isSelected = (clip.id || clip.clipId) === (activeClip.id || activeClip.clipId);
                    return (
                      <button
                        type="button"
                        key={clip.id || clip.clipId}
                        onClick={() => setActiveClip(clip)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${isSelected ? 'var(--color-video)' : 'var(--border-light)'}`,
                          background: isSelected ? 'rgba(236, 72, 153, 0.15)' : 'var(--bg-floor)',
                          color: 'var(--text-primary)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        📹 {clip.drillName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-surface)', border: '1px dashed var(--border-medium)', borderRadius: '16px', color: 'var(--text-secondary)' }}>
            No video clips loaded. Upload a video clip to save in workstation IndexedDB storage.
          </div>
        )}
      </div>
    </div>
  );
}
