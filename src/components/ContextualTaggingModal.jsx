import React, { useState } from 'react';

export default function ContextualTaggingModal({
  isOpen,
  onClose,
  drillName = '',
  squad = [],
  onSave
}) {
  if (!isOpen) return null;

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customDrillName, setCustomDrillName] = useState(drillName);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);

  const togglePlayerSelection = (id) => {
    setSelectedPlayerIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedPlayerIds.length === squad.length) {
      setSelectedPlayerIds([]);
    } else {
      setSelectedPlayerIds(squad.map(p => p.id));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customDrillName.trim()) return;
    onSave({
      date,
      drillName: customDrillName.trim(),
      playerIds: selectedPlayerIds
    });
  };

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="scoreboard-font" style={{ color: 'var(--color-video)', margin: 0 }}>
            TAG CRICKET ANALYSIS SEGMENT
          </h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
          <div className="form-group">
            <label>Session Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label>Drill / Match Segment Category</label>
            <input 
              type="text" 
              value={customDrillName} 
              onChange={(e) => setCustomDrillName(e.target.value)} 
              placeholder="e.g. Death Overs Bowling Seam Release" 
              required
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Tag Players ({selectedPlayerIds.length})</label>
              <button type="button" className="icon-btn" onClick={handleSelectAll} style={{ fontSize: '0.75rem', color: 'var(--color-squad)' }}>
                {selectedPlayerIds.length === squad.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px' }}>
              {squad.map(player => (
                <label key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedPlayerIds.includes(player.id)} 
                    onChange={() => togglePlayerSelection(player.id)} 
                  />
                  <span>#{player.jersey} {player.name}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-video" style={{ width: '100%', marginTop: '8px' }}>
            Save Tagged Video Segment
          </button>
        </form>
      </div>
    </div>
  );
}
