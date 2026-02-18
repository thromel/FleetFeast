import { fetchMerchantOrders } from "../src/lib/api";

export default async function MerchantPage() {
  const merchantId = process.env.MERCHANT_ID ?? "merchant-1";
  const orders = await fetchMerchantOrders(merchantId);

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
