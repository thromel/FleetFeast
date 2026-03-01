import { createAdminAuthSessionManager } from "../src/lib/auth-session-manager";
import { fetchAdminFeatureFlags, fetchAdminIncidents } from "../src/lib/api";

export default async function AdminPage() {
  const sessionExchange = process.env.WEB_ADMIN_OIDC_TOKEN
    ? await createAdminAuthSessionManager().signIn({
        oidcToken: process.env.WEB_ADMIN_OIDC_TOKEN,
        traceId: `web-admin-${Date.now()}`,
        deviceId: "web-admin",
      })
    : null;
  const appSessionToken = process.env.WEB_ADMIN_APP_SESSION_TOKEN ?? sessionExchange?.tokenPair.accessToken;
  const featureFlagUserId =
    process.env.WEB_ADMIN_FEATURE_FLAG_USER_ID ?? sessionExchange?.session.userId;
  const featureFlagRole = process.env.WEB_ADMIN_FEATURE_FLAG_ROLE ?? sessionExchange?.session.role;
  const featureFlagTenantId = process.env.WEB_ADMIN_FEATURE_FLAG_TENANT_ID;
  const incidents = await fetchAdminIncidents({ appSessionToken });
  const featureFlags =
    featureFlagUserId && featureFlagRole
      ? await fetchAdminFeatureFlags(
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
            Feature-flag context unavailable. Set `WEB_ADMIN_FEATURE_FLAG_USER_ID` and
            `WEB_ADMIN_FEATURE_FLAG_ROLE` or provide `WEB_ADMIN_OIDC_TOKEN`.
          </p>
        )}
      </section>
    </main>
  );
}
