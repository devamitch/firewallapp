import { create } from 'zustand';
import { StorageKeys, getJSON, setJSON } from './mmkvStore';

// ─── AI State Store (Zustand + MMKV) ─────────────────────────────────────────
// Reactive state for the AI engine status, displayed on AIStatusScreen.

interface AIState {
  // LLM
  llmStatus: 'IDLE' | 'DOWNLOADING' | 'LOADING' | 'READY' | 'ERROR';
  llmProgress: number;
  llmModelPath: string | null;
  llmError: string | null;

  // C++ Engine
  engineReady: boolean;
  nativePatternCount: number;

  // Vector Store
  vectorCount: number;
  vectorSpam: number;
  vectorImportant: number;
  vectorPromo: number;

  // Pattern Learner
  totalPatterns: number;
  historySize: number;
  whitelistedApps: number;
  blacklistedApps: number;

  // Counters
  totalProcessed: number;
  blockedSpam: number;
  allowedImportant: number;
  blockedCalls: number;

  // Actions
  setLlmStatus: (status: AIState['llmStatus'], error?: string) => void;
  setLlmProgress: (progress: number) => void;
  setLlmModelPath: (path: string) => void;
  setEngineReady: (ready: boolean) => void;
  updateStats: (stats: Partial<AIState>) => void;
  hydrate: () => void;
}

export const useAIStore = create<AIState>((set, get) => ({
  llmStatus: 'IDLE',
  llmProgress: 0,
  llmModelPath: null,
  llmError: null,
  engineReady: false,
  nativePatternCount: 0,
  vectorCount: 0,
  vectorSpam: 0,
  vectorImportant: 0,
  vectorPromo: 0,
  totalPatterns: 0,
  historySize: 0,
  whitelistedApps: 0,
  blacklistedApps: 0,
  totalProcessed: 0,
  blockedSpam: 0,
  allowedImportant: 0,
  blockedCalls: 0,

  setLlmStatus: (status, error) => set({ llmStatus: status, llmError: error || null }),
  setLlmProgress: (progress) => set({ llmProgress: progress }),
  setLlmModelPath: (path) => {
    setJSON(StorageKeys.LLM_MODEL_PATH, path);
    set({ llmModelPath: path });
  },
  setEngineReady: (ready) => set({ engineReady: ready }),
  updateStats: (stats) => set(stats),
  hydrate: () => {
    const modelPath = getJSON<string | null>(StorageKeys.LLM_MODEL_PATH, null);
    set({ llmModelPath: modelPath });
  },
}));
