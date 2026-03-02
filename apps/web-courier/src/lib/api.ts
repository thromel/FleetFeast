export interface CourierJobView {
  jobId: string;
  orderId: string;
  status: string;
  courierId?: string | null;
}

export interface CourierApiOptions {
  courierBffBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export async function listAvailableCourierJobs(options?: CourierApiOptions): Promise<CourierJobView[]> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const baseUrl = resolveCourierBffBaseUrl(options);
  const response = await fetchImpl(`${baseUrl}/app/v1/courier/jobs/available`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("COURIER_BFF_AVAILABLE_JOBS_FETCH_FAILED");
  }

  const payload = (await response.json()) as { jobs?: CourierJobView[] };
  return payload.jobs ?? [];
}

export async function acceptCourierJob(
  jobId: string,
  courierId: string,
  options?: CourierApiOptions,
): Promise<CourierJobView> {
  return postCourierJobAction(jobId, "accept", courierId, options);
}

export async function pickupCourierJob(
  jobId: string,
  courierId: string,
  options?: CourierApiOptions,
): Promise<CourierJobView> {
  return postCourierJobAction(jobId, "pickup", courierId, options);
}

export async function dropoffCourierJob(
  jobId: string,
  courierId: string,
  options?: CourierApiOptions,
): Promise<CourierJobView> {
  return postCourierJobAction(jobId, "dropoff", courierId, options);
}

async function postCourierJobAction(
  jobId: string,
  action: "accept" | "pickup" | "dropoff",
  courierId: string,
  options?: CourierApiOptions,
): Promise<CourierJobView> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const baseUrl = resolveCourierBffBaseUrl(options);
  const response = await fetchImpl(
    `${baseUrl}/app/v1/courier/jobs/${encodeURIComponent(jobId)}/${action}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ courierId }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error("COURIER_BFF_JOB_ACTION_FAILED");
  }

  const payload = (await response.json()) as { job?: CourierJobView };
  if (!payload.job) {
    throw new Error("COURIER_BFF_JOB_ACTION_INVALID_PAYLOAD");
  }

  return payload.job;
}

function resolveCourierBffBaseUrl(options?: CourierApiOptions): string {
  const candidate =
    options?.courierBffBaseUrl ??
    process.env.COURIER_BFF_BASE_URL ??
    "http://127.0.0.1:4102";

  return candidate.replace(/\/+$/, "");
}
