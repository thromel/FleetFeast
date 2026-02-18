import { type FastifyInstance } from "fastify";
export interface CourierJobView {
    jobId: string;
    orderId: string;
    status: string;
}
export interface CourierBffDependencies {
    listAvailableJobs(): Promise<CourierJobView[]>;
}
export declare function createCourierBffServer(dependencies: CourierBffDependencies): FastifyInstance;
