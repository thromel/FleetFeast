package com.fleetfeast.mobile.shared

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class HttpBffTransportTest {
  @Test
  fun consumer_client_works_over_http_transport() {
    val mapper = FakeHttpBodyMapper(
      encodedBodies = mutableListOf(),
      decodedBodiesByPath = mapOf(
        "/app/v1/consumer/orders/order-77" to ConsumerOrderPayload(
          order = ConsumerOrderView(
            id = "order-77",
            status = "COURIER_ASSIGNED",
            timelineVersion = 9,
          ),
        ),
      ),
    )

    val executor = RecordingHttpExecutor(
      responses = listOf(
        HttpTransportResponse(
          statusCode = 200,
          body = "{\"order\":{...}}",
        ),
      ),
    )

    val transport = HttpBffTransport(
      baseUrl = "http://127.0.0.1:4101",
      executor = executor,
      bodyMapper = mapper,
    )

    val client = ConsumerBffClient(transport)
    val order = client.getOrder("order-77")

    assertEquals("order-77", order.id)
    assertEquals(1, executor.requests.size)
    assertEquals("GET", executor.requests[0].method)
    assertEquals("http://127.0.0.1:4101/app/v1/consumer/orders/order-77", executor.requests[0].url)
  }

  @Test
  fun http_transport_encodes_query_body_and_headers() {
    val mapper = FakeHttpBodyMapper(
      encodedBodies = mutableListOf(),
      decodedBodiesByPath = mapOf(
        "/app/v1/merchant/orders" to MerchantOrdersPayload(
          orders = listOf(MerchantOrderView(id = "order-1", status = "READY")),
        ),
      ),
    )

    val executor = RecordingHttpExecutor(
      responses = listOf(
        HttpTransportResponse(
          statusCode = 200,
          body = "{\"orders\":[]}",
        ),
      ),
    )

    val transport = HttpBffTransport(
      baseUrl = "http://127.0.0.1:4103/",
      executor = executor,
      bodyMapper = mapper,
    )

    val response = transport.send(
      BffRequest(
        method = "POST",
        path = "/app/v1/merchant/orders",
        query = mapOf("merchantId" to "merchant 1", "city" to "New York"),
        headers = mapOf("x-trace-id" to "trace-1"),
        body = mapOf("preview" to true),
      ),
    )

    assertEquals(200, response.statusCode)

    val request = executor.requests.single()
    assertEquals(
      "http://127.0.0.1:4103/app/v1/merchant/orders?city=New%20York&merchantId=merchant%201",
      request.url,
    )
    assertEquals("trace-1", request.headers["x-trace-id"])
    assertEquals("application/json", request.headers["content-type"])
    assertNotNull(request.body)
    assertEquals(1, mapper.encodedBodies.size)
  }
}

private class RecordingHttpExecutor(
  responses: List<HttpTransportResponse>,
) : HttpTransportExecutor {
  val requests = mutableListOf<HttpTransportRequest>()
  private val queue = ArrayDeque(responses)

  override fun execute(request: HttpTransportRequest): HttpTransportResponse {
    requests.add(request)
    return queue.removeFirstOrNull() ?: HttpTransportResponse(statusCode = 500)
  }
}

private class FakeHttpBodyMapper(
  val encodedBodies: MutableList<Any>,
  private val decodedBodiesByPath: Map<String, Any>,
) : HttpBodyMapper {
  override fun encode(body: Any): String {
    encodedBodies.add(body)
    return "{\"encoded\":true}"
  }

  override fun decode(path: String, statusCode: Int, body: String?): Any? {
    return decodedBodiesByPath[path]
  }
}
