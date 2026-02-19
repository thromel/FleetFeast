package com.fleetfeast.mobile.shared

import java.nio.file.Files
import kotlin.io.path.exists
import kotlin.io.path.readText
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class JvmOfflineActionStoreTest {
  @Test
  fun file_store_returns_empty_when_file_does_not_exist() {
    val tempDir = Files.createTempDirectory("fleetfeast-offline-store-empty-")
    val filePath = tempDir.resolve("offline-actions.json")
    val store = JvmJsonFileOfflineActionStore(filePath)

    val loaded = store.loadAll()

    assertTrue(loaded.isEmpty())
    assertFalse(filePath.exists())
  }

  @Test
  fun file_store_persists_and_reloads_actions() {
    val tempDir = Files.createTempDirectory("fleetfeast-offline-store-roundtrip-")
    val filePath = tempDir.resolve("offline-actions.json")
    val store = JvmJsonFileOfflineActionStore(filePath)

    val actions = listOf(
      OfflineAction(
        id = "offline-1",
        idempotencyKey = "idem-1",
        intentType = "courier.accept",
        payload = mapOf("jobId" to "job-1"),
        attempts = 1,
        status = OfflineActionStatus.RETRY_SCHEDULED,
      ),
    )

    store.saveAll(actions)

    assertTrue(filePath.exists())
    assertTrue(filePath.readText().contains("\"intentType\":\"courier.accept\""))

    val reloaded = JvmJsonFileOfflineActionStore(filePath).loadAll()
    assertEquals(actions, reloaded)
  }

  @Test
  fun persistent_queue_rehydrates_from_file_store() {
    val tempDir = Files.createTempDirectory("fleetfeast-offline-store-queue-")
    val filePath = tempDir.resolve("offline-actions.json")

    val firstQueue = PersistentOfflineActionQueue(
      store = JvmJsonFileOfflineActionStore(filePath),
      retryPolicy = RetryPolicy(maxAttempts = 3),
    )

    val action = firstQueue.enqueue(
      NewOfflineAction(
        idempotencyKey = "idem-queue-1",
        intentType = "courier.dropoff",
        payload = mapOf("jobId" to "job-2"),
      ),
    )
    val leased = firstQueue.leaseNext()
    assertEquals(action.id, leased?.id)
    firstQueue.markFailed(action.id, retryable = true)

    val secondQueue = PersistentOfflineActionQueue(
      store = JvmJsonFileOfflineActionStore(filePath),
      retryPolicy = RetryPolicy(maxAttempts = 3),
    )
    val rehydrated = secondQueue.snapshot().single()

    assertEquals(action.id, rehydrated.id)
    assertEquals(OfflineActionStatus.RETRY_SCHEDULED, rehydrated.status)
    assertEquals(1, rehydrated.attempts)
  }
}
