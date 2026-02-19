package com.fleetfeast.mobile.courier

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class CourierAndroidShellTest {
  @Test
  fun startup_summary_and_paths_are_generated() {
    val shell = CourierAndroidShell(
      bffBaseUrl = "http://127.0.0.1:4102",
      realtimeBaseUrl = "http://127.0.0.1:4104",
    )

    assertEquals(
      "Courier Android shell configured for http://127.0.0.1:4102 with realtime http://127.0.0.1:4104",
      shell.startupSummary(),
    )
    assertEquals("/app/v1/courier/jobs/available", shell.availableJobsPath())
    assertEquals("/app/v1/realtime/connect", shell.realtimeConnectPath())

    val featurePath = shell.featureFlagPath(
      userId = "courier-1",
      role = "courier",
      tenantId = "metro 1",
    )

    assertTrue(featurePath.contains("/app/v1/courier/feature-flags?"))
    assertTrue(featurePath.contains("userId=courier-1"))
    assertTrue(featurePath.contains("role=courier"))
    assertTrue(featurePath.contains("tenantId=metro%201"))
  }

  @Test
  fun invalid_url_is_rejected() {
    assertFailsWith<IllegalArgumentException> {
      CourierAndroidShell(
        bffBaseUrl = "invalid-url",
        realtimeBaseUrl = "http://127.0.0.1:4104",
      )
    }
  }

  @Test
  fun backend_client_fetches_jobs_and_feature_flags() {
    val transport = RecordingTransport(
      responsesByPath = mapOf(
        "/app/v1/courier/jobs/available" to HttpTransportResponse(
          statusCode = 200,
          body = "{\"jobs\":[{\"jobId\":\"job-1\",\"orderId\":\"order-1\",\"status\":\"AVAILABLE\"}]}",
        ),
        "/app/v1/courier/feature-flags" to HttpTransportResponse(
          statusCode = 200,
          body = "{\"flags\":{\"courier.offlineReplay\":true},\"ttlSeconds\":30,\"generatedAtEpochMillis\":1735684000000}",
        ),
      ),
    )
    val client = CourierBackendClient(
      baseUrl = "http://127.0.0.1:4102",
      transport = transport,
    )

    val jobs = client.fetchAvailableJobs()
    val flags = client.fetchFeatureFlags(
      userId = "courier-1",
      role = "courier",
      tenantId = "metro-1",
    )

    assertEquals(1, jobs.size)
    assertEquals("job-1", jobs[0].jobId)
    assertEquals(true, flags.flags["courier.offlineReplay"])
    assertEquals("/app/v1/courier/jobs/available", transport.paths[0])
    assertEquals("/app/v1/courier/feature-flags", transport.paths[1])
    assertTrue(transport.queries[1].contains("userId=courier-1"))
    assertTrue(transport.queries[1].contains("role=courier"))
    assertTrue(transport.queries[1].contains("tenantId=metro-1"))
  }

  @Test
  fun backend_client_exchanges_session_with_post_request() {
    val transport = RecordingTransport(
      responsesByPath = mapOf(
        "/app/v1/courier/session/exchange" to HttpTransportResponse(
          statusCode = 200,
          body = "{\"session\":{\"sessionId\":\"session-1\",\"userId\":\"courier-1\",\"role\":\"courier\",\"persona\":\"courier\",\"traceId\":\"trace-1\",\"refreshTokenId\":\"rt-1\",\"issuedAt\":\"2026-02-19T00:00:00Z\",\"expiresAt\":\"2026-02-19T01:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-1\",\"refreshToken\":\"refresh-1\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T00:00:00Z\"}}",
        ),
      ),
    )
    val client = CourierBackendClient(
      baseUrl = "http://127.0.0.1:4102",
      transport = transport,
    )

    val response = client.exchangeSession(
      oidcToken = "dev:courier-1:courier@fleetfeast.dev:courier",
      traceId = "trace-1",
      deviceId = "device-1",
    )

    assertEquals("courier", response.session.persona)
    assertEquals("access-1", response.tokenPair.accessToken)
    assertEquals("/app/v1/courier/session/exchange", transport.paths[0])
    assertEquals("POST", transport.methods[0])
    assertTrue(transport.bodies[0].contains("\"oidcToken\":\"dev:courier-1:courier@fleetfeast.dev:courier\""))
  }

  @Test
  fun backend_client_refreshes_session_with_post_request() {
    val transport = RecordingTransport(
      responsesByPath = mapOf(
        "/app/v1/courier/session/refresh" to HttpTransportResponse(
          statusCode = 200,
          body = "{\"session\":{\"sessionId\":\"session-2\",\"userId\":\"courier-1\",\"role\":\"courier\",\"persona\":\"courier\",\"traceId\":\"trace-2\",\"refreshTokenId\":\"rt-2\",\"issuedAt\":\"2026-02-19T01:00:00Z\",\"expiresAt\":\"2026-02-19T02:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-2\",\"refreshToken\":\"refresh-2\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T01:00:00Z\"}}",
        ),
      ),
    )
    val client = CourierBackendClient(
      baseUrl = "http://127.0.0.1:4102",
      transport = transport,
    )

    val response = client.refreshSession(
      refreshToken = "refresh-1",
      traceId = "trace-2",
      deviceId = "device-1",
    )

    assertEquals("trace-2", response.session.traceId)
    assertEquals("access-2", response.tokenPair.accessToken)
    assertEquals("/app/v1/courier/session/refresh", transport.paths[0])
    assertEquals("POST", transport.methods[0])
    assertTrue(transport.bodies[0].contains("\"refreshToken\":\"refresh-1\""))
  }

  @Test
  fun auth_session_manager_sign_in_and_refresh_uses_stored_refresh_token() {
    val transport = RecordingTransport(
      responsesByPath = mapOf(
        "/app/v1/courier/session/exchange" to HttpTransportResponse(
          statusCode = 200,
          body = "{\"session\":{\"sessionId\":\"session-1\",\"userId\":\"courier-1\",\"role\":\"courier\",\"persona\":\"courier\",\"traceId\":\"trace-1\",\"refreshTokenId\":\"rt-1\",\"issuedAt\":\"2026-02-19T00:00:00Z\",\"expiresAt\":\"2026-02-19T01:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-1\",\"refreshToken\":\"refresh-1\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T00:00:00Z\"}}",
        ),
        "/app/v1/courier/session/refresh" to HttpTransportResponse(
          statusCode = 200,
          body = "{\"session\":{\"sessionId\":\"session-2\",\"userId\":\"courier-1\",\"role\":\"courier\",\"persona\":\"courier\",\"traceId\":\"trace-2\",\"refreshTokenId\":\"rt-2\",\"issuedAt\":\"2026-02-19T01:00:00Z\",\"expiresAt\":\"2026-02-19T02:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-2\",\"refreshToken\":\"refresh-2\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T01:00:00Z\"}}",
        ),
      ),
    )
    val client = CourierBackendClient(
      baseUrl = "http://127.0.0.1:4102",
      transport = transport,
    )
    val manager = CourierAuthSessionManager(client)

    val signIn = manager.signIn(
      oidcToken = "dev:courier-1:courier@fleetfeast.dev:courier",
      traceId = "trace-1",
      deviceId = "device-1",
    )
    val refresh = manager.refresh(
      traceId = "trace-2",
      deviceId = "device-1",
    )

    assertEquals("access-1", signIn.tokenPair.accessToken)
    assertEquals("access-2", refresh.tokenPair.accessToken)
    assertEquals("refresh-2", manager.currentSession()?.tokenPair?.refreshToken)
    assertEquals("/app/v1/courier/session/exchange", transport.paths[0])
    assertEquals("/app/v1/courier/session/refresh", transport.paths[1])
    assertTrue(transport.bodies[1].contains("\"refreshToken\":\"refresh-1\""))
  }

  @Test
  fun auth_session_manager_refresh_requires_existing_session() {
    val client = CourierBackendClient(
      baseUrl = "http://127.0.0.1:4102",
      transport = RecordingTransport(responsesByPath = emptyMap()),
    )
    val manager = CourierAuthSessionManager(client)

    val error = assertFailsWith<IllegalStateException> {
      manager.refresh(traceId = "trace-1", deviceId = "device-1")
    }

    assertTrue(error.message?.contains("No active session") == true)
  }
}

private class RecordingTransport(
  private val responsesByPath: Map<String, HttpTransportResponse>,
) : HttpTransport {
  val paths = mutableListOf<String>()
  val queries = mutableListOf<String>()
  val methods = mutableListOf<String>()
  val bodies = mutableListOf<String>()

  override fun execute(request: HttpTransportRequest): HttpTransportResponse {
    val url = java.net.URI.create(request.url)
    paths.add(url.path)
    queries.add(url.query ?: "")
    methods.add(request.method)
    bodies.add(request.body ?: "")
    return responsesByPath[url.path] ?: HttpTransportResponse(404, "{}")
  }
}
