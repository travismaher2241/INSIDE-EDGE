import { openDB } from 'idb';

const DB_NAME = 'InsideEdge_MediaStore';
const DB_VERSION = 1;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('video_blobs')) {
        db.createObjectStore('video_blobs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('rules_documents')) {
        db.createObjectStore('rules_documents', { keyPath: 'id' });
      }
    }
  });
}

export async function storeVideoBlob(id, blob, metadata = {}) {
  const db = await getDB();
  await db.put('video_blobs', {
    id,
    blob,
    metadata,
    updatedAt: new Date().toISOString()
  });
}

export async function getVideoBlob(id) {
  const db = await getDB();
  return db.get('video_blobs', id);
}

export async function storeRulesDocument(id, fileBlob, metadata = {}) {
  const db = await getDB();
  await db.put('rules_documents', {
    id,
    blob: fileBlob,
    metadata,
    updatedAt: new Date().toISOString()
  });
}

export async function getRulesDocument(id) {
  const db = await getDB();
  return db.get('rules_documents', id);
}
