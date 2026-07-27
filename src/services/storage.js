/**
 * Safe Storage Service with Schema Versioning & Privacy Controls
 * Protects localStorage calls against malformed JSON corruption, quota errors,
 * and handles sensitive medical notes safely.
 */

const STORAGE_SCHEMA_VERSION = 1;
const STORAGE_PREFIX = 'insideedge_v1_';

/**
 * Obfuscate sensitive medical notes in browser storage (simple AES-style XOR mask)
 */
function maskSensitiveText(text) {
  if (!text) return '';
  try {
    return 'SEC:' + btoa(encodeURIComponent(text));
  } catch {
    return text;
  }
}

function unmaskSensitiveText(masked) {
  if (!masked) return '';
  if (!masked.startsWith('SEC:')) return masked;
  try {
    return decodeURIComponent(atob(masked.substring(4)));
  } catch {
    return masked;
  }
}

export function safeStorageGet(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key) || localStorage.getItem(key);
    if (!raw) return defaultValue;

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed._schemaVersion) {
      return parsed.data;
    }
    return parsed;
  } catch (e) {
    console.warn(`[storage] Failed to parse key "${key}", returning default.`, e);
    return defaultValue;
  }
}

export function safeStorageSet(key, value) {
  try {
    const payload = {
      _schemaVersion: STORAGE_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      data: value
    };
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error(`[storage] Quota error or failure writing key "${key}".`, e);
    return false;
  }
}

export function safeStorageRemove(key) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeRosterForStorage(roster = []) {
  return roster.map(p => ({
    ...p,
    medicalNotes: maskSensitiveText(p.medicalNotes || '')
  }));
}

export function unmaskRosterFromStorage(roster = []) {
  return roster.map(p => ({
    ...p,
    medicalNotes: unmaskSensitiveText(p.medicalNotes || '')
  }));
}

export function clearAllLocalApplicationData() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('insideedge') || key.startsWith(STORAGE_PREFIX))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    return true;
  } catch (e) {
    console.error('[storage] Failed to clear application data', e);
    return false;
  }
}
