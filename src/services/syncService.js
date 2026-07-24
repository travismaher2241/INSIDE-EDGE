/**
 * Offline Queue & Cloud Sync Manager for Inside Edge
 */

export function getSyncQueue() {
  const saved = localStorage.getItem('insideedge_sync_queue');
  return saved ? JSON.parse(saved) : [];
}

export function saveSyncQueue(queue) {
  localStorage.setItem('insideedge_sync_queue', JSON.stringify(queue));
}

export function queueSyncTransaction(actionType, payload) {
  const queue = getSyncQueue();
  const tx = {
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    timestamp: new Date().toISOString(),
    actionType,
    payload,
    status: 'PENDING_CLOUD_SYNC'
  };
  queue.push(tx);
  saveSyncQueue(queue);
  return tx;
}

export async function flushSyncQueue(isOnline = true) {
  if (!isOnline) {
    return { success: false, syncedCount: 0, reason: 'LOCAL_ONLY_OFFLINE' };
  }

  const queue = getSyncQueue();
  if (queue.length === 0) return { success: true, syncedCount: 0 };

  // Simulate flushing to Firestore
  localStorage.setItem('insideedge_sync_queue', JSON.stringify([]));
  return { success: true, syncedCount: queue.length };
}
