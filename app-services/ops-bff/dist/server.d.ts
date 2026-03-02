import { type FastifyInstance } from "fastify";
import { type AppSessionAuthService, type OidcVerifier } from "@fleetfeast/app-auth";
export interface MerchantOrderView {
    id: string;
    status: string;
}
export interface DispatchAssignmentCandidateInput {
    courierId: string;
    distanceMeters: number;
    available: boolean;
    activeOrders: number;
    withinRestWindow: boolean;
}
export interface RequestDispatchAssignmentInput {
    candidates: DispatchAssignmentCandidateInput[];
    slaPressure: number;
    merchantSelfDeliveryEnabled: boolean;
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
export interface AdminComplianceAuditEventView {
    auditEventId: string;
    actionType: string;
    actorId: string;
    targetType: string;
    targetId: string;
    reasonCode: string;
    metadata: Record<string, unknown>;
    timestamp: string;
    previousHash: string;
    hash: string;
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
    acceptMerchantOrder(orderId: string): Promise<MerchantOrderView>;
    requestDispatchAssignment(orderId: string, input?: RequestDispatchAssignmentInput): Promise<MerchantOrderView>;
    listMerchantPayoutStatements(merchantId: string): Promise<MerchantPayoutStatementView[]>;
    listAdminIncidents(): Promise<AdminIncidentView[]>;
    listAdminComplianceAuditEvents(): Promise<AdminComplianceAuditEventView[]>;
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
export declare function createOpsCoreApiDependencies(options: OpsCoreApiDependencyOptions): Pick<OpsBffDependencies, "acceptMerchantOrder" | "requestDispatchAssignment" | "listMerchantOrders" | "listMerchantPayoutStatements" | "listAdminIncidents" | "listAdminComplianceAuditEvents" | "getAdminSloDashboard" | "getMerchantFeatureFlagSnapshot" | "getAdminFeatureFlagSnapshot">;
export declare function createOpsBffServer(dependencies: OpsBffDependencies): FastifyInstance;
export declare function createOpsBffServerFromEnv(): FastifyInstance;
