package com.fleetfeast.mobile.shared

class ConsumerBffClient(
  private val transport: BffTransport,
  private val basePath: String = BffEndpoints.CONSUMER_BASE,
) {
  fun exchangeSession(request: AppSessionExchangeRequest): AppSessionExchangeResponse {
    val endpoint = "$basePath/session/exchange"
    val response = transport.send(
      BffRequest(
        method = "POST",
        path = endpoint,
        body = request,
      ),
    )
    return requireBody(response, endpoint)
  }

  fun refreshSession(request: AppSessionRefreshRequest): AppSessionExchangeResponse {
    val endpoint = "$basePath/session/refresh"
    val response = transport.send(
      BffRequest(
        method = "POST",
        path = endpoint,
        body = request,
      ),
    )
    return requireBody(response, endpoint)
  }

  fun getOrder(orderId: String): ConsumerOrderView {
    val endpoint = "$basePath/orders/$orderId"
    val response = transport.send(
      BffRequest(
        method = "GET",
        path = endpoint,
      ),
    )
    return requireBody<ConsumerOrderPayload>(response, endpoint).order
  }

  fun getFeatureFlags(context: FeatureFlagContext): FeatureFlagSnapshot {
    val endpoint = "$basePath/feature-flags"
    val query = mutableMapOf(
      "userId" to context.userId,
      "role" to context.role,
    )

    if (context.tenantId != null) {
      query["tenantId"] = context.tenantId
    }

    val response = transport.send(
      BffRequest(
        method = "GET",
        path = endpoint,
        query = query,
      ),
    )
    return requireBody(response, endpoint)
  }
}

class CourierBffClient(
  private val transport: BffTransport,
  private val basePath: String = BffEndpoints.COURIER_BASE,
) {
  fun exchangeSession(request: AppSessionExchangeRequest): AppSessionExchangeResponse {
    val endpoint = "$basePath/session/exchange"
    val response = transport.send(
      BffRequest(
        method = "POST",
        path = endpoint,
        body = request,
      ),
    )
    return requireBody(response, endpoint)
  }

  fun refreshSession(request: AppSessionRefreshRequest): AppSessionExchangeResponse {
    val endpoint = "$basePath/session/refresh"
    val response = transport.send(
      BffRequest(
        method = "POST",
        path = endpoint,
        body = request,
      ),
    )
    return requireBody(response, endpoint)
  }

  fun listAvailableJobs(): List<CourierJobView> {
    val endpoint = "$basePath/jobs/available"
    val response = transport.send(
      BffRequest(
        method = "GET",
        path = endpoint,
      ),
    )
    return requireBody<CourierJobsPayload>(response, endpoint).jobs
  }

  fun getFeatureFlags(context: FeatureFlagContext): FeatureFlagSnapshot {
    val endpoint = "$basePath/feature-flags"
    val query = mutableMapOf(
      "userId" to context.userId,
      "role" to context.role,
    )

    if (context.tenantId != null) {
      query["tenantId"] = context.tenantId
    }

    val response = transport.send(
      BffRequest(
        method = "GET",
        path = endpoint,
        query = query,
      ),
    )
    return requireBody(response, endpoint)
  }
}

class OpsBffClient(
  private val transport: BffTransport,
  private val merchantBasePath: String = BffEndpoints.OPS_MERCHANT_BASE,
  private val adminBasePath: String = BffEndpoints.OPS_ADMIN_BASE,
) {
  fun exchangeMerchantSession(request: AppSessionExchangeRequest): AppSessionExchangeResponse {
    val endpoint = "$merchantBasePath/session/exchange"
    val response = transport.send(
      BffRequest(
        method = "POST",
        path = endpoint,
        body = request,
      ),
    )
    return requireBody(response, endpoint)
  }

  fun refreshMerchantSession(request: AppSessionRefreshRequest): AppSessionExchangeResponse {
    val endpoint = "$merchantBasePath/session/refresh"
    val response = transport.send(
      BffRequest(
        method = "POST",
        path = endpoint,
        body = request,
      ),
    )
    return requireBody(response, endpoint)
  }

  fun exchangeAdminSession(request: AppSessionExchangeRequest): AppSessionExchangeResponse {
    val endpoint = "$adminBasePath/session/exchange"
    val response = transport.send(
      BffRequest(
        method = "POST",
        path = endpoint,
        body = request,
      ),
    )
    return requireBody(response, endpoint)
  }

  fun refreshAdminSession(request: AppSessionRefreshRequest): AppSessionExchangeResponse {
    val endpoint = "$adminBasePath/session/refresh"
    val response = transport.send(
      BffRequest(
        method = "POST",
        path = endpoint,
        body = request,
      ),
    )
    return requireBody(response, endpoint)
  }

  fun listMerchantOrders(merchantId: String): List<MerchantOrderView> {
    val endpoint = "$merchantBasePath/orders"
    val response = transport.send(
      BffRequest(
        method = "GET",
        path = endpoint,
        query = mapOf("merchantId" to merchantId),
      ),
    )
    return requireBody<MerchantOrdersPayload>(response, endpoint).orders
  }

  fun getMerchantFeatureFlags(context: FeatureFlagContext): FeatureFlagSnapshot {
    val endpoint = "$merchantBasePath/feature-flags"
    val query = mutableMapOf(
      "userId" to context.userId,
      "role" to context.role,
    )

    if (context.tenantId != null) {
      query["tenantId"] = context.tenantId
    }

    val response = transport.send(
      BffRequest(
        method = "GET",
        path = endpoint,
        query = query,
      ),
    )
    return requireBody(response, endpoint)
  }

  fun listAdminIncidents(): List<AdminIncidentView> {
    val endpoint = "$adminBasePath/incidents"
    val response = transport.send(
      BffRequest(
        method = "GET",
        path = endpoint,
      ),
    )
    return requireBody<AdminIncidentsPayload>(response, endpoint).incidents
  }

  fun getAdminFeatureFlags(context: FeatureFlagContext): FeatureFlagSnapshot {
    val endpoint = "$adminBasePath/feature-flags"
    val query = mutableMapOf(
      "userId" to context.userId,
      "role" to context.role,
    )

    if (context.tenantId != null) {
      query["tenantId"] = context.tenantId
    }

    val response = transport.send(
      BffRequest(
        method = "GET",
        path = endpoint,
        query = query,
      ),
    )
    return requireBody(response, endpoint)
  }
}

class RealtimeGatewayClient(
  private val transport: BffTransport,
) {
  fun registerPush(request: RealtimePushRegistrationRequest): RealtimePushRegistrationResponse {
    val endpoint = "/app/v1/realtime/push/register"
    val response = transport.send(
      BffRequest(
        method = "POST",
        path = endpoint,
        body = request,
      ),
    )
    return requireBody(response, endpoint)
  }

  fun unregisterPush(request: RealtimePushUnregisterRequest): RealtimePushUnregisterResponse {
    val endpoint = "/app/v1/realtime/push/unregister"
    val response = transport.send(
      BffRequest(
        method = "POST",
        path = endpoint,
        body = request,
      ),
    )
    return requireBody(response, endpoint)
  }

  fun publish(request: RealtimePublishRequest, publishApiKey: String? = null): RealtimePublishResponse {
    val endpoint = "/app/v1/realtime/publish"
    val response = transport.send(
      BffRequest(
        method = "POST",
        path = endpoint,
        body = request,
        headers = if (publishApiKey == null) {
          emptyMap()
        } else {
          mapOf("x-realtime-publish-key" to publishApiKey)
        },
      ),
    )
    return requireBody(response, endpoint)
  }
}
