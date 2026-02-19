package com.fleetfeast.mobile.shared

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class CourierWorkflowServiceTest {
  @Test
  fun flushes_offline_action_when_replay_flag_enabled() {
    val queueStore = InMemoryOfflineActionStore()
    val queue = PersistentOfflineActionQueue(queueStore)

    val featureFlags = FeatureFlagClient(
      source = StaticSnapshotSource(
        FeatureFlagSnapshot(
          flags = mapOf("courier.offlineReplay" to true),
          ttlSeconds = 300,
          generatedAtEpochMillis = 1_000,
        ),
      ),
      clock = FixedClock(now = 1_000),
    )

    val service = CourierWorkflowService(
      queue = queue,
      featureFlagClient = featureFlags,
      featureFlagContext = FeatureFlagContext(userId = "courier-1", role = "courier"),
    )

    service.enqueueOfflineAction(
      idempotencyKey = "idem-workflow-1",
      intentType = "pickup",
      payload = mapOf("orderId" to "order-1"),
    )

    val flushed = service.flushNextOfflineAction { true }
    assertNotNull(flushed)
    assertEquals(OfflineActionStatus.SUCCEEDED, flushed.status)
  }

  @Test
  fun leaves_queue_untouched_when_replay_flag_disabled() {
    val queueStore = InMemoryOfflineActionStore()
    val queue = PersistentOfflineActionQueue(queueStore)

    val featureFlags = FeatureFlagClient(
      source = StaticSnapshotSource(
        FeatureFlagSnapshot(
          flags = mapOf("courier.offlineReplay" to false),
          ttlSeconds = 300,
          generatedAtEpochMillis = 1_000,
        ),
      ),
      clock = FixedClock(now = 1_000),
    )

    val service = CourierWorkflowService(
      queue = queue,
      featureFlagClient = featureFlags,
      featureFlagContext = FeatureFlagContext(userId = "courier-1", role = "courier"),
    )

    service.enqueueOfflineAction(
      idempotencyKey = "idem-workflow-2",
      intentType = "dropoff",
      payload = mapOf("orderId" to "order-2"),
    )

    val flushed = service.flushNextOfflineAction { true }
    assertNull(flushed)
    assertEquals(OfflineActionStatus.PENDING, queue.snapshot().single().status)
  }

  @Test
  fun schedules_retry_when_dispatch_fails() {
    val queueStore = InMemoryOfflineActionStore()
    val queue = PersistentOfflineActionQueue(queueStore, retryPolicy = RetryPolicy(maxAttempts = 3))

    val featureFlags = FeatureFlagClient(
      source = StaticSnapshotSource(
        FeatureFlagSnapshot(
          flags = mapOf("courier.offlineReplay" to true),
          ttlSeconds = 300,
          generatedAtEpochMillis = 1_000,
        ),
      ),
      clock = FixedClock(now = 1_000),
    )

    val service = CourierWorkflowService(
      queue = queue,
      featureFlagClient = featureFlags,
      featureFlagContext = FeatureFlagContext(userId = "courier-2", role = "courier"),
    )

    service.enqueueOfflineAction(
      idempotencyKey = "idem-workflow-3",
      intentType = "accept",
      payload = mapOf("jobId" to "job-3"),
    )

    val flushed = service.flushNextOfflineAction { false }
    assertNotNull(flushed)
    assertEquals(OfflineActionStatus.RETRY_SCHEDULED, flushed.status)
  }
}

private class StaticSnapshotSource(
  private val snapshot: FeatureFlagSnapshot,
) : FeatureFlagSnapshotSource {
  override fun fetchSnapshot(context: FeatureFlagContext): FeatureFlagSnapshot {
    return snapshot
  }
}

private class FixedClock(
  private val now: Long,
) : EpochClock {
  override fun nowEpochMillis(): Long {
    return now
  }
}
