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
}
