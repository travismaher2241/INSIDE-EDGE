import React, { useState } from 'react';
import { PLAYER_ROLES, BOWLING_STYLES } from '../config/participantRoles';
import { parseRosterFile } from '../services/rosterParser';

export default function SquadHub({
  squad = [],
  onAddPlayer,
  _onEditPlayer,
  onImportPlayers,
  onRemovePlayer,
  _videoClips = []
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [spreadsheetData, setSpreadsheetData] = useState([]);
  const [importErrors, setImportErrors] = useState([]);

  // Form State
  const [name, setName] = useState('');
  const [jersey, setJersey] = useState('');
  const [position, setPosition] = useState('TOP_ORDER_BATTER');
  const [bowlingStyle, setBowlingStyle] = useState('RIGHT_ARM_FAST_MEDIUM');
  const [medical, setMedical] = useState('');

  const filteredSquad = squad.filter(p => roleFilter === 'ALL' || p.position === roleFilter);
  const selectedPlayer = squad.find(p => p.id === selectedPlayerId);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    const jerseyNum = parseInt(jersey, 10);

    if (!name.trim() || isNaN(jerseyNum) || jerseyNum < 1 || jerseyNum > 999) {
      alert("Please enter a valid player name and jersey number between 1 and 999.");
      return;
    }

    if (squad.some(p => Number(p.jersey) === jerseyNum)) {
      alert(`Jersey #${jerseyNum} is already assigned to a player in squad.`);
      return;
    }

    onAddPlayer({
      name: name.trim(),
      jersey: jerseyNum,
      position,
      bowlingStyle,
      medical: medical.trim() || 'None',
      attendance: [],
      stats: { totalOvers: 0, stints: 0 }
    });

    setName('');
    setJersey('');
    setPosition('TOP_ORDER_BATTER');
    setBowlingStyle('RIGHT_ARM_FAST_MEDIUM');
    setMedical('');
    setIsAddOpen(false);
  };

  // Safe CSV/Text Roster File Import
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const result = parseRosterFile(text, squad);
        setSpreadsheetData(result.players);
        setImportErrors(result.errors);
      } catch (err) {
        setImportErrors(['Failed to parse roster file: ' + err.message]);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (spreadsheetData.length > 0) {
      onImportPlayers(spreadsheetData);
      setSpreadsheetData([]);
      setImportErrors([]);
      setIsImportOpen(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="scoreboard-font" style={{ color: 'var(--color-squad)', margin: 0 }}>
            Squad Roster ({squad.length})
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Manage player roles, bowling styles, and performance history.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setIsImportOpen(true)}>
            📊 Safe CSV Roster Import
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
            + Add Player
          </button>
        </div>
      </div>

      {/* Role Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button 
          type="button"
          className={`btn ${roleFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setRoleFilter('ALL')}
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          All Roles ({squad.length})
        </button>
        {PLAYER_ROLES.map(role => (
          <button 
            type="button"
            key={role.id} 
            className={`btn ${roleFilter === role.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRoleFilter(role.id)}
            style={{ fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
          >
            {role.name}
          </button>
        ))}
      </div>

      {/* Roster Grid / List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {filteredSquad.map(player => (
          <div 
            key={player.id}
            onClick={() => setSelectedPlayerId(player.id)}
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: `1px solid ${selectedPlayerId === player.id ? 'var(--color-squad)' : 'var(--border-light)'}`,
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="scoreboard-font" style={{ fontSize: '1.2rem', color: 'var(--color-squad)' }}>
                  #{player.jersey}
                </span>
                <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)' }}>
                  {player.name}
                </span>
              </div>
              <span className="badge" style={{ background: 'rgba(58, 134, 255, 0.15)', color: 'var(--color-squad)' }}>
                {player.position}
              </span>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Style: <strong>{player.bowlingStyle || 'None'}</strong>
            </div>

            {player.medicalNotes && player.medicalNotes !== 'None' && (
              <div style={{ fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                ⚠️ {player.medicalNotes}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Player Detail Profile Drawer */}
      {selectedPlayer && (
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="scoreboard-font" style={{ color: 'var(--color-squad)', margin: 0 }}>
              Player Profile: #{selectedPlayer.jersey} {selectedPlayer.name}
            </h3>
            <button type="button" className="icon-btn" onClick={() => setSelectedPlayerId(null)} aria-label="Close profile">✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.85rem' }}>
            <div>Role: <strong>{selectedPlayer.position}</strong></div>
            <div>Bowling Style: <strong>{selectedPlayer.bowlingStyle}</strong></div>
            <div>Workload Overs: <strong>{selectedPlayer.stats?.totalOvers || 0} Overs</strong></div>
            <div>Medical Notes: <strong>{selectedPlayer.medicalNotes || 'None'}</strong></div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => onRemovePlayer(selectedPlayer.id)} style={{ color: '#ef4444' }}>
              Remove Player from Squad
            </button>
          </div>
        </div>
      )}

      {/* Add Player Modal */}
      {isAddOpen && (
        <div className="overlay-backdrop" onClick={() => setIsAddOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="scoreboard-font" style={{ color: 'var(--color-squad)', margin: 0 }}>Add New Player</h3>
              <button type="button" className="icon-btn" onClick={() => setIsAddOpen(false)} aria-label="Close modal">✕</button>
            </div>
            <form onSubmit={handleAddSubmit} className="modal-body">
              <div className="form-group">
                <label htmlFor="add-player-name">Player Name</label>
                <input id="add-player-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="add-player-jersey">Shirt / Jersey # (1-999)</label>
                <input id="add-player-jersey" type="number" min="1" max="999" value={jersey} onChange={(e) => setJersey(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="add-player-role">Primary Role</label>
                <select id="add-player-role" value={position} onChange={(e) => setPosition(e.target.value)}>
                  {PLAYER_ROLES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="add-player-style">Bowling Style</label>
                <select id="add-player-style" value={bowlingStyle} onChange={(e) => setBowlingStyle(e.target.value)}>
                  {BOWLING_STYLES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="add-player-medical">Medical Notes (Optional)</label>
                <input id="add-player-medical" type="text" value={medical} onChange={(e) => setMedical(e.target.value)} placeholder="e.g. Tape right shoulder" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>Save Player</button>
            </form>
          </div>
        </div>
      )}

      {/* Safe Roster Import Modal */}
      {isImportOpen && (
        <div className="overlay-backdrop" onClick={() => setIsImportOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="scoreboard-font" style={{ color: 'var(--color-squad)', margin: 0 }}>Safe CSV / Text Roster Import</h3>
              <button type="button" className="icon-btn" onClick={() => setIsImportOpen(false)} aria-label="Close modal">✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="import-file">Select CSV / Text Roster File (.csv, .txt)</label>
                <input id="import-file" type="file" accept=".csv,.txt" onChange={handleFileUpload} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Format: Name, Jersey#, Role, BowlingStyle, MedicalNotes
                </p>
              </div>

              {importErrors.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '10px', borderRadius: '8px', fontSize: '0.8rem' }}>
                  {importErrors.map((err, idx) => <div key={idx}>⚠️ {err}</div>)}
                </div>
              )}

              {spreadsheetData.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--color-training)', marginBottom: '8px' }}>
                    Valid Preview ({spreadsheetData.length} Players Verified)
                  </h4>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '0.8rem', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '8px' }}>
                    {spreadsheetData.map((p, idx) => (
                      <div key={idx}>#{p.jersey} {p.name} - {p.position}</div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsImportOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={handleConfirmImport} disabled={spreadsheetData.length === 0}>
                  Confirm & Import Roster
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
