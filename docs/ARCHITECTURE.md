# Architecture — AI Shield (Native Security Firewall)

## Overview

AI Shield is an offline-first, AI-powered mobile security firewall inspired by Truecaller. It runs entirely on-device with zero cloud dependencies, intercepting notifications and calls in real-time using a 5-tier classification pipeline.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native UI                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │Dashboard │ │ Settings │ │ History  │ │  AI Status   │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘   │
│       │             │            │               │           │
│       └─────────────┼────────────┼───────────────┘           │
│                     │ Zustand hooks                          │
│  ┌──────────────────┴──────────────────────────────────────┐ │
│  │              Zustand + MMKV Stores                      │ │
│  │  settingsStore │ aiStore │ mmkvStore (Native C++ mmap)  │ │
│  └──────────────────┬──────────────────────────────────────┘ │
└─────────────────────┼────────────────────────────────────────┘
                      │ JSI (zero-copy)
┌─────────────────────┼────────────────────────────────────────┐
│              C++ TurboModule (NativeAIModule)                 │
│  ┌──────────────────┴──────────────────────────────────────┐ │
│  │  AIEngine (shared/AIEngine.cpp)                         │ │
│  │  • classifyNotification() — keyword scoring             │ │
│  │  • classifyCall() — prefix + pattern matching           │ │
│  │  • addPattern() / exportPatterns() — native storage     │ │
│  │  • Atomic counters (lock-free stats)                    │ │
│  │  • std::map<string, NativePattern> (mutex-guarded)      │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                      │
┌─────────────────────┼────────────────────────────────────────┐
│              Android Native Services (Kotlin)                │
│  ┌──────────────────┴──────────────────────────────────────┐ │
│  │  NotificationService (NotificationListenerService)      │ │
│  │  • Intercepts ALL notifications system-wide             │ │
│  │  • Native-side instant classification                   │ │
│  │  • Auto-cancels SPAM, forwards to headless JS           │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │  FirewallCallScreeningService (CallScreeningService)    │ │
│  │  • Indian spam prefix DB (+91140, 1800, etc.)           │ │
│  │  • Short-code detection, spoofed number detection       │ │
│  │  • Auto-reject with system-level call response          │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │  NotificationHeadlessService (HeadlessJsTaskService)    │ │
│  │  • Foreground service with persistent notification      │ │
│  │  • Runs LLM inference in background                     │ │
│  │  • Android 14+ FOREGROUND_SERVICE_TYPE_DATA_SYNC        │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                      │
┌─────────────────────┼────────────────────────────────────────┐
│              On-Device LLM (llama.rn → llama.cpp)            │
│  • Model: gemma-2b-it Q4_K_M (~1.5GB GGUF)                  │
│  • Context: 512 tokens, 4 threads, mmap enabled              │
│  • Capabilities: text classification + embedding generation  │
│  • Latency: ~500ms per classification                        │
└──────────────────────────────────────────────────────────────┘
```

## 5-Tier Classification Pipeline

```
Incoming Notification
        │
        ▼
┌── TIER 0: Custom Keywords ──┐
│  User-defined spam/safe     │ ──→ Instant match → Return
│  words (MMKV, <1μs)         │
└─────────────────────────────┘
        │ no match
        ▼
┌── TIER 1: Pattern Learner ──┐
│  35+ pre-loaded patterns    │ ──→ High confidence → Return
│  + user-learned n-grams     │
│  (MMKV, <1ms)               │
└─────────────────────────────┘
        │ low confidence
        ▼
┌── TIER 1.5: Vector Search ──┐
│  Cosine similarity on LLM   │ ──→ 85%+ match → Return
│  embeddings (MMKV, ~50ms)   │
└─────────────────────────────┘
        │ no match
        ▼
┌── TIER 2: C++ Engine (JSI) ─┐
│  Built-in keyword DB +      │ ──→ High confidence → Return
│  learned patterns (C++, <1ms)│
└─────────────────────────────┘
        │ uncertain
        ▼
┌── TIER 3: LLM Inference ────┐
│  Full prompt-based analysis  │ ──→ Deep classification
│  via llama.cpp (~500ms)      │
└─────────────────────────────┘
        │ LLM unavailable
        ▼
┌── TIER 4: JS Heuristic ─────┐
│  Simple keyword matching     │ ──→ Fallback classification
│  (JS, <1ms)                  │
└─────────────────────────────┘
```

## Self-Learning System

1. **User Feedback** → Teaches pattern learner (n-gram extraction) + C++ engine (native storage) + vector DB (embedding storage)
2. **Auto-Learn** → High-confidence LLM results automatically added to all three stores
3. **Auto Fine-Tune** → Batch retraining from override history, stale pattern pruning
4. **C++ ↔ MMKV Sync** → C++ patterns exported as JSON, persisted in MMKV, reimported on restart

## Storage Architecture

| Store | Backend | Speed | Purpose |
|-------|---------|-------|---------|
| Settings | MMKV (Zustand) | <1μs | User preferences |
| Patterns | MMKV | <1μs | TF-IDF keyword scores |
| Vectors | MMKV | <1μs | LLM embedding vectors |
| History | MMKV | <1μs | Classification log |
| C++ Patterns | std::map + MMKV | <1μs | Native engine patterns |
| Stats | Atomic counters | Lock-free | Real-time counters |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React Native 0.84 (New Architecture) |
| Animations | react-native-reanimated v4 |
| Blur Effects | @react-native-community/blur |
| Navigation | @react-navigation/native-stack |
| State | Zustand v5 |
| Storage | react-native-mmkv (C++ mmap) |
| C++ Bridge | TurboModules (JSI) |
| LLM | llama.rn (llama.cpp) |
| Model | gemma-2b-it Q4_K_M (GGUF) |
| Android Services | Kotlin |
