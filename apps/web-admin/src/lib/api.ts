export interface AdminIncidentView {
  id: string;
  severity: string;
}

export interface AdminApiOptions {
  opsBffBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

function resolveOpsBffBaseUrl(options?: AdminApiOptions): string {
  const candidate =
    options?.opsBffBaseUrl ??
    process.env.OPS_BFF_BASE_URL ??
    "http://127.0.0.1:4103";

  return candidate.replace(/\/+$/, "");
}

export async function fetchAdminIncidents(
  options?: AdminApiOptions,
): Promise<AdminIncidentView[]> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const baseUrl = resolveOpsBffBaseUrl(options);
  const response = await fetchImpl(`${baseUrl}/app/v1/admin/incidents`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("OPS_BFF_ADMIN_INCIDENTS_FETCH_FAILED");
  }

  const payload = (await response.json()) as {
    incidents?: Array<{ id: string; severity: string }>;
  };

  return (payload.incidents ?? []).map((incident) => ({
    id: incident.id,
    severity: incident.severity,
  }));
}
