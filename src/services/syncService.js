import { safeStorageGet, safeStorageSet } from './storage';

/**
 * Local Transaction Log & Offline Activity Ledger for Inside Edge
 * Local-First Product Architecture: Retains explicit audit logs of all domain mutations.
 * Never clears queued operations without real acknowledged remote persistence.
 */

const SYNC_QUEUE_KEY = 'sync_queue';

export function getSyncQueue() {
  return safeStorageGet(SYNC_QUEUE_KEY, []);
}

export function saveSyncQueue(queue) {
  return safeStorageSet(SYNC_QUEUE_KEY, queue);
}

export function queueSyncTransaction(actionType, payload) {
  const queue = getSyncQueue();
  const tx = {
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    actionType,
    payload,
    status: 'LOCAL_LOGGED'
  };
  queue.push(tx);
  saveSyncQueue(queue);
  return tx;
}

export function clearSyncQueue() {
  saveSyncQueue([]);
  return true;
}

export async function flushSyncQueue(isOnline = false) {
  const queue = getSyncQueue();
  if (queue.length === 0) {
    return { success: true, syncedCount: 0, mode: 'LOCAL_ONLY_STATION' };
  }

  // Local-First Workstation Boundary:
  // Retain all transaction records in the local ledger.
  // Do NOT clear or delete uncommitted offline records without an active remote backend.
  return {
    success: true,
    syncedCount: 0,
    pendingCount: queue.length,
    mode: 'LOCAL_ONLY_STATION',
    message: `All ${queue.length} local operations securely logged in workstation ledger.`
  };
}
