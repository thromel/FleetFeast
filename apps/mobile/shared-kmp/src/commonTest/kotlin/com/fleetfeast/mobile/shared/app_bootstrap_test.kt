package com.fleetfeast.mobile.shared

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AppBootstrapTest {
  @Test
  fun consumer_bootstrap_loads_session_and_feature_flags() {
    val transport = BootstrapTransport()
    val bootstrap = ConsumerAppBootstrap(
      consumerClient = ConsumerBffClient(transport),
    )

    val state = bootstrap.bootstrap(
      sessionRequest = AppSessionExchangeRequest(
        oidcToken = "dev:consumer-1:user@fleetfeast.dev:consumer",
        traceId = "trace-consumer-bootstrap",
        deviceId = "device-consumer-1",
      ),
      featureFlagContext = FeatureFlagContext(
        userId = "consumer-1",
        role = "consumer",
        tenantId = "metro-1",
      ),
    )

    assertEquals("consumer", state.session.session.persona)
    assertEquals(true, state.featureFlags.flags["consumer.timelineV2"])
    assertEquals("/app/v1/consumer/session/exchange", transport.paths[0])
    assertEquals("/app/v1/consumer/feature-flags", transport.paths[1])
  }

  @Test
  fun courier_bootstrap_loads_session_jobs_and_feature_flags() {
    val transport = BootstrapTransport()
    val bootstrap = CourierAppBootstrap(
      courierClient = CourierBffClient(transport),
    )

    val state = bootstrap.bootstrap(
      sessionRequest = AppSessionExchangeRequest(
        oidcToken = "dev:courier-1:courier@fleetfeast.dev:courier",
        traceId = "trace-courier-bootstrap",
        deviceId = "device-courier-1",
      ),
      featureFlagContext = FeatureFlagContext(
        userId = "courier-1",
        role = "courier",
        tenantId = "metro-1",
      ),
    )

    assertEquals("courier", state.session.session.persona)
    assertEquals(1, state.availableJobs.size)
    assertEquals("job-1", state.availableJobs[0].jobId)
    assertEquals(true, state.featureFlags.flags["courier.offlineReplay"])
    assertEquals("/app/v1/courier/session/exchange", transport.paths[0])
    assertEquals("/app/v1/courier/jobs/available", transport.paths[1])
    assertEquals("/app/v1/courier/feature-flags", transport.paths[2])
  }

  @Test
  fun ops_bootstrap_loads_merchant_and_admin_views() {
    val transport = BootstrapTransport()
    val bootstrap = OpsAppBootstrap(
      opsClient = OpsBffClient(transport),
    )

    val merchantState = bootstrap.bootstrapMerchant(
      sessionRequest = AppSessionExchangeRequest(
        oidcToken = "dev:merchant-1:merchant@fleetfeast.dev:merchant_operator",
        traceId = "trace-merchant-bootstrap",
      ),
      featureFlagContext = FeatureFlagContext(
        userId = "merchant-1",
        role = "merchant_operator",
        tenantId = "metro-1",
      ),
      merchantId = "merchant-1",
    )

    assertEquals("merchant", merchantState.session.session.persona)
    assertEquals(1, merchantState.orders.size)
    assertEquals(true, merchantState.featureFlags.flags["merchant.livePrepBoard"])

    val adminState = bootstrap.bootstrapAdmin(
      sessionRequest = AppSessionExchangeRequest(
        oidcToken = "dev:admin-1:admin@fleetfeast.dev:system_admin",
        traceId = "trace-admin-bootstrap",
      ),
      featureFlagContext = FeatureFlagContext(
        userId = "admin-1",
        role = "system_admin",
        tenantId = "metro-1",
      ),
    )

    assertEquals("admin", adminState.session.session.persona)
    assertEquals(1, adminState.incidents.size)
    assertTrue(adminState.featureFlags.flags.containsKey("admin.incidentWorkbenchV2"))
  }
}

private class BootstrapTransport : BffTransport {
  val paths = mutableListOf<String>()

  override fun send(request: BffRequest): BffResponse {
    paths.add(request.path)

    return when (request.path) {
      "/app/v1/consumer/session/exchange" -> BffResponse(
        statusCode = 200,
        body = sessionExchangeResponse(persona = "consumer", role = "consumer"),
      )

      "/app/v1/courier/session/exchange" -> BffResponse(
        statusCode = 200,
        body = sessionExchangeResponse(persona = "courier", role = "courier"),
      )

      "/app/v1/merchant/session/exchange" -> BffResponse(
        statusCode = 200,
        body = sessionExchangeResponse(persona = "merchant", role = "merchant_operator"),
      )

      "/app/v1/admin/session/exchange" -> BffResponse(
        statusCode = 200,
        body = sessionExchangeResponse(persona = "admin", role = "system_admin"),
      )

      "/app/v1/consumer/feature-flags" -> BffResponse(
        statusCode = 200,
        body = FeatureFlagSnapshot(
          flags = mapOf("consumer.timelineV2" to true),
          ttlSeconds = 30,
          generatedAtEpochMillis = 1_735_682_100_000,
        ),
      )

      "/app/v1/courier/jobs/available" -> BffResponse(
        statusCode = 200,
        body = CourierJobsPayload(
          jobs = listOf(
            CourierJobView(
              jobId = "job-1",
              orderId = "order-1",
              status = "AVAILABLE",
            ),
          ),
        ),
      )

      "/app/v1/courier/feature-flags" -> BffResponse(
        statusCode = 200,
        body = FeatureFlagSnapshot(
          flags = mapOf("courier.offlineReplay" to true),
          ttlSeconds = 30,
          generatedAtEpochMillis = 1_735_682_100_000,
        ),
      )

      "/app/v1/merchant/orders" -> BffResponse(
        statusCode = 200,
        body = MerchantOrdersPayload(
          orders = listOf(
            MerchantOrderView(
              id = "order-merchant-1",
              status = "MERCHANT_ACCEPTED",
            ),
          ),
        ),
      )

      "/app/v1/merchant/feature-flags" -> BffResponse(
        statusCode = 200,
        body = FeatureFlagSnapshot(
          flags = mapOf("merchant.livePrepBoard" to true),
          ttlSeconds = 30,
          generatedAtEpochMillis = 1_735_682_100_000,
        ),
      )

      "/app/v1/admin/incidents" -> BffResponse(
        statusCode = 200,
        body = AdminIncidentsPayload(
          incidents = listOf(
            AdminIncidentView(
              id = "incident-1",
              severity = "HIGH",
            ),
          ),
        ),
      )

      "/app/v1/admin/feature-flags" -> BffResponse(
        statusCode = 200,
        body = FeatureFlagSnapshot(
          flags = mapOf("admin.incidentWorkbenchV2" to false),
          ttlSeconds = 30,
          generatedAtEpochMillis = 1_735_682_100_000,
        ),
      )

      else -> BffResponse(statusCode = 404)
    }
  }

  private fun sessionExchangeResponse(persona: String, role: String): AppSessionExchangeResponse {
    return AppSessionExchangeResponse(
      session = AppSession(
        sessionId = "session-$persona-1",
        userId = "user-$persona-1",
        role = role,
        persona = persona,
        traceId = "trace-$persona-1",
        refreshTokenId = "refresh-$persona-1",
        issuedAt = "2026-02-19T00:00:00Z",
        expiresAt = "2026-02-19T01:00:00Z",
      ),
      tokenPair = AppSessionTokenPair(
        tokenType = "Bearer",
        accessToken = "access-$persona-1",
        refreshToken = "refresh-$persona-1",
        expiresInSeconds = 3600,
        refreshExpiresInSeconds = 2_592_000,
        refreshExpiresAt = "2026-03-21T00:00:00Z",
      ),
    )
  }
}
