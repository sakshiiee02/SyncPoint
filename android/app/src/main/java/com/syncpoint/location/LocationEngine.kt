package com.syncpoint.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper

/**
 * Manages raw device location updates from Fused Location or LocationManager.
 * Matches Section 8.1 of Developer Handoff.
 */
class LocationEngine(
    private val context: Context,
    private val policy: AdaptiveSamplingPolicy,
    private val onLocationEvaluated: (location: Location, shouldPublish: Boolean) -> Unit
) : LocationListener {

    private val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private var isListening = false
    private var lastLocation: Location? = null

    @SuppressLint("MissingPermission")
    fun startListening() {
        if (isListening) return

        val hasGps = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
        val hasNetwork = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

        val provider = when {
            hasGps -> LocationManager.GPS_PROVIDER
            hasNetwork -> LocationManager.NETWORK_PROVIDER
            else -> LocationManager.PASSIVE_PROVIDER
        }

        // Request at highest responsiveness; AdaptiveSamplingPolicy gates network publication
        locationManager.requestLocationUpdates(
            provider,
            1000L, // 1 sec minimum sample rate
            0f,
            this,
            Looper.getMainLooper()
        )

        isListening = true
    }

    fun stopListening() {
        if (!isListening) return
        locationManager.removeUpdates(this)
        isListening = false
        lastLocation = null
        policy.reset()
    }

    override fun onLocationChanged(location: Location) {
        val currentTimeMs = System.currentTimeMillis()
        val prev = lastLocation

        val distanceMovedM = if (prev != null) location.distanceTo(prev) else 0f
        val speedMps = if (location.hasSpeed()) location.speed else 0f
        val heading = if (location.hasBearing()) location.bearing else 0f

        val shouldPublish = policy.shouldPublish(
            currentTimeMs = currentTimeMs,
            lat = location.latitude,
            lng = location.longitude,
            speedMps = speedMps,
            heading = heading,
            distanceMovedM = distanceMovedM
        )

        lastLocation = location
        onLocationEvaluated(location, shouldPublish)
    }

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}
}
