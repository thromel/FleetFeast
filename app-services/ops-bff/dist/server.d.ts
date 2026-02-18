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
export declare function createOpsBffServer(dependencies: OpsBffDependencies): FastifyInstance;
