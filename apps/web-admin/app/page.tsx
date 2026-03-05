import { buildDemoSurfaceLinks } from "@fleetfeast/shared-contracts";

import { createAdminAuthSessionManager } from "../src/lib/auth-session-manager";
import {
  fetchAdminComplianceAuditEvents,
  fetchAdminFeatureFlags,
  fetchAdminIncidents,
  fetchAdminSloDashboard,
} from "../src/lib/api";

function summarizePlatformState(
  incidentCount: number,
  breachCount: number,
): { label: string; tone: "attention" | "active" | "complete" } {
  if (incidentCount > 0) {
    return { label: "Incident Review", tone: "attention" };
  }

  if (breachCount > 0) {
    return { label: "SLO Watch", tone: "active" };
  }

  return { label: "Platform Stable", tone: "complete" };
}

export default async function AdminPage() {
  const sessionExchange = process.env.WEB_ADMIN_OIDC_TOKEN
    ? await createAdminAuthSessionManager().signIn({
        oidcToken: process.env.WEB_ADMIN_OIDC_TOKEN,
        traceId: `web-admin-${Date.now()}`,
        deviceId: "web-admin",
      })
    : null;
  const appSessionToken =
    process.env.WEB_ADMIN_APP_SESSION_TOKEN ?? sessionExchange?.tokenPair.accessToken;
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

  const platformState = summarizePlatformState(
    incidents.length,
    sloDashboard?.breaches.length ?? 0,
  );
  const criticalIncidents = incidents.filter((incident) =>
    ["SEV1", "SEV2", "CRITICAL", "HIGH"].includes(incident.severity.toUpperCase()),
  ).length;
  const demoLinks = buildDemoSurfaceLinks("admin");

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div className="hero-copy">
          <span className="persona-pill">Admin Demo</span>
          <h1>Operations Room</h1>
          <p className="lede">
            Close the walkthrough here with service health, live incident posture, and the control
            plane view across the platform.
          </p>
          <div className={`stage-pill tone-${platformState.tone}`}>
            <span>Platform state</span>
            <strong>{platformState.label}</strong>
          </div>
        </div>

        <article className="focus-card">
          <p className="eyebrow">Control Surface</p>
          <h2>{hasAppSession ? "Live admin feed connected" : "Admin session required"}</h2>
          <p className="focus-copy">
            {hasAppSession
              ? "Use this screen to prove the platform has operator visibility after the order flow completes."
              : "Set `WEB_ADMIN_APP_SESSION_TOKEN` or `WEB_ADMIN_OIDC_TOKEN` to load the operational dashboards."}
          </p>
          {!hasAppSession ? (
            <p className="notice">
              App session required. Set `WEB_ADMIN_APP_SESSION_TOKEN` or `WEB_ADMIN_OIDC_TOKEN`.
            </p>
          ) : null}
        </article>
      </section>

      <section className="metrics-strip" aria-label="Admin highlights">
        <article className="metric-card">
          <span>Open Incidents</span>
          <strong>{incidents.length}</strong>
        </article>
        <article className="metric-card">
          <span>Critical Signals</span>
          <strong>{criticalIncidents}</strong>
        </article>
        <article className="metric-card">
          <span>SLO Breaches</span>
          <strong>{sloDashboard?.breaches.length ?? 0}</strong>
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

      <section className="admin-grid">
        <article className="health-panel">
          <div className="section-heading">
            <p className="eyebrow">1. Service health</p>
            <h2>SLO dashboard</h2>
            <p className="section-copy">
              This is the operator-ready view for availability and latency right after the demo
              order completes.
            </p>
          </div>

          {sloDashboard ? (
            <>
              <div className="slo-cards">
                <div className="slo-card">
                  <span>Availability</span>
                  <strong>{sloDashboard.availabilityPercent.toFixed(2)}%</strong>
                </div>
                <div className="slo-card">
                  <span>Checkout p95</span>
                  <strong>{sloDashboard.checkoutP95Ms}ms</strong>
                </div>
                <div className="slo-card">
                  <span>Timeline p95</span>
                  <strong>{sloDashboard.timelineP95Ms}ms</strong>
                </div>
              </div>

              {sloDashboard.breaches.length > 0 ? (
                <ul className="feed-list">
                  {sloDashboard.breaches.map((breach, index) => (
                    <li key={`${breach.type}-${index}`} className="feed-item">
                      <div>
                        <strong>{breach.type}</strong>
                        <p>
                          Actual {breach.actual} against threshold {breach.threshold}
                        </p>
                      </div>
                      <span className="chip">Breach</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="notice success">No active SLO breaches in the current environment.</p>
              )}
            </>
          ) : (
            <p className="notice">SLO metrics unavailable without an admin app session.</p>
          )}
        </article>

        <aside className="support-column">
          <article className="panel-card">
            <div className="section-heading">
              <p className="eyebrow">2. Incident feed</p>
              <h2>Platform alerts</h2>
            </div>
            {incidents.length > 0 ? (
              <ul className="feed-list">
                {incidents.map((incident) => (
                  <li key={incident.id} className="feed-item">
                    <div>
                      <strong>{incident.id}</strong>
                      <p>Severity {incident.severity}</p>
                    </div>
                    <span className="chip">{incident.severity}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="notice">No incidents are open in this environment right now.</p>
            )}
          </article>

          <article className="panel-card">
            <div className="section-heading">
              <p className="eyebrow">3. Rollout controls</p>
              <h2>Feature flags</h2>
            </div>
            {featureFlags ? (
              <>
                <p className="section-copy">Snapshot TTL: {featureFlags.ttlSeconds}s</p>
                <ul className="feed-list">
                  {Object.entries(featureFlags.flags).map(([flagKey, enabled]) => (
                    <li key={flagKey} className="feed-item">
                      <div>
                        <strong>{flagKey}</strong>
                        <p>Role-aware flag evaluation from ops-bff</p>
                      </div>
                      <span className="chip">{enabled ? "ON" : "OFF"}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="notice">
                Feature-flag context unavailable. Set `WEB_ADMIN_FEATURE_FLAG_USER_ID` and
                `WEB_ADMIN_FEATURE_FLAG_ROLE` or provide `WEB_ADMIN_OIDC_TOKEN`.
              </p>
            )}
          </article>

          <article className="panel-card compact">
            <div className="section-heading">
              <p className="eyebrow">4. Audit sample</p>
              <h2>Recent administrative actions</h2>
            </div>
            {complianceAuditEvents.length > 0 ? (
              <ul className="feed-list compact-list">
                {complianceAuditEvents.slice(0, 5).map((event) => (
                  <li key={event.auditEventId} className="feed-item">
                    <div>
                      <strong>{event.actionType}</strong>
                      <p>
                        {event.actorId} · {event.reasonCode}
                      </p>
                    </div>
                    <span className="chip">{event.targetType}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="notice">No recent audit events found for the current environment.</p>
            )}
          </article>
        </aside>
      </section>
    </main>
  );
}
