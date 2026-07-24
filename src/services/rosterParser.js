/**
 * Safe Roster File Parser Service
 * Zero external vulnerabilities. Strict schema validation.
 */

export function parseRosterFile(text, existingSquad = []) {
  if (!text || typeof text !== 'string') {
    return { success: false, players: [], errors: ['Empty or invalid file content.'] };
  }

  // Security bounds
  if (text.length > 2 * 1024 * 1024) { // Max 2 MB
    return { success: false, players: [], errors: ['File size exceeds 2 MB limit.'] };
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { success: false, players: [], errors: ['File contains no readable rows.'] };
  }

  if (lines.length > 105) { // Max 100 players + header
    return { success: false, players: [], errors: ['Row count exceeds maximum limit of 100 players.'] };
  }

  const errors = [];
  const validPlayers = [];
  const existingJerseys = new Set(existingSquad.map(p => Number(p.jersey)));
  const importedJerseys = new Set();

  // Detect header line
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('name') || firstLine.includes('jersey') || firstLine.includes('role');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  dataLines.forEach((line, idx) => {
    const rowNum = hasHeader ? idx + 2 : idx + 1;

    // Support CSV comma separation or tab separation
    const cols = line.includes('\t') ? line.split('\t') : line.split(',');
    if (cols.length < 2) {
      errors.push(`Row ${rowNum}: Insufficient columns (must provide Name and Jersey #).`);
      return;
    }

    const rawName = cols[0].replace(/['"]/g, '').trim();
    const rawJersey = cols[1].replace(/['"]/g, '').trim();
    const rawRole = cols[2] ? cols[2].replace(/['"]/g, '').trim() : 'Batter';
    const rawBowlingStyle = cols[3] ? cols[3].replace(/['"]/g, '').trim() : 'Right Arm Fast Medium';
    const rawMedical = cols[4] ? cols[4].replace(/['"]/g, '').trim() : 'None';

    // Validation 1: Name length (1..60)
    if (!rawName || rawName.length < 1 || rawName.length > 60) {
      errors.push(`Row ${rowNum}: Name must be between 1 and 60 characters.`);
      return;
    }

    // Validation 2: Jersey number (1..999)
    const jerseyNum = Number(rawJersey);
    if (isNaN(jerseyNum) || !Number.isInteger(jerseyNum) || jerseyNum < 1 || jerseyNum > 999) {
      errors.push(`Row ${rowNum}: Invalid Jersey #${rawJersey} (must be a number between 1 and 999).`);
      return;
    }

    // Validation 3: Duplicate Jersey Check
    if (existingJerseys.has(jerseyNum) || importedJerseys.has(jerseyNum)) {
      errors.push(`Row ${rowNum}: Jersey #${jerseyNum} is already assigned to a player in squad.`);
      return;
    }

    importedJerseys.add(jerseyNum);

    validPlayers.push({
      name: rawName,
      jersey: jerseyNum,
      position: rawRole || 'Batter',
      bowlingStyle: rawBowlingStyle || 'Right Arm Fast Medium',
      medical: rawMedical || 'None',
      attendance: [],
      stats: { totalOvers: 0, stints: 0 }
    });
  });

  return {
    success: validPlayers.length > 0 && errors.length === 0,
    players: validPlayers,
    errors
  };
}
