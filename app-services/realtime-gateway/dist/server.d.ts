import { type FastifyInstance } from "fastify";
import { type RealtimeEnvelope } from "@fleetfeast/shared-contracts";
export type PushProvider = "apns" | "fcm";
export interface PushFallbackTarget {
    channel: string;
    userId: string;
    pushToken: string;
    provider: PushProvider;
}
export interface PushFallbackMessage {
    channel: string;
    envelope: RealtimeEnvelope;
    target: PushFallbackTarget;
    reason: "NO_ACTIVE_SOCKET";
}
export interface PushFallbackNotifier {
    send(message: PushFallbackMessage): Promise<void>;
}
export interface RealtimeGatewayOptions {
    pushFallbackNotifier?: PushFallbackNotifier;
}
export interface RealtimeGateway {
    app: FastifyInstance;
    publishToChannel(channel: string, envelope: RealtimeEnvelope): Promise<void>;
}
export declare function createRealtimeGatewayServer(options?: RealtimeGatewayOptions): RealtimeGateway;
