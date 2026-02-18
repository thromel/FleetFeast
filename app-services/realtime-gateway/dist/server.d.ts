import { type FastifyInstance } from "fastify";
import { type RealtimeEnvelope } from "@fleetfeast/shared-contracts";
import { type PushFallbackNotifier } from "./push-fallback.js";
export interface RealtimeGatewayOptions {
    pushFallbackNotifier?: PushFallbackNotifier;
}
export interface RealtimeGateway {
    app: FastifyInstance;
    publishToChannel(channel: string, envelope: RealtimeEnvelope): Promise<void>;
}
export declare function createRealtimeGatewayServer(options?: RealtimeGatewayOptions): RealtimeGateway;
export declare function createRealtimeGatewayServerFromEnv(): RealtimeGateway;
