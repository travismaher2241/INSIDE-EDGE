import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { PLAYER_ROLES, BOWLING_STYLES } from '../config/participantRoles';

export default function SquadHub({
  squad = [],
  onAddPlayer,
  onEditPlayer,
  onImportPlayers,
  onRemovePlayer,
  videoClips = [],
  onSelectClipForReview
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
    if (!name.trim() || !jersey) return;
    onAddPlayer({
      name: name.trim(),
      jersey: parseInt(jersey, 10),
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

  // SheetJS Spreadsheet File Import
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Validate rows
        const errors = [];
        const validPlayers = [];

        data.forEach((row, idx) => {
          if (!row.Name || !row.Jersey) {
            errors.push(`Row ${idx + 2}: Missing required Name or Jersey #.`);
          } else {
            validPlayers.push({
              name: String(row.Name).trim(),
              jersey: parseInt(row.Jersey, 10),
              position: row.Role || 'TOP_ORDER_BATTER',
              bowlingStyle: row.BowlingStyle || 'RIGHT_ARM_FAST_MEDIUM',
              medical: row.Medical || 'None',
              attendance: [],
              stats: { totalOvers: 0, stints: 0 }
            });
          }
        });

        setSpreadsheetData(validPlayers);
        setImportErrors(errors);
      } catch (err) {
        setImportErrors(['Failed to parse spreadsheet file: ' + err.message]);
      }
    };
    reader.readAsBinaryString(file);
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
          <button className="btn btn-secondary" onClick={() => setIsImportOpen(true)}>
            📊 SheetJS Import
          </button>
          <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
            + Add Player
          </button>
        </div>
      </div>

      {/* Role Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button 
          className={`btn ${roleFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setRoleFilter('ALL')}
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          All Roles ({squad.length})
        </button>
        {PLAYER_ROLES.map(role => (
          <button 
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

            {player.medical && player.medical !== 'None' && (
              <div style={{ fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                ⚠️ {player.medical}
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
            <button className="icon-btn" onClick={() => setSelectedPlayerId(null)}>✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.85rem' }}>
            <div>Role: <strong>{selectedPlayer.position}</strong></div>
            <div>Bowling Style: <strong>{selectedPlayer.bowlingStyle}</strong></div>
            <div>Workload Overs: <strong>{selectedPlayer.stats?.totalOvers || 0} Overs</strong></div>
            <div>Medical Notes: <strong>{selectedPlayer.medical}</strong></div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
            <button className="btn btn-secondary" onClick={() => onRemovePlayer(selectedPlayer.id)} style={{ color: '#ef4444' }}>
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
              <button className="icon-btn" onClick={() => setIsAddOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleAddSubmit} className="modal-body">
              <div className="form-group">
                <label>Player Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Shirt / Jersey #</label>
                <input type="number" value={jersey} onChange={(e) => setJersey(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Primary Role</label>
                <select value={position} onChange={(e) => setPosition(e.target.value)}>
                  {PLAYER_ROLES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Bowling Style</label>
                <select value={bowlingStyle} onChange={(e) => setBowlingStyle(e.target.value)}>
                  {BOWLING_STYLES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Medical Notes (Optional)</label>
                <input type="text" value={medical} onChange={(e) => setMedical(e.target.value)} placeholder="e.g. Tape right shoulder" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>Save Player</button>
            </form>
          </div>
        </div>
      )}

      {/* SheetJS Spreadsheet Import Modal */}
      {isImportOpen && (
        <div className="overlay-backdrop" onClick={() => setIsImportOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="scoreboard-font" style={{ color: 'var(--color-squad)', margin: 0 }}>SheetJS XLSX Roster Import</h3>
              <button className="icon-btn" onClick={() => setIsImportOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Select Spreadsheet File (.xlsx, .xls, .csv)</label>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
              </div>

              {importErrors.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '10px', borderRadius: '8px', fontSize: '0.8rem' }}>
                  {importErrors.map((err, idx) => <div key={idx}>{err}</div>)}
                </div>
              )}

              {spreadsheetData.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--color-training)', marginBottom: '8px' }}>
                    Valid Preview ({spreadsheetData.length} Players Found)
                  </h4>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '0.8rem', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '8px' }}>
                    {spreadsheetData.map((p, idx) => (
                      <div key={idx}>#{p.jersey} {p.name} - {p.position}</div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setIsImportOpen(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleConfirmImport} disabled={spreadsheetData.length === 0}>
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
