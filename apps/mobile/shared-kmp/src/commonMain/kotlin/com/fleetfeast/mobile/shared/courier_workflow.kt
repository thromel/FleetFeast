package com.fleetfeast.mobile.shared

class CourierWorkflowService(
  private val queue: PersistentOfflineActionQueue,
  private val featureFlagClient: FeatureFlagClient,
  private val featureFlagContext: FeatureFlagContext,
) {
  fun enqueueOfflineAction(
    idempotencyKey: String,
    intentType: String,
    payload: Map<String, String>,
  ): OfflineAction {
    return queue.enqueue(
      NewOfflineAction(
        idempotencyKey = idempotencyKey,
        intentType = intentType,
        payload = payload,
      ),
    )
  }

  fun flushNextOfflineAction(
    dispatch: (OfflineAction) -> Boolean,
  ): OfflineAction? {
    val offlineReplayEnabled = featureFlagClient.isEnabled(
      flagKey = "courier.offlineReplay",
      context = featureFlagContext,
      defaultValue = false,
    )
    if (!offlineReplayEnabled) {
      return null
    }

    val leased = queue.leaseNext() ?: return null
    val delivered = dispatch(leased)

    if (delivered) {
      queue.markSucceeded(leased.id)
    } else {
      queue.markFailed(leased.id, retryable = true)
    }

    return queue.snapshot().firstOrNull { it.id == leased.id }
  }
}
