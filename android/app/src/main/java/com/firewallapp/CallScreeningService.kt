package com.firewallapp

import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log

class FirewallCallScreeningService : CallScreeningService() {

    companion object {
        private const val TAG = "AIFirewall.Call"

        // Known Indian spam prefixes and short codes
        private val SPAM_PREFIXES = listOf(
            "+91140",   // Jaipur telemarketing cluster
            "+911800",  // Abused toll-free
            "+91120",   // Noida spam cluster
            "+91011",   // Delhi spam cluster
            "1800",     // Generic toll-free
            "+1900",    // US premium rate
            "+44870",   // UK premium rate
            "+44871",   // UK premium rate
            "140",      // Indian DND prefix
        )

        fun classifyNumber(number: String): String {
            // Check against known spam prefixes
            for (prefix in SPAM_PREFIXES) {
                if (number.startsWith(prefix)) return "SPAM"
            }

            // Short codes (< 7 digits) are likely telemarketing
            val digits = number.filter { it.isDigit() }
            if (digits.isNotEmpty() && digits.length < 7) return "UNKNOWN"

            // Repeated digit patterns (0000000000) are spoofed
            if (digits.length >= 10 && digits.all { it == digits[0] }) return "SPAM"

            return "SAFE"
        }
    }

    override fun onScreenCall(callDetails: Call.Details) {
        val number = callDetails.handle?.schemeSpecificPart ?: ""
        val label = classifyNumber(number)

        Log.d(TAG, "Screening call from $number → $label")

        when (label) {
            "SPAM" -> {
                Log.w(TAG, "⛔ SPAM CALL REJECTED: $number")
                val response = CallResponse.Builder()
                    .setDisallowCall(true)
                    .setRejectCall(true)
                    .setSkipCallLog(false)
                    .setSkipNotification(false)
                    .build()
                respondToCall(callDetails, response)

                // Notify React Native UI
                SecurityModule.sendNotificationEvent(
                    "call.blocked",
                    "Spam Call Blocked",
                    "Rejected call from $number"
                )
            }
            "UNKNOWN" -> {
                Log.i(TAG, "⚠️ UNKNOWN caller: $number — allowing with warning")
                val response = CallResponse.Builder()
                    .setDisallowCall(false)
                    .setRejectCall(false)
                    .setSkipCallLog(false)
                    .setSkipNotification(false)
                    .build()
                respondToCall(callDetails, response)
            }
            else -> {
                Log.i(TAG, "✅ SAFE call allowed: $number")
                val response = CallResponse.Builder()
                    .setDisallowCall(false)
                    .setRejectCall(false)
                    .setSkipCallLog(false)
                    .setSkipNotification(false)
                    .build()
                respondToCall(callDetails, response)
            }
        }
    }
}
