package com.fleetfeast.mobile.consumer

class ConsumerAndroidShell(
  private val bffBaseUrl: String,
) {
  init {
    require(isHttpUrl(bffBaseUrl)) { "bffBaseUrl must be a valid http/https URL" }
  }

  fun startupSummary(): String {
    return "Consumer Android shell configured for $bffBaseUrl"
  }

  fun orderPath(orderId: String): String {
    return "/app/v1/consumer/orders/$orderId"
  }

  fun featureFlagPath(userId: String, role: String, tenantId: String?): String {
    val queryParts = mutableListOf(
      "userId=${encode(userId)}",
      "role=${encode(role)}",
    )

    if (tenantId != null) {
      queryParts.add("tenantId=${encode(tenantId)}")
    }

    return "/app/v1/consumer/feature-flags?${queryParts.joinToString("&")}" 
  }

  fun createBackendClient(
    transport: HttpTransport = UrlConnectionHttpTransport(),
  ): ConsumerBackendClient {
    return ConsumerBackendClient(
      baseUrl = bffBaseUrl,
      transport = transport,
    )
  }

  fun createAuthSessionManager(
    transport: HttpTransport = UrlConnectionHttpTransport(),
  ): ConsumerAuthSessionManager {
    return ConsumerAuthSessionManager(
      createBackendClient(transport),
    )
  }

  private fun encode(value: String): String {
    return java.net.URLEncoder.encode(value, Charsets.UTF_8).replace("+", "%20")
  }

  private fun isHttpUrl(value: String): Boolean {
    val lower = value.lowercase()
    return lower.startsWith("http://") || lower.startsWith("https://")
  }
}
