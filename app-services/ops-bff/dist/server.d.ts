import { type FastifyInstance } from "fastify";
import { type AppSessionAuthService, type OidcVerifier } from "@fleetfeast/app-auth";
export interface MerchantOrderView {
    id: string;
    status: string;
}
export interface AdminIncidentView {
    id: string;
    severity: string;
}
export interface OpsFeatureFlagContext {
    userId: string;
    role: string;
    tenantId?: string;
}
export interface OpsFeatureFlagSnapshot {
    flags: Record<string, boolean>;
    ttlSeconds: number;
    generatedAtEpochMillis: number;
}
export interface OpsBffDependencies {
    listMerchantOrders(merchantId: string): Promise<MerchantOrderView[]>;
    listAdminIncidents(): Promise<AdminIncidentView[]>;
    getMerchantFeatureFlagSnapshot(context: OpsFeatureFlagContext): Promise<OpsFeatureFlagSnapshot>;
    getAdminFeatureFlagSnapshot(context: OpsFeatureFlagContext): Promise<OpsFeatureFlagSnapshot>;
    oidcVerifier: OidcVerifier;
    sessionAuth: AppSessionAuthService;
}
export interface OpsCoreApiDependencyOptions {
    coreApiBaseUrl: string;
    fetchImpl?: typeof fetch;
}
export declare function createOpsCoreApiDependencies(options: OpsCoreApiDependencyOptions): Pick<OpsBffDependencies, "listMerchantOrders" | "listAdminIncidents" | "getMerchantFeatureFlagSnapshot" | "getAdminFeatureFlagSnapshot">;
export declare function createOpsBffServer(dependencies: OpsBffDependencies): FastifyInstance;
export declare function createOpsBffServerFromEnv(): FastifyInstance;
