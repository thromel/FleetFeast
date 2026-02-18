import type { RealtimeEnvelope } from "@fleetfeast/shared-contracts";
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
export interface PushProviderSender {
    provider: PushProvider;
    send(message: PushFallbackMessage): Promise<void>;
}
export interface PushProviderHttpAdapterOptions {
    endpoint: string;
    authToken?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
}
export declare function createNoopPushProviderSender(provider: PushProvider): PushProviderSender;
export declare function createApnsPushProviderSender(options: PushProviderHttpAdapterOptions): PushProviderSender;
export declare function createFcmPushProviderSender(options: PushProviderHttpAdapterOptions): PushProviderSender;
export declare function createRoutingPushFallbackNotifier(senders: PushProviderSender[]): PushFallbackNotifier;
export interface PushFallbackNotifierFromEnvOptions {
    fetchImpl?: typeof fetch;
}
export declare function createPushFallbackNotifierFromEnv(env?: NodeJS.ProcessEnv, options?: PushFallbackNotifierFromEnvOptions): PushFallbackNotifier;
