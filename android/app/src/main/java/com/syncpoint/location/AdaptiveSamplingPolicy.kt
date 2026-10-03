package com.syncpoint.location

/**
 * Adaptive sampling policy governing location sampling and publication frequency
 * based on vehicle/traveler velocity and distance delta.
 * Matches Section 8.4 and Section 32 of Developer Handoff.
 */
enum class MotionState {
    FAST,        // > 50 km/h (highway driving)
    NORMAL,      // 15 - 50 km/h (city driving)
    SLOW,        // 3 - 15 km/h (congested or cycling/walking)
    STATIONARY   // < 3 km/h (stopped)
}

class AdaptiveSamplingPolicy {
    companion object {
        const val FAST_INTERVAL_MS = 2500L
        const val NORMAL_INTERVAL_MS = 5000L
        const val SLOW_INTERVAL_MS = 8000L
        const val STATIONARY_INTERVAL_MS = 25000L

        const val MIN_PUBLISH_DISTANCE_M = 30.0f
        const val MIN_ELAPSED_FOR_DISTANCE_MS = 1500L
        const val HEADING_CHANGE_THRESHOLD_DEG = 25.0f
    }

    private var lastPublishedTimeMs: Long = 0
    private var lastPublishedLat: Double = 0.0
    private var lastPublishedLng: Double = 0.0
    private var lastPublishedHeading: Float = 0.0f

    fun determineMotionState(speedMps: Float): MotionState {
        return when {
            speedMps > 13.88f -> MotionState.FAST
            speedMps > 4.16f -> MotionState.NORMAL
            speedMps > 0.83f -> MotionState.SLOW
            else -> MotionState.STATIONARY
        }
    }

    fun getTargetIntervalMs(state: MotionState): Long {
        return when (state) {
            MotionState.FAST -> FAST_INTERVAL_MS
            MotionState.NORMAL -> NORMAL_INTERVAL_MS
            MotionState.SLOW -> SLOW_INTERVAL_MS
            MotionState.STATIONARY -> STATIONARY_INTERVAL_MS
        }
    }

    fun shouldPublish(
        currentTimeMs: Long,
        lat: Double,
        lng: Double,
        speedMps: Float,
        heading: Float,
        distanceMovedM: Float
    ): Boolean {
        if (lastPublishedTimeMs == 0L) {
            recordPublish(currentTimeMs, lat, lng, heading)
            return true
        }

        val elapsedMs = currentTimeMs - lastPublishedTimeMs
        val state = determineMotionState(speedMps)
        val targetIntervalMs = getTargetIntervalMs(state)

        // 1. Time interval elapsed
        if (elapsedMs >= targetIntervalMs) {
            recordPublish(currentTimeMs, lat, lng, heading)
            return true
        }

        // 2. Significant distance moved and minimum throttle time elapsed
        if (distanceMovedM >= MIN_PUBLISH_DISTANCE_M && elapsedMs >= MIN_ELAPSED_FOR_DISTANCE_MS) {
            recordPublish(currentTimeMs, lat, lng, heading)
            return true
        }

        // 3. Significant heading change while moving
        if (state != MotionState.STATIONARY && elapsedMs >= MIN_ELAPSED_FOR_DISTANCE_MS) {
            val headingDelta = Math.abs(heading - lastPublishedHeading)
            val normalizedDelta = if (headingDelta > 180f) 360f - headingDelta else headingDelta
            if (normalizedDelta >= HEADING_CHANGE_THRESHOLD_DEG) {
                recordPublish(currentTimeMs, lat, lng, heading)
                return true
            }
        }

        return false
    }

    private fun recordPublish(timeMs: Long, lat: Double, lng: Double, heading: Float) {
        lastPublishedTimeMs = timeMs
        lastPublishedLat = lat
        lastPublishedLng = lng
        lastPublishedHeading = heading
    }

    fun reset() {
        lastPublishedTimeMs = 0
        lastPublishedLat = 0.0
        lastPublishedLng = 0.0
        lastPublishedHeading = 0.0f
    }
}
