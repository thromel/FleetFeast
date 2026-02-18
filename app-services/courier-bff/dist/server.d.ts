import { type FastifyInstance } from "fastify";
export interface CourierJobView {
    jobId: string;
    orderId: string;
    status: string;
}
export interface CourierBffDependencies {
    listAvailableJobs(): Promise<CourierJobView[]>;
}
export interface CourierCoreApiDependencyOptions {
    coreApiBaseUrl: string;
    fetchImpl?: typeof fetch;
}
export declare function createCourierCoreApiDependencies(options: CourierCoreApiDependencyOptions): CourierBffDependencies;
export declare function createCourierBffServer(dependencies: CourierBffDependencies): FastifyInstance;
export declare function createCourierBffServerFromEnv(): FastifyInstance;
