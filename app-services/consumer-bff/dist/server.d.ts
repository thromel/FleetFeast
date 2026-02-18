import { type FastifyInstance } from "fastify";
export interface ConsumerOrderView {
    id: string;
    status: string;
    timelineVersion: number;
}
export interface ConsumerBffDependencies {
    getOrderById(orderId: string): Promise<ConsumerOrderView>;
}
export declare function createConsumerBffServer(dependencies: ConsumerBffDependencies): FastifyInstance;
