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
}

private class RecordingTransport(
  private val responsesByPath: Map<String, HttpTransportResponse>,
) : HttpTransport {
  val paths = mutableListOf<String>()
  val queries = mutableListOf<String>()

  override fun execute(request: HttpTransportRequest): HttpTransportResponse {
    val url = java.net.URI.create(request.url)
    paths.add(url.path)
    queries.add(url.query ?: "")
    return responsesByPath[url.path] ?: HttpTransportResponse(404, "{}")
  }
}
