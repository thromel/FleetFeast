package com.fleetfeast.consumer

/**
 * Lightweight shell placeholder while full Compose app wiring is in progress.
 */
class ConsumerAppShell(
  private val bffBaseUrl: String,
) {
  fun startupSummary(): String {
    return "Consumer Android shell configured for $bffBaseUrl"
  }
}
