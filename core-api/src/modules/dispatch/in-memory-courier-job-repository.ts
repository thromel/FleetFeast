import type { CourierJob } from "./types.js";

export class InMemoryCourierJobRepository {
  private readonly jobs = new Map<string, CourierJob>();

  async save(job: CourierJob): Promise<void> {
    this.jobs.set(job.jobId, { ...job });
  }

  async findById(jobId: string): Promise<CourierJob | null> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    return { ...job };
  }

  async list(): Promise<CourierJob[]> {
    return Array.from(this.jobs.values()).map((job) => ({ ...job }));
  }
}
