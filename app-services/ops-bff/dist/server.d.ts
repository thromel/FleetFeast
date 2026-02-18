import { type FastifyInstance } from "fastify";
export interface MerchantOrderView {
    id: string;
    status: string;
}
export interface AdminIncidentView {
    id: string;
    severity: string;
}
export interface OpsBffDependencies {
    listMerchantOrders(merchantId: string): Promise<MerchantOrderView[]>;
    listAdminIncidents(): Promise<AdminIncidentView[]>;
}
export interface OpsCoreApiDependencyOptions {
    coreApiBaseUrl: string;
    fetchImpl?: typeof fetch;
}
export declare function createOpsCoreApiDependencies(options: OpsCoreApiDependencyOptions): OpsBffDependencies;
export declare function createOpsBffServer(dependencies: OpsBffDependencies): FastifyInstance;
export declare function createOpsBffServerFromEnv(): FastifyInstance;
