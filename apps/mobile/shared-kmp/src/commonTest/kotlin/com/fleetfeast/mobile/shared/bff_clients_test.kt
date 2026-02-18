package com.fleetfeast.mobile.shared

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class BffClientTest {
  @Test
  fun consumer_client_maps_session_and_order_endpoints() {
    val transport = FakeTransport { request ->
      when (request.path) {
        "/app/v1/consumer/session/exchange" -> BffResponse(
          statusCode = 200,
          body = fakeSessionExchangeResponse(persona = "consumer", role = "consumer"),
        )

        "/app/v1/consumer/orders/order-42" -> BffResponse(
          statusCode = 200,
          body = ConsumerOrderPayload(
            order = ConsumerOrderView(
              id = "order-42",
              status = "COURIER_ASSIGNED",
              timelineVersion = 3,
            ),
          ),
        )

        else -> BffResponse(statusCode = 404)
      }
    }

    val client = ConsumerBffClient(transport)

    val exchange = client.exchangeSession(
      AppSessionExchangeRequest(
        oidcToken = "dev:user-1:user-1@fleetfeast.dev:consumer",
        traceId = "trace-mobile-consumer-1",
      ),
    )
    assertEquals("consumer", exchange.session.persona)

    val order = client.getOrder("order-42")
    assertEquals("order-42", order.id)
    assertEquals("COURIER_ASSIGNED", order.status)

    assertEquals(2, transport.requests.size)
    assertEquals("POST", transport.requests[0].method)
    assertEquals("GET", transport.requests[1].method)
  }

  @Test
  fun courier_client_reads_available_jobs() {
    val transport = FakeTransport { request ->
      when (request.path) {
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

        else -> BffResponse(statusCode = 404)
      }
    }

    val client = CourierBffClient(transport)
    val jobs = client.listAvailableJobs()

    assertEquals(1, jobs.size)
    assertEquals("job-1", jobs[0].jobId)
    assertEquals("/app/v1/courier/jobs/available", transport.requests.single().path)
  }

  @Test
  fun ops_client_maps_merchant_and_admin_routes() {
    val transport = FakeTransport { request ->
      when (request.path) {
        "/app/v1/merchant/orders" -> BffResponse(
          statusCode = 200,
          body = MerchantOrdersPayload(
            orders = listOf(
              MerchantOrderView(
                id = "order-merchant-1",
                status = "READY",
              ),
            ),
          ),
        )

        "/app/v1/admin/incidents" -> BffResponse(
          statusCode = 200,
          body = AdminIncidentsPayload(
            incidents = listOf(
              AdminIncidentView(
                id = "trace-incident-1",
                severity = "HIGH",
              ),
            ),
          ),
        )

        "/app/v1/admin/session/exchange" -> BffResponse(
          statusCode = 200,
          body = fakeSessionExchangeResponse(persona = "admin", role = "system_admin"),
        )

        else -> BffResponse(statusCode = 404)
      }
    }

    val client = OpsBffClient(transport)

    val merchantOrders = client.listMerchantOrders("merchant-1")
    assertEquals(1, merchantOrders.size)
    assertEquals("merchant-1", transport.requests[0].query["merchantId"])

    val incidents = client.listAdminIncidents()
    assertEquals("trace-incident-1", incidents.single().id)

    val session = client.exchangeAdminSession(
      AppSessionExchangeRequest(
        oidcToken = "dev:admin-1:admin@fleetfeast.dev:system_admin",
        traceId = "trace-admin-mobile-1",
      ),
    )
    assertEquals("admin", session.session.persona)
  }

  @Test
  fun realtime_client_routes_register_unregister_and_publish() {
    val transport = FakeTransport { request ->
      when (request.path) {
        "/app/v1/realtime/push/register" -> BffResponse(
          statusCode = 200,
          body = RealtimePushRegistrationResponse(registered = true),
        )

        "/app/v1/realtime/push/unregister" -> BffResponse(
          statusCode = 200,
          body = RealtimePushUnregisterResponse(removed = true),
        )

        "/app/v1/realtime/publish" -> BffResponse(
          statusCode = 200,
          body = RealtimePublishResponse(published = true),
        )

        else -> BffResponse(statusCode = 404)
      }
    }

    val client = RealtimeGatewayClient(transport)

    val register = client.registerPush(
      RealtimePushRegistrationRequest(
        channel = "courier.job.job-7",
        userId = "courier-7",
        pushToken = "token-7",
        provider = PushProvider.FCM,
      ),
    )
    assertTrue(register.registered)

    val unregister = client.unregisterPush(
      RealtimePushUnregisterRequest(
        channel = "courier.job.job-7",
        userId = "courier-7",
      ),
    )
    assertTrue(unregister.removed)

    val published = client.publish(
      RealtimePublishRequest(
        channel = "merchant.order.order-88",
        envelope = RealtimeEnvelope(
          eventType = "order.confirmed.v1",
          entityId = "order-88",
          occurredAt = "2026-02-18T10:00:00Z",
          traceId = "trace-mobile-realtime-1",
          payload = mapOf("status" to "MERCHANT_ACCEPTED"),
        ),
      ),
      publishApiKey = "publish-key-mobile",
    )
    assertTrue(published.published)

    val publishRequest = transport.requests.lastOrNull()
    assertNotNull(publishRequest)
    assertEquals("publish-key-mobile", publishRequest.headers["x-realtime-publish-key"])
  }

  private fun fakeSessionExchangeResponse(persona: String, role: String): AppSessionExchangeResponse {
    return AppSessionExchangeResponse(
      session = AppSession(
        sessionId = "session-1",
        userId = "user-1",
        role = role,
        persona = persona,
        traceId = "trace-1",
        refreshTokenId = "refresh-1",
        issuedAt = "2026-02-18T10:00:00Z",
        expiresAt = "2026-02-18T10:15:00Z",
      ),
      tokenPair = AppSessionTokenPair(
        tokenType = "Bearer",
        accessToken = "access-token-1",
        refreshToken = "refresh-token-1",
        expiresInSeconds = 900,
        refreshExpiresInSeconds = 1209600,
        refreshExpiresAt = "2026-03-04T10:00:00Z",
      ),
    )
  }
}

private class FakeTransport(
  private val responder: (BffRequest) -> BffResponse,
) : BffTransport {
  val requests = mutableListOf<BffRequest>()

  override fun send(request: BffRequest): BffResponse {
    requests.add(request)
    return responder(request)
  }
}
