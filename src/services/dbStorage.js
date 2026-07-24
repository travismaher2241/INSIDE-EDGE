import { openDB } from 'idb';

const DB_NAME = 'InsideEdgeDB';
const DB_VERSION = 1;
const STORE_NAME = 'video_blobs';

let dbPromise = null;

async function getDB() {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        if (typeof window === 'undefined' || !window.indexedDB) return null;
        return await openDB(DB_NAME, DB_VERSION, {
          upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME);
            }
          }
        });
      } catch (e) {
        return null;
      }
    })();
  }
  return dbPromise;
}

export async function saveVideoBlob(clipId, blob) {
  try {
    const db = await getDB();
    if (db) {
      await db.put(STORE_NAME, blob, clipId);
    }
    return true;
  } catch (e) {
    return true;
  }
}

export const storeVideoBlob = saveVideoBlob;

export async function getVideoBlob(clipId) {
  try {
    const db = await getDB();
    if (db) {
      return await db.get(STORE_NAME, clipId);
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function deleteVideoBlob(clipId) {
  try {
    const db = await getDB();
    if (db) {
      await db.delete(STORE_NAME, clipId);
    }
    return true;
  } catch (e) {
    return true;
  }
}
