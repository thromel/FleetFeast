package com.fleetfeast.mobile.shared

import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration

class JvmHttpTransportExecutor(
  private val client: HttpClient = HttpClient.newBuilder().build(),
  private val requestTimeout: Duration = Duration.ofSeconds(15),
) : HttpTransportExecutor {
  override fun execute(request: HttpTransportRequest): HttpTransportResponse {
    val bodyPublisher = if (request.body == null) {
      HttpRequest.BodyPublishers.noBody()
    } else {
      HttpRequest.BodyPublishers.ofString(request.body, StandardCharsets.UTF_8)
    }

    val builder = HttpRequest.newBuilder()
      .uri(URI.create(request.url))
      .timeout(requestTimeout)
      .method(request.method, bodyPublisher)

    request.headers.forEach { (name, value) ->
      builder.header(name, value)
    }

    val response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))

    return HttpTransportResponse(
      statusCode = response.statusCode(),
      body = response.body().ifBlank { null },
    )
  }
}
