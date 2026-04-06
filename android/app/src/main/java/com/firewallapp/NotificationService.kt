package com.firewallapp

import android.app.Notification
import android.content.Intent
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

class NotificationService : NotificationListenerService() {

    companion object {
        private const val TAG = "AIFirewall.Notif"

        // Native-side rule-based classifier — mirrors the C++ engine logic
        // so notifications can be classified even before JS boots
        fun classifyNatively(text: String): String {
            val lower = text.lowercase()
            val spamWords = listOf("win", "winner", "won", "lottery", "jackpot", "click here",
                "click now", "act now", "loan approved", "instant loan", "free money",
                "claim your", "congratulations", "selected", "prize", "reward",
                "gift card", "cash prize", "verify your account", "earn money",
                "bitcoin profit", "crypto alert", "limited time", "expires today")
            val importantWords = listOf("otp", "one time password", "verification code",
                "bank alert", "banking", "transaction", "debited", "credited",
                "login attempt", "sign in", "password reset", "delivery",
                "shipped", "out for delivery", "appointment", "reminder",
                "emergency", "alert", "missed call")
            val promoWords = listOf("sale", "discount", "% off", "offer", "deal",
                "coupon", "promo", "cashback", "subscribe", "newsletter",
                "buy now", "shop now", "order now", "free shipping", "save big")

            var spamScore = spamWords.count { lower.contains(it) }
            var importantScore = importantWords.count { lower.contains(it) }
            var promoScore = promoWords.count { lower.contains(it) }

            return when {
                spamScore > importantScore && spamScore > promoScore -> "SPAM"
                importantScore >= promoScore -> "IMPORTANT"
                else -> "PROMOTION"
            }
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        sbn?.let {
            // Skip our own notifications
            if (it.packageName == packageName) return

            val extras = it.notification.extras
            val title = extras.getString(Notification.EXTRA_TITLE) ?: ""
            val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
            val packageName = it.packageName

            Log.d(TAG, "Intercepted: [$packageName] $title — $text")

            // ─── Native-side instant classification ─────────────────────────────
            val combined = "$title $text"
            val label = classifyNatively(combined)

            when (label) {
                "SPAM" -> {
                    Log.w(TAG, "⛔ SPAM BLOCKED: $title")
                    cancelNotification(it.key)
                }
                "PROMOTION" -> {
                    Log.i(TAG, "📢 PROMOTION silenced: $title")
                    // Don't cancel, but it's already silent via channel importance
                }
                else -> {
                    Log.i(TAG, "✅ IMPORTANT allowed: $title")
                }
            }

            // ─── Forward to React Native UI (if alive) ──────────────────────────
            SecurityModule.sendNotificationEvent(packageName, title, text)

            // ─── Fire Headless JS for deep LLM analysis in background ───────────
            val serviceIntent = Intent(applicationContext, NotificationHeadlessService::class.java).apply {
                putExtra("packageName", packageName)
                putExtra("title", title)
                putExtra("text", text)
                putExtra("nativeLabel", label)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                applicationContext.startForegroundService(serviceIntent)
            } else {
                applicationContext.startService(serviceIntent)
            }
        }
    }
}
