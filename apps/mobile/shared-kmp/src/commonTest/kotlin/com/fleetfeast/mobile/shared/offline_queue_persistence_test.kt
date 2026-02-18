package com.fleetfeast.mobile.shared

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class PersistentOfflineActionQueueTest {
  @Test
  fun queue_state_survives_rehydration_from_store() {
    val store = InMemoryOfflineActionStore()

    val firstInstance = PersistentOfflineActionQueue(
      store = store,
      retryPolicy = RetryPolicy(maxAttempts = 3),
    )

    val action = firstInstance.enqueue(
      NewOfflineAction(
        idempotencyKey = "idem-persist-1",
        intentType = "pickup",
        payload = mapOf("orderId" to "order-persist-1"),
      ),
    )

    val firstLease = firstInstance.leaseNext()
    assertNotNull(firstLease)
    assertEquals(1, firstLease.attempts)
    firstInstance.markFailed(action.id, retryable = true)

    val secondInstance = PersistentOfflineActionQueue(
      store = store,
      retryPolicy = RetryPolicy(maxAttempts = 3),
    )

    val secondLease = secondInstance.leaseNext()
    assertNotNull(secondLease)
    assertEquals(action.id, secondLease.id)
    assertEquals(2, secondLease.attempts)

    secondInstance.markSucceeded(action.id)

    val thirdInstance = PersistentOfflineActionQueue(
      store = store,
      retryPolicy = RetryPolicy(maxAttempts = 3),
    )
    assertNull(thirdInstance.leaseNext())
  }

  @Test
  fun queue_id_sequence_continues_after_restart() {
    val store = InMemoryOfflineActionStore()

    val firstInstance = PersistentOfflineActionQueue(store = store)
    firstInstance.enqueue(
      NewOfflineAction(
        idempotencyKey = "idem-seq-1",
        intentType = "accept",
        payload = mapOf("jobId" to "job-seq-1"),
      ),
    )
    firstInstance.enqueue(
      NewOfflineAction(
        idempotencyKey = "idem-seq-2",
        intentType = "dropoff",
        payload = mapOf("jobId" to "job-seq-2"),
      ),
    )

    val secondInstance = PersistentOfflineActionQueue(store = store)
    val thirdAction = secondInstance.enqueue(
      NewOfflineAction(
        idempotencyKey = "idem-seq-3",
        intentType = "dropoff",
        payload = mapOf("jobId" to "job-seq-3"),
      ),
    )

    assertEquals("offline-3", thirdAction.id)
  }
}
