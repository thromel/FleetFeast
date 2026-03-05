import type { CourierJobView } from "./api";

export interface BuildCourierDemoStateInput {
  jobs: CourierJobView[];
  lastJobId?: string;
  lastStatus?: string;
}

export interface CourierDemoState {
  primaryJob: CourierJobView | null;
  followUpJobId: string | null;
  followUpStatus: string | null;
  canPickupFollowUp: boolean;
  canDropoffFollowUp: boolean;
}

function trimValue(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildCourierDemoState(input: BuildCourierDemoStateInput): CourierDemoState {
  const followUpJobId = trimValue(input.lastJobId);
  const followUpStatus = trimValue(input.lastStatus);
  const primaryJob = followUpJobId
    ? input.jobs.find((job) => job.jobId === followUpJobId) ?? input.jobs[0] ?? null
    : input.jobs[0] ?? null;

  return {
    primaryJob,
    followUpJobId,
    followUpStatus,
    canPickupFollowUp: followUpStatus === "ASSIGNED" || followUpStatus === "ACCEPTED",
    canDropoffFollowUp: followUpStatus === "PICKED_UP",
  };
}
