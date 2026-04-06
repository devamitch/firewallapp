#include "AIEngine.h"
#include <sstream>
#include <string>

namespace facebook::react {

// ─── Constructor ────────────────────────────────────────────────────────────
NativeAIModule::NativeAIModule(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeAIModuleCxxSpec(std::move(jsInvoker)) {}

// ─── Utility: toLower ───────────────────────────────────────────────────────
std::string NativeAIModule::toLower(const std::string& input) {
  std::string result = input;
  std::transform(result.begin(), result.end(), result.begin(),
                 [](unsigned char c) { return std::tolower(c); });
  return result;
}

// ─── Utility: case-insensitive contains ─────────────────────────────────────
bool NativeAIModule::containsCI(const std::string& haystack, const std::string& needle) {
  std::string lowerHay = toLower(haystack);
  std::string lowerNeedle = toLower(needle);
  return lowerHay.find(lowerNeedle) != std::string::npos;
}

// ─── Keyword Databases ─────────────────────────────────────────────────────
const std::vector<std::string>& NativeAIModule::spamKeywords() {
  static const std::vector<std::string> kw = {
    "win", "winner", "won", "lottery", "jackpot",
    "click here", "click now", "act now", "urgent",
    "loan approved", "instant loan", "free money",
    "claim your", "congratulations", "selected",
    "prize", "reward", "gift card", "cash prize",
    "verify your account", "suspended", "blocked account",
    "phishing", "nigerian", "inheritance",
    "earn money", "work from home", "make money fast",
    "bitcoin profit", "crypto alert", "investment opportunity",
    "limited time", "expires today"
  };
  return kw;
}

const std::vector<std::string>& NativeAIModule::importantKeywords() {
  static const std::vector<std::string> kw = {
    "otp", "one time password", "verification code",
    "bank alert", "banking", "transaction", "debited", "credited",
    "login attempt", "sign in", "password reset",
    "delivery", "shipped", "out for delivery", "arriving",
    "appointment", "reminder", "scheduled",
    "flight", "boarding", "gate",
    "emergency", "alert", "warning",
    "missed call", "voicemail"
  };
  return kw;
}

const std::vector<std::string>& NativeAIModule::promotionKeywords() {
  static const std::vector<std::string> kw = {
    "sale", "discount", "% off", "offer",
    "deal", "coupon", "promo", "cashback",
    "subscribe", "newsletter", "new arrival",
    "exclusive", "flash sale", "festive",
    "buy now", "shop now", "order now",
    "free shipping", "save big", "clearance",
    "season sale", "mega sale", "diwali",
    "black friday"
  };
  return kw;
}

const std::vector<std::string>& NativeAIModule::spamNumberPrefixes() {
  static const std::vector<std::string> prefixes = {
    "+91140", "+911800", "+91120", "+91011",
    "1800", "+1900", "+44870", "+44871", "140",
  };
  return prefixes;
}

// ─── Core: classifyNotification ─────────────────────────────────────────────
std::string NativeAIModule::classifyNotification(jsi::Runtime& rt, std::string text) {
  totalProcessed_.fetch_add(1, std::memory_order_relaxed);

  int spamScore = 0;
  int importantScore = 0;
  int promotionScore = 0;

  // Score against built-in keywords
  for (const auto& kw : spamKeywords()) {
    if (containsCI(text, kw)) spamScore += 10;
  }
  for (const auto& kw : importantKeywords()) {
    if (containsCI(text, kw)) importantScore += 10;
  }
  for (const auto& kw : promotionKeywords()) {
    if (containsCI(text, kw)) promotionScore += 10;
  }

  // Score against learned patterns (native C++ storage)
  {
    std::lock_guard<std::mutex> lock(patternMutex_);
    std::string lowerText = toLower(text);
    for (const auto& [keyword, pattern] : learnedPatterns_) {
      if (lowerText.find(keyword) != std::string::npos) {
        double weight = std::min(static_cast<double>(pattern.occurrences) / 50.0, 2.0);
        spamScore += static_cast<int>(pattern.spamScore * weight);
        importantScore += static_cast<int>(pattern.importantScore * weight);
        promotionScore += static_cast<int>(pattern.promoScore * weight);
      }
    }
  }

  // Determine classification
  std::string label;
  double confidence;

  if (spamScore > importantScore && spamScore > promotionScore) {
    label = "SPAM";
    confidence = std::min(0.99, 0.7 + (spamScore * 0.02));
    blockedSpam_.fetch_add(1, std::memory_order_relaxed);
  } else if (importantScore >= promotionScore) {
    label = "IMPORTANT";
    confidence = std::min(0.99, 0.7 + (importantScore * 0.02));
    allowedImportant_.fetch_add(1, std::memory_order_relaxed);
  } else {
    label = "PROMOTION";
    confidence = std::min(0.99, 0.7 + (promotionScore * 0.02));
  }

  // Default fallback
  if (spamScore == 0 && importantScore == 0 && promotionScore == 0) {
    label = "IMPORTANT";
    confidence = 0.50;
    allowedImportant_.fetch_add(1, std::memory_order_relaxed);
  }

  std::ostringstream json;
  json << "{\"label\":\"" << label << "\",\"confidence\":" << confidence << "}";
  return json.str();
}

// ─── Core: classifyCall ─────────────────────────────────────────────────────
std::string NativeAIModule::classifyCall(jsi::Runtime& rt, std::string number) {
  for (const auto& prefix : spamNumberPrefixes()) {
    if (number.find(prefix) == 0) {
      blockedCalls_.fetch_add(1, std::memory_order_relaxed);
      return "{\"label\":\"SPAM\",\"confidence\":0.92}";
    }
  }

  std::string digits;
  for (char c : number) {
    if (std::isdigit(static_cast<unsigned char>(c))) digits += c;
  }

  if (digits.length() > 0 && digits.length() < 7) {
    return "{\"label\":\"UNKNOWN\",\"confidence\":0.65}";
  }

  if (digits.length() >= 10) {
    bool allSame = true;
    for (size_t i = 1; i < digits.length(); i++) {
      if (digits[i] != digits[0]) { allSame = false; break; }
    }
    if (allSame) {
      blockedCalls_.fetch_add(1, std::memory_order_relaxed);
      return "{\"label\":\"SPAM\",\"confidence\":0.88}";
    }
  }

  return "{\"label\":\"SAFE\",\"confidence\":0.75}";
}

// ─── Native Pattern Storage ─────────────────────────────────────────────────
void NativeAIModule::addPattern(jsi::Runtime& rt, std::string keyword, double spamScore, double importantScore, double promoScore) {
  std::lock_guard<std::mutex> lock(patternMutex_);
  std::string key = toLower(keyword);

  auto it = learnedPatterns_.find(key);
  if (it != learnedPatterns_.end()) {
    // Reinforce existing pattern
    it->second.spamScore = std::min(100.0, it->second.spamScore + spamScore * 0.2);
    it->second.importantScore = std::min(100.0, it->second.importantScore + importantScore * 0.2);
    it->second.promoScore = std::min(100.0, it->second.promoScore + promoScore * 0.2);
    it->second.occurrences++;
  } else {
    learnedPatterns_[key] = NativePattern{key, spamScore, importantScore, promoScore, 1};
  }
}

double NativeAIModule::getPatternCount(jsi::Runtime& rt) {
  std::lock_guard<std::mutex> lock(patternMutex_);
  return static_cast<double>(learnedPatterns_.size());
}

std::string NativeAIModule::exportPatterns(jsi::Runtime& rt) {
  std::lock_guard<std::mutex> lock(patternMutex_);
  std::ostringstream json;
  json << "[";
  bool first = true;
  for (const auto& [key, p] : learnedPatterns_) {
    if (!first) json << ",";
    first = false;
    json << "{\"k\":\"" << p.keyword
         << "\",\"s\":" << p.spamScore
         << ",\"i\":" << p.importantScore
         << ",\"p\":" << p.promoScore
         << ",\"o\":" << p.occurrences << "}";
  }
  json << "]";
  return json.str();
}

void NativeAIModule::importPatterns(jsi::Runtime& rt, std::string json) {
  // Simple JSON array parser for our known format
  // Format: [{"k":"keyword","s":80,"i":5,"p":15,"o":10}, ...]
  std::lock_guard<std::mutex> lock(patternMutex_);
  learnedPatterns_.clear();

  size_t pos = 0;
  while ((pos = json.find("{\"k\":\"", pos)) != std::string::npos) {
    pos += 6; // skip {"k":"
    size_t endKey = json.find("\"", pos);
    if (endKey == std::string::npos) break;
    std::string keyword = json.substr(pos, endKey - pos);

    // Parse scores
    double s = 0, i = 0, p = 0;
    int o = 1;

    size_t sPos = json.find("\"s\":", endKey);
    if (sPos != std::string::npos) s = std::stod(json.substr(sPos + 4));

    size_t iPos = json.find("\"i\":", endKey);
    if (iPos != std::string::npos) i = std::stod(json.substr(iPos + 4));

    size_t pPos = json.find("\"p\":", endKey);
    if (pPos != std::string::npos) p = std::stod(json.substr(pPos + 4));

    size_t oPos = json.find("\"o\":", endKey);
    if (oPos != std::string::npos) o = std::stoi(json.substr(oPos + 4));

    learnedPatterns_[keyword] = NativePattern{keyword, s, i, p, o};
    pos = endKey + 1;
  }
}

// ─── Stats ──────────────────────────────────────────────────────────────────
std::string NativeAIModule::getStats(jsi::Runtime& rt) {
  std::lock_guard<std::mutex> lock(patternMutex_);
  std::ostringstream json;
  json << "{\"totalProcessed\":" << totalProcessed_.load(std::memory_order_relaxed)
       << ",\"blockedSpam\":" << blockedSpam_.load(std::memory_order_relaxed)
       << ",\"allowedImportant\":" << allowedImportant_.load(std::memory_order_relaxed)
       << ",\"blockedCalls\":" << blockedCalls_.load(std::memory_order_relaxed)
       << ",\"nativePatterns\":" << learnedPatterns_.size()
       << "}";
  return json.str();
}

void NativeAIModule::resetStats(jsi::Runtime& rt) {
  totalProcessed_.store(0, std::memory_order_relaxed);
  blockedSpam_.store(0, std::memory_order_relaxed);
  allowedImportant_.store(0, std::memory_order_relaxed);
  blockedCalls_.store(0, std::memory_order_relaxed);
}

bool NativeAIModule::initEngine(jsi::Runtime& rt) {
  engineReady_.store(true, std::memory_order_release);
  return true;
}

} // namespace facebook::react
