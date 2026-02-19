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
}
