import { InMemoryCourierJobRepository } from "../../../modules/dispatch/in-memory-courier-job-repository.js";
import type { CourierJob } from "../../../modules/dispatch/types.js";
import type { DocumentStore } from "../document-store.js";

const NAMESPACE = "dispatch.courier_jobs";

export class PersistentCourierJobRepository extends InMemoryCourierJobRepository {
  constructor(private readonly store: DocumentStore) {
    super();
  }

  override async save(job: CourierJob): Promise<void> {
    await this.store.put(NAMESPACE, job.jobId, { ...job });
  }

  override async findById(jobId: string): Promise<CourierJob | null> {
    const job = await this.store.get<CourierJob>(NAMESPACE, jobId);
    return job ? { ...job } : null;
  }

  override async list(): Promise<CourierJob[]> {
    const jobs = await this.store.list<CourierJob>(NAMESPACE);
    return jobs.map((job) => ({ ...job }));
  }
}
