package com.fleetfeast.mobile.consumer

import java.net.HttpURLConnection
import java.net.URI
import java.net.URLEncoder
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

data class HttpTransportRequest(
  val method: String,
  val url: String,
  val headers: Map<String, String> = emptyMap(),
  val body: String? = null,
)

data class HttpTransportResponse(
  val statusCode: Int,
  val body: String? = null,
)

interface HttpTransport {
  fun execute(request: HttpTransportRequest): HttpTransportResponse
}

class UrlConnectionHttpTransport : HttpTransport {
  override fun execute(request: HttpTransportRequest): HttpTransportResponse {
    val connection = URI.create(request.url).toURL().openConnection() as HttpURLConnection
    connection.requestMethod = request.method
    connection.connectTimeout = 10_000
    connection.readTimeout = 10_000

    request.headers.forEach { (name, value) ->
      connection.setRequestProperty(name, value)
    }

    if (request.body != null) {
      connection.doOutput = true
      connection.outputStream.use { output ->
        output.write(request.body.encodeToByteArray())
      }
    }

    val status = connection.responseCode
    val stream = if (status in 200..299) connection.inputStream else connection.errorStream
    val body = stream?.use { input ->
      input.readBytes().decodeToString()
    }

    connection.disconnect()
    return HttpTransportResponse(statusCode = status, body = body)
  }
}

@Serializable
data class ConsumerOrder(
  val id: String,
  val status: String,
  val timelineVersion: Int,
)

@Serializable
data class ConsumerQuickOrderModifier(
  val name: String,
  val priceCents: Int,
)

@Serializable
data class ConsumerQuickOrderItem(
  val itemId: String,
  val name: String,
  val quantity: Int,
  val unitPriceCents: Int,
  val modifiers: List<ConsumerQuickOrderModifier>,
)

@Serializable
data class FeatureFlagSnapshot(
  val flags: Map<String, Boolean>,
  val ttlSeconds: Int,
  val generatedAtEpochMillis: Long,
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
  val expiresInSeconds: Int,
  val refreshExpiresInSeconds: Int,
  val refreshExpiresAt: String,
)

@Serializable
data class SessionExchangeResponse(
  val session: AppSession,
  val tokenPair: AppSessionTokenPair,
)

@Serializable
private data class ConsumerOrderPayload(
  val order: ConsumerOrder,
)

@Serializable
private data class ConsumerQuickCreateOrderRequest(
  val consumerId: String,
  val merchantId: String,
  val currency: String,
  val item: ConsumerQuickOrderItem,
)

@Serializable
private data class ConsumerSessionExchangeRequest(
  val oidcToken: String,
  val traceId: String,
  val deviceId: String,
)

@Serializable
private data class ConsumerSessionRefreshRequest(
  val refreshToken: String,
  val traceId: String,
  val deviceId: String,
)

class ConsumerBackendClient(
  private val baseUrl: String,
  private val transport: HttpTransport = UrlConnectionHttpTransport(),
) {
  private val json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
  }

  init {
    require(baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
      "baseUrl must be a valid http/https URL"
    }
  }

  fun fetchOrder(orderId: String): ConsumerOrder {
    val response = executeGet("/app/v1/consumer/orders/$orderId")
    return json.decodeFromString<ConsumerOrderPayload>(response.body ?: "{}").order
  }

  fun createQuickOrder(
    consumerId: String,
    merchantId: String,
    currency: String,
    item: ConsumerQuickOrderItem,
  ): ConsumerOrder {
    val requestBody = ConsumerQuickCreateOrderRequest(
      consumerId = consumerId,
      merchantId = merchantId,
      currency = currency,
      item = item,
    )
    val response = executePost(
      path = "/app/v1/consumer/orders/quick-create",
      body = json.encodeToString(requestBody),
    )
    return json.decodeFromString<ConsumerOrderPayload>(response.body ?: "{}").order
  }

  fun fetchFeatureFlags(
    userId: String,
    role: String,
    tenantId: String?,
  ): FeatureFlagSnapshot {
    val query = linkedMapOf(
      "userId" to userId,
      "role" to role,
    )
    if (tenantId != null) {
      query["tenantId"] = tenantId
    }

    val response = executeGet(
      path = "/app/v1/consumer/feature-flags",
      query = query,
    )
    return json.decodeFromString(response.body ?: "{}")
  }

  fun exchangeSession(
    oidcToken: String,
    traceId: String,
    deviceId: String,
  ): SessionExchangeResponse {
    val requestBody = ConsumerSessionExchangeRequest(
      oidcToken = oidcToken,
      traceId = traceId,
      deviceId = deviceId,
    )
    val response = executePost(
      path = "/app/v1/consumer/session/exchange",
      body = json.encodeToString(requestBody),
    )
    return json.decodeFromString(response.body ?: "{}")
  }

  fun refreshSession(
    refreshToken: String,
    traceId: String,
    deviceId: String,
  ): SessionExchangeResponse {
    val requestBody = ConsumerSessionRefreshRequest(
      refreshToken = refreshToken,
      traceId = traceId,
      deviceId = deviceId,
    )
    val response = executePost(
      path = "/app/v1/consumer/session/refresh",
      body = json.encodeToString(requestBody),
    )
    return json.decodeFromString(response.body ?: "{}")
  }

  private fun executeGet(path: String, query: Map<String, String> = emptyMap()): HttpTransportResponse {
    val response = transport.execute(
      HttpTransportRequest(
        method = "GET",
        url = buildUrl(path, query),
      ),
    )

    if (response.statusCode !in 200..299) {
      throw IllegalStateException("Request failed with status ${response.statusCode} for $path")
    }

    return response
  }

  private fun executePost(path: String, body: String): HttpTransportResponse {
    val response = transport.execute(
      HttpTransportRequest(
        method = "POST",
        url = buildUrl(path, emptyMap()),
        headers = mapOf("content-type" to "application/json"),
        body = body,
      ),
    )

    if (response.statusCode !in 200..299) {
      throw IllegalStateException("Request failed with status ${response.statusCode} for $path")
    }

    return response
  }

  private fun buildUrl(path: String, query: Map<String, String>): String {
    val normalizedBase = baseUrl.removeSuffix("/")
    if (query.isEmpty()) {
      return "$normalizedBase$path"
    }

    val queryString = query.entries.joinToString("&") { (key, value) ->
      "${encodeQuery(key)}=${encodeQuery(value)}"
    }
    return "$normalizedBase$path?$queryString"
  }

  private fun encodeQuery(value: String): String {
    return URLEncoder.encode(value, Charsets.UTF_8).replace("+", "%20")
  }
}
