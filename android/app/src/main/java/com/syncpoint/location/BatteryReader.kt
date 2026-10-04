package com.syncpoint.location

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager

/** Reads the device's real battery state from the sticky ACTION_BATTERY_CHANGED broadcast. */
object BatteryReader {

    data class Reading(val percent: Int, val isCharging: Boolean)

    /** Returns null if the platform does not report a level (percent would otherwise be a guess). */
    fun read(context: Context): Reading? {
        val intent: Intent? = context.applicationContext.registerReceiver(
            null,
            IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        )
        if (intent == null) return null

        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        if (level < 0 || scale <= 0) return null

        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL

        val percent = Math.round(level * 100f / scale).coerceIn(0, 100)
        return Reading(percent, charging)
    }
}
