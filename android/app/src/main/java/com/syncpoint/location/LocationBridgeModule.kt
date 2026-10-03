package com.syncpoint.location

import android.content.Intent
import android.location.Location
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * React Native NativeModule bridging JavaScript/TypeScript UI with native
 * Kotlin JourneyLocationService.
 * Matches Section 8.1 and Section 19 of Developer Handoff.
 */
class LocationBridgeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SyncPointLocationBridge"

    init {
        JourneyLocationService.activeLocationListener = { location: Location, shouldPublish: Boolean ->
            val params = Arguments.createMap().apply {
                putDouble("latitude", location.latitude)
                putDouble("longitude", location.longitude)
                putDouble("speedMps", if (location.hasSpeed()) location.speed.toDouble() else 0.0)
                putDouble("heading", if (location.hasBearing()) location.bearing.toDouble() else 0.0)
                putDouble("accuracy", location.accuracy.toDouble())
                putDouble("timestamp", location.time.toDouble())
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

    private fun sendEvent(eventName: String, params: WritableMap) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
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
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_ERROR", e.localizedMessage, e)
        }
    }

    @ReactMethod
    fun pauseTracking(promise: Promise) {
        try {
            val intent = Intent(reactContext, JourneyLocationService::class.java).apply {
                action = JourneyLocationService.ACTION_PAUSE
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PAUSE_ERROR", e.localizedMessage, e)
        }
    }

    @ReactMethod
    fun resumeTracking(promise: Promise) {
        try {
            val intent = Intent(reactContext, JourneyLocationService::class.java).apply {
                action = JourneyLocationService.ACTION_RESUME
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("RESUME_ERROR", e.localizedMessage, e)
        }
    }

    @ReactMethod
    fun finishTracking(promise: Promise) {
        try {
            val intent = Intent(reactContext, JourneyLocationService::class.java).apply {
                action = JourneyLocationService.ACTION_FINISH
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("FINISH_ERROR", e.localizedMessage, e)
        }
    }

    @ReactMethod
    fun getTrackingState(promise: Promise) {
        val state = Arguments.createMap().apply {
            putBoolean("isRunning", JourneyLocationService.isServiceRunning)
            putBoolean("isPaused", JourneyLocationService.isSharingPaused)
        }
        promise.resolve(state)
    }
}
