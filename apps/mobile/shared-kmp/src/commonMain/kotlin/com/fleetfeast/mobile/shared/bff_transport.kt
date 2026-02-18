package com.fleetfeast.mobile.shared

data class BffRequest(
  val method: String,
  val path: String,
  val body: Any? = null,
  val query: Map<String, String> = emptyMap(),
  val headers: Map<String, String> = emptyMap(),
)

data class BffResponse(
  val statusCode: Int,
  val body: Any? = null,
)

interface BffTransport {
  fun send(request: BffRequest): BffResponse
}

class BffClientError(
  val code: String,
  override val message: String,
) : RuntimeException(message)

internal inline fun <reified T : Any> requireBody(response: BffResponse, endpoint: String): T {
  if (response.statusCode < 200 || response.statusCode > 299) {
    throw BffClientError(
      code = "BFF_HTTP_${response.statusCode}",
      message = "BFF request failed for $endpoint with status ${response.statusCode}",
    )
  }

  val payload = response.body
  if (payload !is T) {
    throw BffClientError(
      code = "BFF_PAYLOAD_TYPE_MISMATCH",
      message = "Unexpected payload for $endpoint: ${payload?.let { it::class.simpleName } ?: "null"}",
    )
  }

  return payload
}
