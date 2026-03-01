import { createMerchantAuthSessionManager } from "../src/lib/auth-session-manager";
import { fetchMerchantOrders } from "../src/lib/api";

export default async function MerchantPage() {
  const merchantId = process.env.MERCHANT_ID ?? "merchant-1";
  const appSessionToken =
    process.env.WEB_MERCHANT_APP_SESSION_TOKEN ??
    (process.env.WEB_MERCHANT_OIDC_TOKEN
      ? (
          await createMerchantAuthSessionManager().signIn({
            oidcToken: process.env.WEB_MERCHANT_OIDC_TOKEN,
            traceId: `web-merchant-${Date.now()}`,
            deviceId: "web-merchant",
          })
        ).tokenPair.accessToken
      : undefined);
  const orders = await fetchMerchantOrders(merchantId, { appSessionToken });

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
      </section>
    </main>
  );
}
