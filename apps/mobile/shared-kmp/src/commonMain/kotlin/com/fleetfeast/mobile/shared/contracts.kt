package com.fleetfeast.mobile.shared

import kotlinx.serialization.Serializable

@Serializable
enum class OfflineActionStatus {
  PENDING,
  IN_FLIGHT,
  RETRY_SCHEDULED,
  SUCCEEDED,
  FAILED,
}

@Serializable
data class RetryPolicy(
  val maxAttempts: Int = 5,
)

@Serializable
data class NewOfflineAction(
  val idempotencyKey: String,
  val intentType: String,
  val payload: Map<String, String>,
)

@Serializable
data class OfflineAction(
  val id: String,
  val idempotencyKey: String,
  val intentType: String,
  val payload: Map<String, String>,
  val attempts: Int,
  val status: OfflineActionStatus,
)

@Serializable
data class FeatureFlagSnapshot(
  val flags: Map<String, Boolean>,
  val ttlSeconds: Long,
  val generatedAtEpochMillis: Long,
)

@Serializable
data class AppSessionExchangeRequest(
  val oidcToken: String,
  val traceId: String,
  val deviceId: String? = null,
)

@Serializable
data class AppSessionRefreshRequest(
  val refreshToken: String,
  val traceId: String,
  val deviceId: String? = null,
)

@Serializable
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

@Serializable
data class AppSessionTokenPair(
  val tokenType: String,
  val accessToken: String,
  val refreshToken: String,
  val expiresInSeconds: Long,
  val refreshExpiresInSeconds: Long,
  val refreshExpiresAt: String,
)

@Serializable
data class AppSessionExchangeResponse(
  val session: AppSession,
  val tokenPair: AppSessionTokenPair,
)

@Serializable
data class ConsumerOrderView(
  val id: String,
  val status: String,
  val timelineVersion: Long,
)

@Serializable
data class CourierJobView(
  val jobId: String,
  val orderId: String,
  val status: String,
)

@Serializable
data class MerchantOrderView(
  val id: String,
  val status: String,
)

@Serializable
data class AdminIncidentView(
  val id: String,
  val severity: String,
)

@Serializable
data class ConsumerOrderPayload(
  val order: ConsumerOrderView,
)

@Serializable
data class CourierJobsPayload(
  val jobs: List<CourierJobView>,
)

@Serializable
data class MerchantOrdersPayload(
  val orders: List<MerchantOrderView>,
)

@Serializable
data class AdminIncidentsPayload(
  val incidents: List<AdminIncidentView>,
)

@Serializable
enum class PushProvider {
  APNS,
  FCM,
}

@Serializable
data class RealtimeEnvelope(
  val eventType: String,
  val entityId: String,
  val occurredAt: String,
  val traceId: String,
  val payload: Map<String, String>,
)

@Serializable
data class RealtimePushRegistrationRequest(
  val channel: String,
  val userId: String,
  val pushToken: String,
  val provider: PushProvider,
)

@Serializable
data class RealtimePushRegistrationResponse(
  val registered: Boolean,
)

@Serializable
data class RealtimePushUnregisterRequest(
  val channel: String,
  val userId: String,
)

@Serializable
data class RealtimePushUnregisterResponse(
  val removed: Boolean,
)

@Serializable
data class RealtimePublishRequest(
  val channel: String,
  val envelope: RealtimeEnvelope,
)

@Serializable
data class RealtimePublishResponse(
  val published: Boolean,
)

interface GeoProvider {
  suspend fun geocode(address: String): GeoCoordinate?
  suspend fun estimateEtaSeconds(origin: GeoCoordinate, destination: GeoCoordinate): Int
  suspend fun distanceMeters(origin: GeoCoordinate, destination: GeoCoordinate): Int
}

@Serializable
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
