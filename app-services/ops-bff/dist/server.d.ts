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
export interface OpsBffDependencies {
    listMerchantOrders(merchantId: string): Promise<MerchantOrderView[]>;
    listAdminIncidents(): Promise<AdminIncidentView[]>;
    oidcVerifier: OidcVerifier;
    sessionAuth: AppSessionAuthService;
}
export interface OpsCoreApiDependencyOptions {
    coreApiBaseUrl: string;
    fetchImpl?: typeof fetch;
}
export declare function createOpsCoreApiDependencies(options: OpsCoreApiDependencyOptions): Pick<OpsBffDependencies, "listMerchantOrders" | "listAdminIncidents">;
export declare function createOpsBffServer(dependencies: OpsBffDependencies): FastifyInstance;
export declare function createOpsBffServerFromEnv(): FastifyInstance;
