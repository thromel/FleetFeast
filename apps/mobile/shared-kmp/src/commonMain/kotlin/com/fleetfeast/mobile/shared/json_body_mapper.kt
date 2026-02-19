package com.fleetfeast.mobile.shared

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.encodeToJsonElement

class DefaultJsonHttpBodyMapper(
  private val json: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
  },
) : HttpBodyMapper {
  override fun encode(body: Any): String {
    return when (body) {
      is String -> body
      is AppSessionExchangeRequest -> json.encodeToString(body)
      is AppSessionRefreshRequest -> json.encodeToString(body)
      is RealtimePushRegistrationRequest -> json.encodeToString(body)
      is RealtimePushUnregisterRequest -> json.encodeToString(body)
      is RealtimePublishRequest -> json.encodeToString(body)
      is Map<*, *> -> mapToJsonElement(body).toString()
      else -> throw IllegalArgumentException("Unsupported request body type: ${body::class.simpleName}")
    }
  }

  override fun decode(path: String, statusCode: Int, body: String?): Any? {
    if (body == null || body.isBlank()) {
      return null
    }

    if (statusCode < 200 || statusCode > 299) {
      return json.parseToJsonElement(body)
    }

    val normalizedPath = normalizePath(path)
    return when {
      normalizedPath == "/app/v1/consumer/session/exchange" -> json.decodeFromString<AppSessionExchangeResponse>(body)
      normalizedPath == "/app/v1/consumer/session/refresh" -> json.decodeFromString<AppSessionExchangeResponse>(body)
      normalizedPath == "/app/v1/courier/session/exchange" -> json.decodeFromString<AppSessionExchangeResponse>(body)
      normalizedPath == "/app/v1/courier/session/refresh" -> json.decodeFromString<AppSessionExchangeResponse>(body)
      normalizedPath == "/app/v1/merchant/session/exchange" -> json.decodeFromString<AppSessionExchangeResponse>(body)
      normalizedPath == "/app/v1/merchant/session/refresh" -> json.decodeFromString<AppSessionExchangeResponse>(body)
      normalizedPath == "/app/v1/admin/session/exchange" -> json.decodeFromString<AppSessionExchangeResponse>(body)
      normalizedPath == "/app/v1/admin/session/refresh" -> json.decodeFromString<AppSessionExchangeResponse>(body)
      normalizedPath.startsWith("/app/v1/consumer/orders/") -> json.decodeFromString<ConsumerOrderPayload>(body)
      normalizedPath == "/app/v1/consumer/feature-flags" -> json.decodeFromString<FeatureFlagSnapshot>(body)
      normalizedPath == "/app/v1/courier/jobs/available" -> json.decodeFromString<CourierJobsPayload>(body)
      normalizedPath == "/app/v1/courier/feature-flags" -> json.decodeFromString<FeatureFlagSnapshot>(body)
      normalizedPath == "/app/v1/merchant/orders" -> json.decodeFromString<MerchantOrdersPayload>(body)
      normalizedPath == "/app/v1/merchant/feature-flags" -> json.decodeFromString<FeatureFlagSnapshot>(body)
      normalizedPath == "/app/v1/admin/incidents" -> json.decodeFromString<AdminIncidentsPayload>(body)
      normalizedPath == "/app/v1/admin/feature-flags" -> json.decodeFromString<FeatureFlagSnapshot>(body)
      normalizedPath == "/app/v1/realtime/push/register" -> json.decodeFromString<RealtimePushRegistrationResponse>(body)
      normalizedPath == "/app/v1/realtime/push/unregister" -> json.decodeFromString<RealtimePushUnregisterResponse>(body)
      normalizedPath == "/app/v1/realtime/publish" -> json.decodeFromString<RealtimePublishResponse>(body)
      else -> json.parseToJsonElement(body)
    }
  }

  private fun normalizePath(path: String): String {
    val withoutQuery = path.substringBefore('?')
    return if (withoutQuery.startsWith('/')) {
      withoutQuery
    } else {
      "/$withoutQuery"
    }
  }

  private fun mapToJsonElement(value: Map<*, *>): JsonElement {
    return buildJsonObject {
      for ((rawKey, rawValue) in value.entries) {
        val key = rawKey?.toString() ?: continue
        put(key, anyToJsonElement(rawValue))
      }
    }
  }

  private fun anyToJsonElement(value: Any?): JsonElement {
    return when (value) {
      null -> JsonNull
      is String -> JsonPrimitive(value)
      is Number -> JsonPrimitive(value)
      is Boolean -> JsonPrimitive(value)
      is Map<*, *> -> mapToJsonElement(value)
      is List<*> -> JsonArray(value.map { anyToJsonElement(it) })
      else -> json.encodeToJsonElement(value.toString())
    }
  }
}
