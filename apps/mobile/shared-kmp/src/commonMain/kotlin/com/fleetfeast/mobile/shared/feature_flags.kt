package com.fleetfeast.mobile.shared

data class FeatureFlagContext(
  val userId: String,
  val role: String,
  val tenantId: String? = null,
)

interface FeatureFlagSnapshotSource {
  fun fetchSnapshot(context: FeatureFlagContext): FeatureFlagSnapshot
}

interface EpochClock {
  fun nowEpochMillis(): Long
}

class FeatureFlagClient(
  private val source: FeatureFlagSnapshotSource,
  private val clock: EpochClock,
) {
  private val cache = mutableMapOf<String, FeatureFlagSnapshot>()

  fun getSnapshot(context: FeatureFlagContext, forceRefresh: Boolean = false): FeatureFlagSnapshot {
    val cacheKey = cacheKey(context)
    val cached = cache[cacheKey]

    if (!forceRefresh && cached != null && !isExpired(cached)) {
      return cached
    }

    val fetched = source.fetchSnapshot(context)
    cache[cacheKey] = fetched
    return fetched
  }

  fun isEnabled(
    flagKey: String,
    context: FeatureFlagContext,
    defaultValue: Boolean = false,
    forceRefresh: Boolean = false,
  ): Boolean {
    val snapshot = getSnapshot(context, forceRefresh = forceRefresh)
    return snapshot.flags[flagKey] ?: defaultValue
  }

  private fun isExpired(snapshot: FeatureFlagSnapshot): Boolean {
    val expiresAt = snapshot.generatedAtEpochMillis + (snapshot.ttlSeconds * 1000)
    return clock.nowEpochMillis() >= expiresAt
  }

  private fun cacheKey(context: FeatureFlagContext): String {
    return listOf(context.userId, context.role, context.tenantId ?: "-").joinToString("|")
  }
}
