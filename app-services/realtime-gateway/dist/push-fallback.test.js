import assert from "node:assert/strict";
import test from "node:test";
import { createApnsPushProviderSender, createFcmPushProviderSender, createPushFallbackNotifierFromEnv, createRoutingPushFallbackNotifier, } from "./push-fallback.js";
function createMessage(provider) {
    return {
        channel: "consumer.order.order-1",
        reason: "NO_ACTIVE_SOCKET",
        target: {
            channel: "consumer.order.order-1",
            userId: "user-1",
            pushToken: `${provider}-token-1`,
            provider,
        },
        envelope: {
            eventType: "order.confirmed.v1",
            entityId: "order-1",
            occurredAt: new Date().toISOString(),
            traceId: "trace-push-1",
            payload: { status: "MERCHANT_ACCEPTED" },
        },
    };
}
test("routing notifier dispatches to matching provider sender", async () => {
    const calledProviders = [];
    const notifier = createRoutingPushFallbackNotifier([
        {
            provider: "apns",
            async send() {
                calledProviders.push("apns");
            },
        },
        {
            provider: "fcm",
            async send() {
                calledProviders.push("fcm");
            },
        },
    ]);
    await notifier.send(createMessage("apns"));
    await notifier.send(createMessage("fcm"));
    assert.deepEqual(calledProviders, ["apns", "fcm"]);
});
test("apns provider sender posts APNs-shaped payload", async () => {
    const requests = [];
    const sender = createApnsPushProviderSender({
        endpoint: "https://push.example/apns",
        authToken: "apns-auth",
        fetchImpl: async (input, init) => {
            requests.push({
                url: typeof input === "string" ? input : String(input),
                init,
            });
            return new Response("", { status: 200 });
        },
    });
    await sender.send(createMessage("apns"));
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, "https://push.example/apns");
    assert.equal(requests[0]?.init?.method, "POST");
    const headers = requests[0]?.init?.headers;
    assert.equal(headers.authorization, "Bearer apns-auth");
    const payload = JSON.parse(String(requests[0]?.init?.body));
    assert.equal(payload.token, "apns-token-1");
    assert.equal(payload.aps.alert.title, "FleetFeast delivery update");
});
test("fcm provider sender posts FCM-shaped payload", async () => {
    const requests = [];
    const sender = createFcmPushProviderSender({
        endpoint: "https://push.example/fcm",
        authToken: "fcm-auth",
        fetchImpl: async (input, init) => {
            requests.push({
                url: typeof input === "string" ? input : String(input),
                init,
            });
            return new Response("", { status: 200 });
        },
    });
    await sender.send(createMessage("fcm"));
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, "https://push.example/fcm");
    const payload = JSON.parse(String(requests[0]?.init?.body));
    assert.equal(payload.token, "fcm-token-1");
    assert.equal(payload.notification.title, "FleetFeast delivery update");
});
test("env-based notifier routes to APNs and FCM endpoints", async () => {
    const requests = [];
    const notifier = createPushFallbackNotifierFromEnv({
        APNS_PUSH_ENDPOINT: "https://push.example/apns",
        APNS_PUSH_AUTH_TOKEN: "apns-token",
        FCM_PUSH_ENDPOINT: "https://push.example/fcm",
        FCM_PUSH_AUTH_TOKEN: "fcm-token",
    }, {
        fetchImpl: async (input, init) => {
            requests.push({
                url: typeof input === "string" ? input : String(input),
                init,
            });
            return new Response("", { status: 200 });
        },
    });
    await notifier.send(createMessage("apns"));
    await notifier.send(createMessage("fcm"));
    assert.equal(requests.length, 2);
    assert.equal(requests[0]?.url, "https://push.example/apns");
    assert.equal(requests[1]?.url, "https://push.example/fcm");
});
//# sourceMappingURL=push-fallback.test.js.map