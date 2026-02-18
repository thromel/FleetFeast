import { type FastifyInstance } from "fastify";
export interface ConsumerOrderView {
    id: string;
    status: string;
    timelineVersion: number;
}
export interface ConsumerBffDependencies {
    getOrderById(orderId: string): Promise<ConsumerOrderView>;
}
export interface ConsumerCoreApiDependencyOptions {
    coreApiBaseUrl: string;
    fetchImpl?: typeof fetch;
}
export declare function createConsumerCoreApiDependencies(options: ConsumerCoreApiDependencyOptions): ConsumerBffDependencies;
export declare function createConsumerBffServer(dependencies: ConsumerBffDependencies): FastifyInstance;
export declare function createConsumerBffServerFromEnv(): FastifyInstance;
