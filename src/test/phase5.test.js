import { describe, it, expect } from 'vitest';
import { parseRosterFile } from '../services/rosterParser';

describe('Phase 5 - Safe Spreadsheet & Roster Parser', () => {

  it('1. Parses valid CSV roster text cleanly', () => {
    const csv = `Name,Jersey,Role,BowlingStyle,Medical
Steve Smith,49,Batter,Right Arm Leg Break,None
Pat Cummins,30,Bowler,Right Arm Fast,None`;

    const res = parseRosterFile(csv);
    expect(res.success).toBe(true);
    expect(res.players.length).toBe(2);
    expect(res.players[0].name).toBe('Steve Smith');
    expect(res.players[0].jersey).toBe(49);
    expect(res.players[1].name).toBe('Pat Cummins');
    expect(res.players[1].jersey).toBe(30);
  });

  it('2. Rejects invalid jersey numbers (NaN, 0, >999)', () => {
    const csv = `Name,Jersey
Bad Player,1500`;

    const res = parseRosterFile(csv);
    expect(res.success).toBe(false);
    expect(res.errors[0]).toContain('Invalid Jersey #1500');
  });

  it('3. Rejects duplicate jersey numbers against existing squad', () => {
    const existingSquad = [{ name: 'Existing', jersey: 7 }];
    const csv = `Name,Jersey
Duplicate Player,7`;

    const res = parseRosterFile(csv, existingSquad);
    expect(res.success).toBe(false);
    expect(res.errors[0]).toContain('Jersey #7 is already assigned');
  });

});
