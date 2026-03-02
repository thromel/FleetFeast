import { type FastifyInstance } from "fastify";
import { type AppSessionAuthService, type OidcVerifier } from "@fleetfeast/app-auth";
export interface CourierJobView {
    jobId: string;
    orderId: string;
    status: string;
    courierId?: string | null;
}
export interface CourierFeatureFlagContext {
    userId: string;
    role: string;
    tenantId?: string;
}
export interface CourierFeatureFlagSnapshot {
    flags: Record<string, boolean>;
    ttlSeconds: number;
    generatedAtEpochMillis: number;
}
export interface CourierBffDependencies {
    listAvailableJobs(): Promise<CourierJobView[]>;
    acceptJob(jobId: string, courierId: string): Promise<CourierJobView>;
    pickupJob(jobId: string, courierId: string): Promise<CourierJobView>;
    dropoffJob(jobId: string, courierId: string): Promise<CourierJobView>;
    getFeatureFlagSnapshot(context: CourierFeatureFlagContext): Promise<CourierFeatureFlagSnapshot>;
    oidcVerifier: OidcVerifier;
    sessionAuth: AppSessionAuthService;
}
export interface CourierCoreApiDependencyOptions {
    coreApiBaseUrl: string;
    fetchImpl?: typeof fetch;
}
export declare function createCourierCoreApiDependencies(options: CourierCoreApiDependencyOptions): Pick<CourierBffDependencies, "listAvailableJobs" | "acceptJob" | "pickupJob" | "dropoffJob" | "getFeatureFlagSnapshot">;
export declare function createCourierBffServer(dependencies: CourierBffDependencies): FastifyInstance;
export declare function createCourierBffServerFromEnv(): FastifyInstance;
