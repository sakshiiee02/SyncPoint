package com.syncpoint.location

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.IBinder
import androidx.core.app.ServiceCompat

/**
 * Long-running Android Foreground Service ensuring continuous location tracking
 * while journey is ACTIVE, even during device lock screen and background transitions.
 * Matches Section 8.2 of Developer Handoff.
 */
class JourneyLocationService : Service() {

    companion object {
        const val ACTION_START = "com.syncpoint.location.ACTION_START"
        const val ACTION_STOP = "com.syncpoint.location.ACTION_STOP"
        const val ACTION_PAUSE = "com.syncpoint.location.ACTION_PAUSE"
        const val ACTION_RESUME = "com.syncpoint.location.ACTION_RESUME"
        const val ACTION_FINISH = "com.syncpoint.location.ACTION_FINISH"

        const val EXTRA_JOURNEY_ID = "journeyId"
        const val EXTRA_JOURNEY_NAME = "journeyName"
        const val EXTRA_DESTINATION_NAME = "destinationName"

        var isServiceRunning = false
            private set
        var isSharingPaused = false
            private set

        var activeLocationListener: ((Location, Boolean) -> Unit)? = null
        var activeStatusListener: ((String) -> Unit)? = null
    }

    private lateinit var notificationController: NotificationController
    private lateinit var locationEngine: LocationEngine
    private lateinit var samplingPolicy: AdaptiveSamplingPolicy

    private var journeyName: String = "Journey"
    private var destinationName: String = ""

    override fun onCreate() {
        super.onCreate()
        notificationController = NotificationController(this)
        samplingPolicy = AdaptiveSamplingPolicy()

        // Every fix is forwarded, even while sharing is paused: pausing only stops *publishing*
        // (decided in JS), the traveler's own navigation keeps working.
        locationEngine = LocationEngine(this, samplingPolicy) { location, shouldPublish ->
            activeLocationListener?.invoke(location, shouldPublish)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // A null intent means Android restarted us after killing the process. The JS side that
        // consumes location events is gone too, so a zombie service would only burn battery:
        // stop, and let the app re-start tracking when the user reopens it.
        val action = intent?.action
        if (action == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        when (action) {
            ACTION_START -> {
                journeyName = intent.getStringExtra(EXTRA_JOURNEY_NAME) ?: "Road Trip"
                destinationName = intent.getStringExtra(EXTRA_DESTINATION_NAME) ?: "Destination"
                startTracking()
            }
            ACTION_PAUSE -> {
                pauseTracking()
            }
            ACTION_RESUME -> {
                resumeTracking()
            }
            ACTION_STOP, ACTION_FINISH -> {
                finishTracking()
            }
        }

        return START_NOT_STICKY
    }

    private fun startTracking() {
        isServiceRunning = true
        isSharingPaused = false

        val initialNotification = notificationController.buildNotification(
            journeyName = journeyName,
            statusText = "Tracking active • Heading to $destinationName",
            isPaused = false
        )

        // Android 14+ requires specifying FOREGROUND_SERVICE_TYPE_LOCATION
        val foregroundServiceType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
        } else {
            0
        }

        ServiceCompat.startForeground(
            this,
            NotificationController.NOTIFICATION_ID,
            initialNotification,
            foregroundServiceType
        )

        locationEngine.startListening()
        activeStatusListener?.invoke("STARTED")
    }

    private fun pauseTracking() {
        isSharingPaused = true
        notificationController.updateNotification(
            journeyName = journeyName,
            statusText = "Location sharing paused (last known visible)",
            isPaused = true
        )
        activeStatusListener?.invoke("PAUSED")
    }

    private fun resumeTracking() {
        isSharingPaused = false
        notificationController.updateNotification(
            journeyName = journeyName,
            statusText = "Tracking resumed • Heading to $destinationName",
            isPaused = false
        )
        activeStatusListener?.invoke("RESUMED")
    }

    private fun finishTracking() {
        isServiceRunning = false
        locationEngine.stopListening()
        activeStatusListener?.invoke("FINISHED")
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        locationEngine.stopListening()
        isServiceRunning = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
