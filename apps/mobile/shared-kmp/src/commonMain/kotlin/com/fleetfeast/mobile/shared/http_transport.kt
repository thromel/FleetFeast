package com.fleetfeast.mobile.shared

data class HttpTransportRequest(
  val method: String,
  val url: String,
  val headers: Map<String, String>,
  val body: String? = null,
)

data class HttpTransportResponse(
  val statusCode: Int,
  val body: String? = null,
)

interface HttpTransportExecutor {
  fun execute(request: HttpTransportRequest): HttpTransportResponse
}

interface HttpBodyMapper {
  fun encode(body: Any): String
  fun decode(path: String, statusCode: Int, body: String?): Any?
}

class HttpBffTransport(
  private val baseUrl: String,
  private val executor: HttpTransportExecutor,
  private val bodyMapper: HttpBodyMapper,
) : BffTransport {
  private val normalizedBaseUrl = baseUrl.removeSuffix("/")

  override fun send(request: BffRequest): BffResponse {
    val encodedBody = request.body?.let { bodyMapper.encode(it) }

    val headers = request.headers.toMutableMap()
    if (encodedBody != null && !containsHeader(headers, "content-type")) {
      headers["content-type"] = "application/json"
    }

    val response = executor.execute(
      HttpTransportRequest(
        method = request.method,
        url = buildUrl(request.path, request.query),
        headers = headers,
        body = encodedBody,
      ),
    )

    val decoded = if (response.body == null) {
      null
    } else {
      bodyMapper.decode(request.path, response.statusCode, response.body)
    }

    return BffResponse(
      statusCode = response.statusCode,
      body = decoded,
    )
  }

  private fun buildUrl(path: String, query: Map<String, String>): String {
    val normalizedPath = if (path.startsWith("/")) path else "/$path"
    if (query.isEmpty()) {
      return "$normalizedBaseUrl$normalizedPath"
    }

    val queryText = query
      .toList()
      .sortedBy { it.first }
      .joinToString("&") { (key, value) ->
        "${encodeQueryComponent(key)}=${encodeQueryComponent(value)}"
      }

    return "$normalizedBaseUrl$normalizedPath?$queryText"
  }

  private fun containsHeader(headers: Map<String, String>, name: String): Boolean {
    return headers.keys.any { headerKey ->
      headerKey.equals(name, ignoreCase = true)
    }
  }
}

private fun encodeQueryComponent(raw: String): String {
  val bytes = raw.encodeToByteArray()
  val output = StringBuilder()

  for (byte in bytes) {
    val value = byte.toInt() and 0xFF
    val char = value.toChar()
    if (isUnreserved(char)) {
      output.append(char)
    } else {
      output.append('%')
      output.append(hexDigit(value shr 4))
      output.append(hexDigit(value and 0x0F))
    }
  }

  return output.toString()
}

private fun isUnreserved(char: Char): Boolean {
  return (char in 'A'..'Z') ||
    (char in 'a'..'z') ||
    (char in '0'..'9') ||
    char == '-' ||
    char == '.' ||
    char == '_' ||
    char == '~'
}

private fun hexDigit(value: Int): Char {
  return "0123456789ABCDEF"[value and 0x0F]
}
