import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  // ─── Classification (C++ engine) ──────────────────────────────────────────
  readonly classifyNotification: (text: string) => string;
  readonly classifyCall: (number: string) => string;

  // ─── Engine lifecycle ─────────────────────────────────────────────────────
  readonly initEngine: () => boolean;
  readonly getStats: () => string;

  // ─── Native storage bridge ────────────────────────────────────────────────
  // These let the C++ engine persist learned patterns and stats across restarts.
  // Backed by in-memory maps with JSON serialization for the JS layer.
  readonly addPattern: (keyword: string, spamScore: number, importantScore: number, promoScore: number) => void;
  readonly getPatternCount: () => number;
  readonly exportPatterns: () => string;
  readonly importPatterns: (json: string) => void;

  // ─── Native counters (lock-free atomics) ──────────────────────────────────
  readonly resetStats: () => void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeAIModule');
