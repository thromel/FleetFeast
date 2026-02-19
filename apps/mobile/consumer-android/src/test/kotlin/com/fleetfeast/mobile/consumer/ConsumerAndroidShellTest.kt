package com.fleetfeast.mobile.consumer

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class ConsumerAndroidShellTest {
  @Test
  fun startup_summary_and_paths_are_generated() {
    val shell = ConsumerAndroidShell("http://127.0.0.1:4101")

    assertEquals("Consumer Android shell configured for http://127.0.0.1:4101", shell.startupSummary())
    assertEquals("/app/v1/consumer/orders/order-1", shell.orderPath("order-1"))

    val featurePath = shell.featureFlagPath(
      userId = "consumer-1",
      role = "consumer",
      tenantId = "metro 1",
    )

    assertTrue(featurePath.contains("/app/v1/consumer/feature-flags?"))
    assertTrue(featurePath.contains("userId=consumer-1"))
    assertTrue(featurePath.contains("role=consumer"))
    assertTrue(featurePath.contains("tenantId=metro%201"))
  }

  @Test
  fun invalid_url_is_rejected() {
    assertFailsWith<IllegalArgumentException> {
      ConsumerAndroidShell("invalid-url")
    }
  }

  @Test
  fun backend_client_fetches_order_and_feature_flags() {
    val transport = RecordingTransport(
      responsesByPath = mapOf(
        "/app/v1/consumer/orders/order-7" to HttpTransportResponse(
          statusCode = 200,
          body = "{\"order\":{\"id\":\"order-7\",\"status\":\"COURIER_ASSIGNED\",\"timelineVersion\":4}}",
        ),
        "/app/v1/consumer/feature-flags" to HttpTransportResponse(
          statusCode = 200,
          body = "{\"flags\":{\"consumer.timelineV2\":true},\"ttlSeconds\":30,\"generatedAtEpochMillis\":1735684000000}",
        ),
      ),
    )
    val client = ConsumerBackendClient(
      baseUrl = "http://127.0.0.1:4101",
      transport = transport,
    )

    val order = client.fetchOrder("order-7")
    val flags = client.fetchFeatureFlags(
      userId = "consumer-1",
      role = "consumer",
      tenantId = "metro-1",
    )

    assertEquals("order-7", order.id)
    assertEquals(true, flags.flags["consumer.timelineV2"])
    assertEquals("/app/v1/consumer/orders/order-7", transport.paths[0])
    assertEquals("/app/v1/consumer/feature-flags", transport.paths[1])
    assertTrue(transport.queries[1].contains("userId=consumer-1"))
    assertTrue(transport.queries[1].contains("role=consumer"))
    assertTrue(transport.queries[1].contains("tenantId=metro-1"))
  }

  @Test
  fun backend_client_exchanges_session_with_post_request() {
    val transport = RecordingTransport(
      responsesByPath = mapOf(
        "/app/v1/consumer/session/exchange" to HttpTransportResponse(
          statusCode = 200,
          body = "{\"session\":{\"sessionId\":\"session-1\",\"userId\":\"consumer-1\",\"role\":\"consumer\",\"persona\":\"consumer\",\"traceId\":\"trace-1\",\"refreshTokenId\":\"rt-1\",\"issuedAt\":\"2026-02-19T00:00:00Z\",\"expiresAt\":\"2026-02-19T01:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-1\",\"refreshToken\":\"refresh-1\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T00:00:00Z\"}}",
        ),
      ),
    )
    val client = ConsumerBackendClient(
      baseUrl = "http://127.0.0.1:4101",
      transport = transport,
    )

    val response = client.exchangeSession(
      oidcToken = "dev:consumer-1:user@fleetfeast.dev:consumer",
      traceId = "trace-1",
      deviceId = "device-1",
    )

    assertEquals("consumer", response.session.persona)
    assertEquals("access-1", response.tokenPair.accessToken)
    assertEquals("/app/v1/consumer/session/exchange", transport.paths[0])
    assertEquals("POST", transport.methods[0])
    assertTrue(transport.bodies[0].contains("\"oidcToken\":\"dev:consumer-1:user@fleetfeast.dev:consumer\""))
  }

  @Test
  fun backend_client_refreshes_session_with_post_request() {
    val transport = RecordingTransport(
      responsesByPath = mapOf(
        "/app/v1/consumer/session/refresh" to HttpTransportResponse(
          statusCode = 200,
          body = "{\"session\":{\"sessionId\":\"session-2\",\"userId\":\"consumer-1\",\"role\":\"consumer\",\"persona\":\"consumer\",\"traceId\":\"trace-2\",\"refreshTokenId\":\"rt-2\",\"issuedAt\":\"2026-02-19T01:00:00Z\",\"expiresAt\":\"2026-02-19T02:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-2\",\"refreshToken\":\"refresh-2\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T01:00:00Z\"}}",
        ),
      ),
    )
    val client = ConsumerBackendClient(
      baseUrl = "http://127.0.0.1:4101",
      transport = transport,
    )

    val response = client.refreshSession(
      refreshToken = "refresh-1",
      traceId = "trace-2",
      deviceId = "device-1",
    )

    assertEquals("trace-2", response.session.traceId)
    assertEquals("access-2", response.tokenPair.accessToken)
    assertEquals("/app/v1/consumer/session/refresh", transport.paths[0])
    assertEquals("POST", transport.methods[0])
    assertTrue(transport.bodies[0].contains("\"refreshToken\":\"refresh-1\""))
  }

  @Test
  fun auth_session_manager_sign_in_and_refresh_uses_stored_refresh_token() {
    val transport = RecordingTransport(
      responsesByPath = mapOf(
        "/app/v1/consumer/session/exchange" to HttpTransportResponse(
          statusCode = 200,
          body = "{\"session\":{\"sessionId\":\"session-1\",\"userId\":\"consumer-1\",\"role\":\"consumer\",\"persona\":\"consumer\",\"traceId\":\"trace-1\",\"refreshTokenId\":\"rt-1\",\"issuedAt\":\"2026-02-19T00:00:00Z\",\"expiresAt\":\"2026-02-19T01:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-1\",\"refreshToken\":\"refresh-1\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T00:00:00Z\"}}",
        ),
        "/app/v1/consumer/session/refresh" to HttpTransportResponse(
          statusCode = 200,
          body = "{\"session\":{\"sessionId\":\"session-2\",\"userId\":\"consumer-1\",\"role\":\"consumer\",\"persona\":\"consumer\",\"traceId\":\"trace-2\",\"refreshTokenId\":\"rt-2\",\"issuedAt\":\"2026-02-19T01:00:00Z\",\"expiresAt\":\"2026-02-19T02:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-2\",\"refreshToken\":\"refresh-2\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T01:00:00Z\"}}",
        ),
      ),
    )
    val client = ConsumerBackendClient(
      baseUrl = "http://127.0.0.1:4101",
      transport = transport,
    )
    val manager = ConsumerAuthSessionManager(client)

    val signIn = manager.signIn(
      oidcToken = "dev:consumer-1:user@fleetfeast.dev:consumer",
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
    assertEquals("/app/v1/consumer/session/exchange", transport.paths[0])
    assertEquals("/app/v1/consumer/session/refresh", transport.paths[1])
    assertTrue(transport.bodies[1].contains("\"refreshToken\":\"refresh-1\""))
  }

  @Test
  fun auth_session_manager_refresh_requires_existing_session() {
    val client = ConsumerBackendClient(
      baseUrl = "http://127.0.0.1:4101",
      transport = RecordingTransport(responsesByPath = emptyMap()),
    )
    val manager = ConsumerAuthSessionManager(client)

    val error = assertFailsWith<IllegalStateException> {
      manager.refresh(traceId = "trace-1", deviceId = "device-1")
    }

    assertTrue(error.message?.contains("No active session") == true)
  }

  @Test
  fun shell_creates_auth_session_manager_using_configured_base_url() {
    val shell = ConsumerAndroidShell("http://127.0.0.1:4101")
    val transport = RecordingTransport(
      responsesByPath = mapOf(
        "/app/v1/consumer/session/exchange" to HttpTransportResponse(
          statusCode = 200,
          body = "{\"session\":{\"sessionId\":\"session-1\",\"userId\":\"consumer-1\",\"role\":\"consumer\",\"persona\":\"consumer\",\"traceId\":\"trace-1\",\"refreshTokenId\":\"rt-1\",\"issuedAt\":\"2026-02-19T00:00:00Z\",\"expiresAt\":\"2026-02-19T01:00:00Z\"},\"tokenPair\":{\"tokenType\":\"Bearer\",\"accessToken\":\"access-1\",\"refreshToken\":\"refresh-1\",\"expiresInSeconds\":3600,\"refreshExpiresInSeconds\":2592000,\"refreshExpiresAt\":\"2026-03-21T00:00:00Z\"}}",
        ),
      ),
    )

    val manager = shell.createAuthSessionManager(transport)
    val response = manager.signIn(
      oidcToken = "dev:consumer-1:user@fleetfeast.dev:consumer",
      traceId = "trace-1",
      deviceId = "device-1",
    )

    assertEquals("consumer", response.session.persona)
    assertEquals("/app/v1/consumer/session/exchange", transport.paths[0])
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
