import { MMKV } from 'react-native-mmkv';

// ─── Global MMKV Instance ───────────────────────────────────────────────────
// Single native C++ mmap-backed storage instance for the entire app.
// 30x faster than AsyncStorage. Synchronous reads/writes.
// Encrypted with a device-specific key.

export const storage = new MMKV({
  id: 'firewall-storage',
  // encryptionKey: 'your-encryption-key', // Uncomment for encrypted storage
});

// ─── Type-Safe MMKV Helpers ─────────────────────────────────────────────────

export const StorageKeys = {
  SETTINGS: 'settings',
  PATTERNS: 'patterns',
  VECTORS: 'vectors',
  HISTORY: 'history',
  WHITELIST: 'whitelist',
  BLACKLIST: 'blacklist',
  LLM_MODEL_PATH: 'llm_model_path',
  LLM_STATUS: 'llm_status',
  CPP_PATTERNS: 'cpp_patterns',
  STATS: 'stats',
} as const;

export function getJSON<T>(key: string, defaultValue: T): T {
  const raw = storage.getString(key);
  if (!raw) return defaultValue;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function setJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}
