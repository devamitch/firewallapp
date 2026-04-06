import { create } from 'zustand';
import { storage, StorageKeys, getJSON, setJSON } from './mmkvStore';

// ─── Firewall Settings ─────────────────────────────────────────────────────
// Reactive Zustand store backed by MMKV (native C++ mmap).
// Every settings change is instant and persisted synchronously.

export interface FirewallSettings {
  autoBlockSpam: boolean;
  silencePromotions: boolean;
  showSpamWarning: boolean;
  autoRejectSpamCalls: boolean;
  blockUnknownShortCodes: boolean;
  blockRepeatedUnknown: boolean;
  confidenceThreshold: number;
  useLLM: boolean;
  autoFineTuneInterval: number;
  learningEnabled: boolean;
  keepHistoryDays: number;
  encryptLogs: boolean;
  darkMode: boolean;
  showLiveFeed: boolean;
  hapticFeedback: boolean;
  notificationBadge: boolean;
  customSpamKeywords: string[];
  customSafeKeywords: string[];
}

const DEFAULT_SETTINGS: FirewallSettings = {
  autoBlockSpam: true,
  silencePromotions: true,
  showSpamWarning: false,
  autoRejectSpamCalls: true,
  blockUnknownShortCodes: true,
  blockRepeatedUnknown: false,
  confidenceThreshold: 0.75,
  useLLM: false,
  autoFineTuneInterval: 24,
  learningEnabled: true,
  keepHistoryDays: 30,
  encryptLogs: false,
  darkMode: true,
  showLiveFeed: true,
  hapticFeedback: true,
  notificationBadge: true,
  customSpamKeywords: [],
  customSafeKeywords: [],
};

interface SettingsState extends FirewallSettings {
  _hydrated: boolean;
  hydrate: () => void;
  update: (partial: Partial<FirewallSettings>) => void;
  addSpamKeyword: (kw: string) => void;
  addSafeKeyword: (kw: string) => void;
  removeKeyword: (kw: string) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  _hydrated: false,

  hydrate: () => {
    const stored = getJSON<Partial<FirewallSettings>>(StorageKeys.SETTINGS, {});
    set({ ...DEFAULT_SETTINGS, ...stored, _hydrated: true });
  },

  update: (partial) => {
    const next = { ...get(), ...partial };
    setJSON(StorageKeys.SETTINGS, next);
    set(partial);
  },

  addSpamKeyword: (kw) => {
    const lower = kw.toLowerCase();
    const state = get();
    if (!state.customSpamKeywords.includes(lower)) {
      const spamKws = [...state.customSpamKeywords, lower];
      const safeKws = state.customSafeKeywords.filter(k => k !== lower);
      set({ customSpamKeywords: spamKws, customSafeKeywords: safeKws });
      setJSON(StorageKeys.SETTINGS, { ...get() });
    }
  },

  addSafeKeyword: (kw) => {
    const lower = kw.toLowerCase();
    const state = get();
    if (!state.customSafeKeywords.includes(lower)) {
      const safeKws = [...state.customSafeKeywords, lower];
      const spamKws = state.customSpamKeywords.filter(k => k !== lower);
      set({ customSafeKeywords: safeKws, customSpamKeywords: spamKws });
      setJSON(StorageKeys.SETTINGS, { ...get() });
    }
  },

  removeKeyword: (kw) => {
    const lower = kw.toLowerCase();
    set({
      customSpamKeywords: get().customSpamKeywords.filter(k => k !== lower),
      customSafeKeywords: get().customSafeKeywords.filter(k => k !== lower),
    });
    setJSON(StorageKeys.SETTINGS, { ...get() });
  },

  reset: () => {
    set(DEFAULT_SETTINGS);
    setJSON(StorageKeys.SETTINGS, DEFAULT_SETTINGS);
  },
}));
