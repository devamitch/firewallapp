import { NativeModules, NativeEventEmitter } from 'react-native';
import { llmService } from './llmService';
import { patternLearner } from './patternLearner';
import { vectorStore } from '../store/vectorStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAIStore } from '../store/aiStore';

// ─── C++ TurboModule via JSI (zero bridge overhead) ─────────────────────────
let NativeAI: {
  classifyNotification: (text: string) => string;
  classifyCall: (number: string) => string;
  getStats: () => string;
  initEngine: () => boolean;
  addPattern: (keyword: string, spamScore: number, importantScore: number, promoScore: number) => void;
  getPatternCount: () => number;
  exportPatterns: () => string;
  importPatterns: (json: string) => void;
  resetStats: () => void;
} | null = null;

try {
  NativeAI = require('../specs/NativeAIModule').default;
} catch (e) {
  console.warn('C++ TurboModule NativeAIModule not available, using JS fallback');
}

// ─── Legacy bridge module for Android service control ───────────────────────
const { SecurityModule } = NativeModules;
export const securityEmitter = SecurityModule ? new NativeEventEmitter(SecurityModule) : null;

// ─── 5-Tier Classification Pipeline ────────────────────────────────────────
//
// 0. User custom keywords (instant)
// 1. Self-learned pattern database (MMKV, fast)
// 1.5. Vector semantic search (LLM embeddings)
// 2. C++ TurboModule rule engine (JSI, sub-ms)
// 3. On-device LLM (llama.rn, deep analysis)
// 4. JS heuristic fallback

export const SecurityService = {
  async initialize(): Promise<void> {
    patternLearner.init();
    vectorStore.init();
    useSettingsStore.getState().hydrate();
    useAIStore.getState().hydrate();

    if (NativeAI) {
      try {
        NativeAI.initEngine();
        useAIStore.getState().setEngineReady(true);

        // Sync MMKV learned patterns → C++ engine
        const { StorageKeys, getJSON } = require('../store/mmkvStore');
        const cppPatterns = getJSON(StorageKeys.CPP_PATTERNS, null);
        if (cppPatterns) {
          NativeAI.importPatterns(cppPatterns);
        }
      } catch (e) {
        console.error('C++ engine init failed:', e);
      }
    }
  },

  startNotificationService() {
    SecurityModule?.startNotificationService();
  },

  startCallScreening() {
    SecurityModule?.startCallScreening();
  },

  async classifyNotification(
    text: string,
    packageName: string = 'unknown'
  ): Promise<{ label: 'IMPORTANT' | 'PROMOTION' | 'SPAM'; confidence: number; source: string }> {
    const settings = useSettingsStore.getState();

    // ─── TIER 0: Custom keyword overrides ─────────────────────────────────
    const lower = text.toLowerCase();
    for (const kw of settings.customSpamKeywords) {
      if (lower.includes(kw)) return { label: 'SPAM', confidence: 0.99, source: 'custom_rule' };
    }
    for (const kw of settings.customSafeKeywords) {
      if (lower.includes(kw)) return { label: 'IMPORTANT', confidence: 0.99, source: 'custom_rule' };
    }

    // ─── TIER 1: Self-learned patterns (MMKV) ────────────────────────────
    const learnedResult = patternLearner.classify(text, packageName);
    if (learnedResult.confidence >= settings.confidenceThreshold) {
      await patternLearner.recordClassification({
        text, predictedLabel: learnedResult.label, confidence: learnedResult.confidence,
        timestamp: Date.now(), packageName,
      });
      return { ...learnedResult, source: 'learned_patterns' };
    }

    // ─── TIER 1.5: Vector semantic search ─────────────────────────────────
    if (settings.useLLM && llmService.isReady) {
      try {
        const queryEmbedding = await llmService.getEmbedding(text);
        const similar = await vectorStore.searchSimilar(queryEmbedding, 1);
        if (similar.length > 0 && similar[0].similarity > 0.85) {
          const match = similar[0];
          await patternLearner.recordClassification({
            text, predictedLabel: match.entry.label, confidence: match.similarity,
            timestamp: Date.now(), packageName,
          });
          return { label: match.entry.label, confidence: match.similarity, source: 'vector_search' };
        }
      } catch (e) {
        console.error('Vector search failed:', e);
      }
    }

    // ─── TIER 2: C++ TurboModule (JSI — sub-millisecond) ──────────────────
    if (NativeAI) {
      try {
        const jsonStr = NativeAI.classifyNotification(text);
        const parsed = JSON.parse(jsonStr);
        if (parsed.confidence >= settings.confidenceThreshold) {
          await patternLearner.recordClassification({
            text, predictedLabel: parsed.label, confidence: parsed.confidence,
            timestamp: Date.now(), packageName,
          });
          return { ...parsed, source: 'cpp_engine' };
        }
      } catch (e) {
        console.error('C++ classification failed:', e);
      }
    }

    // ─── TIER 3: On-device LLM (deep analysis) ───────────────────────────
    if (settings.useLLM && llmService.isReady) {
      try {
        const result = await llmService.classify(text);
        const jsonStr = result.substring(result.indexOf('{'), result.lastIndexOf('}') + 1);
        const parsed = JSON.parse(jsonStr);
        await patternLearner.recordClassification({
          text, predictedLabel: parsed.label, confidence: parsed.confidence,
          timestamp: Date.now(), packageName,
        });

        // Auto-learn from high-confidence LLM results
        if (settings.learningEnabled && parsed.confidence > 0.85) {
          await patternLearner.learnFromFeedback(text, parsed.label);

          // Also teach C++ engine
          if (NativeAI) {
            const scores = {
              spam: parsed.label === 'SPAM' ? 80 : 5,
              important: parsed.label === 'IMPORTANT' ? 80 : 5,
              promo: parsed.label === 'PROMOTION' ? 80 : 5,
            };
            const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            for (let i = 0; i < words.length - 1; i++) {
              NativeAI.addPattern(`${words[i]} ${words[i+1]}`, scores.spam, scores.important, scores.promo);
            }
            // Persist C++ patterns to MMKV
            const { StorageKeys, setJSON } = require('../store/mmkvStore');
            setJSON(StorageKeys.CPP_PATTERNS, NativeAI.exportPatterns());
          }
        }

        return { ...parsed, source: 'llm_inference' };
      } catch (e) {
        console.error('LLM inference failed:', e);
      }
    }

    // ─── TIER 4: JS heuristic fallback ────────────────────────────────────
    if (['win', 'loan', 'free', 'click here', 'jackpot', 'prize'].some(k => lower.includes(k))) {
      return { label: 'SPAM', confidence: 0.9, source: 'js_heuristic' };
    }
    if (['otp', 'alert', 'bank', 'login', 'transaction', 'delivery'].some(k => lower.includes(k))) {
      return { label: 'IMPORTANT', confidence: 0.95, source: 'js_heuristic' };
    }
    if (['sale', 'off', 'discount', 'offer', 'deal', 'coupon'].some(k => lower.includes(k))) {
      return { label: 'PROMOTION', confidence: 0.85, source: 'js_heuristic' };
    }

    return { label: 'IMPORTANT', confidence: 0.5, source: 'default' };
  },

  async submitFeedback(text: string, correctLabel: 'SPAM' | 'IMPORTANT' | 'PROMOTION'): Promise<void> {
    await patternLearner.learnFromFeedback(text, correctLabel);

    // Teach C++ engine
    if (NativeAI) {
      const scores = {
        spam: correctLabel === 'SPAM' ? 80 : 5,
        important: correctLabel === 'IMPORTANT' ? 80 : 5,
        promo: correctLabel === 'PROMOTION' ? 80 : 5,
      };
      const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      for (let i = 0; i < words.length - 1; i++) {
        NativeAI.addPattern(`${words[i]} ${words[i+1]}`, scores.spam, scores.important, scores.promo);
      }
      const { StorageKeys, setJSON } = require('../store/mmkvStore');
      setJSON(StorageKeys.CPP_PATTERNS, NativeAI.exportPatterns());
    }

    // Embed for vector search
    if (useSettingsStore.getState().useLLM && llmService.isReady) {
      try {
        const embedding = await llmService.getEmbedding(text);
        await vectorStore.addVector({ text, label: correctLabel, embedding, source: 'user_feedback' });
      } catch (e) {
        console.error('Failed to embed feedback:', e);
      }
    }
  },

  async autoFineTune(): Promise<{ patternsUpdated: number; accuracy: number }> {
    return patternLearner.autoFineTune();
  },

  classifyCall(number: string): { label: 'SPAM' | 'SAFE' | 'UNKNOWN'; confidence: number } {
    if (NativeAI) {
      try { return JSON.parse(NativeAI.classifyCall(number)); }
      catch (e) { console.error('C++ call classification failed:', e); }
    }
    return { label: 'SAFE', confidence: 0.5 };
  },

  getStats() {
    const learnerStats = patternLearner.getStats();
    const vectorStats = vectorStore.getStats();
    let engineStats = { totalProcessed: 0, blockedSpam: 0, allowedImportant: 0, blockedCalls: 0, nativePatterns: 0 };

    if (NativeAI) {
      try { engineStats = JSON.parse(NativeAI.getStats()); }
      catch (e) { /* fallback */ }
    }

    // Update Zustand AI store
    useAIStore.getState().updateStats({
      ...engineStats,
      ...learnerStats,
      nativePatternCount: engineStats.nativePatterns || 0,
      vectorCount: vectorStats.total,
      vectorSpam: vectorStats.spam,
      vectorImportant: vectorStats.important,
      vectorPromo: vectorStats.promo,
    });

    return { ...engineStats, ...learnerStats, vector: vectorStats };
  },

  initEngine(): boolean {
    if (NativeAI) {
      try { return NativeAI.initEngine(); }
      catch (e) { console.error('Failed to init native engine:', e); }
    }
    return false;
  },
};
