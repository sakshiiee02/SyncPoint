package com.syncpoint.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

/**
 * Receives device location. Prefers Google's Fused Location Provider (better accuracy and
 * battery use) and falls back to the platform LocationManager on devices without Play Services.
 * The sampling policy decides which fixes are worth publishing; every fix is still forwarded so
 * the traveler's own navigation stays smooth.
 */
class LocationEngine(
    context: Context,
    private val policy: AdaptiveSamplingPolicy,
    private val onLocationEvaluated: (location: Location, shouldPublish: Boolean) -> Unit
) : LocationListener {

    companion object {
        private const val SAMPLE_INTERVAL_MS = 1000L
        private const val MAX_USABLE_ACCURACY_M = 500f
    }

    private val appContext = context.applicationContext
    private val locationManager = appContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val fusedClient = LocationServices.getFusedLocationProviderClient(appContext)

    private var isListening = false
    private var platformFallbackActive = false
    private var lastLocation: Location? = null

    private val fusedCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            for (location in result.locations) handle(location)
        }
    }

    @SuppressLint("MissingPermission")
    fun startListening() {
        if (isListening) return
        isListening = true

        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, SAMPLE_INTERVAL_MS)
            .setMinUpdateIntervalMillis(SAMPLE_INTERVAL_MS)
            .build()

        try {
            fusedClient.requestLocationUpdates(request, fusedCallback, Looper.getMainLooper())
                .addOnFailureListener { startPlatformUpdates() }
        } catch (e: Exception) {
            startPlatformUpdates()
        }
    }

    @SuppressLint("MissingPermission")
    private fun startPlatformUpdates() {
        if (!isListening || platformFallbackActive) return
        platformFallbackActive = true

        val provider = when {
            locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> LocationManager.PASSIVE_PROVIDER
        }
        locationManager.requestLocationUpdates(provider, SAMPLE_INTERVAL_MS, 0f, this, Looper.getMainLooper())
    }

    fun stopListening() {
        if (!isListening) return
        isListening = false
        fusedClient.removeLocationUpdates(fusedCallback)
        if (platformFallbackActive) {
            locationManager.removeUpdates(this)
            platformFallbackActive = false
        }
        lastLocation = null
        policy.reset()
    }

    private fun handle(location: Location) {
        if (location.hasAccuracy() && location.accuracy > MAX_USABLE_ACCURACY_M) return

        val prev = lastLocation
        val distanceMovedM = if (prev != null) location.distanceTo(prev) else 0f
        val speedMps = if (location.hasSpeed()) location.speed else 0f
        val heading = if (location.hasBearing()) location.bearing else 0f

        val shouldPublish = policy.shouldPublish(
            currentTimeMs = System.currentTimeMillis(),
            lat = location.latitude,
            lng = location.longitude,
            speedMps = speedMps,
            heading = heading,
            distanceMovedM = distanceMovedM
        )

        lastLocation = location
        onLocationEvaluated(location, shouldPublish)
    }

    override fun onLocationChanged(location: Location) = handle(location)

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}
}
