import { InMemoryOrderRepository } from "../order-orchestration/in-memory-order-repository.js";
import { InMemoryCourierJobRepository } from "./in-memory-courier-job-repository.js";
import type { CourierJob } from "./types.js";

export class CourierJobNotFoundError extends Error {
  code = "COURIER_JOB_NOT_FOUND";

  constructor(jobId: string) {
    super(`Courier job '${jobId}' was not found.`);
    this.name = "CourierJobNotFoundError";
  }
}

export class CourierJobStateConflictError extends Error {
  code = "COURIER_JOB_STATE_CONFLICT";

  constructor(jobId: string, message: string) {
    super(`Courier job '${jobId}' state conflict: ${message}`);
    this.name = "CourierJobStateConflictError";
  }
}

export class CourierJobService {
  constructor(
    private readonly orderRepository: InMemoryOrderRepository,
    private readonly jobRepository: InMemoryCourierJobRepository,
  ) {}

  async listAvailableJobs(): Promise<CourierJob[]> {
    await this.syncDispatchPendingOrders();
    const jobs = await this.jobRepository.list();
    return jobs.filter((job) => job.status === "AVAILABLE");
  }

  async getJob(jobId: string): Promise<CourierJob> {
    await this.syncDispatchPendingOrders();
    return this.requireJob(jobId);
  }

  async acceptJob(jobId: string, courierId: string): Promise<CourierJob> {
    await this.syncDispatchPendingOrders();
    const job = await this.requireJob(jobId);

    if (job.status === "ACCEPTED" && job.courierId === courierId) {
      return job;
    }

    if (job.status !== "AVAILABLE") {
      throw new CourierJobStateConflictError(
        jobId,
        `expected AVAILABLE, received ${job.status}`,
      );
    }

    if (job.status === "AVAILABLE") {
      const updated: CourierJob = {
        ...job,
        status: "ACCEPTED",
        courierId,
        acceptedAt: new Date().toISOString(),
      };
      await this.jobRepository.save(updated);
      return updated;
    }

    return job;
  }

  async pickupJob(jobId: string, courierId: string): Promise<CourierJob> {
    await this.syncDispatchPendingOrders();
    const job = await this.requireJob(jobId);

    if (job.status === "PICKED_UP" && job.courierId === courierId) {
      return job;
    }

    if (job.status !== "ACCEPTED") {
      throw new CourierJobStateConflictError(
        jobId,
        `expected ACCEPTED, received ${job.status}`,
      );
    }

    if (job.courierId !== courierId) {
      throw new CourierJobStateConflictError(
        jobId,
        `courier mismatch: expected ${job.courierId ?? "none"}, received ${courierId}`,
      );
    }

    const updated: CourierJob = {
      ...job,
      status: "PICKED_UP",
      pickedUpAt: new Date().toISOString(),
    };
    await this.jobRepository.save(updated);
    return updated;
  }

  async dropoffJob(jobId: string, courierId: string): Promise<CourierJob> {
    await this.syncDispatchPendingOrders();
    const job = await this.requireJob(jobId);

    if (job.status === "DROPPED_OFF" && job.courierId === courierId) {
      return job;
    }

    if (job.status !== "PICKED_UP") {
      throw new CourierJobStateConflictError(
        jobId,
        `expected PICKED_UP, received ${job.status}`,
      );
    }

    if (job.courierId !== courierId) {
      throw new CourierJobStateConflictError(
        jobId,
        `courier mismatch: expected ${job.courierId ?? "none"}, received ${courierId}`,
      );
    }

    const updated: CourierJob = {
      ...job,
      status: "DROPPED_OFF",
      droppedOffAt: new Date().toISOString(),
    };
    await this.jobRepository.save(updated);
    return updated;
  }

  private async requireJob(jobId: string): Promise<CourierJob> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new CourierJobNotFoundError(jobId);
    }

    return job;
  }

  private async syncDispatchPendingOrders(): Promise<void> {
    const orders = await this.orderRepository.list();
    for (const order of orders) {
      if (order.status !== "DISPATCH_PENDING") {
        continue;
      }

      const existing = await this.jobRepository.findById(order.id);
      if (existing) {
        continue;
      }

      const job: CourierJob = {
        jobId: order.id,
        orderId: order.id,
        status: "AVAILABLE",
        courierId: null,
        acceptedAt: null,
        pickedUpAt: null,
        droppedOffAt: null,
      };
      await this.jobRepository.save(job);
    }
  }
}
