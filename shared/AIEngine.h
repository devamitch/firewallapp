#pragma once

#include <AppSpecsJSI.h>
#include <memory>
#include <string>
#include <atomic>
#include <algorithm>
#include <cctype>
#include <vector>
#include <map>
#include <mutex>

namespace facebook::react {

// ─── Native Pattern Entry ───────────────────────────────────────────────────
// Stored in-memory for sub-microsecond lookup. Exported to JSON for MMKV persistence.
struct NativePattern {
  std::string keyword;
  double spamScore;
  double importantScore;
  double promoScore;
  int occurrences;
};

class NativeAIModule : public NativeAIModuleCxxSpec<NativeAIModule> {
public:
  NativeAIModule(std::shared_ptr<CallInvoker> jsInvoker);

  // ─── Classification ─────────────────────────────────────────────────────────
  std::string classifyNotification(jsi::Runtime& rt, std::string text);
  std::string classifyCall(jsi::Runtime& rt, std::string number);

  // ─── Engine lifecycle ───────────────────────────────────────────────────────
  bool initEngine(jsi::Runtime& rt);
  std::string getStats(jsi::Runtime& rt);
  void resetStats(jsi::Runtime& rt);

  // ─── Native pattern storage (C++-speed persistence bridge) ────────────────
  void addPattern(jsi::Runtime& rt, std::string keyword, double spamScore, double importantScore, double promoScore);
  double getPatternCount(jsi::Runtime& rt);
  std::string exportPatterns(jsi::Runtime& rt);
  void importPatterns(jsi::Runtime& rt, std::string json);

private:
  // Atomic counters (lock-free)
  std::atomic<int> totalProcessed_{0};
  std::atomic<int> blockedSpam_{0};
  std::atomic<int> allowedImportant_{0};
  std::atomic<int> blockedCalls_{0};
  std::atomic<bool> engineReady_{false};

  // Native pattern database (guarded by mutex for thread-safety)
  std::map<std::string, NativePattern> learnedPatterns_;
  std::mutex patternMutex_;

  // Utilities
  static std::string toLower(const std::string& input);
  static bool containsCI(const std::string& haystack, const std::string& needle);

  // Built-in keyword databases
  static const std::vector<std::string>& spamKeywords();
  static const std::vector<std::string>& importantKeywords();
  static const std::vector<std::string>& promotionKeywords();
  static const std::vector<std::string>& spamNumberPrefixes();
};

} // namespace facebook::react
