import { listAvailableCourierJobs } from "../src/lib/api";

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

export default async function CourierPage({ searchParams }: CourierPageProps) {
  const courierId = resolveCourierId(searchParams?.courierId ?? process.env.COURIER_ID);
  const jobs = await listAvailableCourierJobs().catch(() => []);

  return (
    <main className="shell">
      <section className="panel">
        <h1 className="headline">Courier Job Console</h1>
        <p className="meta">Executes accept, pickup, and dropoff actions through courier-bff.</p>
        <form className="actions" method="get" action="/">
          <input name="courierId" defaultValue={courierId} />
          <button type="submit" className="button">
            Set Courier
          </button>
        </form>
        {searchParams?.lastJobId && searchParams?.lastStatus ? (
          <p className="meta">
            Last action: <strong>{searchParams.lastJobId}</strong>{" "}
            <span className="chip">{searchParams.lastStatus}</span>
          </p>
        ) : null}
        {searchParams?.lastJobId ? (
          <div className="actions">
            <form method="post" action={`/jobs/${encodeURIComponent(searchParams.lastJobId)}/pickup`}>
              <input type="hidden" name="courierId" value={courierId} />
              <button className="button alt" type="submit">
                Pickup Last Job
              </button>
            </form>
            <form method="post" action={`/jobs/${encodeURIComponent(searchParams.lastJobId)}/dropoff`}>
              <input type="hidden" name="courierId" value={courierId} />
              <button className="button soft" type="submit">
                Dropoff Last Job
              </button>
            </form>
          </div>
        ) : null}
        {searchParams?.error ? <p className="meta">Last action failed: {searchParams.error}</p> : null}
        <ul className="list">
          {jobs.map((job) => (
            <li className="item" key={job.jobId}>
              <span>
                {job.jobId} ({job.orderId})
              </span>
              <span className="chip">{job.status}</span>
              <div className="actions">
                <form method="post" action={`/jobs/${encodeURIComponent(job.jobId)}/accept`}>
                  <input type="hidden" name="courierId" value={courierId} />
                  <button className="button" type="submit">
                    Accept
                  </button>
                </form>
                <form method="post" action={`/jobs/${encodeURIComponent(job.jobId)}/pickup`}>
                  <input type="hidden" name="courierId" value={courierId} />
                  <button className="button alt" type="submit">
                    Pickup
                  </button>
                </form>
                <form method="post" action={`/jobs/${encodeURIComponent(job.jobId)}/dropoff`}>
                  <input type="hidden" name="courierId" value={courierId} />
                  <button className="button soft" type="submit">
                    Dropoff
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
