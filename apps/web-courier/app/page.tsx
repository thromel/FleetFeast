import { buildDemoSurfaceLinks } from "@fleetfeast/shared-contracts";

import { listAvailableCourierJobs } from "../src/lib/api";
import { buildCourierDemoState } from "../src/lib/demo-state";

interface CourierPageProps {
  searchParams?: {
    courierId?: string;
    lastJobId?: string;
    lastStatus?: string;
    error?: string;
  };
}

function resolveCourierId(rawValue: string | undefined): string {
  if (!rawValue) {
    return "courier-1";
  }

  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : "courier-1";
}

function describeCourierStatus(status: string | null | undefined): {
  label: string;
  tone: "attention" | "active" | "complete";
} {
  switch (status) {
    case "AVAILABLE":
      return { label: "Ready to Accept", tone: "attention" };
    case "ASSIGNED":
    case "ACCEPTED":
      return { label: "Head to Pickup", tone: "active" };
    case "PICKED_UP":
      return { label: "Finish the Dropoff", tone: "active" };
    case "DELIVERED":
    case "DROPPED_OFF":
      return { label: "Completed", tone: "complete" };
    default:
      return { label: "Waiting for Work", tone: "attention" };
  }
}

function canAccept(status: string): boolean {
  return status === "AVAILABLE";
}

function canPickup(status: string): boolean {
  return status === "ASSIGNED" || status === "ACCEPTED";
}

function canDropoff(status: string): boolean {
  return status === "PICKED_UP";
}

export default async function CourierPage({ searchParams }: CourierPageProps) {
  const courierId = resolveCourierId(searchParams?.courierId ?? process.env.COURIER_ID);
  const jobs = await listAvailableCourierJobs().catch(() => []);
  const demoState = buildCourierDemoState({
    jobs,
    lastJobId: searchParams?.lastJobId,
    lastStatus: searchParams?.lastStatus,
  });
  const primaryJob = demoState.primaryJob;
  const focusJobId = primaryJob?.jobId ?? demoState.followUpJobId;
  const focusOrderId = primaryJob?.orderId ?? null;
  const focusStatus = primaryJob?.status ?? demoState.followUpStatus;
  const jobStage = describeCourierStatus(focusStatus);
  const demoLinks = buildDemoSurfaceLinks("courier", {
    consumer: focusOrderId
      ? `http://127.0.0.1:3003?orderId=${encodeURIComponent(focusOrderId)}`
      : "http://127.0.0.1:3003",
    merchant: focusOrderId
      ? `http://127.0.0.1:3001?orderId=${encodeURIComponent(focusOrderId)}`
      : "http://127.0.0.1:3001",
  });
  const availableCount = jobs.filter((job) => job.status === "AVAILABLE").length;
  const activeCount = jobs.filter((job) => ["ASSIGNED", "ACCEPTED", "PICKED_UP"].includes(job.status)).length;
  const completedCount = jobs.filter((job) => ["DELIVERED", "DROPPED_OFF"].includes(job.status)).length;

  return (
    <main className="courier-shell">
      <section className="courier-hero">
        <div className="hero-copy">
          <span className="persona-pill">Courier Demo</span>
          <h1>Fulfillment Board</h1>
          <p className="lede">
            Accept the assigned job, capture pickup, and complete dropoff from the same live
            courier-bff flow.
          </p>
          <form className="courier-picker" method="get" action="/">
            <label className="field">
              <span>Courier ID</span>
              <input name="courierId" defaultValue={courierId} />
            </label>
            <button type="submit" className="primary-button">
              Load Courier
            </button>
          </form>
        </div>

        <article className="focus-card">
          <p className="eyebrow">Delivery Focus</p>
          <h2>{focusJobId ?? "No active job selected"}</h2>
          <p className="focus-copy">
            {primaryJob
              ? `Order ${primaryJob.orderId} is in ${primaryJob.status}. This is the screen to use during the live courier handoff.`
              : demoState.followUpJobId && demoState.followUpStatus
                ? `Continue the same job after ${demoState.followUpStatus.toLowerCase().replaceAll("_", " ")} without losing the demo handoff.`
                : "Request dispatch from the merchant surface, then reload this board to show the courier handoff."}
          </p>
          <div className={`stage-pill tone-${jobStage.tone}`}>
            <span>Status</span>
            <strong>{jobStage.label}</strong>
          </div>
          {searchParams?.lastJobId && searchParams?.lastStatus ? (
            <p className="notice success">
              Last action: <strong>{searchParams.lastJobId}</strong>
              <span className="chip">{searchParams.lastStatus}</span>
            </p>
          ) : null}
          {searchParams?.error ? <p className="notice error">Last action failed: {searchParams.error}</p> : null}
        </article>
      </section>

      <section className="metrics-strip" aria-label="Courier highlights">
        <article className="metric-card">
          <span>Ready Jobs</span>
          <strong>{availableCount}</strong>
        </article>
        <article className="metric-card">
          <span>In Motion</span>
          <strong>{activeCount}</strong>
        </article>
        <article className="metric-card">
          <span>Completed</span>
          <strong>{completedCount}</strong>
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

      <section className="courier-grid">
        <article className="jobs-panel">
          <div className="section-heading">
            <p className="eyebrow">1. Job actions</p>
            <h2>Run the last-mile handoff</h2>
            <p className="section-copy">
              Each button executes the live accept, pickup, or dropoff route through courier-bff.
            </p>
          </div>

          {demoState.followUpJobId && (demoState.canPickupFollowUp || demoState.canDropoffFollowUp) ? (
            <article className="continuation-card">
              <div>
                <p>Continue last handoff</p>
                <strong>{demoState.followUpJobId}</strong>
                <span>{demoState.followUpStatus}</span>
              </div>
              <div className="job-actions">
                <form method="post" action={`/jobs/${encodeURIComponent(demoState.followUpJobId)}/pickup`}>
                  <input type="hidden" name="courierId" value={courierId} />
                  <button
                    className="secondary-button"
                    type="submit"
                    disabled={!demoState.canPickupFollowUp}
                  >
                    Pickup
                  </button>
                </form>
                <form method="post" action={`/jobs/${encodeURIComponent(demoState.followUpJobId)}/dropoff`}>
                  <input type="hidden" name="courierId" value={courierId} />
                  <button
                    className="tertiary-button"
                    type="submit"
                    disabled={!demoState.canDropoffFollowUp}
                  >
                    Dropoff
                  </button>
                </form>
              </div>
            </article>
          ) : null}

          {jobs.length === 0 ? (
            <p className="notice">
              {demoState.followUpJobId
                ? "No new courier jobs are available right now, but the current handoff can continue below."
                : "No courier jobs are available yet in this environment."}
            </p>
          ) : (
            <ul className="job-list">
              {jobs.map((job) => {
                const state = describeCourierStatus(job.status);

                return (
                  <li className="job-card" key={job.jobId}>
                    <div className="job-header">
                      <div>
                        <p>Job</p>
                        <strong>{job.jobId}</strong>
                        <span>Order {job.orderId}</span>
                      </div>
                      <div className={`stage-pill tone-${state.tone}`}>
                        <span>Queue state</span>
                        <strong>{job.status}</strong>
                      </div>
                    </div>

                    <div className="job-actions">
                      <form method="post" action={`/jobs/${encodeURIComponent(job.jobId)}/accept`}>
                        <input type="hidden" name="courierId" value={courierId} />
                        <button className="primary-button" type="submit" disabled={!canAccept(job.status)}>
                          Accept
                        </button>
                      </form>
                      <form method="post" action={`/jobs/${encodeURIComponent(job.jobId)}/pickup`}>
                        <input type="hidden" name="courierId" value={courierId} />
                        <button className="secondary-button" type="submit" disabled={!canPickup(job.status)}>
                          Pickup
                        </button>
                      </form>
                      <form method="post" action={`/jobs/${encodeURIComponent(job.jobId)}/dropoff`}>
                        <input type="hidden" name="courierId" value={courierId} />
                        <button className="tertiary-button" type="submit" disabled={!canDropoff(job.status)}>
                          Dropoff
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <aside className="support-column">
          <article className="panel-card">
            <div className="section-heading">
              <p className="eyebrow">2. Demo cues</p>
              <h2>What to narrate</h2>
            </div>
            <ul className="cue-list">
              <li>
                <strong>Accept</strong>
                <span>Show the courier taking ownership of the assignment.</span>
              </li>
              <li>
                <strong>Pickup</strong>
                <span>Confirm the order is collected and the delivery clock is live.</span>
              </li>
              <li>
                <strong>Dropoff</strong>
                <span>Finish the flow, then jump back to consumer or admin to close the story.</span>
              </li>
            </ul>
          </article>

          <article className="panel-card">
            <div className="section-heading">
              <p className="eyebrow">3. Current focus</p>
              <h2>Delivery handoff</h2>
            </div>
            {primaryJob ? (
              <div className="focus-summary">
                <div>
                  <span>Courier</span>
                  <strong>{courierId}</strong>
                </div>
                <div>
                  <span>Order</span>
                  <strong>{primaryJob.orderId}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{primaryJob.status}</strong>
                </div>
              </div>
            ) : demoState.followUpJobId && demoState.followUpStatus ? (
              <div className="focus-summary">
                <div>
                  <span>Courier</span>
                  <strong>{courierId}</strong>
                </div>
                <div>
                  <span>Job</span>
                  <strong>{demoState.followUpJobId}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{demoState.followUpStatus}</strong>
                </div>
              </div>
            ) : (
              <p className="notice">Use merchant dispatch first, then this board becomes the next live step.</p>
            )}
          </article>
        </aside>
      </section>
    </main>
  );
}
