import { exchangeAdminSession, fetchAdminIncidents } from "../src/lib/api";

export default async function AdminPage() {
  const appSessionToken =
    process.env.WEB_ADMIN_APP_SESSION_TOKEN ??
    (process.env.WEB_ADMIN_OIDC_TOKEN
      ? await exchangeAdminSession({
          oidcToken: process.env.WEB_ADMIN_OIDC_TOKEN,
          traceId: `web-admin-${Date.now()}`,
          deviceId: "web-admin",
        })
      : undefined);
  const incidents = await fetchAdminIncidents({ appSessionToken });

  return (
    <main className="shell">
      <section className="panel">
        <h1 className="headline">Platform Incident Console</h1>
        <p className="meta">Live severity feed from ops-bff observability projection.</p>
        <ul className="list">
          {incidents.map((incident) => (
            <li key={incident.id} className="item">
              <span>{incident.id}</span>
              <span className="chip">{incident.severity}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
