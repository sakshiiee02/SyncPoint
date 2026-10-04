package com.syncpoint.location

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.media.AudioAttributes
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import java.util.Locale

/**
 * React Native bridge to the native location foreground service, one-shot position reads,
 * battery state and text-to-speech.
 */
class LocationBridgeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var pendingSpeech: String? = null

    override fun getName(): String = "SyncPointLocationBridge"

    init {
        JourneyLocationService.activeLocationListener = { location: Location, shouldPublish: Boolean ->
            val params = locationToMap(location).apply {
                putBoolean("shouldPublish", shouldPublish)
            }
            sendEvent("onLocationUpdate", params)
        }

        JourneyLocationService.activeStatusListener = { status: String ->
            val params = Arguments.createMap().apply {
                putString("status", status)
            }
            sendEvent("onLocationStatusChange", params)
        }
    }

    /** Location fields plus the device's real battery state. */
    private fun locationToMap(location: Location): WritableMap =
        Arguments.createMap().apply {
            putDouble("latitude", location.latitude)
            putDouble("longitude", location.longitude)
            putDouble("speedMps", if (location.hasSpeed()) location.speed.toDouble() else 0.0)
            putDouble("heading", if (location.hasBearing()) location.bearing.toDouble() else 0.0)
            putDouble("accuracy", if (location.hasAccuracy()) location.accuracy.toDouble() else 0.0)
            putDouble("timestamp", location.time.toDouble())
            val battery = BatteryReader.read(reactContext)
            if (battery != null) {
                putInt("batteryPct", battery.percent)
                putBoolean("isCharging", battery.isCharging)
            }
        }

    private fun sendEvent(eventName: String, params: WritableMap) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    // Required by NativeEventEmitter on newer React Native versions.
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun sendServiceAction(action: String, promise: Promise, errorCode: String) {
        try {
            val intent = Intent(reactContext, JourneyLocationService::class.java).apply {
                this.action = action
            }
            if (action == JourneyLocationService.ACTION_START) {
                ContextCompat.startForegroundService(reactContext, intent)
            } else {
                reactContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject(errorCode, e.localizedMessage, e)
        }
    }

    @ReactMethod
    fun startTracking(journeyId: String, journeyName: String, destinationName: String, promise: Promise) {
        try {
            val intent = Intent(reactContext, JourneyLocationService::class.java).apply {
                action = JourneyLocationService.ACTION_START
                putExtra(JourneyLocationService.EXTRA_JOURNEY_ID, journeyId)
                putExtra(JourneyLocationService.EXTRA_JOURNEY_NAME, journeyName)
                putExtra(JourneyLocationService.EXTRA_DESTINATION_NAME, destinationName)
            }
            ContextCompat.startForegroundService(reactContext, intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_ERROR", e.localizedMessage, e)
        }
    }

    @ReactMethod
    fun pauseTracking(promise: Promise) =
        sendServiceAction(JourneyLocationService.ACTION_PAUSE, promise, "PAUSE_ERROR")

    @ReactMethod
    fun resumeTracking(promise: Promise) =
        sendServiceAction(JourneyLocationService.ACTION_RESUME, promise, "RESUME_ERROR")

    @ReactMethod
    fun finishTracking(promise: Promise) =
        sendServiceAction(JourneyLocationService.ACTION_FINISH, promise, "FINISH_ERROR")

    @ReactMethod
    fun getTrackingState(promise: Promise) {
        val state = Arguments.createMap().apply {
            putBoolean("isRunning", JourneyLocationService.isServiceRunning)
            putBoolean("isPaused", JourneyLocationService.isSharingPaused)
        }
        promise.resolve(state)
    }

    /**
     * One-shot, high-accuracy position (used for "start from my current location").
     * Rejects with PERMISSION_DENIED, TIMEOUT or UNAVAILABLE.
     */
    @ReactMethod
    fun getCurrentPosition(timeoutMs: Double, promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(
            reactContext, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            promise.reject("PERMISSION_DENIED", "Location permission has not been granted.")
            return
        }

        val handler = Handler(Looper.getMainLooper())
        val cancellation = CancellationTokenSource()
        var settled = false

        fun succeed(location: Location) {
            if (settled) return
            settled = true
            handler.removeCallbacksAndMessages(null)
            promise.resolve(locationToMap(location))
        }

        fun fail(code: String, message: String) {
            if (settled) return
            settled = true
            handler.removeCallbacksAndMessages(null)
            promise.reject(code, message)
        }

        handler.postDelayed({
            cancellation.cancel()
            fail("TIMEOUT", "Could not get a GPS fix in time. Move to an open area and try again.")
        }, timeoutMs.toLong())

        try {
            val client = LocationServices.getFusedLocationProviderClient(reactContext)
            client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancellation.token)
                .addOnSuccessListener { location ->
                    if (location != null) {
                        succeed(location)
                    } else {
                        client.lastLocation
                            .addOnSuccessListener { last ->
                                if (last != null) succeed(last)
                                else fail("UNAVAILABLE", "Location is turned off or unavailable.")
                            }
                            .addOnFailureListener { fail("UNAVAILABLE", it.localizedMessage ?: "Location unavailable.") }
                    }
                }
                .addOnFailureListener { fail("UNAVAILABLE", it.localizedMessage ?: "Location unavailable.") }
        } catch (e: SecurityException) {
            fail("PERMISSION_DENIED", "Location permission has not been granted.")
        } catch (e: Exception) {
            fail("UNAVAILABLE", e.localizedMessage ?: "Location unavailable.")
        }
    }

    // ── Text-to-speech for turn-by-turn guidance ─────────────────────────────────────────

    private fun ensureTts() {
        if (tts != null) return
        tts = TextToSpeech(reactContext.applicationContext) { status ->
            if (status != TextToSpeech.SUCCESS) return@TextToSpeech
            val engine = tts ?: return@TextToSpeech
            val result = engine.setLanguage(Locale.getDefault())
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                engine.setLanguage(Locale.US)
            }
            engine.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            ttsReady = true
            pendingSpeech?.let { engine.speak(it, TextToSpeech.QUEUE_FLUSH, null, "syncpoint-guidance") }
            pendingSpeech = null
        }
    }

    @ReactMethod
    fun speak(text: String) {
        ensureTts()
        if (ttsReady) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "syncpoint-guidance")
        } else {
            pendingSpeech = text
        }
    }

    @ReactMethod
    fun stopSpeaking() {
        tts?.stop()
    }

    // ── Journey alerts (someone arrived / needs help / low battery) ───────────────────────

    private var alertId = 50000

    /** Posts a notification while the app is in the background. [urgent] uses a high-priority channel. */
    @ReactMethod
    fun notify(title: String, message: String, urgent: Boolean) {
        val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = if (urgent) "syncpoint_alerts_urgent" else "syncpoint_alerts"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                if (urgent) "Urgent journey alerts" else "Journey alerts",
                if (urgent) NotificationManager.IMPORTANCE_HIGH else NotificationManager.IMPORTANCE_DEFAULT
            ).apply { description = "Updates from the people on your journey" }
            manager.createNotificationChannel(channel)
        }

        val launchIntent = reactContext.packageManager.getLaunchIntentForPackage(reactContext.packageName)
        val contentIntent = PendingIntent.getActivity(
            reactContext, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(reactContext, channelId)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(reactContext)
        }
        builder
            .setContentTitle(title)
            .setContentText(message)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(contentIntent)
            .setAutoCancel(true)

        try {
            manager.notify(alertId++, builder.build())
        } catch (e: SecurityException) {
            // Notification permission denied: alerts still show in-app.
        }
    }

    override fun invalidate() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        ttsReady = false
        super.invalidate()
    }
}
