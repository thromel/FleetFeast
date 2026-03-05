import { buildDemoSurfaceLinks, describeOrderStage } from "@fleetfeast/shared-contracts";

import { createMerchantAuthSessionManager } from "../src/lib/auth-session-manager";
import {
  fetchMerchantFeatureFlags,
  fetchMerchantOrders,
  fetchMerchantPayoutStatements,
  type MerchantOrderView,
  type MerchantPayoutStatementView,
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

function selectPrimaryOrder(
  orders: MerchantOrderView[],
  preferredOrderId: string | null,
): MerchantOrderView | null {
  if (preferredOrderId) {
    const matchedOrder = orders.find((order) => order.id === preferredOrderId);
    if (matchedOrder) {
      return matchedOrder;
    }
  }

  return orders[0] ?? null;
}

function sumPayouts(statements: MerchantPayoutStatementView[]): number {
  return statements.reduce((total, statement) => total + statement.totalAmount, 0);
}

function canAcceptOrder(status: string): boolean {
  return status === "CREATED";
}

function canRequestDispatch(status: string): boolean {
  return status === "MERCHANT_ACCEPTED" || status === "CREATED";
}

export default async function MerchantPage({ searchParams }: MerchantPageProps) {
  const merchantId =
    process.env.MERCHANT_ID ?? searchParams?.merchantId?.trim() ?? "merchant-1";
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

  const primaryOrder = selectPrimaryOrder(orders, searchParams?.orderId?.trim() || null);
  const stage = describeOrderStage(primaryOrder?.status);
  const demoLinks = buildDemoSurfaceLinks("merchant", {
    consumer: primaryOrder
      ? `http://127.0.0.1:3003?orderId=${encodeURIComponent(primaryOrder.id)}`
      : "http://127.0.0.1:3003",
  });
  const pendingCount = orders.filter((order) => order.status === "CREATED").length;
  const activeCount = orders.filter((order) =>
    ["MERCHANT_ACCEPTED", "DISPATCH_REQUESTED", "COURIER_ASSIGNED", "PICKED_UP"].includes(order.status),
  ).length;
  const totalPayoutAmount = sumPayouts(payoutStatements);
  const lastActionLabel = searchParams?.action && searchParams?.orderId
    ? `${searchParams.action} on ${searchParams.orderId}`
    : null;

  return (
    <main className="merchant-shell">
      <section className="merchant-hero">
        <div className="hero-copy">
          <span className="persona-pill">Merchant Demo</span>
          <h1>Dispatch Desk</h1>
          <p className="lede">
            Accept the order, release it to dispatch, and keep the client walkthrough moving
            without leaving the live backend flow.
          </p>
          <div className="hero-meta">
            <div className={`stage-pill tone-${stage.tone}`}>
              <span>Live stage</span>
              <strong>{primaryOrder ? stage.label : "Waiting for intake"}</strong>
            </div>
            <p className="hero-caption">Merchant: {merchantId}</p>
          </div>
        </div>

        <article className="signal-card">
          <p className="eyebrow">Queue Focus</p>
          <h2>{primaryOrder ? primaryOrder.id : "No active order selected"}</h2>
          <p className="signal-copy">
            {primaryOrder
              ? `Current status is ${primaryOrder.status}. Accept it here, then hand off to courier and admin.`
              : "Create an order from the consumer surface, then reopen this desk to continue the flow."}
          </p>
          {lastActionLabel ? (
            <p className="notice success">
              Last action: <strong>{lastActionLabel}</strong>
              {searchParams?.status ? <span className="chip">{searchParams.status}</span> : null}
            </p>
          ) : null}
          {searchParams?.error ? <p className="notice error">Last action failed: {searchParams.error}</p> : null}
          {!hasAppSession ? (
            <p className="notice">
              App session required. Set `WEB_MERCHANT_APP_SESSION_TOKEN` or `WEB_MERCHANT_OIDC_TOKEN`.
            </p>
          ) : null}
        </article>
      </section>

      <section className="metrics-strip" aria-label="Merchant highlights">
        <article className="metric-card">
          <span>Pending Orders</span>
          <strong>{pendingCount}</strong>
        </article>
        <article className="metric-card">
          <span>Active Fulfillment</span>
          <strong>{activeCount}</strong>
        </article>
        <article className="metric-card">
          <span>Payout Visibility</span>
          <strong>${(totalPayoutAmount / 100).toFixed(2)}</strong>
        </article>
      </section>

      <section className="surface-grid" aria-label="Demo surfaces">
        {demoLinks.map((link) => (
          <a
            key={link.id}
            className={`surface-card${link.isCurrent ? " is-current" : ""}`}
            href={link.href}
            target="_blank"
            rel="noreferrer"
          >
            <span className="surface-kicker">{link.id}</span>
            <strong>{link.label}</strong>
            <p>{link.description}</p>
          </a>
        ))}
      </section>

      <section className="merchant-grid">
        <article className="queue-panel">
          <div className="section-heading">
            <p className="eyebrow">1. Order queue</p>
            <h2>Release orders to delivery</h2>
            <p className="section-copy">
              Each action below talks to the live ops-bff routes already wired into the backend.
            </p>
          </div>

          {orders.length === 0 ? (
            <p className="notice">No merchant orders available for this demo merchant yet.</p>
          ) : (
            <ul className="order-list">
              {orders.map((order) => {
                const orderStage = describeOrderStage(order.status);

                return (
                  <li key={order.id} className="order-card">
                    <div className="order-summary">
                      <div>
                        <p>Order</p>
                        <strong>{order.id}</strong>
                      </div>
                      <div className={`stage-pill tone-${orderStage.tone}`}>
                        <span>{orderStage.label}</span>
                        <strong>{order.status}</strong>
                      </div>
                    </div>

                    <div className="order-actions">
                      <form method="post" action={`/orders/${encodeURIComponent(order.id)}/accept`}>
                        <input type="hidden" name="merchantId" value={merchantId} />
                        <input type="hidden" name="appSessionToken" value={appSessionToken ?? ""} />
                        <button className="primary-button" type="submit" disabled={!canAcceptOrder(order.status)}>
                          Accept Order
                        </button>
                      </form>
                      <form method="post" action={`/orders/${encodeURIComponent(order.id)}/request-dispatch`}>
                        <input type="hidden" name="merchantId" value={merchantId} />
                        <input type="hidden" name="appSessionToken" value={appSessionToken ?? ""} />
                        <button
                          className="secondary-button"
                          type="submit"
                          disabled={!canRequestDispatch(order.status)}
                        >
                          Request Dispatch
                        </button>
                      </form>
                      <a
                        className="ghost-link"
                        href={`http://127.0.0.1:3003?orderId=${encodeURIComponent(order.id)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View Consumer Story
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <aside className="insight-column">
          <article className="panel-card">
            <div className="section-heading">
              <p className="eyebrow">2. Realtime signal</p>
              <h2>Merchant event rail</h2>
            </div>
            {primaryOrder ? (
              <MerchantRealtimeFeed orderId={primaryOrder.id} />
            ) : (
              <p className="notice">Select or create an order to watch realtime events here.</p>
            )}
          </article>

          <article className="panel-card">
            <div className="section-heading">
              <p className="eyebrow">3. Demo notes</p>
              <h2>Payout and rollout context</h2>
            </div>
            <div className="detail-stack">
              <div className="detail-block">
                <span>Latest statements</span>
                <strong>{payoutStatements.length}</strong>
                <p>
                  {payoutStatements[0]
                    ? `${payoutStatements[0].statementId} · ${payoutStatements[0].format}`
                    : "No payout statements loaded in this environment."}
                </p>
              </div>
              <div className="detail-block">
                <span>Feature flags</span>
                <strong>{featureFlags ? Object.keys(featureFlags.flags).length : 0}</strong>
                <p>
                  {featureFlags
                    ? `Snapshot TTL ${featureFlags.ttlSeconds}s`
                    : "Feature flag context unavailable without a merchant app session."}
                </p>
              </div>
            </div>
            {featureFlags ? (
              <ul className="flag-list">
                {Object.entries(featureFlags.flags).map(([flagKey, enabled]) => (
                  <li key={flagKey}>
                    <span>{flagKey}</span>
                    <strong>{enabled ? "ON" : "OFF"}</strong>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        </aside>
      </section>
    </main>
  );
}
