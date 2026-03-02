import { redirect } from "next/navigation";

import { acceptCourierJob, dropoffCourierJob, pickupCourierJob } from "../../../../src/lib/api";

function asNonEmptyFormValue(value: FormDataEntryValue | null, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export async function POST(
  request: Request,
  context: {
    params: {
      jobId: string;
      action: string;
    };
  },
): Promise<Response> {
  const formData = await request.formData();
  const courierId = asNonEmptyFormValue(formData.get("courierId"), "courier-1");
  const jobId = context.params.jobId;

  let job = null;
  try {
    job =
      context.params.action === "accept"
        ? await acceptCourierJob(jobId, courierId)
        : context.params.action === "pickup"
          ? await pickupCourierJob(jobId, courierId)
          : context.params.action === "dropoff"
            ? await dropoffCourierJob(jobId, courierId)
            : null;
  } catch {
    redirect(`/?courierId=${encodeURIComponent(courierId)}&error=COURIER_JOB_ACTION_FAILED`);
  }

  if (!job) {
    redirect(`/?courierId=${encodeURIComponent(courierId)}&error=INVALID_JOB_ACTION`);
  }

  redirect(
    `/?courierId=${encodeURIComponent(courierId)}&lastJobId=${encodeURIComponent(job.jobId)}&lastStatus=${encodeURIComponent(job.status)}`,
  );
}
