import { createAdminAuthSessionManager } from "../src/lib/auth-session-manager";
import {
  fetchAdminComplianceAuditEvents,
  fetchAdminFeatureFlags,
  fetchAdminIncidents,
  fetchAdminSloDashboard,
} from "../src/lib/api";

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
  const hasAppSession = typeof appSessionToken === "string" && appSessionToken.length > 0;
  const incidents = hasAppSession ? await fetchAdminIncidents({ appSessionToken }) : [];
  const complianceAuditEvents = hasAppSession
    ? await fetchAdminComplianceAuditEvents({ appSessionToken })
    : [];
  const sloDashboard = hasAppSession
    ? await fetchAdminSloDashboard({ appSessionToken })
    : null;
  const featureFlags =
    hasAppSession && featureFlagUserId && featureFlagRole
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
        {!hasAppSession ? (
          <p className="meta">
            App session required. Set `WEB_ADMIN_APP_SESSION_TOKEN` or `WEB_ADMIN_OIDC_TOKEN`.
          </p>
        ) : null}
        <ul className="list">
          {incidents.map((incident) => (
            <li key={incident.id} className="item">
              <span>{incident.id}</span>
              <span className="chip">{incident.severity}</span>
            </li>
          ))}
        </ul>
        <h2 className="headline">SLO Dashboard</h2>
        {sloDashboard ? (
          <ul className="list">
            <li className="item">
              <span>Availability</span>
              <span className="chip">{sloDashboard.availabilityPercent.toFixed(2)}%</span>
            </li>
            <li className="item">
              <span>Checkout P95</span>
              <span className="chip">{sloDashboard.checkoutP95Ms}ms</span>
            </li>
            <li className="item">
              <span>Timeline P95</span>
              <span className="chip">{sloDashboard.timelineP95Ms}ms</span>
            </li>
            {sloDashboard.breaches.map((breach, index) => (
              <li key={`${breach.type}-${index}`} className="item">
                <span>{breach.type}</span>
                <span className="chip">
                  {breach.actual} / {breach.threshold}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta">SLO metrics unavailable without an app session.</p>
        )}
        <h2 className="headline">Compliance Audit Feed</h2>
        {complianceAuditEvents.length > 0 ? (
          <ul className="list">
            {complianceAuditEvents.map((event) => (
              <li key={event.auditEventId} className="item">
                <span>
                  {event.actionType} · {event.actorId} · {event.reasonCode}
                </span>
                <span className="chip">{event.targetType}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta">No compliance audit events found for the current environment.</p>
        )}
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
