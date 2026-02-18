import Fastify from "fastify";
import websocketPlugin from "@fastify/websocket";
import { WebSocket } from "ws";
import { isRealtimeEnvelope } from "@fleetfeast/shared-contracts";
import { createPushFallbackNotifierFromEnv, } from "./push-fallback.js";
export function createRealtimeGatewayServer(options = {}) {
    const app = Fastify();
    const subscribers = new Map();
    const pushRegistrations = new Map();
    const notifier = options.pushFallbackNotifier ?? createPushFallbackNotifierFromEnv(process.env);
    const publishApiKey = process.env.REALTIME_PUBLISH_API_KEY;
    app.register(async (instance) => {
        await instance.register(websocketPlugin);
        instance.route({
            method: "GET",
            url: "/app/v1/realtime/connect",
            handler: async (_request, reply) => {
                reply.status(426);
                return {
                    errorCode: "WEBSOCKET_UPGRADE_REQUIRED",
                    message: "Use websocket upgrade for this endpoint",
                };
            },
            wsHandler: (socket, request) => {
                const query = (request.query ?? {});
                if (typeof query.channel !== "string" || query.channel.trim().length === 0) {
                    socket.close(1008, "channel is required");
                    return;
                }
                const channel = query.channel;
                const channelSet = subscribers.get(channel) ?? new Set();
                channelSet.add(socket);
                subscribers.set(channel, channelSet);
                socket.on("close", () => {
                    const current = subscribers.get(channel);
                    if (!current) {
                        return;
                    }
                    current.delete(socket);
                    if (current.size === 0) {
                        subscribers.delete(channel);
                    }
                });
            },
        });
    });
    app.post("/app/v1/realtime/push/register", async (request, reply) => {
        const payload = request.body;
        if (typeof payload?.channel !== "string" ||
            payload.channel.trim().length === 0 ||
            typeof payload?.userId !== "string" ||
            payload.userId.trim().length === 0 ||
            typeof payload?.pushToken !== "string" ||
            payload.pushToken.trim().length === 0 ||
            (payload?.provider !== "apns" && payload?.provider !== "fcm")) {
            reply.status(400);
            return {
                errorCode: "INVALID_PUSH_REGISTRATION_PAYLOAD",
                message: "channel, userId, pushToken, and provider (apns|fcm) are required",
            };
        }
        const byUserId = pushRegistrations.get(payload.channel) ?? new Map();
        byUserId.set(payload.userId, {
            channel: payload.channel,
            userId: payload.userId,
            pushToken: payload.pushToken,
            provider: payload.provider,
        });
        pushRegistrations.set(payload.channel, byUserId);
        return { registered: true };
    });
    app.post("/app/v1/realtime/push/unregister", async (request, reply) => {
        const payload = request.body;
        if (typeof payload?.channel !== "string" ||
            payload.channel.trim().length === 0 ||
            typeof payload?.userId !== "string" ||
            payload.userId.trim().length === 0) {
            reply.status(400);
            return {
                errorCode: "INVALID_PUSH_UNREGISTER_PAYLOAD",
                message: "channel and userId are required",
            };
        }
        const byUserId = pushRegistrations.get(payload.channel);
        if (!byUserId) {
            return { removed: false };
        }
        byUserId.delete(payload.userId);
        if (byUserId.size === 0) {
            pushRegistrations.delete(payload.channel);
        }
        return { removed: true };
    });
    app.post("/app/v1/realtime/publish", async (request, reply) => {
        if (publishApiKey && request.headers["x-realtime-publish-key"] !== publishApiKey) {
            reply.status(401);
            return {
                errorCode: "REALTIME_PUBLISH_UNAUTHORIZED",
                message: "x-realtime-publish-key header is invalid",
            };
        }
        const payload = request.body;
        if (typeof payload?.channel !== "string" || payload.channel.trim().length === 0) {
            reply.status(400);
            return {
                errorCode: "INVALID_REALTIME_PUBLISH_PAYLOAD",
                message: "channel is required",
            };
        }
        if (!isRealtimeEnvelope(payload.envelope)) {
            reply.status(400);
            return {
                errorCode: "INVALID_REALTIME_PUBLISH_PAYLOAD",
                message: "envelope is invalid",
            };
        }
        await publishToChannel(payload.channel, payload.envelope);
        return { published: true };
    });
    async function publishToChannel(channel, envelope) {
        if (!isRealtimeEnvelope(envelope)) {
            throw new Error("INVALID_REALTIME_ENVELOPE");
        }
        const channelSet = subscribers.get(channel);
        const payload = JSON.stringify(envelope);
        let openSocketCount = 0;
        if (channelSet) {
            for (const socket of channelSet) {
                if (socket.readyState !== WebSocket.OPEN) {
                    continue;
                }
                socket.send(payload);
                openSocketCount += 1;
            }
        }
        if (openSocketCount > 0) {
            return;
        }
        const byUserId = pushRegistrations.get(channel);
        if (!byUserId || byUserId.size === 0) {
            return;
        }
        const results = await Promise.allSettled([...byUserId.values()].map((target) => notifier.send({
            channel,
            envelope,
            target,
            reason: "NO_ACTIVE_SOCKET",
        })));
        for (const result of results) {
            if (result.status === "rejected") {
                app.log.error({
                    channel,
                    error: result.reason,
                }, "Failed to deliver push fallback notification");
            }
        }
    }
    return {
        app,
        publishToChannel,
    };
}
export function createRealtimeGatewayServerFromEnv() {
    return createRealtimeGatewayServer({
        pushFallbackNotifier: createPushFallbackNotifierFromEnv(process.env),
    });
}
//# sourceMappingURL=server.js.map