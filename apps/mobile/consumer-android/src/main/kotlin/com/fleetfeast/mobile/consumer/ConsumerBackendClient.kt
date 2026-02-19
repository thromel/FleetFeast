package com.fleetfeast.mobile.consumer

import java.net.HttpURLConnection
import java.net.URI
import java.net.URLEncoder
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
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
data class FeatureFlagSnapshot(
  val flags: Map<String, Boolean>,
  val ttlSeconds: Int,
  val generatedAtEpochMillis: Long,
)

@Serializable
private data class ConsumerOrderPayload(
  val order: ConsumerOrder,
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
