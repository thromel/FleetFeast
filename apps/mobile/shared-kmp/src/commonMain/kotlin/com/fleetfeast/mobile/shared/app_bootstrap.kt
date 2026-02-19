package com.fleetfeast.mobile.shared

data class ConsumerBootstrapState(
  val session: AppSessionExchangeResponse,
  val featureFlags: FeatureFlagSnapshot,
)

data class CourierBootstrapState(
  val session: AppSessionExchangeResponse,
  val availableJobs: List<CourierJobView>,
  val featureFlags: FeatureFlagSnapshot,
)

data class MerchantBootstrapState(
  val session: AppSessionExchangeResponse,
  val orders: List<MerchantOrderView>,
  val featureFlags: FeatureFlagSnapshot,
)

data class AdminBootstrapState(
  val session: AppSessionExchangeResponse,
  val incidents: List<AdminIncidentView>,
  val featureFlags: FeatureFlagSnapshot,
)

class ConsumerAppBootstrap(
  private val consumerClient: ConsumerBffClient,
) {
  fun bootstrap(
    sessionRequest: AppSessionExchangeRequest,
    featureFlagContext: FeatureFlagContext,
  ): ConsumerBootstrapState {
    val session = consumerClient.exchangeSession(sessionRequest)
    val featureFlags = consumerClient.getFeatureFlags(featureFlagContext)

    return ConsumerBootstrapState(
      session = session,
      featureFlags = featureFlags,
    )
  }
}

class CourierAppBootstrap(
  private val courierClient: CourierBffClient,
) {
  fun bootstrap(
    sessionRequest: AppSessionExchangeRequest,
    featureFlagContext: FeatureFlagContext,
  ): CourierBootstrapState {
    val session = courierClient.exchangeSession(sessionRequest)
    val jobs = courierClient.listAvailableJobs()
    val featureFlags = courierClient.getFeatureFlags(featureFlagContext)

    return CourierBootstrapState(
      session = session,
      availableJobs = jobs,
      featureFlags = featureFlags,
    )
  }
}

class OpsAppBootstrap(
  private val opsClient: OpsBffClient,
) {
  fun bootstrapMerchant(
    sessionRequest: AppSessionExchangeRequest,
    featureFlagContext: FeatureFlagContext,
    merchantId: String,
  ): MerchantBootstrapState {
    val session = opsClient.exchangeMerchantSession(sessionRequest)
    val orders = opsClient.listMerchantOrders(merchantId)
    val featureFlags = opsClient.getMerchantFeatureFlags(featureFlagContext)

    return MerchantBootstrapState(
      session = session,
      orders = orders,
      featureFlags = featureFlags,
    )
  }

  fun bootstrapAdmin(
    sessionRequest: AppSessionExchangeRequest,
    featureFlagContext: FeatureFlagContext,
  ): AdminBootstrapState {
    val session = opsClient.exchangeAdminSession(sessionRequest)
    val incidents = opsClient.listAdminIncidents()
    val featureFlags = opsClient.getAdminFeatureFlags(featureFlagContext)

    return AdminBootstrapState(
      session = session,
      incidents = incidents,
      featureFlags = featureFlags,
    )
  }
}
