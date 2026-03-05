import { buildDemoSurfaceLinks, describeOrderStage } from "@fleetfeast/shared-contracts";

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

  const stage = describeOrderStage(order?.status);
  const demoLinks = buildDemoSurfaceLinks("consumer");
  const stats = [
    { label: "Backend State", value: "Demo Ready" },
    { label: "Realtime Relay", value: "Live" },
    { label: "Journey Stage", value: stage.label },
  ];

  return (
    <main className="demo-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="persona-pill">Consumer Demo</span>
          <h1>FleetFeast</h1>
          <p className="lede">
            Create the order here, then hand it off to merchant, courier, and admin surfaces for a
            complete client walkthrough.
          </p>
        </div>
        <div className="journey-card">
          <p className="eyebrow">Live Order Signal</p>
          <h2>{order ? stage.label : "Start a Fresh Order"}</h2>
          <p className="journey-copy">
            {order
              ? `Order ${order.id} is currently ${order.status}. Use the links below to continue the flow.`
              : "Use the composer to create a real order through consumer-bff and core-api."}
          </p>
          {order ? (
            <div className={`stage-pill tone-${stage.tone}`}>
              <span>{stage.persona}</span>
              <strong>{order.status}</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className="stats-strip" aria-label="Demo summary">
        {stats.map((stat) => (
          <article key={stat.label} className="metric-card">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
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

      <section className="content-grid">
        <article className="composer-panel">
          <div className="section-heading">
            <p className="eyebrow">1. Build the basket</p>
            <h2>Create a live order</h2>
            <p className="section-copy">
              This form posts to the real quick-create flow and gives you an order id to track
              across the rest of the demo.
            </p>
          </div>

          {searchParams?.error ? <p className="notice error">Last action failed: {searchParams.error}</p> : null}

          <form className="composer-grid" method="post" action="/quick-create">
            <label className="field">
              <span>Consumer ID</span>
              <input name="consumerId" defaultValue={consumerId} />
            </label>
            <label className="field">
              <span>Merchant ID</span>
              <input name="merchantId" defaultValue={merchantId} />
            </label>
            <label className="field field-wide">
              <span>Signature item</span>
              <input name="itemName" defaultValue="Chicken Rice Bowl" />
            </label>
            <label className="field">
              <span>Unit price (cents)</span>
              <input name="unitPriceCents" defaultValue="1250" />
            </label>
            <label className="field">
              <span>Quantity</span>
              <input name="quantity" defaultValue="1" />
            </label>
            <label className="field">
              <span>Modifier</span>
              <input name="modifierName" defaultValue="Extra Sauce" />
            </label>
            <label className="field">
              <span>Modifier price (cents)</span>
              <input name="modifierPriceCents" defaultValue="100" />
            </label>
            <div className="button-row">
              <button className="primary-button" type="submit">
                Create Live Order
              </button>
              <a className="secondary-link" href="http://127.0.0.1:3001" target="_blank" rel="noreferrer">
                Open Merchant Desk
              </a>
            </div>
          </form>
        </article>

        <aside className="status-panel">
          <div className="section-heading">
            <p className="eyebrow">2. Track the handoff</p>
            <h2>Current order snapshot</h2>
          </div>

          {order ? (
            <article className="order-card">
              <header>
                <p>Order ID</p>
                <strong>{order.id}</strong>
              </header>
              <div className="order-meta">
                <div>
                  <span>Status</span>
                  <strong>{order.status}</strong>
                </div>
                <div>
                  <span>Timeline</span>
                  <strong>v{order.timelineVersion}</strong>
                </div>
              </div>
              <div className={`stage-pill tone-${stage.tone}`}>
                <span>Next surface</span>
                <strong>{stage.persona}</strong>
              </div>
            </article>
          ) : (
            <p className="notice">No order yet. Create one to unlock the full journey.</p>
          )}

          <div className="handoff-panel">
            <p className="eyebrow">3. Present the flow</p>
            <ul className="step-list">
              <li>
                <strong>Merchant</strong>
                <span>Accept the order and request dispatch.</span>
              </li>
              <li>
                <strong>Courier</strong>
                <span>Accept, pick up, and drop off the job.</span>
              </li>
              <li>
                <strong>Admin</strong>
                <span>Show the operating view, SLOs, and compliance feed.</span>
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
