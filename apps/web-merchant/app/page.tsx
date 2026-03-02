import { createMerchantAuthSessionManager } from "../src/lib/auth-session-manager";
import {
  fetchMerchantFeatureFlags,
  fetchMerchantOrders,
  fetchMerchantPayoutStatements,
} from "../src/lib/api";
import { MerchantRealtimeFeed } from "../src/lib/realtime-feed";

interface MerchantPageProps {
  searchParams?: {
    merchantId?: string;
    action?: string;
    status?: string;
    orderId?: string;
    error?: string;
  };
}

export default async function MerchantPage({ searchParams }: MerchantPageProps) {
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
  const hasAppSession = typeof appSessionToken === "string" && appSessionToken.length > 0;
  const orders = hasAppSession ? await fetchMerchantOrders(merchantId, { appSessionToken }) : [];
  const payoutStatements = hasAppSession
    ? await fetchMerchantPayoutStatements(merchantId, { appSessionToken })
    : [];
  const featureFlags =
    hasAppSession && featureFlagUserId && featureFlagRole
      ? await fetchMerchantFeatureFlags(
          {
            userId: featureFlagUserId,
            role: featureFlagRole,
            tenantId: featureFlagTenantId,
          },
          { appSessionToken },
        )
      : null;
  const realtimeOrderId = searchParams?.orderId ?? orders[0]?.id ?? null;

  return (
    <main className="shell">
      <section className="card">
        <h1 className="headline">Merchant Dispatch Desk</h1>
        <p className="meta">Live feed from ops-bff for merchant: {merchantId}</p>
        {searchParams?.action && searchParams?.orderId ? (
          <p className="meta">
            Last action: <strong>{searchParams.action}</strong> on{" "}
            <strong>{searchParams.orderId}</strong>{" "}
            {searchParams.status ? <span className="chip">{searchParams.status}</span> : null}
          </p>
        ) : null}
        {searchParams?.error ? <p className="meta">Last action failed: {searchParams.error}</p> : null}
        {!hasAppSession ? (
          <p className="meta">
            App session required. Set `WEB_MERCHANT_APP_SESSION_TOKEN` or `WEB_MERCHANT_OIDC_TOKEN`.
          </p>
        ) : null}
        <ul className="list">
          {orders.map((order) => (
            <li key={order.id} className="item">
              <span>{order.id}</span>
              <span className="chip">{order.status}</span>
              {hasAppSession ? (
                <span className="inline-actions">
                  <form method="post" action={`/orders/${encodeURIComponent(order.id)}/accept`}>
                    <input type="hidden" name="merchantId" value={merchantId} />
                    <input type="hidden" name="appSessionToken" value={appSessionToken} />
                    <button className="button" type="submit">
                      Accept
                    </button>
                  </form>
                  <form method="post" action={`/orders/${encodeURIComponent(order.id)}/request-dispatch`}>
                    <input type="hidden" name="merchantId" value={merchantId} />
                    <input type="hidden" name="appSessionToken" value={appSessionToken} />
                    <button className="button" type="submit">
                      Request Dispatch
                    </button>
                  </form>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {realtimeOrderId ? (
          <>
            <h2 className="headline">Realtime Order Events</h2>
            <MerchantRealtimeFeed orderId={realtimeOrderId} />
          </>
        ) : null}
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
