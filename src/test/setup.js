import { beforeAll } from 'vitest';

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    let store = {};
    globalThis.localStorage = {
      getItem: (key) => store[key] || null,
      setItem: (key, val) => { store[key] = String(val); },
      removeItem: (key) => { delete store[key]; },
      clear: () => { store = {}; }
    };
  }

  if (typeof globalThis.IDBRequest === 'undefined') {
    globalThis.IDBRequest = class IDBRequest {};
    globalThis.IDBTransaction = class IDBTransaction {};
    globalThis.IDBDatabase = class IDBDatabase {};
  }

  if (typeof globalThis.indexedDB === 'undefined') {
    const mockStore = new Map();
    globalThis.indexedDB = {
      open: () => {
        const req = new globalThis.IDBRequest();
        setTimeout(() => {
          req.result = {
            objectStoreNames: { contains: () => true },
            createObjectStore: () => {},
            transaction: () => ({
              objectStore: () => ({
                put: (val, key) => mockStore.set(key || val.id, val),
                get: (key) => mockStore.get(key)
              })
            })
          };
          req.onsuccess && req.onsuccess();
        }, 0);
        return req;
      }
    };
  }

  if (typeof globalThis.File === 'undefined') {
    globalThis.File = class File {
      constructor(parts, name, options = {}) {
        this.name = name;
        this.type = options.type || '';
        this.size = parts.reduce((acc, p) => acc + (p.length || 0), 0);
      }
    };
  }

  if (typeof globalThis.URL.createObjectURL === 'undefined') {
    globalThis.URL.createObjectURL = () => 'blob:mock_video_url_123';
    globalThis.URL.revokeObjectURL = () => {};
  }
});
