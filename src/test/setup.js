import { vi } from 'vitest';

// Mock localStorage for Node test environment
if (typeof localStorage === 'undefined' || !localStorage.getItem) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(String(key)) || null,
    setItem: (key, value) => store.set(String(key), String(value)),
    removeItem: (key) => store.delete(String(key)),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] || null,
    get length() {
      return store.size;
    }
  };
}

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  if (!window.indexedDB) {
    window.indexedDB = {
      open: vi.fn().mockImplementation(() => {
        const req = {
          result: {
            objectStoreNames: { contains: () => true },
            createObjectStore: vi.fn()
          },
          onsuccess: null,
          onerror: null
        };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      })
    };
  }
}
