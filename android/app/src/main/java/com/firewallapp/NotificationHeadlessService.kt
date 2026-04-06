package com.firewallapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.bridge.Arguments

class NotificationHeadlessService : HeadlessJsTaskService() {

    companion object {
        private const val CHANNEL_ID = "FIREWALL_CHANNEL"
        private const val NOTIFICATION_ID = 1
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("AI Shield Active")
            .setContentText("Monitoring notifications passively...")
            .setSmallIcon(android.R.drawable.ic_secure)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .setSilent(true)
            .build()

        // Android 14+ requires specifying the foreground service type
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "AI Firewall Engine",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                description = "Keeps the AI classification engine alive in background"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        return intent?.extras?.let { extras ->
            val params = Arguments.createMap().apply {
                putString("packageName", extras.getString("packageName") ?: "")
                putString("title", extras.getString("title") ?: "")
                putString("text", extras.getString("text") ?: "")
                putString("nativeLabel", extras.getString("nativeLabel") ?: "")
            }

            HeadlessJsTaskConfig(
                "NotificationProcessor",
                params,
                60000,  // 60s timeout — enough for LLM cold-start + inference
                true    // allow in foreground too
            )
        }
    }
}
