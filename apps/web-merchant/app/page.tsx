import { createMerchantAuthSessionManager } from "../src/lib/auth-session-manager";
import {
  fetchMerchantFeatureFlags,
  fetchMerchantOrders,
  fetchMerchantPayoutStatements,
} from "../src/lib/api";

export default async function MerchantPage() {
  const merchantId = process.env.MERCHANT_ID ?? "merchant-1";
  const sessionExchange = process.env.WEB_MERCHANT_OIDC_TOKEN
    ? await createMerchantAuthSessionManager().signIn({
        oidcToken: process.env.WEB_MERCHANT_OIDC_TOKEN,
        traceId: `web-merchant-${Date.now()}`,
        deviceId: "web-merchant",
      })
    : null;
  const appSessionToken =
    process.env.WEB_MERCHANT_APP_SESSION_TOKEN ?? sessionExchange?.tokenPair.accessToken;
  const featureFlagUserId =
    process.env.WEB_MERCHANT_FEATURE_FLAG_USER_ID ?? sessionExchange?.session.userId;
  const featureFlagRole =
    process.env.WEB_MERCHANT_FEATURE_FLAG_ROLE ?? sessionExchange?.session.role;
  const featureFlagTenantId = process.env.WEB_MERCHANT_FEATURE_FLAG_TENANT_ID;
  const orders = await fetchMerchantOrders(merchantId, { appSessionToken });
  const payoutStatements = await fetchMerchantPayoutStatements(merchantId, { appSessionToken });
  const featureFlags =
    featureFlagUserId && featureFlagRole
      ? await fetchMerchantFeatureFlags(
          {
            userId: featureFlagUserId,
            role: featureFlagRole,
            tenantId: featureFlagTenantId,
          },
          { appSessionToken },
        )
      : null;

  return (
    <main className="shell">
      <section className="card">
        <h1 className="headline">Merchant Dispatch Desk</h1>
        <p className="meta">Live feed from ops-bff for merchant: {merchantId}</p>
        <ul className="list">
          {orders.map((order) => (
            <li key={order.id} className="item">
              <span>{order.id}</span>
              <span className="chip">{order.status}</span>
            </li>
          ))}
        </ul>
        <h2 className="headline">Recent Payout Statements</h2>
        <ul className="list">
          {payoutStatements.map((statement) => (
            <li key={statement.statementId} className="item">
              <span>
                {statement.statementId} · {statement.currency} {statement.totalAmount}
              </span>
              <span className="chip">{statement.format}</span>
            </li>
          ))}
        </ul>
        <h2 className="headline">Feature Flags</h2>
        {featureFlags ? (
          <>
            <p className="meta">Snapshot TTL: {featureFlags.ttlSeconds}s</p>
            <ul className="list">
              {Object.entries(featureFlags.flags).map(([flagKey, enabled]) => (
                <li key={flagKey} className="item">
                  <span>{flagKey}</span>
                  <span className="chip">{enabled ? "ON" : "OFF"}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="meta">
            Feature-flag context unavailable. Set `WEB_MERCHANT_FEATURE_FLAG_USER_ID` and
            `WEB_MERCHANT_FEATURE_FLAG_ROLE` or provide `WEB_MERCHANT_OIDC_TOKEN`.
          </p>
        )}
      </section>
    </main>
  );
}
