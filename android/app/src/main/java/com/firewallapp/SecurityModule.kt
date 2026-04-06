package com.firewallapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.Arguments
import android.content.Intent
import android.provider.Settings

class SecurityModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    init {
        reactContextStatic = reactContext
    }

    override fun getName(): String {
        return "SecurityModule"
    }

    @ReactMethod
    fun startNotificationService() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactApplicationContext.startActivity(intent)
    }

    @ReactMethod
    fun startCallScreening() {
       // Open role capability selection if needed
    }

    companion object {
        var reactContextStatic: ReactApplicationContext? = null

        fun sendNotificationEvent(packageName: String, title: String, text: String) {
            val params = Arguments.createMap().apply {
                putString("packageName", packageName)
                putString("title", title)
                putString("text", text)
            }
            reactContextStatic
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onNotificationReceived", params)
        }
    }
}
