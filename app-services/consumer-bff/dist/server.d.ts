import { type FastifyInstance } from "fastify";
import { type AppSessionAuthService, type OidcVerifier } from "@fleetfeast/app-auth";
export interface ConsumerOrderView {
    id: string;
    status: string;
    timelineVersion: number;
}
export interface ConsumerFeatureFlagContext {
    userId: string;
    role: string;
    tenantId?: string;
}
export interface ConsumerFeatureFlagSnapshot {
    flags: Record<string, boolean>;
    ttlSeconds: number;
    generatedAtEpochMillis: number;
}
export interface ConsumerBffDependencies {
    getOrderById(orderId: string): Promise<ConsumerOrderView>;
    getFeatureFlagSnapshot(context: ConsumerFeatureFlagContext): Promise<ConsumerFeatureFlagSnapshot>;
    oidcVerifier: OidcVerifier;
    sessionAuth: AppSessionAuthService;
}
export interface ConsumerCoreApiDependencyOptions {
    coreApiBaseUrl: string;
    fetchImpl?: typeof fetch;
}
export declare function createConsumerCoreApiDependencies(options: ConsumerCoreApiDependencyOptions): Pick<ConsumerBffDependencies, "getOrderById" | "getFeatureFlagSnapshot">;
export declare function createConsumerBffServer(dependencies: ConsumerBffDependencies): FastifyInstance;
export declare function createConsumerBffServerFromEnv(): FastifyInstance;
