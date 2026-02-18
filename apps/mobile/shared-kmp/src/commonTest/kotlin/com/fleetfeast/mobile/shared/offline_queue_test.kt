package com.fleetfeast.mobile.shared

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class OfflineActionQueueTest {
  @Test
  fun enqueue_deduplicates_by_idempotency_key() {
    val queue = OfflineActionQueue()

    val first = queue.enqueue(
      NewOfflineAction(
        idempotencyKey = "idem-1",
        intentType = "pickup",
        payload = mapOf("orderId" to "order-1"),
      ),
    )
    val second = queue.enqueue(
      NewOfflineAction(
        idempotencyKey = "idem-1",
        intentType = "pickup",
        payload = mapOf("orderId" to "order-1"),
      ),
    )

    assertEquals(first.id, second.id)
    assertEquals(1, queue.snapshot().size)
  }

  @Test
  fun failed_retryable_action_reenters_queue_until_succeeded() {
    val queue = OfflineActionQueue(retryPolicy = RetryPolicy(maxAttempts = 3))

    val action = queue.enqueue(
      NewOfflineAction(
        idempotencyKey = "idem-2",
        intentType = "dropoff",
        payload = mapOf("orderId" to "order-2"),
      ),
    )

    val firstLease = queue.leaseNext()
    assertNotNull(firstLease)
    assertEquals(action.id, firstLease.id)
    assertEquals(1, firstLease.attempts)

    queue.markFailed(action.id, retryable = true)

    val secondLease = queue.leaseNext()
    assertNotNull(secondLease)
    assertEquals(action.id, secondLease.id)
    assertEquals(2, secondLease.attempts)

    queue.markSucceeded(action.id)
    assertNull(queue.leaseNext())
  }

  @Test
  fun failed_non_retryable_action_does_not_reenter_queue() {
    val queue = OfflineActionQueue(retryPolicy = RetryPolicy(maxAttempts = 2))

    val action = queue.enqueue(
      NewOfflineAction(
        idempotencyKey = "idem-3",
        intentType = "accept",
        payload = mapOf("jobId" to "job-3"),
      ),
    )

    val lease = queue.leaseNext()
    assertNotNull(lease)
    assertEquals(action.id, lease.id)

    queue.markFailed(action.id, retryable = false)
    assertNull(queue.leaseNext())

    val finalStatus = queue.snapshot().first { it.id == action.id }.status
    assertEquals(OfflineActionStatus.FAILED, finalStatus)
  }
}
