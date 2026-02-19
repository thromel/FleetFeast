package com.fleetfeast.mobile.consumer

class ConsumerAuthSessionManager(
  private val client: ConsumerBackendClient,
) {
  private var activeSession: SessionExchangeResponse? = null

  fun signIn(
    oidcToken: String,
    traceId: String,
    deviceId: String,
  ): SessionExchangeResponse {
    val response = client.exchangeSession(
      oidcToken = oidcToken,
      traceId = traceId,
      deviceId = deviceId,
    )
    activeSession = response
    return response
  }

  fun refresh(
    traceId: String,
    deviceId: String,
  ): SessionExchangeResponse {
    val refreshToken = activeSession?.tokenPair?.refreshToken
      ?: throw IllegalStateException("No active session to refresh")

    val response = client.refreshSession(
      refreshToken = refreshToken,
      traceId = traceId,
      deviceId = deviceId,
    )
    activeSession = response
    return response
  }

  fun currentSession(): SessionExchangeResponse? {
    return activeSession
  }
}
