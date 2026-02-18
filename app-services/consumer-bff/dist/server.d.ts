import { type FastifyInstance } from "fastify";
import { type AppSessionAuthService, type OidcVerifier } from "@fleetfeast/app-auth";
export interface ConsumerOrderView {
    id: string;
    status: string;
    timelineVersion: number;
}
export interface ConsumerBffDependencies {
    getOrderById(orderId: string): Promise<ConsumerOrderView>;
    oidcVerifier: OidcVerifier;
    sessionAuth: AppSessionAuthService;
}
export interface ConsumerCoreApiDependencyOptions {
    coreApiBaseUrl: string;
    fetchImpl?: typeof fetch;
}
export declare function createConsumerCoreApiDependencies(options: ConsumerCoreApiDependencyOptions): Pick<ConsumerBffDependencies, "getOrderById">;
export declare function createConsumerBffServer(dependencies: ConsumerBffDependencies): FastifyInstance;
export declare function createConsumerBffServerFromEnv(): FastifyInstance;
