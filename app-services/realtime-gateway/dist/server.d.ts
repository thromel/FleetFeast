import { type FastifyInstance } from "fastify";
import { type RealtimeEnvelope } from "@fleetfeast/shared-contracts";
export interface RealtimeGateway {
    app: FastifyInstance;
    publishToChannel(channel: string, envelope: RealtimeEnvelope): void;
}
export declare function createRealtimeGatewayServer(): RealtimeGateway;
