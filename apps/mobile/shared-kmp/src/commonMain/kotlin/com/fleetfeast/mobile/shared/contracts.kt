package com.fleetfeast.mobile.shared

enum class OfflineActionStatus {
  PENDING,
  IN_FLIGHT,
  RETRY_SCHEDULED,
  SUCCEEDED,
  FAILED,
}

data class RetryPolicy(
  val maxAttempts: Int = 5,
)

data class NewOfflineAction(
  val idempotencyKey: String,
  val intentType: String,
  val payload: Map<String, String>,
)

data class OfflineAction(
  val id: String,
  val idempotencyKey: String,
  val intentType: String,
  val payload: Map<String, String>,
  val attempts: Int,
  val status: OfflineActionStatus,
)

data class FeatureFlagSnapshot(
  val flags: Map<String, Boolean>,
  val ttlSeconds: Long,
  val generatedAtEpochMillis: Long,
)

data class AppSessionExchangeRequest(
  val oidcToken: String,
  val traceId: String,
  val deviceId: String? = null,
)

data class AppSessionRefreshRequest(
  val refreshToken: String,
  val traceId: String,
  val deviceId: String? = null,
)

data class AppSession(
  val sessionId: String,
  val userId: String,
  val role: String,
  val persona: String,
  val traceId: String,
  val refreshTokenId: String,
  val issuedAt: String,
  val expiresAt: String,
)

data class AppSessionTokenPair(
  val tokenType: String,
  val accessToken: String,
  val refreshToken: String,
  val expiresInSeconds: Long,
  val refreshExpiresInSeconds: Long,
  val refreshExpiresAt: String,
)

data class AppSessionExchangeResponse(
  val session: AppSession,
  val tokenPair: AppSessionTokenPair,
)

data class ConsumerOrderView(
  val id: String,
  val status: String,
  val timelineVersion: Long,
)

data class CourierJobView(
  val jobId: String,
  val orderId: String,
  val status: String,
)

data class MerchantOrderView(
  val id: String,
  val status: String,
)

data class AdminIncidentView(
  val id: String,
  val severity: String,
)

data class ConsumerOrderPayload(
  val order: ConsumerOrderView,
)

data class CourierJobsPayload(
  val jobs: List<CourierJobView>,
)

data class MerchantOrdersPayload(
  val orders: List<MerchantOrderView>,
)

data class AdminIncidentsPayload(
  val incidents: List<AdminIncidentView>,
)

enum class PushProvider {
  APNS,
  FCM,
}

data class RealtimeEnvelope(
  val eventType: String,
  val entityId: String,
  val occurredAt: String,
  val traceId: String,
  val payload: Map<String, String>,
)

data class RealtimePushRegistrationRequest(
  val channel: String,
  val userId: String,
  val pushToken: String,
  val provider: PushProvider,
)

data class RealtimePushRegistrationResponse(
  val registered: Boolean,
)

data class RealtimePushUnregisterRequest(
  val channel: String,
  val userId: String,
)

data class RealtimePushUnregisterResponse(
  val removed: Boolean,
)

data class RealtimePublishRequest(
  val channel: String,
  val envelope: RealtimeEnvelope,
)

data class RealtimePublishResponse(
  val published: Boolean,
)

interface GeoProvider {
  suspend fun geocode(address: String): GeoCoordinate?
  suspend fun estimateEtaSeconds(origin: GeoCoordinate, destination: GeoCoordinate): Int
  suspend fun distanceMeters(origin: GeoCoordinate, destination: GeoCoordinate): Int
}

data class GeoCoordinate(
  val latitude: Double,
  val longitude: Double,
)

object BffEndpoints {
  const val CONSUMER_BASE = "/app/v1/consumer"
  const val COURIER_BASE = "/app/v1/courier"
  const val OPS_MERCHANT_BASE = "/app/v1/merchant"
  const val OPS_ADMIN_BASE = "/app/v1/admin"
  const val REALTIME_CONNECT = "/app/v1/realtime/connect"
}
