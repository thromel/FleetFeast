package com.fleetfeast.mobile.shared

class OfflineActionQueue(
  private val retryPolicy: RetryPolicy = RetryPolicy(),
) {
  private val actions = linkedMapOf<String, OfflineAction>()
  private val idempotencyIndex = mutableMapOf<String, String>()
  private var nextSequence = 1L

  fun enqueue(input: NewOfflineAction): OfflineAction {
    val existingId = idempotencyIndex[input.idempotencyKey]
    if (existingId != null) {
      val existing = actions[existingId]
      if (existing != null) {
        return existing
      }
    }

    val action = OfflineAction(
      id = "offline-${nextSequence++}",
      idempotencyKey = input.idempotencyKey,
      intentType = input.intentType,
      payload = input.payload,
      attempts = 0,
      status = OfflineActionStatus.PENDING,
    )

    actions[action.id] = action
    idempotencyIndex[action.idempotencyKey] = action.id
    return action
  }

  fun leaseNext(): OfflineAction? {
    val candidate = actions.values.firstOrNull {
      it.status == OfflineActionStatus.PENDING || it.status == OfflineActionStatus.RETRY_SCHEDULED
    } ?: return null

    val leased = candidate.copy(
      attempts = candidate.attempts + 1,
      status = OfflineActionStatus.IN_FLIGHT,
    )
    actions[leased.id] = leased
    return leased
  }

  fun markSucceeded(actionId: String): Boolean {
    val current = actions[actionId] ?: return false
    actions[actionId] = current.copy(status = OfflineActionStatus.SUCCEEDED)
    return true
  }

  fun markFailed(actionId: String, retryable: Boolean): Boolean {
    val current = actions[actionId] ?: return false

    val nextStatus = if (
      retryable &&
      current.attempts < retryPolicy.maxAttempts
    ) {
      OfflineActionStatus.RETRY_SCHEDULED
    } else {
      OfflineActionStatus.FAILED
    }

    actions[actionId] = current.copy(status = nextStatus)
    return true
  }

  fun snapshot(): List<OfflineAction> {
    return actions.values.toList()
  }
}
