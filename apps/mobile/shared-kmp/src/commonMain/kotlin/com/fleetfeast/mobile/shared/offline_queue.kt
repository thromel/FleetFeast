package com.fleetfeast.mobile.shared

class OfflineActionQueue(
  private val retryPolicy: RetryPolicy = RetryPolicy(),
  initialActions: List<OfflineAction> = emptyList(),
) {
  private val actions = linkedMapOf<String, OfflineAction>()
  private val idempotencyIndex = mutableMapOf<String, String>()
  private var nextSequence = initializeSequence(initialActions)

  init {
    for (action in initialActions) {
      actions[action.id] = action
      idempotencyIndex[action.idempotencyKey] = action.id
    }
  }

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

  private fun initializeSequence(initialActions: List<OfflineAction>): Long {
    val maxSequence = initialActions
      .mapNotNull { action ->
        action.id
          .removePrefix("offline-")
          .toLongOrNull()
      }
      .maxOrNull()

    return if (maxSequence == null) {
      1L
    } else {
      maxSequence + 1L
    }
  }
}

interface OfflineActionStore {
  fun loadAll(): List<OfflineAction>
  fun saveAll(actions: List<OfflineAction>)
}

class InMemoryOfflineActionStore(
  initialActions: List<OfflineAction> = emptyList(),
) : OfflineActionStore {
  private var persistedActions: List<OfflineAction> = initialActions.toList()

  override fun loadAll(): List<OfflineAction> {
    return persistedActions.toList()
  }

  override fun saveAll(actions: List<OfflineAction>) {
    persistedActions = actions.toList()
  }
}

class PersistentOfflineActionQueue(
  private val store: OfflineActionStore,
  retryPolicy: RetryPolicy = RetryPolicy(),
) {
  private val queue = OfflineActionQueue(
    retryPolicy = retryPolicy,
    initialActions = store.loadAll(),
  )

  fun enqueue(input: NewOfflineAction): OfflineAction {
    val action = queue.enqueue(input)
    persist()
    return action
  }

  fun leaseNext(): OfflineAction? {
    val leased = queue.leaseNext()
    if (leased != null) {
      persist()
    }

    return leased
  }

  fun markSucceeded(actionId: String): Boolean {
    val updated = queue.markSucceeded(actionId)
    if (updated) {
      persist()
    }

    return updated
  }

  fun markFailed(actionId: String, retryable: Boolean): Boolean {
    val updated = queue.markFailed(actionId, retryable)
    if (updated) {
      persist()
    }

    return updated
  }

  fun snapshot(): List<OfflineAction> {
    return queue.snapshot()
  }

  private fun persist() {
    store.saveAll(queue.snapshot())
  }
}
