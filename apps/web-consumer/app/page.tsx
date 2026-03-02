import { fetchConsumerOrder } from "../src/lib/api";

interface ConsumerPageProps {
  searchParams?: {
    orderId?: string;
    error?: string;
  };
}

export default async function ConsumerPage({ searchParams }: ConsumerPageProps) {
  const consumerId = "consumer-1";
  const merchantId = "merchant-1";
  const currentOrderId = searchParams?.orderId?.trim() || null;
  const order =
    currentOrderId !== null
      ? await fetchConsumerOrder(currentOrderId).catch(() => null)
      : null;

  return (
    <main className="shell">
      <section className="panel">
        <h1 className="headline">Consumer Ordering Console</h1>
        <p className="meta">Creates and tracks real orders through consumer-bff and core-api.</p>
        {searchParams?.error ? <p className="meta">Last action failed: {searchParams.error}</p> : null}
        <form className="grid" method="post" action="/quick-create">
          <label className="field">
            Consumer ID
            <input name="consumerId" defaultValue={consumerId} />
          </label>
          <label className="field">
            Merchant ID
            <input name="merchantId" defaultValue={merchantId} />
          </label>
          <label className="field">
            Item Name
            <input name="itemName" defaultValue="Chicken Rice Bowl" />
          </label>
          <label className="field">
            Unit Price (cents)
            <input name="unitPriceCents" defaultValue="1250" />
          </label>
          <label className="field">
            Quantity
            <input name="quantity" defaultValue="1" />
          </label>
          <label className="field">
            Modifier Name
            <input name="modifierName" defaultValue="Extra Sauce" />
          </label>
          <label className="field">
            Modifier Price (cents)
            <input name="modifierPriceCents" defaultValue="100" />
          </label>
          <div className="actions">
            <button className="button" type="submit">
              Create Order
            </button>
          </div>
        </form>
        <h2 className="headline">Current Order</h2>
        {order ? (
          <p className="meta">
            <strong>{order.id}</strong> <span className="chip">{order.status}</span> timeline v
            {order.timelineVersion}
          </p>
        ) : (
          <p className="meta">No active order loaded. Create one to start the flow.</p>
        )}
      </section>
    </main>
  );
}
