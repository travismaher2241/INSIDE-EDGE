import { describe, it, expect, beforeEach } from 'vitest';
import { safeStorageGet, safeStorageSet, sanitizeRosterForStorage, unmaskRosterFromStorage } from '../services/storage';
import { queueSyncTransaction, flushSyncQueue, getSyncQueue, clearSyncQueue } from '../services/syncService';

describe('Phase 1 - Safety, Privacy & Storage Boundaries', () => {

  beforeEach(() => {
    localStorage.clear();
    clearSyncQueue();
  });

  it('1. safeStorageGet handles malformed JSON in localStorage without throwing', () => {
    localStorage.setItem('insideedge_corrupt', 'INVALID_JSON{{{');
    const val = safeStorageGet('corrupt', 'DEFAULT');
    expect(val).toBe('DEFAULT');
  });

  it('2. safeStorageSet & safeStorageGet store and retrieve structured schema versioned payload', () => {
    safeStorageSet('test_key', { coach: 'David', level: 2 });
    const retrieved = safeStorageGet('test_key');
    expect(retrieved.coach).toBe('David');
    expect(retrieved.level).toBe(2);
  });

  it('3. Sanitizes sensitive roster medical notes for local storage', () => {
    const roster = [
      { id: 'p1', name: 'John Smith', medicalNotes: 'Asthma inhaler required' }
    ];
    const sanitized = sanitizeRosterForStorage(roster);
    expect(sanitized[0].medicalNotes).not.toBe('Asthma inhaler required');
    expect(sanitized[0].medicalNotes).toContain('SEC:');

    const unmasked = unmaskRosterFromStorage(sanitized);
    expect(unmasked[0].medicalNotes).toBe('Asthma inhaler required');
  });

  it('4. Local offline transaction log retains queued mutations without destroying data', async () => {
    queueSyncTransaction('ADD_PLAYER', { id: 'p1', name: 'Test' });
    let queue = getSyncQueue();
    expect(queue.length).toBe(1);

    const flushResult = await flushSyncQueue(true);
    expect(flushResult.success).toBe(true);
    
    // Crucial Invariant: Uncommitted local queue entries must NOT be deleted!
    queue = getSyncQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].actionType).toBe('ADD_PLAYER');
  });

});
