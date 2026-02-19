package com.fleetfeast.mobile.courier

class CourierAndroidShell(
  private val bffBaseUrl: String,
  private val realtimeBaseUrl: String,
) {
  init {
    require(isHttpUrl(bffBaseUrl)) { "bffBaseUrl must be a valid http/https URL" }
    require(isHttpUrl(realtimeBaseUrl)) { "realtimeBaseUrl must be a valid http/https URL" }
  }

  fun startupSummary(): String {
    return "Courier Android shell configured for $bffBaseUrl with realtime $realtimeBaseUrl"
  }

  fun availableJobsPath(): String {
    return "/app/v1/courier/jobs/available"
  }

  fun featureFlagPath(userId: String, role: String, tenantId: String?): String {
    val queryParts = mutableListOf(
      "userId=${encode(userId)}",
      "role=${encode(role)}",
    )

    if (tenantId != null) {
      queryParts.add("tenantId=${encode(tenantId)}")
    }

    return "/app/v1/courier/feature-flags?${queryParts.joinToString("&")}" 
  }

  fun realtimeConnectPath(): String {
    return "/app/v1/realtime/connect"
  }

  fun createBackendClient(
    transport: HttpTransport = UrlConnectionHttpTransport(),
  ): CourierBackendClient {
    return CourierBackendClient(
      baseUrl = bffBaseUrl,
      transport = transport,
    )
  }

  fun createAuthSessionManager(
    transport: HttpTransport = UrlConnectionHttpTransport(),
  ): CourierAuthSessionManager {
    return CourierAuthSessionManager(
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
