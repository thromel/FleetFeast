import { InMemoryStoreStatusRepository } from "./in-memory-store-status-repository.js";
import type {
  StoreOrderability,
  StoreStatus,
  UpdateStoreStatusInput,
} from "./store-status-types.js";

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map((value) => Number(value));
  return hours * 60 + minutes;
}

function getCurrentMinutesUtc(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export class StoreStatusService {
  constructor(private readonly repository: InMemoryStoreStatusRepository) {}

  async setStatus(storeId: string, input: UpdateStoreStatusInput): Promise<StoreStatus> {
    const status: StoreStatus = {
      storeId,
      paused: input.paused,
      schedule: {
        open: input.schedule.open,
        close: input.schedule.close,
        timezone: input.schedule.timezone,
      },
      updatedAt: new Date().toISOString(),
    };

    await this.repository.save(status);
    return status;
  }

  async evaluateOrderability(storeId: string, at = new Date()): Promise<StoreOrderability> {
    const status = await this.repository.findByStoreId(storeId);
    if (!status) {
      return {
        orderable: false,
        reason: "STORE_STATUS_NOT_CONFIGURED",
        evaluatedAt: at.toISOString(),
      };
    }

    if (status.paused) {
      return {
        orderable: false,
        reason: "STORE_PAUSED",
        evaluatedAt: at.toISOString(),
      };
    }

    // For this v1 baseline we evaluate in UTC. Non-UTC timezone conversion
    // can be introduced in a dedicated enhancement story.
    const nowMinutes = getCurrentMinutesUtc(at);
    const openMinutes = toMinutes(status.schedule.open);
    const closeMinutes = toMinutes(status.schedule.close);

    const withinHours =
      openMinutes <= closeMinutes
        ? nowMinutes >= openMinutes && nowMinutes <= closeMinutes
        : nowMinutes >= openMinutes || nowMinutes <= closeMinutes;

    if (!withinHours) {
      return {
        orderable: false,
        reason: "OUTSIDE_STORE_HOURS",
        evaluatedAt: at.toISOString(),
      };
    }

    return {
      orderable: true,
      reason: "OK",
      evaluatedAt: at.toISOString(),
    };
  }
}
