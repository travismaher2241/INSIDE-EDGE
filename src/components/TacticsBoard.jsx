import React, { useState, useRef, useEffect } from 'react';

export default function TacticsBoard({ _squad = [], _subscriptionTier, activeMatchDef }) {
  const canvasRef = useRef(null);

  // Correct 11 Fielding Player Tokens + 2 Batting Tokens Model
  const [tokens, setTokens] = useState([
    { id: 'f1', x: 500, y: 350, label: 'B', role: 'Bowler' },
    { id: 'f2', x: 500, y: 220, label: 'WK', role: 'Keeper' },
    { id: 'f3', x: 530, y: 225, label: 'S1', role: '1st Slip' },
    { id: 'f4', x: 550, y: 235, label: 'S2', role: '2nd Slip' },
    { id: 'f5', x: 575, y: 260, label: 'G', role: 'Gully' },
    { id: 'f6', x: 620, y: 300, label: 'Pt', role: 'Point' },
    { id: 'f7', x: 590, y: 380, label: 'Cov', role: 'Cover' },
    { id: 'f8', x: 530, y: 410, label: 'Mid-Off', role: 'Mid-off' },
    { id: 'f9', x: 470, y: 410, label: 'Mid-On', role: 'Mid-on' },
    { id: 'f10', x: 410, y: 380, label: 'Mid-Wkt', role: 'Mid-wicket' },
    { id: 'f11', x: 380, y: 300, label: 'Sq-Leg', role: 'Square Leg' },
    // Batting Tokens on Pitch
    { id: 'b1', x: 500, y: 240, label: 'BAT 1', team: 'batter' },
    { id: 'b2', x: 500, y: 330, label: 'BAT 2', team: 'batter' }
  ]);

  // Field Presets
  const applyPreset = (presetName) => {
    if (presetName === 'ATTACKING_SLIP_CORDON') {
      setTokens(prev => prev.map(t => {
        if (t.id === 'f3') return { ...t, x: 530, y: 225 };
        if (t.id === 'f4') return { ...t, x: 550, y: 235 };
        return t;
      }));
    } else if (presetName === 'T20_POWERPLAY') {
      setTokens(prev => prev.map(t => {
        if (t.id === 'f8') return { ...t, x: 530, y: 500 };
        if (t.id === 'f9') return { ...t, x: 470, y: 500 };
        return t;
      }));
    }
  };

  // Keyboard Nudge Handler for Accessibility
  const handleTokenKeyDown = (e, tokenId) => {
    const step = e.shiftKey ? 20 : 5;
    let dx = 0;
    let dy = 0;

    if (e.key === 'ArrowUp') dy = -step;
    if (e.key === 'ArrowDown') dy = step;
    if (e.key === 'ArrowLeft') dx = -step;
    if (e.key === 'ArrowRight') dx = step;

    if (dx !== 0 || dy !== 0) {
      e.preventDefault();
      setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, x: Math.max(50, Math.min(950, t.x + dx)), y: Math.max(50, Math.min(550, t.y + dy)) } : t));
    }
  };

  // Draw Oval Canvas Background & Markings
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(canvas.width / 1000, canvas.height / 600);

    // Oval Grass Ground
    ctx.fillStyle = '#102e1c';
    ctx.beginPath();
    ctx.ellipse(500, 300, 460, 260, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#2a5a3a';
    ctx.lineWidth = 4;
    ctx.stroke();

    // 30-Yard Inner Circle Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.ellipse(500, 300, 220, 130, 0, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pitch Strip
    ctx.fillStyle = '#bfa175';
    ctx.fillRect(485, 230, 30, 140);

    // Creases & Stumps
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(485, 240, 30, 1);
    ctx.strokeRect(485, 360, 30, 1);

    ctx.restore();
  };

  useEffect(() => {
    drawCanvas();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {/* Action Header & Presets */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="scoreboard-font" style={{ color: 'var(--color-tactics)', margin: 0 }}>
            Cricket Tactics Board (11 Fielders + 2 Batters)
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Max Outfielders Allowed: {activeMatchDef?.fieldingRestrictions?.maxOutfieldersNonPowerplay || 5}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => applyPreset('ATTACKING_SLIP_CORDON')}>
            🛡️ Attacking Slip Cordon
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => applyPreset('T20_POWERPLAY')}>
            ⚡ T20 Powerplay
          </button>
        </div>
      </div>

      {/* Interactive Board View Container */}
      <div style={{ position: 'relative', width: '100%', height: '500px', backgroundColor: '#0e1310', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-medium)' }}>
        <canvas ref={canvasRef} width={1000} height={600} style={{ width: '100%', height: '100%' }} />

        {/* Render Accessible Fielder & Batter Tokens */}
        {tokens.map(token => (
          <div
            key={token.id}
            tabIndex={0}
            role="button"
            aria-label={`${token.role || token.label} Token (Use arrow keys to move)`}
            onKeyDown={(e) => handleTokenKeyDown(e, token.id)}
            style={{
              position: 'absolute',
              left: `${(token.x / 1000) * 100}%`,
              top: `${(token.y / 600) * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: token.team === 'batter' ? '#f59e0b' : 'var(--color-tactics)',
              color: '#000',
              fontWeight: '800',
              fontSize: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
              cursor: 'pointer',
              userSelect: 'none',
              outline: 'none'
            }}
          >
            {token.label}
          </div>
        ))}
      </div>
    </div>
  );
}
