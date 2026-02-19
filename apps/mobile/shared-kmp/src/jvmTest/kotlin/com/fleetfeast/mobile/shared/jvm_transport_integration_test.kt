package com.fleetfeast.mobile.shared

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class JvmTransportIntegrationTest {
  @Test
  fun json_mapper_encodes_and_decodes_known_contracts() {
    val mapper = DefaultJsonHttpBodyMapper()

    val encoded = mapper.encode(
      AppSessionExchangeRequest(
        oidcToken = "oidc-token-1",
        traceId = "trace-1",
        deviceId = "device-1",
      ),
    )

    assertTrue(encoded.contains("\"oidcToken\":\"oidc-token-1\""))

    val decoded = mapper.decode(
      path = "/app/v1/consumer/orders/order-100",
      statusCode = 200,
      body = """
      {"order":{"id":"order-100","status":"DELIVERED","timelineVersion":42}}
      """.trimIndent(),
    )

    val payload = decoded as ConsumerOrderPayload
    assertEquals("order-100", payload.order.id)
    assertEquals("DELIVERED", payload.order.status)
    assertEquals(42, payload.order.timelineVersion)
  }

  @Test
  fun consumer_client_can_call_live_http_server_via_jvm_executor() {
    val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
    var capturedRequestBody: String? = null

    server.createContext("/app/v1/consumer/session/exchange") { exchange ->
      capturedRequestBody = exchange.requestBody.readBytes().decodeToString()
      respondJson(
        exchange,
        200,
        """
        {
          "session": {
            "sessionId": "session-1",
            "userId": "user-1",
            "role": "consumer",
            "persona": "consumer",
            "traceId": "trace-1",
            "refreshTokenId": "rt-1",
            "issuedAt": "2026-02-19T00:00:00Z",
            "expiresAt": "2026-02-19T00:30:00Z"
          },
          "tokenPair": {
            "tokenType": "Bearer",
            "accessToken": "access-1",
            "refreshToken": "refresh-1",
            "expiresInSeconds": 1800,
            "refreshExpiresInSeconds": 2592000,
            "refreshExpiresAt": "2026-03-21T00:00:00Z"
          }
        }
        """.trimIndent(),
      )
    }

    server.createContext("/app/v1/consumer/orders/order-100") { exchange ->
      respondJson(
        exchange,
        200,
        """
        {
          "order": {
            "id": "order-100",
            "status": "COURIER_ASSIGNED",
            "timelineVersion": 9
          }
        }
        """.trimIndent(),
      )
    }

    server.start()
    try {
      val transport = HttpBffTransport(
        baseUrl = "http://127.0.0.1:${server.address.port}",
        executor = JvmHttpTransportExecutor(),
        bodyMapper = DefaultJsonHttpBodyMapper(),
      )
      val client = ConsumerBffClient(transport)

      val session = client.exchangeSession(
        AppSessionExchangeRequest(
          oidcToken = "oidc-token-1",
          traceId = "trace-1",
          deviceId = "device-1",
        ),
      )
      val order = client.getOrder("order-100")

      assertEquals("session-1", session.session.sessionId)
      assertEquals("access-1", session.tokenPair.accessToken)
      assertEquals("order-100", order.id)
      assertEquals("COURIER_ASSIGNED", order.status)
      assertEquals(9, order.timelineVersion)
      assertTrue(capturedRequestBody?.contains("\"oidcToken\":\"oidc-token-1\"") == true)
    } finally {
      server.stop(0)
    }
  }

  private fun respondJson(exchange: HttpExchange, status: Int, body: String) {
    val bytes = body.encodeToByteArray()
    exchange.responseHeaders.add("content-type", "application/json")
    exchange.sendResponseHeaders(status, bytes.size.toLong())
    exchange.responseBody.use { it.write(bytes) }
  }
}
