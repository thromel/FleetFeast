package com.fleetfeast.mobile.shared

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class FeatureFlagClientTest {
  @Test
  fun returns_cached_snapshot_when_ttl_is_valid() {
    val clock = FakeClock(now = 1_000)
    val source = FakeFlagSource(
      snapshots = listOf(
        FeatureFlagSnapshot(
          flags = mapOf("courier.offlineReplay" to true),
          ttlSeconds = 60,
          generatedAtEpochMillis = 1_000,
        ),
      ),
    )

    val client = FeatureFlagClient(source = source, clock = clock)
    val context = FeatureFlagContext(userId = "courier-1", role = "courier")

    val first = client.getSnapshot(context)
    val second = client.getSnapshot(context)

    assertEquals(first, second)
    assertEquals(1, source.fetchCount)
    assertTrue(client.isEnabled("courier.offlineReplay", context))
  }

  @Test
  fun refreshes_snapshot_after_ttl_expiry() {
    val clock = FakeClock(now = 2_000)
    val source = FakeFlagSource(
      snapshots = listOf(
        FeatureFlagSnapshot(
          flags = mapOf("consumer.newCheckout" to false),
          ttlSeconds = 1,
          generatedAtEpochMillis = 2_000,
        ),
        FeatureFlagSnapshot(
          flags = mapOf("consumer.newCheckout" to true),
          ttlSeconds = 60,
          generatedAtEpochMillis = 4_000,
        ),
      ),
    )

    val client = FeatureFlagClient(source = source, clock = clock)
    val context = FeatureFlagContext(userId = "consumer-1", role = "consumer")

    assertFalse(client.isEnabled("consumer.newCheckout", context))
    assertEquals(1, source.fetchCount)

    clock.now = 4_000
    assertTrue(client.isEnabled("consumer.newCheckout", context))
    assertEquals(2, source.fetchCount)
  }

  @Test
  fun force_refresh_bypasses_cache() {
    val clock = FakeClock(now = 3_000)
    val source = FakeFlagSource(
      snapshots = listOf(
        FeatureFlagSnapshot(
          flags = mapOf("ops.bulkActions" to false),
          ttlSeconds = 120,
          generatedAtEpochMillis = 3_000,
        ),
        FeatureFlagSnapshot(
          flags = mapOf("ops.bulkActions" to true),
          ttlSeconds = 120,
          generatedAtEpochMillis = 3_001,
        ),
      ),
    )

    val client = FeatureFlagClient(source = source, clock = clock)
    val context = FeatureFlagContext(userId = "ops-1", role = "system_admin")

    assertFalse(client.isEnabled("ops.bulkActions", context))
    assertTrue(client.isEnabled("ops.bulkActions", context, forceRefresh = true))
    assertEquals(2, source.fetchCount)
  }

  @Test
  fun courier_bff_snapshot_source_fetches_flags_using_context_query() {
    val transport = RecordingFeatureFlagTransport(
      snapshot = FeatureFlagSnapshot(
        flags = mapOf("courier.offlineReplay" to true),
        ttlSeconds = 30,
        generatedAtEpochMillis = 9_000,
      ),
    )
    val source = CourierBffFeatureFlagSnapshotSource(
      courierClient = CourierBffClient(transport),
    )

    val snapshot = source.fetchSnapshot(
      FeatureFlagContext(
        userId = "courier-9",
        role = "courier",
        tenantId = "fleet-9",
      ),
    )

    assertEquals(true, snapshot.flags["courier.offlineReplay"])
    assertEquals("/app/v1/courier/feature-flags", transport.lastRequestPath)
    assertEquals("courier-9", transport.lastRequestQuery["userId"])
    assertEquals("courier", transport.lastRequestQuery["role"])
    assertEquals("fleet-9", transport.lastRequestQuery["tenantId"])
  }

  @Test
  fun consumer_bff_snapshot_source_fetches_flags_using_context_query() {
    val transport = RecordingFeatureFlagTransport(
      snapshot = FeatureFlagSnapshot(
        flags = mapOf("consumer.timelineV2" to true),
        ttlSeconds = 40,
        generatedAtEpochMillis = 9_100,
      ),
    )
    val source = ConsumerBffFeatureFlagSnapshotSource(
      consumerClient = ConsumerBffClient(transport),
    )

    val snapshot = source.fetchSnapshot(
      FeatureFlagContext(
        userId = "consumer-7",
        role = "consumer",
        tenantId = "metro-7",
      ),
    )

    assertEquals(true, snapshot.flags["consumer.timelineV2"])
    assertEquals("/app/v1/consumer/feature-flags", transport.lastRequestPath)
    assertEquals("consumer-7", transport.lastRequestQuery["userId"])
    assertEquals("consumer", transport.lastRequestQuery["role"])
    assertEquals("metro-7", transport.lastRequestQuery["tenantId"])
  }
}

private class FakeClock(
  var now: Long,
) : EpochClock {
  override fun nowEpochMillis(): Long {
    return now
  }
}

private class FakeFlagSource(
  snapshots: List<FeatureFlagSnapshot>,
) : FeatureFlagSnapshotSource {
  private val queue = ArrayDeque(snapshots)
  var fetchCount: Int = 0
    private set

  override fun fetchSnapshot(context: FeatureFlagContext): FeatureFlagSnapshot {
    fetchCount += 1
    return queue.removeFirstOrNull() ?: FeatureFlagSnapshot(
      flags = emptyMap(),
      ttlSeconds = 30,
      generatedAtEpochMillis = 0,
    )
  }
}

private class RecordingFeatureFlagTransport(
  private val snapshot: FeatureFlagSnapshot,
) : BffTransport {
  var lastRequestPath: String = ""
    private set
  var lastRequestQuery: Map<String, String> = emptyMap()
    private set

  override fun send(request: BffRequest): BffResponse {
    lastRequestPath = request.path
    lastRequestQuery = request.query

    return BffResponse(
      statusCode = 200,
      body = snapshot,
    )
  }
}
