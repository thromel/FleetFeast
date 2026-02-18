package com.fleetfeast.courier

/**
 * Lightweight shell placeholder while full Compose courier workflows are implemented.
 */
class CourierAppShell(
  private val bffBaseUrl: String,
  private val realtimeBaseUrl: String,
) {
  fun startupSummary(): String {
    return "Courier Android shell configured for $bffBaseUrl with realtime $realtimeBaseUrl"
  }
}
