import { type FastifyInstance } from "fastify";
import { type AppSessionAuthService, type OidcVerifier } from "@fleetfeast/app-auth";
export interface MerchantOrderView {
    id: string;
    status: string;
}
export interface MerchantPayoutStatementLineItemView {
    label: string;
    amount: number;
}
export interface MerchantPayoutStatementView {
    statementId: string;
    payoutBatchId: string;
    entityType: "MERCHANT";
    entityId: string;
    periodStart: string;
    periodEnd: string;
    currency: string;
    totalAmount: number;
    lineItems: MerchantPayoutStatementLineItemView[];
    format: "PDF" | "PLAINTEXT";
    renderedContent: string;
    createdAt: string;
}
export interface AdminIncidentView {
    id: string;
    severity: string;
}
export interface AdminSloBreachView {
    type: "AVAILABILITY" | "LATENCY_CHECKOUT" | "LATENCY_TIMELINE";
    actual: number;
    threshold: number;
}
export interface AdminSloDashboardView {
    availabilityPercent: number;
    checkoutP95Ms: number;
    timelineP95Ms: number;
    breaches: AdminSloBreachView[];
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
    listMerchantPayoutStatements(merchantId: string): Promise<MerchantPayoutStatementView[]>;
    listAdminIncidents(): Promise<AdminIncidentView[]>;
    getAdminSloDashboard(): Promise<AdminSloDashboardView>;
    getMerchantFeatureFlagSnapshot(context: OpsFeatureFlagContext): Promise<OpsFeatureFlagSnapshot>;
    getAdminFeatureFlagSnapshot(context: OpsFeatureFlagContext): Promise<OpsFeatureFlagSnapshot>;
    oidcVerifier: OidcVerifier;
    sessionAuth: AppSessionAuthService;
}
export interface OpsCoreApiDependencyOptions {
    coreApiBaseUrl: string;
    fetchImpl?: typeof fetch;
}
export declare function createOpsCoreApiDependencies(options: OpsCoreApiDependencyOptions): Pick<OpsBffDependencies, "listMerchantOrders" | "listMerchantPayoutStatements" | "listAdminIncidents" | "getAdminSloDashboard" | "getMerchantFeatureFlagSnapshot" | "getAdminFeatureFlagSnapshot">;
export declare function createOpsBffServer(dependencies: OpsBffDependencies): FastifyInstance;
export declare function createOpsBffServerFromEnv(): FastifyInstance;
